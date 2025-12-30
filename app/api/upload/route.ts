import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { addDailyUpload, getOrCreateActiveChallenge, formatDate } from '@/lib/challenges';
import { formatDateSerbia } from '@/lib/timezone';
import { updateUploadMetadata } from '@/lib/verification';
import { cookies } from 'next/headers';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.userId;

    // Get form data
    const formData = await request.formData();
    const file = formData.get('photo') as File;
    const metadataStr = formData.get('metadata') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // HEIC/HEIF are not reliably displayable in browsers; we convert client-side to JPEG.
    // Reject raw HEIC uploads so we don't store images that won't render for most users.
    const ext = (file.name?.split('.').pop() || '').toLowerCase();
    if (file.type === 'image/heic' || file.type === 'image/heif' || ext === 'heic' || ext === 'heif') {
      return NextResponse.json(
        { error: 'HEIC images are not supported. Please upload JPG/PNG (or let the app convert it automatically).' },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 });
    }

    // Get or create active challenge
    const challenge = getOrCreateActiveChallenge(userId);

    // Server determines upload date - always today
    const uploadDate = formatDateSerbia();

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Determine base directory (use persistent volume on Railway)
    const baseDir = process.env.DATABASE_PATH 
      ? join(process.env.DATABASE_PATH, '..')
      : join(process.cwd(), 'data');
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = join(baseDir, 'uploads', userId.toString());
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const filename = `${timestamp}.${extension}`;
    const filepath = join(uploadsDir, filename);
    // Use API route to serve the file
    const relativePath = `/api/files/uploads/${userId}/${filename}`;

    await writeFile(filepath, buffer);

    // Add to database
    const upload = addDailyUpload(userId, challenge.id, uploadDate, relativePath);

    // Store metadata if provided (EXIF extracted client-side from original file).
    if (metadataStr && typeof metadataStr === 'string') {
      try {
        // Basic sanity check (must be JSON object/stringifiable)
        const parsed = JSON.parse(metadataStr);
        updateUploadMetadata(upload.id, JSON.stringify(parsed));
      } catch {
        // ignore invalid metadata payloads
      }
    }

    return NextResponse.json({
      message: 'Upload successful',
      upload: {
        id: upload.id,
        upload_date: upload.upload_date,
        photo_path: upload.photo_path,
      },
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    const msg = error?.message;
    if (msg === 'Upload already exists for this date' || msg === 'Rest day already used for this date') {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

