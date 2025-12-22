import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, getUserByUsername } from '@/lib/auth';
import { verifyAltcha } from '@/lib/altcha';
import db from '@/lib/db';
import { getSerbiaDateSQLite } from '@/lib/timezone';

export async function POST(request: NextRequest) {
  try {
    const { username, password, altcha } = await request.json();
    
    // Verify ALTCHA solution
    if (!altcha) {
      return NextResponse.json({ error: 'Please complete the verification challenge' }, { status: 400 });
    }
    
    const isValidAltcha = await verifyAltcha(altcha);
    if (!isValidAltcha) {
      return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 400 });
    }

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    if (username.length < 3) {
      return NextResponse.json({ error: 'Username must be at least 3 characters' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // Validate username format (alphanumeric and underscores only)
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json({ error: 'Username can only contain letters, numbers, and underscores' }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = getUserByUsername(username);
    if (existingUser) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
    }

    // Hash password and create user (explicitly set credits to 0 and Serbia date)
    const passwordHash = await hashPassword(password);
    // Get Serbia date as YYYY-MM-DD
    const serbiaDate = getSerbiaDateSQLite();
    const result = db.prepare('INSERT INTO users (username, password_hash, credits, created_at) VALUES (?, ?, ?, ?)').run(username, passwordHash, 0, serbiaDate);

    return NextResponse.json(
      {
        message: 'User created successfully',
        user: {
          id: result.lastInsertRowid,
          username,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

