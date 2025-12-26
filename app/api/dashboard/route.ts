import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getUserDashboard } from '@/lib/challenges';
import { cookies } from 'next/headers';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.userId;
    const dashboard = getUserDashboard(userId);
    
    // Get user username and profile picture for admin check and display
    const user = db.prepare('SELECT username, profile_picture, COALESCE(trophies, 0) as trophies FROM users WHERE id = ?').get(userId) as { username: string; profile_picture: string | null; trophies: number } | undefined;
    
    return NextResponse.json({
      ...dashboard,
      userId,
      username: user?.username,
      profilePicture: user?.profile_picture || null,
      trophies: user?.trophies ?? 0,
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    console.error('Error stack:', error?.stack);
    console.error('Error message:', error?.message);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined
    }, { status: 500 });
  }
}

