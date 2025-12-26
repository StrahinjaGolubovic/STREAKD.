import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import db from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
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
    const { feedback } = await request.json();

    if (!feedback || typeof feedback !== 'string' || feedback.trim().length === 0) {
      return NextResponse.json({ error: 'Feedback is required' }, { status: 400 });
    }

    if (feedback.length > 5000) {
      return NextResponse.json({ error: 'Feedback is too long (max 5000 characters)' }, { status: 400 });
    }

    db.prepare('INSERT INTO feedback (user_id, feedback_text) VALUES (?, ?)').run(
      userId,
      feedback.trim()
    );

    return NextResponse.json({ success: true, message: 'Feedback submitted successfully' });
  } catch (error: any) {
    console.error('Feedback submission error:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}

