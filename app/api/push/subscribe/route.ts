import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { subscribeToPush } from '@/lib/push-notifications';
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
        const { subscription } = await request.json();

        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
        }

        const userAgent = request.headers.get('user-agent') || undefined;
        const success = subscribeToPush(userId, subscription, userAgent);

        if (!success) {
            return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error subscribing to push:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
