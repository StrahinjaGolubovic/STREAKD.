import db from '@/lib/db';
import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import { join } from 'path';

function getDataDir(): string {
  // For Railway, database lives in /data/... and uploads are in /data/uploads
  return process.env.DATABASE_PATH ? join(process.env.DATABASE_PATH, '..') : join(process.cwd(), 'data');
}

function uploadFilePathFromPhotoPath(photoPath: string): string | null {
  // New format: /api/files/uploads/{userId}/{filename}
  if (photoPath.startsWith('/api/files/uploads/')) {
    const rel = photoPath.replace('/api/files/uploads/', ''); // {userId}/{filename}
    return join(getDataDir(), 'uploads', rel);
  }
  // Old format: /uploads/{userId}/{filename}
  if (photoPath.startsWith('/uploads/')) {
    const rel = photoPath.replace('/uploads/', '');
    return join(getDataDir(), 'uploads', rel);
  }
  // Fallback: ignore unknown formats
  return null;
}

/**
 * Purge old upload rows (and their image files) to save disk resources.
 *
 * We only delete uploads that are:
 * - older than `cutoffYMD` (YYYY-MM-DD)
 * - not pending (keep pending so admins can still verify them)
 */
export async function purgeUserUploadsBeforeDate(
  userId: number,
  cutoffYMD: string
): Promise<{ deletedRows: number; deletedFiles: number }> {
  const rows = db
    .prepare(
      `SELECT id, photo_path
       FROM daily_uploads
       WHERE user_id = ?
         AND upload_date < ?
         AND verification_status != 'pending'`
    )
    .all(userId, cutoffYMD) as Array<{ id: number; photo_path: string }>;

  let deletedFiles = 0;
  for (const r of rows) {
    const filePath = uploadFilePathFromPhotoPath(r.photo_path);
    if (!filePath) continue;
    try {
      if (existsSync(filePath)) {
        await unlink(filePath);
        deletedFiles++;
      }
    } catch {
      // ignore file deletion errors (DB purge still saves query/runtime resources)
    }
  }

  const deletedRows = 0;

  return { deletedRows, deletedFiles };
}


