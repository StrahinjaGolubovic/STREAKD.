import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, getUserByUsername } from '@/lib/auth';
import { verifyAltcha } from '@/lib/altcha';
import db from '@/lib/db';
import { getSerbiaDateSQLite } from '@/lib/timezone';

export async function POST(request: NextRequest) {
  try {
    const { username, password, altcha, referralCode } = await request.json();
    
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

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    // Require at least one letter and one number
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json({ 
        error: 'Password must contain at least one letter and one number' 
      }, { status: 400 });
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

    // Hash password and create user (Serbia date)
    const passwordHash = await hashPassword(password);
    // Get Serbia date as YYYY-MM-DD
    const serbiaDate = getSerbiaDateSQLite();
    
    // Check if referral code is valid
    let referrerId: number | null = null;
    if (referralCode) {
      const referrer = db
        .prepare('SELECT user_id FROM invite_codes WHERE code = ?')
        .get(referralCode) as { user_id: number } | undefined;
      if (referrer) {
        referrerId = referrer.user_id;
      }
    }
    
    const result = db.prepare('INSERT INTO users (username, password_hash, credits, created_at, referred_by) VALUES (?, ?, ?, ?, ?)').run(username, passwordHash, 0, serbiaDate, referrerId);

    // Track referral if valid
    if (referrerId) {
      const { trackReferral } = require('@/lib/coins');
      trackReferral(referrerId, Number(result.lastInsertRowid));
    }

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

