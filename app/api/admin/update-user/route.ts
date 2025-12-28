import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { checkAdmin } from '@/lib/admin';
import db from '@/lib/db';
import { formatDateSerbia } from '@/lib/timezone';

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
      if (trophiesInt !== undefined) {
        const currentRow = db
          .prepare('SELECT COALESCE(trophies, 0) as trophies FROM users WHERE id = ?')
          .get(userId) as { trophies: number } | undefined;
        const currentTrophies = currentRow?.trophies ?? 0;
        const delta = trophiesInt - currentTrophies;

        db.prepare('UPDATE users SET trophies = ? WHERE id = ?').run(trophiesInt, userId);
        if (delta !== 0) {
          db.prepare(
            'INSERT INTO trophy_transactions (user_id, upload_id, delta, reason) VALUES (?, NULL, ?, ?)'
          ).run(userId, delta, 'admin_set');
        }
      }

      const needsStreakUpdate =
        currentInt !== undefined || longestInt !== undefined || lastActivityDate !== undefined;

      if (needsStreakUpdate) {
        // Ensure streak row exists
        db.prepare('INSERT OR IGNORE INTO streaks (user_id, current_streak, longest_streak) VALUES (?, 0, 0)').run(
          userId
        );

        const existing = db
          .prepare(
            'SELECT current_streak, longest_streak, last_activity_date, admin_baseline_date, admin_baseline_streak, admin_baseline_longest FROM streaks WHERE user_id = ?'
          )
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

        // Baseline rules:
        // - If admin sets a non-zero current streak and does NOT explicitly provide last_activity_date,
        //   we treat the baseline as "as of yesterday", so the next upload becomes +1.
        // - If admin provides last_activity_date, that is the baseline date.
        // - Setting current_streak to 0 clears the baseline.
        const defaultBaselineDate = addDaysYMD(formatDateSerbia(), -1);
        const baselineDate =
          desiredCurrent > 0
            ? lastActivityDate !== undefined
              ? lastActivityDate === null
                ? null
                : (lastActivityDate as string)
              : defaultBaselineDate
            : null;

        const baselineStreak = desiredCurrent > 0 ? desiredCurrent : 0;
        const baselineLongest = desiredCurrent > 0 ? desiredLongest : 0;

        // last_activity_date defaults to baselineDate when current is set.
        const desiredLast =
          lastActivityDate !== undefined ? (lastActivityDate === null ? null : (lastActivityDate as string)) : baselineDate;

        db.prepare('UPDATE streaks SET current_streak = ?, longest_streak = ? WHERE user_id = ?').run(
          desiredCurrent,
          desiredLongest,
          userId
        );
        if (desiredLast !== undefined) {
          db.prepare('UPDATE streaks SET last_activity_date = ? WHERE user_id = ?').run(desiredLast, userId);
        }

        // Persist baseline so verify/recompute can't reset admin-set streaks to 1.
        db.prepare(
          'UPDATE streaks SET admin_baseline_date = ?, admin_baseline_streak = ?, admin_baseline_longest = ? WHERE user_id = ?'
        ).run(baselineDate, baselineStreak, baselineLongest, userId);
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


