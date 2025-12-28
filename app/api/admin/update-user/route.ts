import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { checkAdmin } from '@/lib/admin';
import db from '@/lib/db';
import { formatDateSerbia } from '@/lib/timezone';

function isValidYMD(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
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
    const lastActivityDate = body.last_activity_date;

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

    if (
      lastActivityDate !== undefined &&
      lastActivityDate !== null &&
      lastActivityDate !== '' &&
      !isValidYMD(lastActivityDate)
    ) {
      return NextResponse.json({ error: 'last_activity_date must be YYYY-MM-DD (or empty)' }, { status: 400 });
    }

    // Ensure user exists
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId) as { id: number } | undefined;
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // `@/lib/db` is a thin wrapper, so we use explicit BEGIN/COMMIT for atomic updates.
    db.exec('BEGIN');
    try {
      if (trophiesInt !== undefined) {
        db.prepare('UPDATE users SET trophies = ? WHERE id = ?').run(trophiesInt, userId);
      }

      const needsStreakUpdate =
        currentInt !== undefined || longestInt !== undefined || lastActivityDate !== undefined;

      if (needsStreakUpdate) {
        // Ensure streak row exists
        db.prepare('INSERT OR IGNORE INTO streaks (user_id, current_streak, longest_streak) VALUES (?, 0, 0)').run(
          userId
        );

        const existing = db
          .prepare('SELECT current_streak, longest_streak, last_activity_date FROM streaks WHERE user_id = ?')
          .get(userId) as { current_streak: number; longest_streak: number; last_activity_date: string | null };

        const desiredCurrent = currentInt !== undefined ? currentInt : (existing?.current_streak ?? 0);
        let desiredLongest = longestInt !== undefined ? longestInt : (existing?.longest_streak ?? 0);

        // Invariant: longest_streak must always be >= current_streak
        if (desiredCurrent > desiredLongest) desiredLongest = desiredCurrent;

        // last_activity_date rules:
        // - if explicitly provided, respect it ('' means null)
        // - else if admin changes current streak:
        //   - current > 0 -> set last_activity_date to today (Serbia) to prevent auto-reset
        //   - current == 0 -> clear last_activity_date (unless explicitly provided)
        let desiredLast: string | null | undefined = undefined;
        if (lastActivityDate !== undefined) {
          desiredLast = lastActivityDate === '' || lastActivityDate === null ? null : (lastActivityDate as string);
        } else if (currentInt !== undefined) {
          desiredLast = desiredCurrent > 0 ? formatDateSerbia() : null;
        }

        db.prepare('UPDATE streaks SET current_streak = ?, longest_streak = ? WHERE user_id = ?').run(
          desiredCurrent,
          desiredLongest,
          userId
        );
        if (desiredLast !== undefined) {
          db.prepare('UPDATE streaks SET last_activity_date = ? WHERE user_id = ?').run(desiredLast, userId);
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


