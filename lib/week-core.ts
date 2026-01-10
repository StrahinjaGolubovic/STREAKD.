/**
 * week-core.ts - Single Source of Truth for Weekly Challenge Management
 * 
 * INVARIANTS:
 * 1. Weekly status transitions: active → pending_evaluation → completed/failed
 * 2. Week is NOT finalized until all uploads are verified (no pending)
 * 3. completed_days only counts APPROVED uploads + rest days
 * 4. Weekly bonus only awarded when status transitions to completed with 7/7
 * 5. Bonus can be revoked if uploads are later rejected
 */

import db from './db';
import { formatDateSerbia, formatDateTimeSerbia } from './timezone';
import { addDaysYMD, diffDaysYMD } from './streak-core';
import { syncWeeklyBonus, challengeQualifiesForBonus } from './trophy-core';
import { logWarning } from './logger';
import { getPremiumRestDayLimit } from './premium';

// ============================================================================
// Types
// ============================================================================

export type ChallengeStatus = 'active' | 'pending_evaluation' | 'completed' | 'failed';

export interface WeeklyChallenge {
  id: number;
  user_id: number;
  start_date: string;
  end_date: string;
  status: ChallengeStatus;
  completed_days: number;
  rest_days_available: number;
  created_at: string;
}

export interface ChallengeProgress {
  totalDays: number;
  completedDays: number;       // approved + rest days
  pendingDays: number;         // pending uploads
  rejectedDays: number;        // rejected uploads
  days: Array<{
    date: string;
    uploaded: boolean;
    photo_path?: string;
    verification_status?: 'pending' | 'approved' | 'rejected';
    is_rest_day?: boolean;
  }>;
}

// ============================================================================
// Week Calculation
// ============================================================================

/**
 * Get the start of the current week based on user registration date.
 * Weeks are 7-day cycles starting from registration.
 */
export function getWeekStartForUser(registrationDate: string, currentDate?: string): string {
  const currentDateStr = currentDate ?? formatDateSerbia();
  const daysSinceReg = diffDaysYMD(currentDateStr, registrationDate);
  const weekNumber = Math.floor(daysSinceReg / 7);
  return addDaysYMD(registrationDate, weekNumber * 7);
}

/**
 * Get the end of the week (6 days after start).
 */
export function getWeekEndForUser(weekStart: string): string {
  return addDaysYMD(weekStart, 6);
}

// ============================================================================
// Challenge Progress (PURE computation)
// ============================================================================

/**
 * Compute challenge progress from database.
 * This is a READ-ONLY operation.
 */
export function computeChallengeProgress(challengeId: number): ChallengeProgress {
  const challenge = db
    .prepare('SELECT * FROM weekly_challenges WHERE id = ?')
    .get(challengeId) as WeeklyChallenge | undefined;

  if (!challenge) {
    return {
      totalDays: 7,
      completedDays: 0,
      pendingDays: 0,
      rejectedDays: 0,
      days: [],
    };
  }

  // Get all uploads for this challenge
  const uploads = db
    .prepare(`
      SELECT upload_date, photo_path, verification_status 
      FROM daily_uploads 
      WHERE challenge_id = ?
    `)
    .all(challengeId) as Array<{
      upload_date: string;
      photo_path: string;
      verification_status: 'pending' | 'approved' | 'rejected';
    }>;

  const uploadMap = new Map(
    uploads.map(u => [u.upload_date, { path: u.photo_path, status: u.verification_status }])
  );

  // Get rest days
  let restDays: Array<{ rest_date: string }> = [];
  try {
    restDays = db
      .prepare('SELECT rest_date FROM rest_days WHERE challenge_id = ?')
      .all(challengeId) as Array<{ rest_date: string }>;
  } catch { /* table might not exist */ }

  const restDaySet = new Set(restDays.map(r => r.rest_date));

  // Build day-by-day progress
  const days: ChallengeProgress['days'] = [];
  let completedDays = 0;
  let pendingDays = 0;
  let rejectedDays = 0;

  for (let i = 0; i < 7; i++) {
    const dateStr = addDaysYMD(challenge.start_date, i);
    const upload = uploadMap.get(dateStr);
    const isRestDay = restDaySet.has(dateStr);

    days.push({
      date: dateStr,
      uploaded: !!upload,
      photo_path: upload?.path,
      verification_status: upload?.status,
      is_rest_day: isRestDay,
    });

    // Count by category
    if (upload) {
      if (upload.status === 'approved') {
        completedDays++;
      } else if (upload.status === 'pending') {
        pendingDays++;
      } else if (upload.status === 'rejected') {
        rejectedDays++;
      }
    }

    // Rest days always count as completed (if no upload on that day)
    if (isRestDay && !upload) {
      completedDays++;
    }
  }

  return {
    totalDays: 7,
    completedDays,
    pendingDays,
    rejectedDays,
    days,
  };
}

