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
    
    // Get user username, profile picture, and crew info
    const user = db.prepare(`
      SELECT 
        u.username, 
        u.profile_picture, 
        COALESCE(u.trophies, 0) as trophies,
        u.crew_id,
        c.name as crew_name,
        c.tag as crew_tag,
        COALESCE(c.tag_color, '#0ea5e9') as crew_tag_color
      FROM users u
      LEFT JOIN crews c ON u.crew_id = c.id
      WHERE u.id = ?
    `).get(userId) as { 
      username: string; 
      profile_picture: string | null; 
      trophies: number;
      crew_id: number | null;
      crew_name: string | null;
      crew_tag: string | null;
      crew_tag_color: string;
    } | undefined;
    
    // Ensure rest_days_available is always present (default to 3 if missing)
    const restDaysAvailable = dashboard.challenge.rest_days_available ?? 3;
    const challenge = {
      ...dashboard.challenge,
      rest_days_available: typeof restDaysAvailable === 'number' ? restDaysAvailable : 3,
    };
    
    return NextResponse.json({
      ...dashboard,
      challenge,
      userId,
      username: user?.username,
      profilePicture: user?.profile_picture || null,
      trophies: user?.trophies ?? 0,
      crew_id: user?.crew_id || null,
      crew_name: user?.crew_name || null,
      crew_tag: user?.crew_tag || null,
      crew_tag_color: user?.crew_tag_color || '#0ea5e9',
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

