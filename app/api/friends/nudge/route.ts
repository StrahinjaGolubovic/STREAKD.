import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getUserById } from '@/lib/auth';
import { sendNudgeNotification } from '@/lib/notifications';
import { formatDateSerbia } from '@/lib/timezone';
import db from '@/lib/db';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
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
    const user = getUserById(userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { friend_id } = await request.json();

    if (!friend_id || typeof friend_id !== 'number') {
      return NextResponse.json({ error: 'friend_id is required' }, { status: 400 });
    }

    // Check if users are friends
    const friendship = db
      .prepare(
        'SELECT * FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)'
      )
      .get(userId, friend_id, friend_id, userId) as { id: number } | undefined;

    if (!friendship) {
      return NextResponse.json({ error: 'You are not friends with this user' }, { status: 403 });
    }

    // Check if friend exists
    const friend = getUserById(friend_id);
    if (!friend) {
      return NextResponse.json({ error: 'Friend not found' }, { status: 404 });
    }

    // Check if user has already nudged this friend today (Serbia timezone)
    const today = formatDateSerbia(); // Returns YYYY-MM-DD in Serbia timezone
    const existingNudge = db
      .prepare(
        'SELECT id FROM nudges WHERE from_user_id = ? AND to_user_id = ? AND nudge_date = ?'
      )
      .get(userId, friend_id, today) as { id: number } | undefined;

    if (existingNudge) {
      return NextResponse.json(
        { error: 'You can only nudge this friend once per day' },
        { status: 429 }
      );
    }

    // Record the nudge with server timestamp
    try {
      const { formatDateTimeSerbia } = require('@/lib/timezone');
      const createdAt = formatDateTimeSerbia();
      db.prepare(
        'INSERT INTO nudges (from_user_id, to_user_id, nudge_date, created_at) VALUES (?, ?, ?, ?)'
      ).run(userId, friend_id, today, createdAt);
    } catch (insertError: any) {
      // If it's a unique constraint error, someone else inserted it (race condition)
      // Check again to be sure
      const checkAgain = db
        .prepare(
          'SELECT id FROM nudges WHERE from_user_id = ? AND to_user_id = ? AND nudge_date = ?'
        )
        .get(userId, friend_id, today) as { id: number } | undefined;

      if (checkAgain) {
        return NextResponse.json(
          { error: 'You can only nudge this friend once per day' },
          { status: 429 }
        );
      }
      // If it's a different error, rethrow
      throw insertError;
    }

    // Send nudge notification
    const notification = sendNudgeNotification(userId, user.username, friend_id);

    // Check for nudge achievements
    try {
      const { checkAndUnlockAchievements } = require('@/lib/achievements');
      checkAndUnlockAchievements(userId, 'social');
    } catch (error) {
      console.error('[ACHIEVEMENTS] Error checking nudge achievements:', error);
    }

    return NextResponse.json({ success: true, notification, nudged_today: true });
  } catch (error: any) {
    console.error('Nudge friend error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

