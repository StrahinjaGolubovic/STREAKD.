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
    const { username, profile_private } = body;

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

    // Update username and/or privacy setting
    try {
      if (profile_private !== undefined) {
        // Update both username and privacy
        if (trimmedUsername) {
          db.prepare(`
            UPDATE users 
            SET username = ?, profile_private = ? 
            WHERE id = ?
          `).run(trimmedUsername, profile_private ? 1 : 0, userId);
        } else {
          // Only update privacy
          db.prepare(`
            UPDATE users 
            SET profile_private = ? 
            WHERE id = ?
          `).run(profile_private ? 1 : 0, userId);
        }
      } else if (trimmedUsername) {
        // Only update username
        db.prepare(`
          UPDATE users 
          SET username = ? 
          WHERE id = ?
        `).run(trimmedUsername, userId);
      }

      return NextResponse.json({
        success: true,
        username: trimmedUsername || undefined,
        profile_private: profile_private !== undefined ? (profile_private ? 1 : 0) : undefined,
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

