import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, generateToken, getUserByUsername } from '@/lib/auth';
import { verifyAltcha } from '@/lib/altcha';
import { cookies } from 'next/headers';

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

    // Get user from database
    const user = getUserByUsername(username);
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Generate token
    const token = generateToken(user.id);

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return NextResponse.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        debt: user.credits, // credits column stores debt
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

