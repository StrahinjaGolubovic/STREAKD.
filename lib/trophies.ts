import db from '@/lib/db';

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

function getLastApprovedDateBefore(userId: number, uploadDate: string, uploadId: number): string | null {
  const row = db
    .prepare(
      `SELECT upload_date
       FROM daily_uploads
       WHERE user_id = ?
         AND verification_status = 'approved'
         AND upload_date < ?
         AND id != ?
       ORDER BY upload_date DESC
       LIMIT 1`
    )
    .get(userId, uploadDate, uploadId) as { upload_date: string } | undefined;
  return row?.upload_date ?? null;
}

/**
 * Approval reward:
 * - Base reward: 26-32 trophies (deterministic)
 * - Missed streak penalty: cut in half if gap exists
 */
export function trophiesAwardForApproval(userId: number, uploadId: number, uploadDate: string): number {
  const base = baseTrophiesForUpload(uploadId);
  const lastApproved = getLastApprovedDateBefore(userId, uploadDate, uploadId);
  
  // Check if streak was maintained (yesterday had an approved upload)
  let maintainedStreak = false;
  if (lastApproved) {
    const yesterday = addDaysYMD(uploadDate, -1);
    maintainedStreak = lastApproved === yesterday;
  } else {
    // First upload ever - treat as maintained
    maintainedStreak = true;
  }

  // Apply missed streak penalty (half) if streak was broken
  return maintainedStreak ? base : Math.max(1, Math.round(base / 2));
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

function applyTrophyDelta(userId: number, uploadId: number | null, delta: number, reason: string) {
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
      db.prepare('INSERT INTO trophy_transactions (user_id, upload_id, delta, reason) VALUES (?, ?, ?, ?)').run(
        userId,
        uploadId,
        appliedDelta,
        reason
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

/**
 * Deduct trophies for failing a weekly challenge (< 5 days).
 * Penalty is proportional to encourage consistency.
 */
export function deductWeeklyFailurePenalty(userId: number, challengeId: number): void {
  const penalty = -150; // More forgiving than old debt system, but still meaningful
  applyTrophyDelta(userId, null, penalty, `weekly_failure:challenge_${challengeId}`);
}


