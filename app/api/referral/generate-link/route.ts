import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
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

    // Get or create invite code for this user
    let inviteCode = db
      .prepare('SELECT code FROM invite_codes WHERE user_id = ? LIMIT 1')
      .get(userId) as { code: string } | undefined;

    if (!inviteCode) {
      // Generate a unique invite code
      const code = generateInviteCode();
      db.prepare('INSERT INTO invite_codes (user_id, code) VALUES (?, ?)').run(userId, code);
      inviteCode = { code };
    }

    // Generate the full invite link
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://streakd.com';
    const inviteLink = `${baseUrl}/register?ref=${inviteCode.code}`;

    return NextResponse.json({
      inviteCode: inviteCode.code,
      inviteLink,
    });
  } catch (error: any) {
    console.error('Generate invite link error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
