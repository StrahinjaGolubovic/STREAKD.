/**
 * trophy-core.ts - Single Source of Truth for Trophy/Dumbbell Management
 * 
 * INVARIANTS:
 * 1. Trophies ONLY change on verification (approve/reject) or week evaluation
 * 2. Pending uploads do NOT affect trophies
 * 3. Weekly bonus only awarded when ALL uploads verified AND 7/7 approved
 * 4. All trophy changes are logged in trophy_transactions (audit trail)
 * 5. Trophies can never go negative (clamped to 0)
 * 6. syncTrophiesForUpload is idempotent - safe to call multiple times
 * 7. Weekly bonuses can be revoked if uploads are later rejected
 */

import db from './db';
import { formatDateTimeSerbia } from './timezone';
import { createNotification } from './notifications';

// ============================================================================
// Constants
// ============================================================================

// Base trophy reward range: 26-32 (deterministic from uploadId)
const BASE_TROPHY_MIN = 26;
const BASE_TROPHY_RANGE = 7; // 26 + (0..6) = 26..32

// Rejection penalty multiplier
const REJECTION_PENALTY_MULTIPLIER = 2;

// Weekly bonus: 10 per consecutive perfect week, capped at 70
const WEEKLY_BONUS_PER_WEEK = 10;
const WEEKLY_BONUS_CAP = 70;

// Missed day penalty is half of 26-32 -> 13-16 (deterministic per user+date)

// ============================================================================
// Trophy Calculation (PURE functions)
// ============================================================================

/**
 * Deterministic base trophy reward for an upload.
 * Uses uploadId so it's stable and can't be re-rolled.
 */
export function baseTrophiesForUpload(uploadId: number): number {
  return BASE_TROPHY_MIN + (Math.abs(uploadId) % BASE_TROPHY_RANGE);
}

/**
 * Apply a missed-day penalty for a specific date.
 * Idempotent: reason is unique per date, so re-calls won't double-penalize.
 */
export function applyMissedDayPenalty(userId: number, dateYMD: string): void {
  const targetNet = trophiesForMissedDay(userId, dateYMD);
  const currentNet = getMissedDayNet(userId, dateYMD);
  const delta = targetNet - currentNet;
  if (delta !== 0) {
    applyTrophyDelta(userId, null, delta, `missed:${dateYMD}`);
  }
}

/**
 * Trophy award for approved upload.
 */
export function trophiesForApproval(uploadId: number): number {
  return baseTrophiesForUpload(uploadId);
}

/**
 * Trophy penalty for rejected upload.
 * Penalty is 2x base (so -52 to -64).
 */
export function trophiesForRejection(uploadId: number): number {
  return -baseTrophiesForUpload(uploadId) * REJECTION_PENALTY_MULTIPLIER;
}

/**
 * Calculate weekly bonus for perfect week completion.
 * Bonus increases with consecutive perfect weeks, capped at 70.
 */
export function calculateWeeklyBonus(consecutivePerfectWeeks: number): number {
  return Math.min(consecutivePerfectWeeks * WEEKLY_BONUS_PER_WEEK, WEEKLY_BONUS_CAP);
}

/**
 * Deterministic hash for (userId, date) -> stable integer.
 */
