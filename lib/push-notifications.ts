import webpush from 'web-push';
import db from './db';
import { formatDateTimeSerbia } from './timezone';

// Push subscription interface
export interface PushSubscription {
    id: number;
    user_id: number;
    endpoint: string;
    p256dh: string;
    auth: string;
    user_agent?: string;
    created_at: string;
    last_used_at: string;
}

// Push notification interface
export interface PushNotificationPayload {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    data?: any;
    tag?: string;
    requireInteraction?: boolean;
    actions?: Array<{
        action: string;
        title: string;
        icon?: string;
    }>;
}

// Initialize VAPID keys
function initializeVapid() {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:support@streakd.app';

    if (!publicKey || !privateKey) {
        console.warn('VAPID keys not configured. Push notifications will not work.');
        console.warn('Generate keys with: npx web-push generate-vapid-keys');
        return false;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    return true;
}

// Get VAPID public key
export function getVapidPublicKey(): string | null {
    return process.env.VAPID_PUBLIC_KEY || null;
}

// Subscribe user to push notifications
export function subscribeToPush(
    userId: number,
    subscription: {
        endpoint: string;
        keys: {
            p256dh: string;
            auth: string;
        };
    },
    userAgent?: string
): boolean {
    try {
        const now = formatDateTimeSerbia();

        db.prepare(`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, created_at, last_used_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, endpoint) DO UPDATE SET
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        last_used_at = excluded.last_used_at
    `).run(
            userId,
            subscription.endpoint,
            subscription.keys.p256dh,
            subscription.keys.auth,
            userAgent || null,
            now,
            now
        );

        console.log(`User ${userId} subscribed to push notifications`);
        return true;
    } catch (error) {
        console.error('Error subscribing to push:', error);
        return false;
    }
}

// Unsubscribe from push notifications
export function unsubscribeFromPush(userId: number, endpoint: string): boolean {
    try {
        const result = db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?')
            .run(userId, endpoint);

        return result.changes > 0;
    } catch (error) {
        console.error('Error unsubscribing from push:', error);
        return false;
    }
}

// Get user's push subscriptions
export function getUserSubscriptions(userId: number): PushSubscription[] {
    try {
        return db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?')
            .all(userId) as PushSubscription[];
    } catch (error) {
        console.error('Error getting user subscriptions:', error);
        return [];
    }
}

// Send push notification to a user (all their devices)
export async function sendPushNotification(
    userId: number,
    notification: PushNotificationPayload
): Promise<{ sent: number; failed: number }> {
    if (!initializeVapid()) {
        return { sent: 0, failed: 0 };
    }

    try {
        // Check user's notification preferences
        const user = db.prepare('SELECT notification_preferences FROM users WHERE id = ?').get(userId) as any;
        if (!user) {
            return { sent: 0, failed: 0 };
        }

        let preferences: any = {
            enabled: true,
            dailyReminder: true,
            dailyReminderTime: '18:00',
            streakWarning: true,
            achievements: true,
            friendActivity: true,
            crewActivity: true,
            adminMessages: true
        };

        if (user.notification_preferences) {
            try {
                preferences = JSON.parse(user.notification_preferences);
            } catch (e) {
                console.error('Error parsing notification preferences:', e);
            }
        }

        // Check if notifications are enabled
        if (!preferences.enabled) {
            return { sent: 0, failed: 0 };
        }

        // Get all subscriptions for this user
        const subscriptions = getUserSubscriptions(userId);
        if (subscriptions.length === 0) {
            return { sent: 0, failed: 0 };
        }

        let sent = 0;
        let failed = 0;
        const expiredEndpoints: string[] = [];

        // Send to all devices
        for (const sub of subscriptions) {
            try {
                const pushSubscription = {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth
                    }
                };

                const payload = JSON.stringify(notification);

                await webpush.sendNotification(pushSubscription, payload);

                // Update last_used_at
                const now = formatDateTimeSerbia();
                db.prepare('UPDATE push_subscriptions SET last_used_at = ? WHERE id = ?')
                    .run(now, sub.id);

                sent++;
            } catch (error: any) {
                console.error(`Error sending push to ${sub.endpoint}:`, error);

                // If subscription is expired or invalid, mark for deletion
                if (error.statusCode === 410 || error.statusCode === 404) {
                    expiredEndpoints.push(sub.endpoint);
                }

                failed++;
            }
        }

        // Clean up expired subscriptions
        for (const endpoint of expiredEndpoints) {
            unsubscribeFromPush(userId, endpoint);
        }

        return { sent, failed };
    } catch (error) {
        console.error('Error in sendPushNotification:', error);
        return { sent: 0, failed: 0 };
    }
}

