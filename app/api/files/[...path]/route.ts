import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// Serve files from the persistent volume
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> | { path: string[] } }
) {
  try {
    const params = await Promise.resolve(context.params);
    const filePath = params.path.join('/');
    
    // Security: Only allow profiles and uploads directories
    if (!filePath.startsWith('profiles/') && !filePath.startsWith('uploads/')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // For Railway, files are stored in /data, for local dev use ./data
    const baseDir = process.env.DATABASE_PATH 
      ? join(process.env.DATABASE_PATH, '..')
      : join(process.cwd(), 'data');
    
    const fullPath = join(baseDir, filePath);

    // Security: Prevent directory traversal
    if (!fullPath.startsWith(baseDir)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!existsSync(fullPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const fileBuffer = await readFile(fullPath);
    
    // Determine content type
    const ext = fullPath.split('.').pop()?.toLowerCase();
    const contentType = 
      ext === 'png' ? 'image/png' :
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
      ext === 'gif' ? 'image/gif' :
      ext === 'webp' ? 'image/webp' :
      'application/octet-stream';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('File serve error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

