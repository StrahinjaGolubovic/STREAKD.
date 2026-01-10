import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { formatDateSerbia } from '@/lib/timezone';
import { sendPushNotification } from '@/lib/push-notifications';

// This endpoint should be called by a cron service (e.g., Railway Cron, Vercel Cron, or external cron)
// Configure to run every hour from 9am to 11pm Serbia time

export async function GET(request: NextRequest) {
    try {
        // Verify this is a cron request (optional: add secret token)
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const today = formatDateSerbia();
        const currentHour = new Date().getHours(); // Server time, but we'll check Serbia time in preferences

        // Get all users who:
        // 1. Have push subscriptions
        // 2. Have daily reminders enabled
        // 3. Haven't uploaded today
        // 4. Current time matches their reminder preference (or use default times)

        const usersToNotify = db.prepare(`
      SELECT DISTINCT 
        u.id,
        u.username,
        u.notification_preferences,
        s.current_streak
      FROM users u
      INNER JOIN push_subscriptions ps ON u.id = ps.user_id
      LEFT JOIN streaks s ON u.id = s.user_id
      WHERE u.id NOT IN (
        -- Exclude users who already uploaded today
        SELECT DISTINCT du.user_id 
        FROM daily_uploads du
        INNER JOIN weekly_challenges wc ON du.challenge_id = wc.id
        WHERE du.upload_date = ? 
        AND wc.status = 'active'
      )
      AND u.id NOT IN (
        -- Exclude users who used rest day today
        SELECT DISTINCT rd.user_id
        FROM rest_days rd
        INNER JOIN weekly_challenges wc ON rd.challenge_id = wc.id
        WHERE rd.rest_date = ?
        AND wc.status = 'active'
      )
    `).all(today, today) as Array<{
            id: number;
            username: string;
            notification_preferences: string | null;
            current_streak: number | null;
        }>;

        let sentCount = 0;
        let skippedCount = 0;
        const errors: string[] = [];

        for (const user of usersToNotify) {
            try {
                // Parse notification preferences
                let preferences: any = {
                    enabled: true,
                    dailyReminder: true,
                    dailyReminderTime: '18:00',
                };

                if (user.notification_preferences) {
                    try {
                        preferences = JSON.parse(user.notification_preferences);
                    } catch (e) {
                        console.error(`Failed to parse preferences for user ${user.id}`);
                    }
                }

                // Check if daily reminders are enabled
                if (!preferences.enabled || !preferences.dailyReminder) {
                    skippedCount++;
                    continue;
                }

                // Determine notification message based on time of day and streak
                const streak = user.current_streak || 0;
                let title = '💪 Time to hit the gym!';
                let body = "Don't break your streak! Upload your workout photo today.";
                let urgency: 'low' | 'medium' | 'high' = 'low';

                // Morning (6am - 12pm)
                if (currentHour >= 6 && currentHour < 12) {
                    title = '🌅 Good morning!';
                    body = 'Start your day strong! Time for your workout.';
                    urgency = 'low';
                }
                // Afternoon (12pm - 6pm)
                else if (currentHour >= 12 && currentHour < 18) {
                    title = '💪 Afternoon reminder';
                    body = "Don't forget to upload your gym photo today!";
                    urgency = 'low';
                }
                // Evening (6pm - 9pm)
                else if (currentHour >= 18 && currentHour < 21) {
                    title = '⏰ Evening reminder';
                    body = streak > 0
                        ? `Protect your ${streak}-day streak! Upload before midnight.`
                        : 'Upload your workout photo before the day ends!';
                    urgency = 'medium';
                }
                // Late evening (9pm - 11pm) - URGENT
                else if (currentHour >= 21 && currentHour < 23) {
                    title = '🚨 URGENT: Upload needed!';
                    body = streak > 0
                        ? `Your ${streak}-day streak is at risk! Upload NOW before midnight.`
                        : 'Last chance to upload today! Only a few hours left.';
                    urgency = 'high';
                }
                // Night (11pm - midnight) - CRITICAL
                else if (currentHour >= 23) {
                    title = '⚠️ FINAL WARNING!';
                    body = streak > 0
                        ? `STREAK ENDING! ${streak} days will be lost! Upload immediately!`
                        : 'Less than 1 hour left! Upload your photo NOW!';
                    urgency = 'high';
                }
                // Early morning (midnight - 6am) - Skip
                else {
                    skippedCount++;
                    continue;
                }

                // Send push notification
                const result = await sendPushNotification(user.id, {
                    title,
                    body,
                    icon: '/android-chrome-192x192.png',
                    badge: '/favicon-48x48.png',
                    tag: 'daily-reminder', // Same tag replaces previous notification
                    requireInteraction: urgency === 'high', // Require action for urgent notifications
                    data: {
                        type: 'daily-reminder',
                        url: '/dashboard',
                        urgency,
                        streak
                    },
                    actions: urgency === 'high' ? [
                        {
                            action: 'upload',
                            title: 'Upload Now',
                            icon: '/android-chrome-192x192.png'
                        },
                        {
                            action: 'dismiss',
                            title: 'Dismiss'
                        }
                    ] : undefined
                });

                if (result.sent > 0) {
                    sentCount++;
                } else {
                    skippedCount++;
                }
            } catch (error: any) {
                errors.push(`User ${user.id}: ${error.message}`);
                console.error(`Error sending reminder to user ${user.id}:`, error);
            }
        }

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            currentHour,
            today,
            stats: {
                totalUsers: usersToNotify.length,
                sent: sentCount,
                skipped: skippedCount,
                errors: errors.length
            },
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error: any) {
        console.error('Error in daily reminders cron:', error);
        return NextResponse.json({
            error: 'Internal server error',
            message: error.message
        }, { status: 500 });
    }
}
