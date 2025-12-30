import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getUserById } from '@/lib/auth';
import { addCrewChatMessage } from '@/lib/crew-chat';
import { getUserCrew } from '@/lib/crews';
import { cookies } from 'next/headers';

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
    const user = getUserById(userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { message, crew_id } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (message.trim().length === 0) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }

    if (message.length > 500) {
      return NextResponse.json({ error: 'Message too long (max 500 characters)' }, { status: 400 });
    }

    if (!crew_id || typeof crew_id !== 'number') {
      return NextResponse.json({ error: 'crew_id is required' }, { status: 400 });
    }

    // Check if user is a member of this crew
    const userCrew = getUserCrew(userId);
    if (!userCrew || userCrew.id !== crew_id) {
      return NextResponse.json({ error: 'You are not a member of this crew' }, { status: 403 });
    }

    // Server determines timestamp - no client control
    const newMessage = addCrewChatMessage(crew_id, userId, user.username, message);

    if (!newMessage) {
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }

    return NextResponse.json({ message: newMessage });
  } catch (error: any) {
    console.error('Send crew chat message error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

