import db from './db';
import exifr from 'exifr';
import { readFile } from 'fs/promises';
import { join } from 'path';

export interface UploadForVerification {
  id: number;
  user_id: number;
  username: string;
  upload_date: string;
  photo_path: string;
  verification_status: 'pending' | 'approved' | 'rejected';
  metadata: string | null;
  created_at: string;
  challenge_id: number;
}

// Extract metadata from image
export async function extractImageMetadata(photoPath: string): Promise<any> {
  try {
    // Convert API path back to file system path
    let actualPath = photoPath;
    if (photoPath.startsWith('/api/files/')) {
      actualPath = photoPath.replace('/api/files/', '');
    } else if (photoPath.startsWith('/uploads/') || photoPath.startsWith('/profiles/')) {
      actualPath = photoPath.substring(1); // Remove leading /
    }
    
    // Determine base directory (use persistent volume on Railway)
    const baseDir = process.env.DATABASE_PATH 
      ? join(process.env.DATABASE_PATH, '..')
      : join(process.cwd(), 'data');
    
    const fullPath = join(baseDir, actualPath);
    const imageBuffer = await readFile(fullPath);
    
    // Extract EXIF data
    const exifData = await exifr.parse(imageBuffer, {
      pick: [
        'DateTimeOriginal',
        'CreateDate',
        'ModifyDate',
        'GPSLatitude',
        'GPSLongitude',
        'GPSAltitude',
        'Make',
        'Model',
        'Software',
        'ImageWidth',
        'ImageHeight',
        'Orientation',
        'XResolution',
        'YResolution',
      ],
    });

    return {
      exif: exifData || null,
      fileSize: imageBuffer.length,
      extractedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error extracting metadata:', error);
    return {
      error: 'Failed to extract metadata',
      extractedAt: new Date().toISOString(),
    };
  }
}

// Get pending uploads for verification
export function getPendingUploads(): UploadForVerification[] {
  const uploads = db
    .prepare(
      `
    SELECT 
      du.id,
      du.user_id,
      u.username,
      du.upload_date,
      du.photo_path,
      du.verification_status,
      du.metadata,
      du.created_at,
      du.challenge_id
    FROM daily_uploads du
    JOIN users u ON du.user_id = u.id
    WHERE du.verification_status = 'pending'
    ORDER BY du.created_at DESC
  `
    )
    .all() as UploadForVerification[];

  return uploads;
}

// Get all uploads (for admin view)
export function getAllUploads(limit: number = 50, offset: number = 0): UploadForVerification[] {
  const uploads = db
    .prepare(
      `
    SELECT 
      du.id,
      du.user_id,
      u.username,
      du.upload_date,
      du.photo_path,
      du.verification_status,
      du.metadata,
      du.created_at,
      du.challenge_id
    FROM daily_uploads du
    JOIN users u ON du.user_id = u.id
    ORDER BY du.created_at DESC
    LIMIT ? OFFSET ?
  `
    )
    .all(limit, offset) as UploadForVerification[];

  return uploads;
}

// Verify an upload
export function verifyUpload(uploadId: number, status: 'approved' | 'rejected', verifiedBy: number): boolean {
  const { formatDateTimeSerbia } = require('./timezone');
  const verifiedAt = formatDateTimeSerbia();
  const result = db
    .prepare(
      `
    UPDATE daily_uploads 
    SET verification_status = ?, verified_at = ?, verified_by = ?
    WHERE id = ? AND verification_status = 'pending'
  `
    )
    .run(status, verifiedAt, verifiedBy, uploadId);

  return result.changes > 0;
}

// Update upload metadata
export function updateUploadMetadata(uploadId: number, metadata: string): boolean {
  const result = db
    .prepare('UPDATE daily_uploads SET metadata = ? WHERE id = ?')
    .run(metadata, uploadId);

  return result.changes > 0;
}

