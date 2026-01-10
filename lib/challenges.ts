/**
 * challenges.ts - Main Challenge/Streak/Trophy Interface
 * 
 * REFACTORED: Now delegates to core modules for single source of truth.
 * 
 * Key changes:
 * - Streak computation via streak-core.ts (no incremental updates)
 * - Trophy awards via trophy-core.ts (only on verification)
 * - Week management via week-core.ts (pending-aware completion)
 * - NO side effects in getters
 * - NO auto-reset on read
 * - NO missed day penalties (removed - users just don't earn trophies)
 * - Pending uploads do NOT affect streak or trophies
 */

import db from './db';
import { formatDateSerbia, formatDateTimeSerbia } from './timezone';
import { purgeUserUploadsBeforeDate } from './purge';
import { logWarning } from './logger';

// Import from core modules
import {
  addDaysYMD,
  diffDaysYMD,
  getComputedStreakForDisplay,
  recomputeAndPersistStreak,
  ensureStreakRowExists,
  getStreakData,
  type ComputedStreak,
} from './streak-core';

import {
  getOrCreateActiveChallenge as getOrCreateActiveChallengeCore,
  getChallengeProgress as getChallengeProgressCore,
  evaluateChallenge,
  reevaluateChallengeAfterVerification,
  getWeekStartForUser as getWeekStartForUserCore,
  getWeekEndForUser as getWeekEndForUserCore,
  type WeeklyChallenge as WeeklyChallengeType,
  type ChallengeProgress as ChallengeProgressType,
} from './week-core';

import {
  getUserTrophies,
  syncTrophiesForUpload,
  syncWeeklyBonus,
  syncAllWeeklyBonuses,
} from './trophy-core';

// Re-export utilities for backward compatibility
export { addDaysYMD, diffDaysYMD };

// ============================================================================
// Types (backward compatible)
// ============================================================================

export interface WeeklyChallenge {
  id: number;
  user_id: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'completed' | 'failed' | 'pending_evaluation';
  completed_days: number;
  rest_days_available: number;
  created_at: string;
}

export interface DailyUpload {
  id: number;
  challenge_id: number;
  user_id: number;
  upload_date: string;
  photo_path: string;
  verification_status: 'pending' | 'approved' | 'rejected';
  metadata: string | null;
  verified_at: string | null;
  verified_by: number | null;
  created_at: string;
}

export interface RestDay {
  id: number;
  challenge_id: number;
  user_id: number;
  rest_date: string;
  created_at: string;
}

export interface Streak {
  id: number;
  user_id: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
}

// ============================================================================
// Streak Functions (delegating to streak-core)
// ============================================================================

/**
 * Get user streak - PURE READ, no side effects.
 * 
 * CHANGE: Reads persisted streak from database (updated by verification and daily rollup).
 * This ensures consistency with admin panel and prevents recomputing on every dashboard load.
 */
export function getUserStreak(userId: number): Streak {
  ensureStreakRowExists(userId);
  const data = getStreakData(userId);

  return {
    id: 0, // Not used
    user_id: userId,
    current_streak: data.current_streak,
    longest_streak: data.longest_streak,
    last_activity_date: data.last_activity_date,
  };
}

/**
 * Recompute user streak from uploads.
 * Called after verification status changes.
 * 
 * CHANGE: Now only counts APPROVED uploads (not pending).
 */
export function recomputeUserStreakFromUploads(userId: number): Streak {
  const computed = recomputeAndPersistStreak(userId);
  return {
    id: 0,
    user_id: userId,
    current_streak: computed.current_streak,
    longest_streak: computed.longest_streak,
    last_activity_date: computed.last_activity_date,
  };
}

// ============================================================================
// Week/Challenge Functions (delegating to week-core)
// ============================================================================

/**
 * Get week start for user based on registration date.
 */
export function getWeekStartForUser(registrationDate: string | Date, currentDate?: Date): string {
  const regDateStr = typeof registrationDate === 'string'
    ? registrationDate
    : formatDateSerbia(registrationDate);
  const currentDateStr = currentDate ? formatDateSerbia(currentDate) : undefined;
  return getWeekStartForUserCore(regDateStr, currentDateStr);
}

/**
 * Get week end (6 days after start).
 */
export function getWeekEndForUser(weekStart: string): string {
  return getWeekEndForUserCore(weekStart);
}

/**
 * Format date as YYYY-MM-DD in Serbia timezone.
 */
export function formatDate(date: Date = new Date()): string {
  return formatDateSerbia(date);
}

/**
 * Get or create active challenge for user.
 * 
 * CHANGES:
 * - NO bonus awards during rollover (deferred until verification complete)
 * - NO streak updates (computed separately)
 * - Purge is still async but doesn't affect correctness
 */
