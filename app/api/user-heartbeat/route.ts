import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import db from '@/lib/db';
import { formatDateTimeSerbia } from '@/lib/timezone';
import { getUserStreak } from '@/lib/challenges';

export async function POST(request: NextRequest) {
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
    const now = formatDateTimeSerbia();

    // Update or insert user's last activity timestamp
    // Upsert user activity (SQLite doesn't support ON CONFLICT, so we use REPLACE)
    db.prepare(
      `INSERT OR REPLACE INTO user_activity (user_id, last_seen) 
       VALUES (?, ?)`
    ).run(userId, now);

    // Also apply streak "missed day" decay on regular activity so it self-corrects after midnight (Serbia time).
    getUserStreak(userId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Heartbeat error:', error);
    console.error('Error stack:', error?.stack);
    console.error('Error message:', error?.message);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined
    }, { status: 500 });
  }
}

