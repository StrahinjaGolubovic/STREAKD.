import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { clearAllNotifications, getUserNotifications, getUnreadNotificationCount } from '@/lib/notifications';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
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
    const notifications = getUserNotifications(userId);
    const unreadCount = getUnreadNotificationCount(userId);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Notifications error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
    const success = clearAllNotifications(userId);

    return NextResponse.json({ success });
  } catch (error) {
    console.error('Clear notifications error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