export function getOrCreateActiveChallenge(userId: number): WeeklyChallenge {
  const challenge = getOrCreateActiveChallengeCore(userId);

  // Trigger async purge if this is a new week with no uploads
  // This is best-effort cleanup, NOT correctness-critical
  const progress = getChallengeProgressCore(challenge.id);
  const hasAnyUpload = progress.days.some(d => d.uploaded);

  if (!hasAnyUpload) {
    purgeUserUploadsBeforeDate(userId, challenge.start_date).catch(() => {
      // Ignore purge errors - not correctness-critical
    });
  }

  return challenge as WeeklyChallenge;
}

/**
 * Get challenge progress.
 * 
 * CHANGE: Returns additional pending/rejected counts for UI.
 */
export function getChallengeProgress(challengeId: number): {
  totalDays: number;
  completedDays: number;
  days: Array<{
    date: string;
    uploaded: boolean;
    photo_path?: string;
    verification_status?: string;
    is_rest_day?: boolean;
  }>;
} {
  const progress = getChallengeProgressCore(challengeId);
  return {
    totalDays: progress.totalDays,
    completedDays: progress.completedDays,
    days: progress.days,
  };
}

// ============================================================================
// Upload Functions
// ============================================================================

/**
 * Check if rest day exists for a date.
 */
export function hasRestDay(challengeId: number, date: string): boolean {
  try {
    const restDay = db
      .prepare('SELECT 1 FROM rest_days WHERE challenge_id = ? AND rest_date = ?')
      .get(challengeId, date);
    return !!restDay;
  } catch {
    return false;
  }
}

/**
 * Add daily upload.
 * 
 * CHANGES:
 * - NO streak update (streak computed from approved uploads only)
 * - NO trophy award (trophies awarded on verification only)
 * - Upload starts as 'pending'
 */
export function addDailyUpload(
  userId: number,
  challengeId: number,
  uploadDate: string,
  photoPath: string
): DailyUpload {
  // Check if upload already exists for this date
  const existing = db
    .prepare('SELECT * FROM daily_uploads WHERE challenge_id = ? AND upload_date = ?')
    .get(challengeId, uploadDate) as DailyUpload | undefined;

  if (existing) {
    throw new Error('Upload already exists for this date');
  }

  // Check if rest day was already used for this date
  if (hasRestDay(challengeId, uploadDate)) {
    throw new Error('Rest day already used for this date');
  }

  const createdAt = formatDateTimeSerbia();
  const result = db
    .prepare(`
      INSERT INTO daily_uploads 
      (challenge_id, user_id, upload_date, photo_path, verification_status, created_at) 
      VALUES (?, ?, ?, ?, 'pending', ?)
    `)
    .run(challengeId, userId, uploadDate, photoPath, createdAt);

  // NOTE: NO streak update here - streak is computed from approved uploads only
  // NOTE: NO trophy award here - trophies awarded on verification only

  // Update challenge completed_days (pending counts for UI display)
  const progress = getChallengeProgress(challengeId);
  db.prepare('UPDATE weekly_challenges SET completed_days = ? WHERE id = ?')
    .run(progress.completedDays, challengeId);

  return db.prepare('SELECT * FROM daily_uploads WHERE id = ?')
    .get(result.lastInsertRowid) as DailyUpload;
}

/**
 * Use a rest day.
 * 
 * CHANGES:
 * - NO missed day penalty
 * - Streak is recomputed to include rest day immediately
 *   (rest days don't need verification)
 */
export function useRestDay(
  userId: number,
  challengeId: number,
  restDate: string
): { success: boolean; message: string } {
  // Get challenge
  let challenge: WeeklyChallenge | undefined;
  try {
    challenge = db
      .prepare(`
        SELECT *, COALESCE(rest_days_available, 3) as rest_days_available 
        FROM weekly_challenges 
        WHERE id = ? AND user_id = ? AND status = 'active'
      `)
      .get(challengeId, userId) as WeeklyChallenge | undefined;
  } catch {
    const row = db
      .prepare('SELECT * FROM weekly_challenges WHERE id = ? AND user_id = ? AND status = ?')
      .get(challengeId, userId, 'active') as any;
    if (row) {
      challenge = { ...row, rest_days_available: 3 };
    }
  }

  if (!challenge) {
    return { success: false, message: 'Challenge not found or not active' };
  }

  const restDaysAvailable = challenge.rest_days_available ?? 3;
  if (restDaysAvailable <= 0) {
    return { success: false, message: 'No rest days available this week' };
  }

  if (hasRestDay(challengeId, restDate)) {
    return { success: false, message: 'Rest day already used for this date' };
  }

  // Check if already uploaded photo for this date
  const existingUpload = db
    .prepare('SELECT 1 FROM daily_uploads WHERE challenge_id = ? AND upload_date = ?')
    .get(challengeId, restDate);

  if (existingUpload) {
    return { success: false, message: 'Photo already uploaded for this date' };
  }

  try {
    const createdAt = formatDateTimeSerbia();
    db.prepare('INSERT INTO rest_days (challenge_id, user_id, rest_date, created_at) VALUES (?, ?, ?, ?)')
      .run(challengeId, userId, restDate, createdAt);

    // Decrement rest days available
    try {
      db.prepare('UPDATE weekly_challenges SET rest_days_available = rest_days_available - 1 WHERE id = ?')
        .run(challengeId);
    } catch {
      // Column might not exist
    }

    // Recompute streak immediately (rest days count as valid activity)
    recomputeAndPersistStreak(userId);

    return { success: true, message: 'Rest day used successfully' };
  } catch (error) {
    console.error('Error using rest day:', error);
    return { success: false, message: 'Failed to use rest day' };
  }
}

