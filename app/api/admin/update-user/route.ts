import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { checkAdmin } from '@/lib/admin';
import db from '@/lib/db';
import { formatDateSerbia } from '@/lib/timezone';
import { setAdminBaseline, recomputeAndPersistStreak, ensureStreakRowExists } from '@/lib/streak-core';
import { adminSetTrophies } from '@/lib/trophy-core';

function isValidYMD(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDaysYMD(dateString: string, deltaDays: number): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day + deltaDays));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    const adminCheck = await checkAdmin(token);
    if (!adminCheck.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const userId = Number(body.userId);

    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: 'Valid userId is required' }, { status: 400 });
    }

    const trophies = body.trophies;
    const currentStreak = body.current_streak;
    const longestStreak = body.longest_streak;
    // Treat empty string as "not provided" (admin UI often submits empty)
    // To clear last_activity_date explicitly, send null.
    const lastActivityDate =
      body.last_activity_date === '' ? undefined : (body.last_activity_date as unknown);

    // Validate numeric fields if present
    const parseNonNegativeInt = (v: unknown) => {
      if (v === undefined || v === null || v === '') return undefined;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null;
      return n;
    };

    const trophiesInt = parseNonNegativeInt(trophies);
    const currentInt = parseNonNegativeInt(currentStreak);
    const longestInt = parseNonNegativeInt(longestStreak);

    if (trophiesInt === null || currentInt === null || longestInt === null) {
      return NextResponse.json({ error: 'Trophies/streak values must be non-negative integers' }, { status: 400 });
    }

    if (lastActivityDate !== undefined && lastActivityDate !== null && !isValidYMD(lastActivityDate)) {
      return NextResponse.json({ error: 'last_activity_date must be YYYY-MM-DD (or null)' }, { status: 400 });
    }

    // Ensure user exists
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId) as { id: number } | undefined;
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // `@/lib/db` is a thin wrapper, so we use explicit BEGIN/COMMIT for atomic updates.
    db.exec('BEGIN');
    try {
      // Handle trophy update via unified trophy system
      if (trophiesInt !== undefined) {
        adminSetTrophies(userId, trophiesInt);
      }

      // Handle streak update via unified streak system
      const needsStreakUpdate =
        currentInt !== undefined || longestInt !== undefined || lastActivityDate !== undefined;

      if (needsStreakUpdate) {
        ensureStreakRowExists(userId);

        const existing = db
          .prepare(`
            SELECT current_streak, longest_streak, last_activity_date, 
                   admin_baseline_date, admin_baseline_streak, admin_baseline_longest 
            FROM streaks WHERE user_id = ?`)
          .get(userId) as {
            current_streak: number;
            longest_streak: number;
            last_activity_date: string | null;
            admin_baseline_date: string | null;
            admin_baseline_streak: number | null;
            admin_baseline_longest: number | null;
          };

        const desiredCurrent = currentInt !== undefined ? currentInt : (existing?.current_streak ?? 0);
        let desiredLongest = longestInt !== undefined ? longestInt : (existing?.longest_streak ?? 0);

        // Invariant: longest_streak must always be >= current_streak
        if (desiredCurrent > desiredLongest) desiredLongest = desiredCurrent;

        // NEW BASELINE LOGIC:
        // - Admin baseline is a HARD FLOOR that does NOT decay
        // - If admin sets current_streak > 0, set baseline to that value
        // - baseline_date defaults to TODAY (streak is current as of today)
        // - Setting current_streak to 0 clears the baseline
        const defaultBaselineDate = formatDateSerbia(); // TODAY, not yesterday
        const baselineDate =
          desiredCurrent > 0
            ? lastActivityDate !== undefined && lastActivityDate !== null
              ? (lastActivityDate as string)
              : defaultBaselineDate
            : null;

        // Use the new setAdminBaseline which properly handles the hard floor
        if (desiredCurrent > 0) {
          setAdminBaseline(userId, desiredCurrent, baselineDate, desiredLongest);
        } else {
          // Clear baseline and let recompute determine streak from uploads
          setAdminBaseline(userId, 0, null, 0);
        }

        // If admin explicitly set last_activity_date, update it directly
        if (lastActivityDate !== undefined) {
          db.prepare('UPDATE streaks SET last_activity_date = ? WHERE user_id = ?')
            .run(lastActivityDate, userId);
        }
      }

      db.exec('COMMIT');
    } catch (e) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // ignore rollback errors
      }
      throw e;
    }

    // Return the resulting values so the admin UI can stay consistent.
    const updated = db
      .prepare(
        `SELECT 
          u.id,
          COALESCE(u.trophies, 0) as trophies,
          COALESCE(s.current_streak, 0) as current_streak,
          COALESCE(s.longest_streak, 0) as longest_streak,
          s.last_activity_date as last_activity_date
         FROM users u
         LEFT JOIN streaks s ON u.id = s.user_id
         WHERE u.id = ?`
      )
      .get(userId);

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    console.error('Admin update user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


