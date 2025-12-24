import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/admin';
import { verifyUpload, extractImageMetadata, updateUploadMetadata, getPendingUploads } from '@/lib/verification';
import { recomputeUserStreakFromUploads, getChallengeProgress } from '@/lib/challenges';
import { cookies } from 'next/headers';
import db from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    const adminCheck = await checkAdmin(token);
    if (!adminCheck.isAdmin || !adminCheck.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { uploadId, status } = await request.json();

    if (!uploadId || !status || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // Get upload info before verifying (to get user_id, upload_date, and challenge_id)
    const upload = db.prepare('SELECT user_id, upload_date, challenge_id, verification_status FROM daily_uploads WHERE id = ?').get(uploadId) as { user_id: number; upload_date: string; challenge_id: number; verification_status: string } | undefined;
    
    if (!upload) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    }

    // Extract metadata before verifying
    const pendingUploads = getPendingUploads();
    const pendingUpload = pendingUploads.find((u) => u.id === uploadId);
    if (pendingUpload) {
      const metadata = await extractImageMetadata(pendingUpload.photo_path);
      updateUploadMetadata(uploadId, JSON.stringify(metadata));
    }

    const success = verifyUpload(uploadId, status, adminCheck.userId);

    if (!success) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    }

    // Always recompute streak from uploads so rejections correctly reduce streak.
    recomputeUserStreakFromUploads(upload.user_id);

    // Always update challenge completed_days (rejections should reduce it).
    const progress = getChallengeProgress(upload.challenge_id);
    db.prepare('UPDATE weekly_challenges SET completed_days = ? WHERE id = ?').run(
      progress.completedDays,
      upload.challenge_id
    );

    return NextResponse.json({ message: `Upload ${status} successfully` });
  } catch (error) {
    console.error('Verify upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

