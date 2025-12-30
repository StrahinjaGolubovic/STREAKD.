import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getUserCrew, clearExpiredCrewTags } from '@/lib/crews';
import { cookies } from 'next/headers';

// Track last cleanup time to avoid running on every request
let lastCleanup = 0;
const CLEANUP_INTERVAL = 60 * 60 * 1000; // Run cleanup every 1 hour

export async function GET(request: NextRequest) {
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

    // Automatically clear expired crew tags (throttled to once per hour)
    const now = Date.now();
    if (now - lastCleanup > CLEANUP_INTERVAL) {
      try {
        clearExpiredCrewTags();
        lastCleanup = now;
      } catch (error) {
        // Don't fail the request if cleanup fails
        console.error('Auto-cleanup error:', error);
      }
    }

    const crew = getUserCrew(decoded.userId);

    return NextResponse.json({ crew });
  } catch (error) {
    console.error('Get my crew error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

