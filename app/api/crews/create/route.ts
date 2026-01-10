import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { createCrew } from '@/lib/crews';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { name } = await request.json();

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Crew name is required' }, { status: 400 });
    }

    const result = createCrew(decoded.userId, name);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    // Check for crew achievements
    try {
      const { checkAndUnlockAchievements } = require('@/lib/achievements');
      checkAndUnlockAchievements(decoded.userId, 'social');
    } catch (error) {
      console.error('[ACHIEVEMENTS] Error checking crew achievements:', error);
    }

    return NextResponse.json({ success: true, crewId: result.crewId, message: result.message });
  } catch (error) {
    console.error('Create crew error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

