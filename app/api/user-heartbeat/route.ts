import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import db from '@/lib/db';
import { formatDateTimeSerbia } from '@/lib/timezone';
import { runDailyRollupForUser } from '@/lib/streak-core';

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

    const rollup = runDailyRollupForUser(userId);

    return NextResponse.json({
      success: true,
      serbia_today: rollup.today,
      rollupApplied: rollup.rollupApplied,
    });
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

