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

    // Verify the notification belongs to the user
    const notification = db.prepare(`
      SELECT id FROM notifications
      WHERE id = ? AND user_id = ? AND type = 'crew_invite'
    `).get(notificationId, decoded.userId) as { id: number } | undefined;

    if (!notification) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    // Delete the notification
    db.prepare('DELETE FROM notifications WHERE id = ?').run(notificationId);

    return NextResponse.json({ success: true, message: 'Invite rejected' });
  } catch (error) {
    console.error('Error rejecting crew invite:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
