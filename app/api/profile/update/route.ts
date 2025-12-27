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

    // Get current username if not provided
    const currentUser = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as { username: string } | undefined;
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let trimmedUsername: string | undefined = undefined;
    if (username !== undefined && username !== null) {
      if (typeof username !== 'string') {
        return NextResponse.json(
          { error: 'Username must be a string' },
          { status: 400 }
        );
      }

      trimmedUsername = username.trim();
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
      if (trimmedUsername !== currentUser.username) {
        const existingUser = db.prepare(`
          SELECT id FROM users WHERE username = ? AND id != ?
        `).get(trimmedUsername, userId) as { id: number } | undefined;

        if (existingUser) {
          return NextResponse.json(
            { error: 'Username is already taken' },
            { status: 400 }
          );
        }
      }
    }

    // Update username and/or privacy setting
    try {
      if (profile_private !== undefined && trimmedUsername !== undefined) {
        // Update both username and privacy
        db.prepare(`
          UPDATE users 
          SET username = ?, profile_private = ? 
          WHERE id = ?
        `).run(trimmedUsername, profile_private ? 1 : 0, userId);
      } else if (profile_private !== undefined) {
        // Only update privacy
        db.prepare(`
          UPDATE users 
          SET profile_private = ? 
          WHERE id = ?
        `).run(profile_private ? 1 : 0, userId);
      } else if (trimmedUsername !== undefined) {
        // Only update username
        db.prepare(`
          UPDATE users 
          SET username = ? 
          WHERE id = ?
        `).run(trimmedUsername, userId);
      } else {
        return NextResponse.json(
          { error: 'At least one field (username or profile_private) must be provided' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        username: trimmedUsername || currentUser.username,
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

