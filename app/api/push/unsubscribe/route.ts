import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { unsubscribeFromPush } from '@/lib/push-notifications';
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
        const { endpoint } = await request.json();

        if (!endpoint) {
            return NextResponse.json({ error: 'Endpoint required' }, { status: 400 });
        }

        const success = unsubscribeFromPush(userId, endpoint);

        return NextResponse.json({ success });
    } catch (error) {
        console.error('Error unsubscribing from push:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