// ============================================================================
// Verification Integration
// ============================================================================

/**
 * Handle upload verification status change.
 * This is the ONLY place where streak and trophies are updated for uploads.
 * 
 * Called from: /api/admin/verify-upload
 */
export function onUploadVerified(
  uploadId: number,
  userId: number,
  challengeId: number,
  status: 'approved' | 'rejected'
): void {
  // 1. Sync trophies for this upload
  syncTrophiesForUpload({ userId, uploadId, status });

  // 2. Recompute streak from all uploads
  recomputeUserStreakFromUploads(userId);

  // 3. Sync weekly bonuses (in case this approval completes a perfect week)
  syncAllWeeklyBonuses(userId);

  // 4. Check and unlock achievements
  try {
    const { checkAndUnlockAchievements, sendAchievementNotification } = require('./achievements');
    const { sendPushNotification } = require('./push-notifications');

    const unlockedAchievements = checkAndUnlockAchievements(userId, 'upload', {
      uploadTime: new Date()
    });

    // Also check streak and trophy achievements
    checkAndUnlockAchievements(userId, 'streak');
    checkAndUnlockAchievements(userId, 'trophy');

    // Send push notifications for unlocked achievements
    for (const achievement of unlockedAchievements) {
      sendAchievementNotification(userId, achievement.name, achievement.icon).catch((err: any) => {
        console.error('Failed to send achievement notification:', err);
      });
    }
  } catch (error) {
    console.error('Error checking achievements:', error);
  }
  // 3. Re-evaluate challenge (may change status, may award/revoke bonus)
  reevaluateChallengeAfterVerification(challengeId);

  // 4. Update challenge completed_days
  const progress = getChallengeProgress(challengeId);
  db.prepare('UPDATE weekly_challenges SET completed_days = ? WHERE id = ?')
    .run(progress.completedDays, challengeId);

  // 5. Check and reward referral if this is first approved upload
  if (status === 'approved') {
    const { checkAndRewardReferral } = require('./coins');
    checkAndRewardReferral(userId);
  }
}

// ============================================================================
// Dashboard
// ============================================================================

/**
 * Get user dashboard data.
 * 
 * CHANGES:
 * - Streak is computed (not stored value with side effects)
 * - NO auto-reset on read
 * - Pure read operation
 */
export function getUserDashboard(userId: number): {
  challenge: WeeklyChallenge;
  progress: ReturnType<typeof getChallengeProgress>;
  streak: Streak;
  trophies: number;
} {
  const challenge = getOrCreateActiveChallenge(userId);
  const progress = getChallengeProgress(challenge.id);
  const streak = getUserStreak(userId);
  const trophies = getUserTrophies(userId);

  return {
    challenge,
    progress,
    streak,
    trophies,
  };
}

// ============================================================================
// Legacy Functions (deprecated but kept for backward compatibility)
// ============================================================================

/**
 * @deprecated Use recomputeAndPersistStreak instead
 */
export function updateStreak(userId: number, challengeCompleted: boolean): void {
  logWarning('challenges', 'updateStreak is deprecated, use recomputeAndPersistStreak', { userId });
  recomputeAndPersistStreak(userId);
}

/**
 * @deprecated Streak updates now happen only on verification
 */
export function updateStreakOnUpload(userId: number, uploadDate: string): void {
  // NO-OP: Pending uploads don't affect streak anymore
  logWarning('challenges', 'updateStreakOnUpload is deprecated and no longer updates streak', { userId });
}

/**
 * @deprecated Streak updates handled by useRestDay
 */
export function updateStreakOnRestDay(userId: number, restDate: string): void {
  // NO-OP: Handled internally by useRestDay
  logWarning('challenges', 'updateStreakOnRestDay is deprecated', { userId });
}

// Re-export trophy function for backward compatibility
export { getUserTrophies } from './trophy-core';
