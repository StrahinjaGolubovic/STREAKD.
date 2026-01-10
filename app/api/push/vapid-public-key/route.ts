import { NextRequest, NextResponse } from 'next/server';
import { getVapidPublicKey } from '@/lib/push-notifications';

export async function GET(request: NextRequest) {
    try {
        const publicKey = getVapidPublicKey();

        if (!publicKey) {
            return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 });
        }

        return NextResponse.json({ publicKey });
    } catch (error) {
        console.error('Error getting VAPID public key:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