// Send push notification to multiple users
export async function sendBulkPushNotifications(
    userIds: number[],
    notification: PushNotificationPayload
): Promise<{ totalSent: number; totalFailed: number }> {
    let totalSent = 0;
    let totalFailed = 0;

    for (const userId of userIds) {
        const result = await sendPushNotification(userId, notification);
        totalSent += result.sent;
        totalFailed += result.failed;
    }

    return { totalSent, totalFailed };
}

// Clean up expired subscriptions (run periodically)
export function cleanupExpiredSubscriptions(): number {
    try {
        // Delete subscriptions not used in 90 days
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const cutoffDate = ninetyDaysAgo.toISOString().split('T')[0];

        const result = db.prepare('DELETE FROM push_subscriptions WHERE last_used_at < ?')
            .run(cutoffDate);

        console.log(`Cleaned up ${result.changes} expired push subscriptions`);
        return result.changes;
    } catch (error) {
        console.error('Error cleaning up subscriptions:', error);
        return 0;
    }
}

// Helper: Send achievement unlock notification
export async function sendAchievementNotification(userId: number, achievementName: string, achievementIcon: string) {
    return sendPushNotification(userId, {
        title: 'Achievement Unlocked!',
        body: `${achievementIcon} ${achievementName}`,
        icon: '/android-chrome-192x192.png',
        badge: '/favicon-48x48.png',
        tag: 'achievement',
        data: {
            type: 'achievement',
            url: '/achievements'
        }
    });
}

// Helper: Send daily reminder notification
export async function sendDailyReminderNotification(userId: number) {
    return sendPushNotification(userId, {
        title: 'Time to hit the gym!',
        body: "Don't break your streak! Upload your workout photo today.",
        icon: '/android-chrome-192x192.png',
        badge: '/favicon-48x48.png',
        tag: 'daily-reminder',
        requireInteraction: false,
        data: {
            type: 'reminder',
            url: '/dashboard'
        }
    });
}

// Helper: Send streak warning notification
export async function sendStreakWarningNotification(userId: number, currentStreak: number) {
    return sendPushNotification(userId, {
        title: 'Your streak is at risk!',
        body: `Don't lose your ${currentStreak}-day streak! Upload before midnight.`,
        icon: '/android-chrome-192x192.png',
        badge: '/favicon-48x48.png',
        tag: 'streak-warning',
        requireInteraction: true,
        data: {
            type: 'streak-warning',
            url: '/dashboard'
        }
    });
}

// Helper: Send friend activity notification
export async function sendFriendActivityNotification(
    userId: number,
    friendName: string,
    activityType: 'upload' | 'milestone' | 'nudge'
) {
    const messages = {
        upload: `${friendName} just uploaded their workout!`,
        milestone: `${friendName} reached a new milestone!`,
        nudge: `${friendName} nudged you!`
    };

    return sendPushNotification(userId, {
        title: 'Friend Activity',
        body: messages[activityType],
        icon: '/android-chrome-192x192.png',
        badge: '/favicon-48x48.png',
        tag: 'friend-activity',
        data: {
            type: 'friend-activity',
            url: '/dashboard'
        }
    });
}

// Helper: Send crew notification
export async function sendCrewNotification(
    userId: number,
    crewName: string,
    notificationType: 'invite' | 'accepted' | 'milestone'
) {
    const messages = {
        invite: `You've been invited to join ${crewName}!`,
        accepted: `Your request to join ${crewName} was accepted!`,
        milestone: `${crewName} reached a new milestone!`
    };

    return sendPushNotification(userId, {
        title: 'Crew Update',
        body: messages[notificationType],
        icon: '/android-chrome-192x192.png',
        badge: '/favicon-48x48.png',
        tag: 'crew-notification',
        data: {
            type: 'crew',
            url: '/crews'
        }
    });
}
