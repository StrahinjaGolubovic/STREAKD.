/**
 * streak-core.ts - Single Source of Truth for Streak Computation
 * 
 * INVARIANTS:
 * 1. current_streak is ALWAYS derived from approved uploads + rest days
 * 2. Pending uploads do NOT affect streak
 * 3. Admin baseline is a HARD FLOOR that never decays
 * 4. longest_streak only increases, never decreases
 * 5. This module has NO side effects - pure computation only
 * 6. All writes go through explicit update functions
 */

import db from './db';
import { formatDateSerbia } from './timezone';
import { applyMissedDayPenalty } from './trophy-core';

// ============================================================================
// Date Utilities (internal)
// ============================================================================

function parseYMD(dateString: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateString.split('-').map(Number);
  return { year, month, day };
}

export function addDaysYMD(dateString: string, deltaDays: number): string {
  const { year, month, day } = parseYMD(dateString);
  const dt = new Date(Date.UTC(year, month - 1, day + deltaDays));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function diffDaysYMD(a: string, b: string): number {
  const A = parseYMD(a);
  const B = parseYMD(b);
  const tA = Date.UTC(A.year, A.month - 1, A.day);
  const tB = Date.UTC(B.year, B.month - 1, B.day);
  return Math.floor((tA - tB) / (1000 * 60 * 60 * 24));
}

// ============================================================================
// Types
// ============================================================================

export interface StreakData {
  user_id: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  last_rollup_date: string | null;
  admin_baseline_date: string | null;
  admin_baseline_streak: number;
  admin_baseline_longest: number;
}

export interface ComputedStreak {
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  // Debug info for tracing
  computed_from_uploads: number;
  baseline_applied: boolean;
}

// ============================================================================
// Core Computation (PURE - no side effects)
// ============================================================================

/**
 * Compute streak from APPROVED uploads and rest days only.
 * This is the SINGLE SOURCE OF TRUTH for streak calculation.
 * 
 * Rules:
 * - Only approved uploads count (pending = invisible, rejected = invisible)
 * - Rest days count as valid activity
 * - current_streak = consecutive days ending at most recent activity
 * - If most recent activity is before yesterday, current_streak = 0
 * - Admin baseline is a HARD FLOOR - computed streak cannot go below it
 * - longest_streak = max(historical_longest, current_streak, admin_baseline_longest)
 */
export function computeStreakFromDatabase(userId: number): ComputedStreak {
  const today = formatDateSerbia();
  const yesterday = addDaysYMD(today, -1);

  // Get admin baseline (hard floor)
  const baselineRow = db
    .prepare(`
      SELECT 
        COALESCE(admin_baseline_date, NULL) as admin_baseline_date,
        COALESCE(admin_baseline_streak, 0) as admin_baseline_streak,
        COALESCE(admin_baseline_longest, 0) as admin_baseline_longest,
        COALESCE(longest_streak, 0) as longest_streak
      FROM streaks 
      WHERE user_id = ?
    `)
    .get(userId) as {
      admin_baseline_date: string | null;
      admin_baseline_streak: number;
      admin_baseline_longest: number;
      longest_streak: number;
    } | undefined;

  const adminBaselineDate = baselineRow?.admin_baseline_date ?? null;
  const adminBaselineStreak = baselineRow?.admin_baseline_streak ?? 0;
  const adminBaselineLongest = baselineRow?.admin_baseline_longest ?? 0;
  const storedLongest = baselineRow?.longest_streak ?? 0;

  // Get ALL approved uploads (NOT pending, NOT rejected)
  const approvedUploads = db
    .prepare(`
      SELECT DISTINCT upload_date
      FROM daily_uploads
      WHERE user_id = ? AND verification_status = 'approved'
      ORDER BY upload_date ASC
    `)
    .all(userId) as Array<{ upload_date: string }>;

  // Latest rejected upload date (used as a streak breaker)
  const rejectedRow = db
    .prepare(
      `
        SELECT MAX(upload_date) as max_rejected
        FROM daily_uploads
        WHERE user_id = ? AND verification_status = 'rejected'
      `
    )
    .get(userId) as { max_rejected: string | null } | undefined;
  const latestRejectedDate = rejectedRow?.max_rejected ?? null;

  // Get all rest days
  let restDays: Array<{ rest_date: string }> = [];
  try {
    restDays = db
      .prepare(`SELECT DISTINCT rest_date FROM rest_days WHERE user_id = ? ORDER BY rest_date ASC`)
      .all(userId) as Array<{ rest_date: string }>;
  } catch {
    // Table might not exist
    restDays = [];
  }

  // Combine and deduplicate all valid activity dates
  const allDates = [
    ...approvedUploads.map(r => r.upload_date),
    ...restDays.map(r => r.rest_date)
  ];
  const dates = [...new Set(allDates)].sort();

  // Compute streak from activity dates
  let computedCurrent = 0;
  let computedLongest = 0;
  let lastActivityDate: string | null = null;

  if (dates.length > 0) {
    // Find all consecutive runs and track the longest
    let currentRun = 1;
    let runStart = dates[0];
    
    for (let i = 1; i < dates.length; i++) {
      const diff = diffDaysYMD(dates[i], dates[i - 1]);
      if (diff === 1) {
        currentRun++;
      } else if (diff > 1) {
        computedLongest = Math.max(computedLongest, currentRun);
        currentRun = 1;
        runStart = dates[i];
      }
      // diff === 0 means duplicate date (shouldn't happen after dedup)
    }
    computedLongest = Math.max(computedLongest, currentRun);

    // The current streak is the run ending at the most recent date
    lastActivityDate = dates[dates.length - 1];
    
    // Walk backwards to find current consecutive run length
    let backRun = 1;
    for (let i = dates.length - 1; i > 0; i--) {
      const diff = diffDaysYMD(dates[i], dates[i - 1]);
      if (diff === 1) {
        backRun++;
      } else {
        break;
      }
    }

    // Current streak is only valid if last activity is recent (today or yesterday)
    if (lastActivityDate >= yesterday) {
      computedCurrent = backRun;
    } else {
      computedCurrent = 0;
    }
  }

  // Apply admin baseline as HARD FLOOR
  // Baseline never decays - it's the minimum the streak can be
  let finalCurrent = computedCurrent;
  let baselineApplied = false;

  if (adminBaselineStreak > 0 && adminBaselineDate) {
    // Baseline is valid. Check if we can extend it with new activity.
    // Find consecutive approved activity dates starting from baseline date + 1
    const dateSet = new Set(dates);
    let extension = 0;
    let checkDate = addDaysYMD(adminBaselineDate, 1);
    
    while (dateSet.has(checkDate)) {
      extension++;
      checkDate = addDaysYMD(checkDate, 1);
    }

    // The extended baseline end date
    const extendedBaselineEnd = addDaysYMD(adminBaselineDate, extension);
    const extendedBaselineStreak = adminBaselineStreak + extension;

    // Baseline is active if the extended end is recent
    if (extendedBaselineEnd >= yesterday) {
      // Use baseline if it's higher than computed
      if (extendedBaselineStreak > computedCurrent) {
        finalCurrent = extendedBaselineStreak;
        lastActivityDate = extendedBaselineEnd;
        baselineApplied = true;
      }
    }
    // If baseline end is too old, baseline has naturally expired
    // but we DON'T zero it out - admin can still see/edit it
  }

  // Rejected uploads break the streak immediately.
  // If the most recent *action day* is a rejected upload (today/yesterday), current_streak must be 0.
  if (latestRejectedDate && latestRejectedDate >= yesterday) {
    if (!lastActivityDate || latestRejectedDate >= lastActivityDate) {
      finalCurrent = 0;
      lastActivityDate = latestRejectedDate;
      baselineApplied = false;
    }
  }

  // longest_streak can only increase
  const finalLongest = Math.max(
    storedLongest,
    computedLongest,
    finalCurrent,
    adminBaselineLongest
  );

  return {
    current_streak: finalCurrent,
    longest_streak: finalLongest,
    last_activity_date: lastActivityDate,
    computed_from_uploads: approvedUploads.length,
    baseline_applied: baselineApplied,
  };
}

// ============================================================================
// Database Operations (explicit writes only)
// ============================================================================

/**
 * Ensure streak row exists for user.
 * Does NOT modify existing data.
 */
export function ensureStreakRowExists(userId: number): void {
  db.prepare(`
    INSERT OR IGNORE INTO streaks (user_id, current_streak, longest_streak, admin_baseline_streak, admin_baseline_longest)
    VALUES (?, 0, 0, 0, 0)
  `).run(userId);
}

/**
 * Persist computed streak values to database.
 * Called after verification or when streak needs to be updated.
 */
export function persistComputedStreak(userId: number, computed: ComputedStreak): void {
  ensureStreakRowExists(userId);
  
  db.prepare(`
    UPDATE streaks 
    SET current_streak = ?,
        longest_streak = ?,
        last_activity_date = ?
    WHERE user_id = ?
  `).run(
    computed.current_streak,
    computed.longest_streak,
    computed.last_activity_date,
    userId
  );
}

/**
 * Full recompute and persist - the ONLY way to update streak from activity.
 * Called on verification status change.
 * 
 * ALSO applies missed day penalty if streak broke.
 */
export function recomputeAndPersistStreak(userId: number): ComputedStreak {
  ensureStreakRowExists(userId);

  // Compute new streak
  const computed = computeStreakFromDatabase(userId);
  
  persistComputedStreak(userId, computed);
  return computed;
}

/**
 * Get current streak data from database (for display).
 * This is a READ-ONLY operation with NO side effects.
 */
export function getStreakData(userId: number): StreakData {
  ensureStreakRowExists(userId);
  
  const row = db
    .prepare(`
      SELECT 
        user_id,
        COALESCE(current_streak, 0) as current_streak,
        COALESCE(longest_streak, 0) as longest_streak,
        last_activity_date,
        last_rollup_date,
        admin_baseline_date,
        COALESCE(admin_baseline_streak, 0) as admin_baseline_streak,
        COALESCE(admin_baseline_longest, 0) as admin_baseline_longest
      FROM streaks 
      WHERE user_id = ?
    `)
    .get(userId) as StreakData;

  return row;
}

export function runDailyRollupForUser(userId: number): { rollupApplied: boolean; today: string } {
  ensureStreakRowExists(userId);

  const today = formatDateSerbia();
  const yesterday = addDaysYMD(today, -1);

  const row = db
    .prepare(
      `
        SELECT
          last_activity_date,
          last_rollup_date
        FROM streaks
        WHERE user_id = ?
      `
    )
    .get(userId) as { last_activity_date: string | null; last_rollup_date: string | null } | undefined;

  const lastActivity = row?.last_activity_date ?? null;
  const lastRollup = row?.last_rollup_date ?? null;

  if (lastRollup === today) {
    return { rollupApplied: false, today };
  }

  // Determine where to start scanning for missed days.
  // If we already rolled up before, continue from there; otherwise start from last activity.
  const base = lastRollup ? addDaysYMD(lastRollup, -1) : lastActivity;

  db.exec('SAVEPOINT daily_rollup');
  try {
    if (base && base < yesterday) {
      let d = addDaysYMD(base, 1);
      while (d <= yesterday) {
        // CRITICAL: Only count APPROVED uploads (not pending or rejected)
        // Pending/rejected uploads should NOT prevent missed day penalties
        const hasApprovedUpload = !!db
          .prepare('SELECT 1 FROM daily_uploads WHERE user_id = ? AND upload_date = ? AND verification_status = ? LIMIT 1')
          .get(userId, d, 'approved');

        let hasRest = false;
        try {
          hasRest = !!db
            .prepare('SELECT 1 FROM rest_days WHERE user_id = ? AND rest_date = ? LIMIT 1')
            .get(userId, d);
        } catch {
          hasRest = false;
        }

        if (!hasApprovedUpload && !hasRest) {
          applyMissedDayPenalty(userId, d);
        }

        d = addDaysYMD(d, 1);
      }
    }

    // Persist streak state so admin views and other queries stay in sync after midnight.
    const computed = computeStreakFromDatabase(userId);
    persistComputedStreak(userId, computed);

    db.prepare('UPDATE streaks SET last_rollup_date = ? WHERE user_id = ?').run(today, userId);
    db.exec('RELEASE daily_rollup');
    return { rollupApplied: true, today };
  } catch (e) {
    try {
      db.exec('ROLLBACK TO daily_rollup');
      db.exec('RELEASE daily_rollup');
    } catch {
      /* ignore */
    }
    throw e;
  }
}

/**
 * Get computed streak for display (pure computation, no persistence).
 * Use this for dashboard display to ensure consistency.
 */
export function getComputedStreakForDisplay(userId: number): ComputedStreak {
  ensureStreakRowExists(userId);
  return computeStreakFromDatabase(userId);
}

// ============================================================================
// Admin Operations
// ============================================================================

/**
 * Set admin baseline - creates a hard floor for the streak.
 * 
 * Rules:
 * - baseline_streak is the minimum current_streak can be
 * - baseline_longest is the minimum longest_streak can be
 * - baseline_date is when the baseline was set (used for extension calculation)
 * - Setting baseline to 0 clears it
 */
export function setAdminBaseline(
  userId: number,
  baselineStreak: number,
  baselineDate: string | null,
  baselineLongest?: number
): void {
  ensureStreakRowExists(userId);

  const effectiveLongest = baselineLongest ?? baselineStreak;
  const today = formatDateSerbia();
  
  db.prepare(`
    UPDATE streaks
    SET admin_baseline_streak = ?,
        admin_baseline_date = ?,
        admin_baseline_longest = ?,
        current_streak = ?,
        longest_streak = ?,
        last_activity_date = ?,
        last_rollup_date = ?
    WHERE user_id = ?
  `).run(
    baselineStreak,
    baselineDate,
    effectiveLongest,
    baselineStreak,
    effectiveLongest,
    baselineDate,
    today,
    userId
  );

  // Note: We don't call recomputeAndPersistStreak here to avoid circular issues
  // The baseline is now set and will be respected in future recomputes
}

/**
 * Clear admin baseline for a user.
 */
export function clearAdminBaseline(userId: number): void {
  setAdminBaseline(userId, 0, null, 0);
}