// ============================================================================
// Challenge Evaluation
// ============================================================================

/**
 * Evaluate and potentially finalize a challenge.
 * 
 * Rules:
 * - If any uploads are pending, status becomes 'pending_evaluation'
 * - If no pending uploads and approved+rest >= 5, status is 'completed'
 * - If no pending uploads and approved+rest < 5, status is 'failed'
 * - Weekly bonus is synced (awarded or revoked) based on final state
 */
export function evaluateChallenge(challengeId: number): {
  status: ChallengeStatus;
  completedDays: number;
  bonusAwarded: boolean;
} {
  const challenge = db
    .prepare('SELECT * FROM weekly_challenges WHERE id = ?')
    .get(challengeId) as WeeklyChallenge | undefined;

  if (!challenge) {
    return { status: 'failed', completedDays: 0, bonusAwarded: false };
  }

  const progress = computeChallengeProgress(challengeId);

  let newStatus: ChallengeStatus;

  if (progress.pendingDays > 0) {
    // Can't finalize yet - still have pending uploads
    newStatus = 'pending_evaluation';
  } else if (progress.completedDays >= 5) {
    newStatus = 'completed';
  } else {
    newStatus = 'failed';
  }

  // Update challenge in database
  db.prepare(`
    UPDATE weekly_challenges 
    SET status = ?, completed_days = ?
    WHERE id = ?
  `).run(newStatus, progress.completedDays, challengeId);

  // Sync weekly bonus (idempotent - will award or revoke as needed)
  let bonusAwarded = false;
  if (newStatus === 'completed' || newStatus === 'failed') {
    syncWeeklyBonus(challenge.user_id, challengeId);
    const check = challengeQualifiesForBonus(challengeId);
    bonusAwarded = check.qualifies;
  }

  return {
    status: newStatus,
    completedDays: progress.completedDays,
    bonusAwarded,
  };
}

export function evaluateChallengeNoBonus(challengeId: number): {
  status: ChallengeStatus;
  completedDays: number;
} {
  const challenge = db
    .prepare('SELECT * FROM weekly_challenges WHERE id = ?')
    .get(challengeId) as WeeklyChallenge | undefined;

  if (!challenge) {
    return { status: 'failed', completedDays: 0 };
  }

  const progress = computeChallengeProgress(challengeId);

  let newStatus: ChallengeStatus;

  if (progress.pendingDays > 0) {
    newStatus = 'pending_evaluation';
  } else if (progress.completedDays >= 5) {
    newStatus = 'completed';
  } else {
    newStatus = 'failed';
  }

  db.prepare(`
    UPDATE weekly_challenges 
    SET status = ?, completed_days = ?
    WHERE id = ?
  `).run(newStatus, progress.completedDays, challengeId);

  return {
    status: newStatus,
    completedDays: progress.completedDays,
  };
}

/**
 * Re-evaluate a challenge after verification changes.
 * This may change status from completed to failed or vice versa.
 */
