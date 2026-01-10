import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { sendPushNotification } from '@/lib/push-notifications';
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

        // Send test notification
        const result = await sendPushNotification(userId, {
            title: 'Test Notification',
            body: 'Push notifications are working! You\'re all set.',
            icon: '/android-chrome-192x192.png',
            badge: '/favicon-48x48.png',
            tag: 'test',
            data: {
                type: 'test',
                url: '/dashboard'
            }
        });

        return NextResponse.json({
            success: result.sent > 0,
            sent: result.sent,
            failed: result.failed
        });
    } catch (error) {
        console.error('Error sending test notification:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
