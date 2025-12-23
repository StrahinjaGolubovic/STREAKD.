import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import db from '@/lib/db';

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
    const file = formData.get('picture') as File;

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

    // Validate file size (max 2MB for profile pictures)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 2MB' }, { status: 400 });
    }

    // Get existing profile picture to delete it later
    const user = db.prepare('SELECT profile_picture FROM users WHERE id = ?').get(userId) as { profile_picture: string | null } | undefined;
    const oldPicturePath = user?.profile_picture;

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Determine base directory (use persistent volume on Railway)
    const baseDir = process.env.DATABASE_PATH 
      ? join(process.env.DATABASE_PATH, '..')
      : join(process.cwd(), 'data');
    
    // Create profile pictures directory if it doesn't exist
    const profilesDir = join(baseDir, 'profiles', userId.toString());
    if (!existsSync(profilesDir)) {
      await mkdir(profilesDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const filename = `profile.${extension}`;
    const filepath = join(profilesDir, filename);
    // Use API route to serve the file
    const relativePath = `/api/files/profiles/${userId}/${filename}`;

    await writeFile(filepath, buffer);

    // Delete old profile picture if it exists
    if (oldPicturePath) {
      try {
        // Handle both old format (/profiles/...) and new format (/api/files/profiles/...)
        let oldFilePath: string;
        if (oldPicturePath.startsWith('/api/files/profiles/')) {
          const pathPart = oldPicturePath.replace('/api/files/profiles/', '');
          oldFilePath = join(baseDir, 'profiles', pathPart);
        } else if (oldPicturePath.startsWith('/profiles/')) {
          const pathPart = oldPicturePath.replace('/profiles/', '');
          oldFilePath = join(baseDir, 'profiles', pathPart);
        } else {
          oldFilePath = join(baseDir, 'profiles', oldPicturePath);
        }
        
        if (existsSync(oldFilePath)) {
          await unlink(oldFilePath);
        }
      } catch (error) {
        // Ignore errors when deleting old picture
        console.log('Error deleting old profile picture:', error);
      }
    }

    // Update database
    db.prepare('UPDATE users SET profile_picture = ? WHERE id = ?').run(relativePath, userId);

    return NextResponse.json({
      message: 'Profile picture updated successfully',
      profile_picture: relativePath,
    });
  } catch (error: any) {
    console.error('Profile picture upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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

    // Get existing profile picture
    const user = db.prepare('SELECT profile_picture FROM users WHERE id = ?').get(userId) as { profile_picture: string | null } | undefined;
    const picturePath = user?.profile_picture;

    // Delete file if it exists
    if (picturePath) {
      try {
        const baseDir = process.env.DATABASE_PATH 
          ? join(process.env.DATABASE_PATH, '..')
          : join(process.cwd(), 'data');
        
        let filePath: string;
        if (picturePath.startsWith('/api/files/profiles/')) {
          const pathPart = picturePath.replace('/api/files/profiles/', '');
          filePath = join(baseDir, 'profiles', pathPart);
        } else if (picturePath.startsWith('/profiles/')) {
          const pathPart = picturePath.replace('/profiles/', '');
          filePath = join(baseDir, 'profiles', pathPart);
        } else {
          filePath = join(baseDir, 'profiles', picturePath);
        }
        
        if (existsSync(filePath)) {
          await unlink(filePath);
        }
      } catch (error) {
        console.log('Error deleting profile picture:', error);
      }
    }

    // Update database
    db.prepare('UPDATE users SET profile_picture = NULL WHERE id = ?').run(userId);

    return NextResponse.json({ message: 'Profile picture removed successfully' });
  } catch (error: any) {
    console.error('Profile picture delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

