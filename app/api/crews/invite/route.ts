import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { formatDateTimeSerbia } from '@/lib/timezone';

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

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Check if inviter has a crew and is the leader
    const inviterCrew = db.prepare(`
      SELECT c.id, c.leader_id, c.name
      FROM crews c
      INNER JOIN crew_members cm ON c.id = cm.crew_id
      WHERE cm.user_id = ? AND c.leader_id = ?
    `).get(decoded.userId, decoded.userId) as { id: number; leader_id: number; name: string } | undefined;

    if (!inviterCrew) {
      return NextResponse.json({ error: 'You must be a crew leader to invite members' }, { status: 403 });
    }

    // Check if target user exists and is not in a crew
    const targetUser = db.prepare(`
      SELECT u.id, u.username, cm.crew_id
      FROM users u
      LEFT JOIN crew_members cm ON u.id = cm.user_id
      WHERE u.id = ?
    `).get(userId) as { id: number; username: string; crew_id: number | null } | undefined;

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (targetUser.crew_id) {
      return NextResponse.json({ error: 'User is already in a crew' }, { status: 400 });
    }

    // Check if invite already exists
    const existingInvite = db.prepare(`
      SELECT id FROM notifications
      WHERE user_id = ? AND type = 'crew_invite' AND data LIKE ?
    `).get(targetUser.id, `%"crewId":${inviterCrew.id}%`) as { id: number } | undefined;

    if (existingInvite) {
      return NextResponse.json({ error: 'Invite already sent' }, { status: 400 });
    }

    // Create notification for crew invite
    const createdAt = formatDateTimeSerbia();
    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, data, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      targetUser.id,
      'crew_invite',
      'Crew Invite',
      `You've been invited to join ${inviterCrew.name}`,
      JSON.stringify({ crewId: inviterCrew.id, crewName: inviterCrew.name, inviterId: decoded.userId }),
      createdAt
    );

    return NextResponse.json({ success: true, message: 'Invite sent successfully' });
  } catch (error) {
    console.error('Error sending crew invite:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
