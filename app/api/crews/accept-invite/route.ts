import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { notificationId } = await request.json();

    if (!notificationId) {
      return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 });
    }

    // Get the notification
    const notification = db.prepare(`
      SELECT id, user_id, data
      FROM notifications
      WHERE id = ? AND user_id = ? AND type = 'crew_invite'
    `).get(notificationId, decoded.userId) as { id: number; user_id: number; data: string } | undefined;

    if (!notification) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    const data = JSON.parse(notification.data);
    const crewId = data.crewId;

    // Check if user is already in a crew
    const existingMembership = db.prepare(`
      SELECT crew_id FROM crew_members WHERE user_id = ?
    `).get(decoded.userId) as { crew_id: number } | undefined;

    if (existingMembership) {
      // Delete the notification
      db.prepare('DELETE FROM notifications WHERE id = ?').run(notificationId);
      return NextResponse.json({ error: 'You are already in a crew' }, { status: 400 });
    }

    // Check if crew still exists and has space
    const crew = db.prepare(`
      SELECT id, name, (SELECT COUNT(*) FROM crew_members WHERE crew_id = ?) as member_count
      FROM crews
      WHERE id = ?
    `).get(crewId, crewId) as { id: number; name: string; member_count: number } | undefined;

    if (!crew) {
      // Delete the notification
      db.prepare('DELETE FROM notifications WHERE id = ?').run(notificationId);
      return NextResponse.json({ error: 'Crew no longer exists' }, { status: 404 });
    }

    if (crew.member_count >= 30) {
      // Delete the notification
      db.prepare('DELETE FROM notifications WHERE id = ?').run(notificationId);
      return NextResponse.json({ error: 'Crew is full' }, { status: 400 });
    }

    // Add user to crew
    db.prepare(`
      INSERT INTO crew_members (crew_id, user_id, joined_at)
      VALUES (?, ?, datetime('now'))
    `).run(crewId, decoded.userId);

    // Update user's crew_id
    db.prepare('UPDATE users SET crew_id = ? WHERE id = ?').run(crewId, decoded.userId);

    // Delete the notification
    db.prepare('DELETE FROM notifications WHERE id = ?').run(notificationId);

    // Check for crew achievements
    try {
      const { checkAndUnlockAchievements } = require('@/lib/achievements');
      checkAndUnlockAchievements(decoded.userId, 'social');
    } catch (error) {
      console.error('[ACHIEVEMENTS] Error checking crew achievements:', error);
    }

    return NextResponse.json({ success: true, message: `You joined ${crew.name}!` });
  } catch (error) {
    console.error('Error accepting crew invite:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
