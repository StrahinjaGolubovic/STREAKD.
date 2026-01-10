import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpiredSubscriptions } from '@/lib/push-notifications';

// Cleanup endpoint for expired push subscriptions
// Should be called once per day (e.g., 3am)

export async function POST(request: NextRequest) {
    try {
        // Verify this is a cron request
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const cleaned = cleanupExpiredSubscriptions();

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            cleaned
        });
    } catch (error: any) {
        console.error('Error in cleanup cron:', error);
        return NextResponse.json({
            error: 'Internal server error',
            message: error.message
        }, { status: 500 });
    }
}
