import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getUserById } from '@/lib/auth';
import { addMessage } from '@/lib/chat';
import { cookies } from 'next/headers';

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
    const user = getUserById(userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { message, clientTime } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (message.trim().length === 0) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }

    if (message.length > 500) {
      return NextResponse.json({ error: 'Message too long (max 500 characters)' }, { status: 400 });
    }

    // Use client time if provided (to avoid timezone issues), otherwise use server time
    const newMessage = addMessage(userId, user.username, message, clientTime);

    if (!newMessage) {
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }

    return NextResponse.json({ message: newMessage });
  } catch (error: any) {
    console.error('Send message error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