export function reevaluateChallengeAfterVerification(challengeId: number): void {
  const challenge = db
    .prepare('SELECT * FROM weekly_challenges WHERE id = ?')
    .get(challengeId) as WeeklyChallenge | undefined;

  if (!challenge) return;

  // Only re-evaluate non-active challenges
  if (challenge.status === 'active') return;

  evaluateChallengeNoBonus(challengeId);
}

// ============================================================================
// Week Rollover
// ============================================================================

/**
 * Handle week rollover - close previous week and create new one.
 * 
 * IMPORTANT: This does NOT award bonuses for weeks with pending uploads.
 * Bonuses are awarded when uploads are verified.
 */
export function handleWeekRollover(
  userId: number,
  previousChallenge: WeeklyChallenge | null,
  newWeekStart: string,
  newWeekEnd: string
): WeeklyChallenge {
  // Evaluate previous challenge if exists
  if (previousChallenge) {
    evaluateChallengeNoBonus(previousChallenge.id);
  }

  // Create new challenge with premium-aware rest days
  const createdAt = formatDateTimeSerbia();
  const restDayLimit = getPremiumRestDayLimit(userId); // 5 for premium, 3 for regular

  let result;
  try {
    result = db
      .prepare(`
        INSERT INTO weekly_challenges 
        (user_id, start_date, end_date, status, rest_days_available, created_at)
        VALUES (?, ?, ?, 'active', ?, ?)
      `)
      .run(userId, newWeekStart, newWeekEnd, restDayLimit, createdAt);
  } catch {
    // Fallback without rest_days_available column
    result = db
      .prepare(`
        INSERT INTO weekly_challenges 
        (user_id, start_date, end_date, status, created_at)
        VALUES (?, ?, ?, 'active', ?)
      `)
      .run(userId, newWeekStart, newWeekEnd, createdAt);
  }

  const newChallenge = db
    .prepare('SELECT * FROM weekly_challenges WHERE id = ?')
    .get(result.lastInsertRowid) as WeeklyChallenge;

  // Ensure rest_days_available exists
  return {
    ...newChallenge,
    rest_days_available: newChallenge.rest_days_available ?? restDayLimit,
  };
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Get or create active challenge for user.
 * 
 * CHANGES FROM OLD IMPLEMENTATION:
 * - NO bonus awards during rollover for weeks with pending uploads
 * - NO streak updates (streak is recomputed separately)
 * - Purge is handled separately (not fire-and-forget)
 */
export function getOrCreateActiveChallenge(userId: number): WeeklyChallenge {
  // Get user registration date
  const user = db
    .prepare('SELECT created_at FROM users WHERE id = ?')
    .get(userId) as { created_at: string } | undefined;

  if (!user) {
    throw new Error('User not found');
  }

  const registrationDate = user.created_at;
  const weekStart = getWeekStartForUser(registrationDate);
  const weekEnd = getWeekEndForUser(weekStart);

  // Check for existing active challenge for this week
  let challenge = db
    .prepare(`
      SELECT *, COALESCE(rest_days_available, 3) as rest_days_available
      FROM weekly_challenges 
      WHERE user_id = ? AND start_date = ? AND status = 'active'
    `)
    .get(userId, weekStart) as WeeklyChallenge | undefined;

  if (challenge) {
    return challenge;
  }

  // Check for any previous active challenge (from old week)
  const previousChallenge = db
    .prepare(`
      SELECT *, COALESCE(rest_days_available, 3) as rest_days_available
      FROM weekly_challenges 
      WHERE user_id = ? AND status = 'active'
      ORDER BY start_date DESC 
      LIMIT 1
    `)
    .get(userId) as WeeklyChallenge | undefined;

  // Handle week rollover and create new challenge
  challenge = handleWeekRollover(userId, previousChallenge ?? null, weekStart, weekEnd);

  return challenge;
}

/**
 * Get challenge progress for display.
 * This is a READ-ONLY wrapper.
 */
export function getChallengeProgress(challengeId: number): ChallengeProgress {
  return computeChallengeProgress(challengeId);
}