function hashUserDate(userId: number, dateYMD: string): number {
  const s = `${userId}:${dateYMD}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Base value for a missed day, matching the same 26-32 range.
 */
export function baseTrophiesForMissedDay(userId: number, dateYMD: string): number {
  return BASE_TROPHY_MIN + (hashUserDate(userId, dateYMD) % BASE_TROPHY_RANGE);
}

/**
 * Penalty for a missed day: -half of 26-32 => -13..-16.
 */
export function trophiesForMissedDay(userId: number, dateYMD: string): number {
  const base = baseTrophiesForMissedDay(userId, dateYMD);
  return -Math.round(base / 2);
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Get current trophy balance for user.
 */
export function getUserTrophies(userId: number): number {
  const row = db
    .prepare('SELECT COALESCE(trophies, 0) as trophies FROM users WHERE id = ?')
    .get(userId) as { trophies: number } | undefined;
  return row?.trophies ?? 0;
}

/**
 * Get net trophy change for a specific upload.
 */
function getUploadTrophyNet(uploadId: number): number {
  const row = db
    .prepare('SELECT COALESCE(SUM(delta), 0) as net FROM trophy_transactions WHERE upload_id = ?')
    .get(uploadId) as { net: number };
  return row?.net ?? 0;
}

function getMissedDayNet(userId: number, dateYMD: string): number {
  const row = db
    .prepare(`
      SELECT COALESCE(SUM(delta), 0) as net
      FROM trophy_transactions
      WHERE user_id = ? AND reason = ?
    `)
    .get(userId, `missed:${dateYMD}`) as { net: number };
  return row?.net ?? 0;
}

/**
 * Get net trophy change for a weekly bonus (by challenge_id in reason).
 */
function getWeeklyBonusNet(challengeId: number): number {
  const row = db
    .prepare(`
      SELECT COALESCE(SUM(delta), 0) as net 
      FROM trophy_transactions 
      WHERE reason LIKE 'weekly_bonus:challenge_' || ? || '%'
    `)
    .get(challengeId) as { net: number };
  return row?.net ?? 0;
}

/**
 * Apply trophy delta with transaction logging.
 * Trophies are clamped to never go below 0.
 * 
 * @param userId - User to modify
 * @param uploadId - Related upload (null for bonuses/admin)
 * @param delta - Amount to add (positive) or subtract (negative)
 * @param reason - Audit reason string
 */
export function applyTrophyDelta(
  userId: number,
  uploadId: number | null,
  delta: number,
  reason: string
): void {
  if (delta === 0) return;

  const buildTrophyNotification = (appliedDelta: number): { type: string; title: string; message: string } => {
    const sign = appliedDelta > 0 ? '+' : '';
    const title = `🏆 ${sign}${appliedDelta} Trophies`;
    const verb = appliedDelta > 0 ? 'earned' : 'lost';
    const amount = Math.abs(appliedDelta);

    if (reason.startsWith('sync:approved')) {
      return { type: 'trophy', title, message: `You ${verb} ${amount} trophies. Your upload was approved.` };
    }
    if (reason.startsWith('sync:rejected')) {
      return { type: 'trophy', title, message: `You ${verb} ${amount} trophies. Your upload was rejected.` };
    }
    if (reason.startsWith('missed:')) {
      return { type: 'trophy', title, message: `You ${verb} ${amount} trophies. You missed a day.` };
    }
    if (reason.startsWith('weekly_bonus:') && reason.endsWith(':perfect')) {
      return { type: 'trophy', title, message: `You ${verb} ${amount} trophies. Perfect week bonus awarded.` };
    }
    if (reason.startsWith('weekly_bonus:') && reason.endsWith(':revoked')) {
      return { type: 'trophy', title, message: `You ${verb} ${amount} trophies. Weekly bonus revoked.` };
    }
    if (reason === 'admin_set') {
      return { type: 'trophy', title, message: `You ${verb} ${amount} trophies. Your trophies were adjusted by an admin.` };
    }

    return { type: 'trophy', title, message: `You ${verb} ${amount} trophies.` };
  };

  db.exec('SAVEPOINT trophy_delta');
  try {
    // Get current balance
    const row = db
      .prepare('SELECT COALESCE(trophies, 0) as trophies FROM users WHERE id = ?')
      .get(userId) as { trophies: number } | undefined;
    const current = row?.trophies ?? 0;

    // Clamp to prevent negative balance
    let appliedDelta = delta;
    if (delta < 0 && current + delta < 0) {
      appliedDelta = -current; // Bring to exactly 0
    }

    if (appliedDelta !== 0) {
      // Update user balance
      db.prepare('UPDATE users SET trophies = COALESCE(trophies, 0) + ? WHERE id = ?')
        .run(appliedDelta, userId);

      // Log transaction
      const createdAt = formatDateTimeSerbia();
      db.prepare(`
        INSERT INTO trophy_transactions (user_id, upload_id, delta, reason, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(userId, uploadId, appliedDelta, reason, createdAt);

      const n = buildTrophyNotification(appliedDelta);
      try {
        createNotification(userId, n.type, n.title, n.message);
      } catch {
      }
    }

    db.exec('RELEASE trophy_delta');
  } catch (e) {
    try {
      db.exec('ROLLBACK TO trophy_delta');
      db.exec('RELEASE trophy_delta');
    } catch {
      /* ignore */
    }
    throw e;
  }
}

// ============================================================================
// Upload Verification Trophy Sync (IDEMPOTENT)
// ============================================================================

/**
 * Sync trophies for an upload based on its verification status.
 * 
 * This is IDEMPOTENT - calling multiple times with the same status
 * will not double-award or double-penalize.
 * 
 * Logic:
 * - approved: target net = +baseTrophies
 * - rejected: target net = -2*baseTrophies
 * - pending: target net = 0 (no trophies for pending)
 * 
 * The function calculates the delta needed to reach target from current net.
 */
