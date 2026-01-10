import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { acceptInviteCode } from '@/lib/friends';
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

    const { code } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
    }

    const result = acceptInviteCode(decoded.userId, code.toUpperCase());

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    // Check for friend achievements
    try {
      const { checkAndUnlockAchievements } = require('@/lib/achievements');
      checkAndUnlockAchievements(decoded.userId, 'social');
    } catch (error) {
      console.error('[ACHIEVEMENTS] Error checking friend achievements:', error);
    }

    return NextResponse.json({ message: result.message });
  } catch (error) {
    console.error('Accept invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

