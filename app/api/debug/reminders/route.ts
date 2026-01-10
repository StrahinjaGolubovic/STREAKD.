import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { formatDateSerbia } from '@/lib/timezone';

export async function GET(request: NextRequest) {
    try {
        const today = formatDateSerbia();

        // Check total users
        const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };

        // Check users with push subscriptions
        const usersWithPush = db.prepare('SELECT COUNT(DISTINCT user_id) as count FROM push_subscriptions').get() as { count: number };

        // Check users who uploaded today
        const uploadedToday = db.prepare(`
            SELECT COUNT(DISTINCT du.user_id) as count
            FROM daily_uploads du
            INNER JOIN weekly_challenges wc ON du.challenge_id = wc.id
            WHERE du.upload_date = ?
            AND wc.status = 'active'
        `).get(today) as { count: number };

        // Get sample users with notification preferences
        const sampleUsers = db.prepare(`
            SELECT id, username, notification_preferences
            FROM users
            LIMIT 5
        `).all() as Array<{ id: number; username: string; notification_preferences: string | null }>;

        // Get all push subscriptions
        const pushSubs = db.prepare(`
            SELECT user_id, endpoint, created_at
            FROM push_subscriptions
        `).all() as Array<{ user_id: number; endpoint: string; created_at: string }>;

        return NextResponse.json({
            today,
            stats: {
                totalUsers: totalUsers.count,
                usersWithPush: usersWithPush.count,
                uploadedToday: uploadedToday.count
            },
            sampleUsers,
            pushSubscriptions: pushSubs
        });
    } catch (error) {
        console.error('Debug error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
