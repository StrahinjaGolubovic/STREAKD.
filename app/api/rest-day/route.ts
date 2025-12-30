import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { useRestDay as applyRestDay, getOrCreateActiveChallenge } from '@/lib/challenges';
import { formatDateSerbia } from '@/lib/timezone';
import { cookies } from 'next/headers';

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

    // Server determines date - no client control
    const restDate = formatDateSerbia();

    // Get active challenge
    const challenge = getOrCreateActiveChallenge(userId);

    // Use rest day
    const result = applyRestDay(userId, challenge.id, restDate);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: result.message,
      restDaysAvailable: challenge.rest_days_available - 1 
    });
  } catch (error: any) {
    console.error('Rest day error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

