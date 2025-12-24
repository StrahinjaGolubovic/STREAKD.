import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = decoded.userId;
    const body = await request.json();
    const { username } = body;

    // Validate username
    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
      return NextResponse.json(
        { error: 'Username must be between 3 and 20 characters' },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      return NextResponse.json(
        { error: 'Username can only contain letters, numbers, and underscores' },
        { status: 400 }
      );
    }

    // Check if username is already taken by another user
    const existingUser = db.prepare(`
      SELECT id FROM users WHERE username = ? AND id != ?
    `).get(trimmedUsername, userId) as { id: number } | undefined;

    if (existingUser) {
      return NextResponse.json(
        { error: 'Username is already taken' },
        { status: 400 }
      );
    }

    // Update username
    try {
      db.prepare(`
        UPDATE users 
        SET username = ? 
        WHERE id = ?
      `).run(trimmedUsername, userId);

      return NextResponse.json({
        success: true,
        username: trimmedUsername,
      });
    } catch (error: any) {
      if (error.message?.includes('UNIQUE constraint')) {
        return NextResponse.json(
          { error: 'Username is already taken' },
          { status: 400 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