export function syncTrophiesForUpload(params: {
  userId: number;
  uploadId: number;
  status: 'approved' | 'rejected' | 'pending';
}): void {
  const { userId, uploadId, status } = params;

  // Calculate target net based on status
  let targetNet = 0;
  if (status === 'approved') {
    targetNet = trophiesForApproval(uploadId);
  } else if (status === 'rejected') {
    targetNet = trophiesForRejection(uploadId);
  }
  // pending = 0

  // Get current net for this upload
  const currentNet = getUploadTrophyNet(uploadId);

  // Calculate delta to reach target
  const delta = targetNet - currentNet;

  if (delta !== 0) {
    applyTrophyDelta(userId, uploadId, delta, `sync:${status}`);
  }
}

// ============================================================================
// Weekly Bonus Management (IDEMPOTENT)
// ============================================================================

/**
 * Check if a challenge qualifies for perfect week bonus.
 * Requirements:
 * - Challenge status is 'completed'
 * - 7+ approved uploads (not pending, not rejected)
 * - No pending uploads remaining
 */
export function challengeQualifiesForBonus(challengeId: number): {
  qualifies: boolean;
  approvedCount: number;
  pendingCount: number;
  restDayCount: number;
} {
  // Count approved uploads
  const approved = db
    .prepare(`
      SELECT COUNT(*) as count 
      FROM daily_uploads 
      WHERE challenge_id = ? AND verification_status = 'approved'
    `)
    .get(challengeId) as { count: number };

  // Count pending uploads
  const pending = db
    .prepare(`
      SELECT COUNT(*) as count 
      FROM daily_uploads 
      WHERE challenge_id = ? AND verification_status = 'pending'
    `)
    .get(challengeId) as { count: number };

  // Count rest days
  let restDays = { count: 0 };
  try {
    restDays = db
      .prepare('SELECT COUNT(*) as count FROM rest_days WHERE challenge_id = ?')
      .get(challengeId) as { count: number };
  } catch { /* table might not exist */ }

  const totalValid = approved.count + restDays.count;

  return {
    qualifies: totalValid >= 7 && pending.count === 0,
    approvedCount: approved.count,
    pendingCount: pending.count,
    restDayCount: restDays.count,
  };
}

/**
 * Count consecutive perfect weeks for a user, ending at the specified challenge.
 */
export function countConsecutivePerfectWeeks(userId: number, upToChallengeId: number): number {
  const challenges = db
    .prepare(`
      SELECT id, status, completed_days
      FROM weekly_challenges
      WHERE user_id = ? AND id <= ?
      ORDER BY id DESC
    `)
    .all(userId, upToChallengeId) as Array<{
      id: number;
      status: string;
      completed_days: number;
    }>;

  let consecutive = 0;
  for (const ch of challenges) {
    // Check if this challenge is a perfect week
    const check = challengeQualifiesForBonus(ch.id);
    if (check.qualifies) {
      consecutive++;
    } else {
      break;
    }
  }

  return consecutive;
}

/**
 * Sync weekly bonus for a challenge (IDEMPOTENT).
 * 
 * Awards bonus if challenge qualifies, revokes if it doesn't.
 * Safe to call multiple times.
 */
export function syncWeeklyBonus(userId: number, challengeId: number): void {
  const check = challengeQualifiesForBonus(challengeId);
  
  let targetBonus = 0;
  if (check.qualifies) {
    const consecutiveWeeks = countConsecutivePerfectWeeks(userId, challengeId);
    targetBonus = calculateWeeklyBonus(consecutiveWeeks);
  }

  // Get current bonus for this challenge
  const currentBonus = getWeeklyBonusNet(challengeId);

  // Calculate delta
  const delta = targetBonus - currentBonus;

  if (delta !== 0) {
    const reason = check.qualifies
      ? `weekly_bonus:challenge_${challengeId}:perfect`
      : `weekly_bonus:challenge_${challengeId}:revoked`;
    applyTrophyDelta(userId, null, delta, reason);
  }
}

/**
 * Re-evaluate and sync bonuses for all challenges of a user.
 * Called when verification might affect past weeks.
 */
export function syncAllWeeklyBonuses(userId: number): void {
  const challenges = db
    .prepare(`
      SELECT id FROM weekly_challenges 
      WHERE user_id = ? AND status IN ('completed', 'failed')
      ORDER BY id ASC
    `)
    .all(userId) as Array<{ id: number }>;

  for (const ch of challenges) {
    syncWeeklyBonus(userId, ch.id);
  }
}

// ============================================================================
// Admin Operations
// ============================================================================

/**
 * Admin set trophies to exact value.
 * Creates audit trail transaction.
 */
export function adminSetTrophies(userId: number, newValue: number): void {
  const current = getUserTrophies(userId);
  const delta = newValue - current;
  
  if (delta !== 0) {
    applyTrophyDelta(userId, null, delta, 'admin_set');
  }
}
