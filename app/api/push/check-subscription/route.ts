import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import db from '@/lib/db';
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

        const { subscription } = await request.json();

        if (!subscription || !subscription.endpoint) {
            return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
        }

        // Check if this endpoint is linked to the current user
        const existing = db.prepare(`
            SELECT user_id FROM push_subscriptions 
            WHERE endpoint = ?
        `).get(subscription.endpoint) as { user_id: number } | undefined;

        const isLinkedToCurrentUser = existing && existing.user_id === decoded.userId;

        return NextResponse.json({
            isLinkedToCurrentUser,
            existingUserId: existing?.user_id
        });
    } catch (error) {
        console.error('Error checking subscription:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
