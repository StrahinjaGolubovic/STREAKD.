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
 * "Miss a streak => cut trophies in half" logic:
 * - If the user has an approved upload for yesterday (relative to the uploadDate), full reward.
 * - If they had no previous approved days at all, full reward (first day shouldn't be penalized).
 * - Otherwise, half reward.
 */
export function trophiesAwardForApproval(userId: number, uploadId: number, uploadDate: string): number {
  const base = baseTrophiesForUpload(uploadId);
  const lastApproved = getLastApprovedDateBefore(userId, uploadDate, uploadId);
  if (!lastApproved) return base;

  const yesterday = addDaysYMD(uploadDate, -1);
  if (lastApproved === yesterday) return base;

  return Math.max(1, Math.round(base / 2));
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
    db.prepare('UPDATE users SET trophies = COALESCE(trophies, 0) + ? WHERE id = ?').run(delta, userId);
    db.prepare(
      'INSERT INTO trophy_transactions (user_id, upload_id, delta, reason) VALUES (?, ?, ?, ?)'
    ).run(userId, uploadId, delta, reason);
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


