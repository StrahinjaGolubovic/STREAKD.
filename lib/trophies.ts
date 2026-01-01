import db from '@/lib/db';
import { logError } from '@/lib/logger';

export type UploadVerifyStatus = 'approved' | 'rejected' | 'pending';

function addDaysYMD(dateString: string, deltaDays: number): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day + deltaDays));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Deterministic "random" base reward between 26–32.
 * Uses uploadId so it's stable and can't be spammed/re-rolled.
 */
export function baseTrophiesForUpload(uploadId: number): number {
  return 26 + (Math.abs(uploadId) % 7); // 26..32
}

/**
 * Missed day penalty:
 * - Penalty: half of base (13-16 trophies lost)
 * - Applied when user breaks their streak
 */
export function trophiesPenaltyForMissedDay(userId: number): number {
  // Use a consistent base for missed day penalty (average of 26-32 = 29)
  const averageBase = 29;
  return -Math.round(averageBase / 2); // -14 or -15 trophies
}

/**
 * Approval reward:
 * - Base reward: 26-32 trophies (deterministic)
 * - Always full reward (streak penalties applied separately when streak breaks)
 */
export function trophiesAwardForApproval(userId: number, uploadId: number, uploadDate: string): number {
  // Plain and simple: approved upload always gives 26-32 trophies
  // Missed day penalties are applied separately when streak breaks
  return baseTrophiesForUpload(uploadId);
}

/**
 * Rejection should hurt more than a single-day gain.
 * Penalty is 2x base (so -52..-64).
 */
export function trophiesPenaltyForRejection(uploadId: number): number {
  const base = baseTrophiesForUpload(uploadId);
  return -Math.round(base * 2);
}

function getUploadTrophiesNet(uploadId: number): number {
  const row = db
    .prepare('SELECT COALESCE(SUM(delta), 0) as net FROM trophy_transactions WHERE upload_id = ?')
    .get(uploadId) as { net: number };
  return row?.net ?? 0;
}

export function applyTrophyDelta(userId: number, uploadId: number | null, delta: number, reason: string) {
  if (!delta) return;
  db.exec('BEGIN');
  try {
    // Never allow trophies (aka Dumbbells) to go negative.
    // If we would dip below 0, clamp the applied delta to only subtract what's available.
    const row = db
      .prepare('SELECT COALESCE(trophies, 0) as trophies FROM users WHERE id = ?')
      .get(userId) as { trophies: number } | undefined;
    const current = row?.trophies ?? 0;

    let appliedDelta = delta;
    if (delta < 0 && current + delta < 0) {
      appliedDelta = -current; // bring to 0
    }

    if (appliedDelta !== 0) {
      db.prepare('UPDATE users SET trophies = COALESCE(trophies, 0) + ? WHERE id = ?').run(appliedDelta, userId);
      const { formatDateTimeSerbia } = require('./timezone');
      const createdAt = formatDateTimeSerbia();
      db.prepare('INSERT INTO trophy_transactions (user_id, upload_id, delta, reason, created_at) VALUES (?, ?, ?, ?, ?)').run(
        userId,
        uploadId,
        appliedDelta,
        reason,
        createdAt
      );
    }
    db.exec('COMMIT');
  } catch (e) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore
    }
    throw e;
  }
}

/**
 * Idempotently sync trophies for a specific upload to match its current verification status.
 * Ensures no double-awards when an admin clicks approve/reject multiple times or toggles state.
 */
export function syncTrophiesForUpload(params: {
  userId: number;
  uploadId: number;
  uploadDate: string;
  status: UploadVerifyStatus;
}) {
  const { userId, uploadId, uploadDate, status } = params;

  let targetNet = 0;
  if (status === 'approved') targetNet = trophiesAwardForApproval(userId, uploadId, uploadDate);
  else if (status === 'rejected') targetNet = trophiesPenaltyForRejection(uploadId);

  const currentNet = getUploadTrophiesNet(uploadId);
  const delta = targetNet - currentNet;

  if (delta !== 0) {
    applyTrophyDelta(userId, uploadId, delta, `sync:${status}`);
  }
}

export function getUserTrophies(userId: number): number {
  const row = db.prepare('SELECT COALESCE(trophies, 0) as trophies FROM users WHERE id = ?').get(userId) as
    | { trophies: number }
    | undefined;
  return row?.trophies ?? 0;
}

/**
 * Award weekly challenge completion bonus.
 * Called when a user completes 5+ days in a week.
 * Bonus increases by +10 per consecutive completed week, capped at +70 for 7th week and beyond.
 */
export function awardWeeklyCompletionBonus(userId: number, challengeId: number): void {
  // Bonus is ONLY for perfect weeks (7/7). No bonus for 5/7, 6/7, etc.
  const currentRow = db
    .prepare('SELECT status, completed_days FROM weekly_challenges WHERE id = ? AND user_id = ?')
    .get(challengeId, userId) as { status: string; completed_days: number } | undefined;

  if (!currentRow) return;
  const isPerfect = currentRow.status === 'completed' && Number(currentRow.completed_days ?? 0) >= 7;
  if (!isPerfect) return;

  // Count consecutive perfect weeks from most recent backwards.
  const allChallenges = db
    .prepare(`
      SELECT id, status, completed_days
      FROM weekly_challenges
      WHERE user_id = ?
      ORDER BY id DESC
    `)
    .all(userId) as Array<{ id: number; status: string; completed_days: number }>;

  let consecutivePerfectWeeks = 0;
  for (const ch of allChallenges) {
    const perfect = ch.status === 'completed' && Number(ch.completed_days ?? 0) >= 7;
    if (perfect) consecutivePerfectWeeks++;
    else break;
  }

  const bonus = Math.min(10 * consecutivePerfectWeeks, 70);
  applyTrophyDelta(
    userId,
    null,
    bonus,
    `weekly_completion:challenge_${challengeId}:perfect_consecutive_${consecutivePerfectWeeks}`
  );
}

