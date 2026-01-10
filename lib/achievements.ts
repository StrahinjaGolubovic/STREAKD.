import db from './db';
import { formatDateTimeSerbia } from './timezone';

// Achievement system launch date - only count actions after this date
// This prevents old users from getting achievements for historical data
export const ACHIEVEMENT_SYSTEM_LAUNCH_DATE = '2026-01-10'; // YYYY-MM-DD format

// Achievement types
export interface Achievement {
    id: number;
    key: string;
    name: string;
    description: string;
    icon: string;
    category: 'streak' | 'upload' | 'trophy' | 'social' | 'special';
    tier: 'bronze' | 'silver' | 'gold' | 'platinum';
    points: number;
    hidden: boolean;
    created_at: string;
}

export interface UserAchievement {
    id: number;
    user_id: number;
    achievement_id: number;
    unlocked_at: string;
    progress: number;
    notified: boolean;
}

export interface AchievementWithStatus extends Achievement {
    unlocked: boolean;
    unlocked_at?: string;
    progress: number;
}

// Achievement definitions
const ACHIEVEMENT_DEFINITIONS = [
    // Streak Achievements
    { key: 'first_upload', name: 'First Steps', description: 'Upload your first photo', icon: 'target', category: 'upload', tier: 'bronze', points: 10 },
    { key: 'streak_3', name: 'Getting Started', description: 'Maintain a 3-day streak', icon: 'flame', category: 'streak', tier: 'bronze', points: 15 },
    { key: 'streak_7', name: 'Week Warrior', description: 'Complete your first week', icon: 'muscle', category: 'streak', tier: 'silver', points: 25 },
    { key: 'streak_30', name: 'Monthly Master', description: 'Reach a 30-day streak', icon: 'star', category: 'streak', tier: 'gold', points: 50 },
    { key: 'streak_100', name: 'Century Club', description: 'Reach a 100-day streak', icon: 'hundred', category: 'streak', tier: 'gold', points: 100 },
    { key: 'streak_365', name: 'The Iron Will', description: 'Reach a 365-day streak', icon: 'iron', category: 'streak', tier: 'platinum', points: 365 },

    // Upload Achievements
    { key: 'uploads_10', name: 'Dedicated', description: 'Upload 10 photos', icon: 'camera', category: 'upload', tier: 'bronze', points: 20 },
    { key: 'uploads_50', name: 'Committed', description: 'Upload 50 photos', icon: 'camera', category: 'upload', tier: 'silver', points: 50 },
    { key: 'uploads_100', name: 'Unstoppable', description: 'Upload 100 photos', icon: 'video', category: 'upload', tier: 'gold', points: 100 },
    { key: 'uploads_500', name: 'Legend', description: 'Upload 500 photos', icon: 'trophy', category: 'upload', tier: 'platinum', points: 500 },
    { key: 'perfect_week', name: 'Perfectionist', description: 'Complete a perfect week (7/7)', icon: 'sparkles', category: 'upload', tier: 'silver', points: 30 },
    { key: 'perfect_month', name: 'Flawless', description: 'Complete 4 consecutive perfect weeks', icon: 'diamond', category: 'upload', tier: 'gold', points: 100 },

    // Trophy Achievements
    { key: 'trophies_100', name: 'Collector', description: 'Earn 100 trophies', icon: 'medal_bronze', category: 'trophy', tier: 'bronze', points: 20 },
    { key: 'trophies_500', name: 'Hoarder', description: 'Earn 500 trophies', icon: 'medal_silver', category: 'trophy', tier: 'silver', points: 50 },
    { key: 'trophies_1000', name: 'Wealthy', description: 'Earn 1,000 trophies', icon: 'medal_gold', category: 'trophy', tier: 'gold', points: 100 },
    { key: 'trophies_5000', name: 'Tycoon', description: 'Earn 5,000 trophies', icon: 'coins', category: 'trophy', tier: 'platinum', points: 500 },

    // Social Achievements
    { key: 'first_friend', name: 'Friendly', description: 'Add your first friend', icon: 'hand_wave', category: 'social', tier: 'bronze', points: 10 },
    { key: 'friends_10', name: 'Popular', description: 'Have 10 friends', icon: 'users', category: 'social', tier: 'silver', points: 30 },
    { key: 'crew_member', name: 'Team Player', description: 'Join a crew', icon: 'handshake', category: 'social', tier: 'bronze', points: 15 },
    { key: 'crew_leader', name: 'Leader', description: 'Create a crew', icon: 'shield', category: 'social', tier: 'silver', points: 40 },
    { key: 'helpful', name: 'Motivator', description: 'Nudge friends 10 times', icon: 'bell', category: 'social', tier: 'silver', points: 25 },

    // Special Achievements
    { key: 'early_bird', name: 'Early Bird', description: 'Upload before 6am (5 times)', icon: 'sunrise', category: 'special', tier: 'silver', points: 35 },
    { key: 'night_owl', name: 'Night Owl', description: 'Upload after 10pm (5 times)', icon: 'moon', category: 'special', tier: 'silver', points: 35 },
    { key: 'weekend_warrior', name: 'Weekend Warrior', description: 'Upload on Saturday and Sunday (10 weekends)', icon: 'dumbbell', category: 'special', tier: 'gold', points: 75 },
    { key: 'comeback_kid', name: 'Comeback Kid', description: 'Rebuild a streak after breaking it', icon: 'refresh', category: 'special', tier: 'silver', points: 40 },
];

// Initialize achievements in database
export function initializeAchievements(): void {
    try {
        // Check if achievements already exist
        const count = db.prepare('SELECT COUNT(*) as count FROM achievements').get() as { count: number };

        if (count.count === 0) {
            // Insert all achievement definitions
            const insertStmt = db.prepare(`
        INSERT INTO achievements (key, name, description, icon, category, tier, points, hidden, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
      `);

            const now = formatDateTimeSerbia();
            for (const achievement of ACHIEVEMENT_DEFINITIONS) {
                try {
                    insertStmt.run(
                        achievement.key,
                        achievement.name,
                        achievement.description,
                        achievement.icon,
                        achievement.category,
                        achievement.tier,
                        achievement.points,
                        now
                    );
                } catch (error) {
                    // Skip if already exists
                    console.log(`Achievement ${achievement.key} already exists, skipping`);
                }
            }

            console.log(`Initialized ${ACHIEVEMENT_DEFINITIONS.length} achievements`);
        }
    } catch (error) {
        console.error('Error initializing achievements:', error);
    }
}

// Get all achievements with user's unlock status
export function getUserAchievements(userId: number): AchievementWithStatus[] {
    try {
        const achievements = db.prepare(`
      SELECT 
        a.*,
        ua.unlocked_at,
        COALESCE(ua.progress, 0) as progress,
        COALESCE(ua.notified, 0) as notified,
        CASE WHEN ua.id IS NOT NULL THEN 1 ELSE 0 END as unlocked
      FROM achievements a
      LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = ?
      ORDER BY a.category, a.points
    `).all(userId) as AchievementWithStatus[];

        return achievements;
    } catch (error) {
        console.error('Error fetching user achievements:', error);
        return [];
    }
}

// Check if user has unlocked an achievement
export function hasAchievement(userId: number, achievementKey: string): boolean {
    try {
        const result = db.prepare(`
      SELECT 1 FROM user_achievements ua
      JOIN achievements a ON ua.achievement_id = a.id
      WHERE ua.user_id = ? AND a.key = ?
    `).get(userId, achievementKey);

        return !!result;
    } catch (error) {
        console.error('Error checking achievement:', error);
        return false;
    }
}

// Unlock an achievement for a user
export function unlockAchievement(userId: number, achievementKey: string): { unlocked: boolean; achievement?: Achievement } {
    try {
        // Check if already unlocked
        if (hasAchievement(userId, achievementKey)) {
            return { unlocked: false };
        }

        // Get achievement
        const achievement = db.prepare('SELECT * FROM achievements WHERE key = ?').get(achievementKey) as Achievement | undefined;
        if (!achievement) {
            console.error(`Achievement ${achievementKey} not found`);
            return { unlocked: false };
        }

        // Unlock achievement
        const now = formatDateTimeSerbia();
        db.prepare(`
      INSERT INTO user_achievements (user_id, achievement_id, unlocked_at, progress, notified)
      VALUES (?, ?, ?, 100, 0)
    `).run(userId, achievement.id, now);

        console.log(`User ${userId} unlocked achievement: ${achievementKey}`);
        return { unlocked: true, achievement };
    } catch (error) {
        console.error('Error unlocking achievement:', error);
        return { unlocked: false };
    }
}

// Update progress for an achievement
export function updateAchievementProgress(userId: number, achievementKey: string, progress: number): void {
    try {
        const achievement = db.prepare('SELECT * FROM achievements WHERE key = ?').get(achievementKey) as Achievement | undefined;
        if (!achievement) return;

        // Check if already unlocked
        if (hasAchievement(userId, achievementKey)) return;

        // Update or insert progress
        db.prepare(`
      INSERT INTO user_achievements (user_id, achievement_id, progress, notified)
      VALUES (?, ?, ?, 0)
      ON CONFLICT(user_id, achievement_id) DO UPDATE SET progress = ?
    `).run(userId, achievement.id, progress, progress);
    } catch (error) {
        console.error('Error updating achievement progress:', error);
    }
}

// Check and unlock achievements based on trigger
export function checkAndUnlockAchievements(userId: number, trigger: string, data?: any): Achievement[] {
    const unlockedAchievements: Achievement[] = [];

    try {
        // Get user stats (only count data after achievement system launch)
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
        if (!user) return [];

        const streak = db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(userId) as any;

        // Only count uploads after achievement system launch
        const uploadCount = db.prepare(`
            SELECT COUNT(*) as count 
            FROM daily_uploads 
            WHERE user_id = ? 
            AND verification_status = 'approved'
            AND DATE(upload_date) >= DATE(?)
        `).get(userId, ACHIEVEMENT_SYSTEM_LAUNCH_DATE) as { count: number };

        // Only count friends added after achievement system launch
        // Use DATE() to ensure proper comparison regardless of timestamp format
        const friendCount = db.prepare(`
            SELECT COUNT(*) as count 
            FROM friends 
            WHERE user_id = ? 
            AND DATE(created_at) >= DATE(?)
        `).get(userId, ACHIEVEMENT_SYSTEM_LAUNCH_DATE) as { count: number };

        // Only count nudges after achievement system launch
        const nudgeCount = db.prepare(`
            SELECT COUNT(DISTINCT nudge_date) as count 
            FROM nudges 
            WHERE from_user_id = ?
            AND DATE(nudge_date) >= DATE(?)
        `).get(userId, ACHIEVEMENT_SYSTEM_LAUNCH_DATE) as { count: number };

        // Check streak achievements
        if (trigger === 'streak' || trigger === 'upload') {
            const currentStreak = streak?.current_streak || 0;

            if (currentStreak >= 3 && !hasAchievement(userId, 'streak_3')) {
                const result = unlockAchievement(userId, 'streak_3');
                if (result.unlocked && result.achievement) unlockedAchievements.push(result.achievement);
            }
            if (currentStreak >= 7 && !hasAchievement(userId, 'streak_7')) {
                const result = unlockAchievement(userId, 'streak_7');
                if (result.unlocked && result.achievement) unlockedAchievements.push(result.achievement);
            }
            if (currentStreak >= 30 && !hasAchievement(userId, 'streak_30')) {
                const result = unlockAchievement(userId, 'streak_30');
                if (result.unlocked && result.achievement) unlockedAchievements.push(result.achievement);
            }
            if (currentStreak >= 100 && !hasAchievement(userId, 'streak_100')) {
                const result = unlockAchievement(userId, 'streak_100');
                if (result.unlocked && result.achievement) unlockedAchievements.push(result.achievement);
            }
            if (currentStreak >= 365 && !hasAchievement(userId, 'streak_365')) {
                const result = unlockAchievement(userId, 'streak_365');
                if (result.unlocked && result.achievement) unlockedAchievements.push(result.achievement);
            }
        }

        // Check upload achievements
        if (trigger === 'upload') {
            const count = uploadCount.count;

            if (count === 1 && !hasAchievement(userId, 'first_upload')) {
                const result = unlockAchievement(userId, 'first_upload');
                if (result.unlocked && result.achievement) unlockedAchievements.push(result.achievement);
            }
            if (count >= 10 && !hasAchievement(userId, 'uploads_10')) {
                const result = unlockAchievement(userId, 'uploads_10');
                if (result.unlocked && result.achievement) unlockedAchievements.push(result.achievement);
            }
            if (count >= 50 && !hasAchievement(userId, 'uploads_50')) {
                const result = unlockAchievement(userId, 'uploads_50');
                if (result.unlocked && result.achievement) unlockedAchievements.push(result.achievement);
            }
            if (count >= 100 && !hasAchievement(userId, 'uploads_100')) {
                const result = unlockAchievement(userId, 'uploads_100');
                if (result.unlocked && result.achievement) unlockedAchievements.push(result.achievement);
            }
            if (count >= 500 && !hasAchievement(userId, 'uploads_500')) {
                const result = unlockAchievement(userId, 'uploads_500');
                if (result.unlocked && result.achievement) unlockedAchievements.push(result.achievement);
            }

            // Check time-based achievements
            if (data?.uploadTime) {
                const hour = new Date(data.uploadTime).getHours();

                if (hour < 6) {
                    // Early bird - only count uploads after launch date
                    const earlyBirdCount = db.prepare(`
            SELECT COUNT(*) as count FROM daily_uploads
            WHERE user_id = ? AND verification_status = 'approved'
            AND strftime('%H', created_at) < '06'
            AND DATE(upload_date) >= DATE(?)
          `).get(userId, ACHIEVEMENT_SYSTEM_LAUNCH_DATE) as { count: number };

                    updateAchievementProgress(userId, 'early_bird', Math.min(100, (earlyBirdCount.count / 5) * 100));

                    if (earlyBirdCount.count >= 5 && !hasAchievement(userId, 'early_bird')) {
                        const result = unlockAchievement(userId, 'early_bird');
                        if (result.unlocked && result.achievement) unlockedAchievements.push(result.achievement);
                    }
                }

                if (hour >= 22) {
                    // Night owl - only count uploads after launch date
                    const nightOwlCount = db.prepare(`
            SELECT COUNT(*) as count FROM daily_uploads
            WHERE user_id = ? AND verification_status = 'approved'
            AND strftime('%H', created_at) >= '22'
            AND DATE(upload_date) >= DATE(?)
          `).get(userId, ACHIEVEMENT_SYSTEM_LAUNCH_DATE) as { count: number };

                    updateAchievementProgress(userId, 'night_owl', Math.min(100, (nightOwlCount.count / 5) * 100));

                    if (nightOwlCount.count >= 5 && !hasAchievement(userId, 'night_owl')) {
                        const result = unlockAchievement(userId, 'night_owl');
                        if (result.unlocked && result.achievement) unlockedAchievements.push(result.achievement);
                    }
                }
            }
        }

        // Check trophy achievements
        if (trigger === 'trophy') {
            const trophies = user.trophies || 0;

            if (trophies >= 100 && !hasAchievement(userId, 'trophies_100')) {
                const result = unlockAchievement(userId, 'trophies_100');
                if (result.unlocked && result.achievement) unlockedAchievements.push(result.achievement);
            }
            if (trophies >= 500 && !hasAchievement(userId, 'trophies_500')) {
                const result = unlockAchievement(userId, 'trophies_500');
                if (result.unlocked && result.achievement) unlockedAchievements.push(result.achievement);
            }
            if (trophies >= 1000 && !hasAchievement(userId, 'trophies_1000')) {
                const result = unlockAchievement(userId, 'trophies_1000');
                if (result.unlocked && result.achievement) unlockedAchievements.push(result.achievement);
            }
            if (trophies >= 5000 && !hasAchievement(userId, 'trophies_5000')) {
                const result = unlockAchievement(userId, 'trophies_5000');
                if (result.unlocked && result.achievement) unlockedAchievements.push(result.achievement);
            }
        }

        // Check social achievements
        if (trigger === 'social') {
            // Friend achievements
            const count = friendCount.count;

            if (count === 1 && !hasAchievement(userId, 'first_friend')) {
                const result = unlockAchievement(userId, 'first_friend');
                if (result.unlocked && result.achievement) unlockedAchievements.push(result.achievement);
            }
            if (count >= 10 && !hasAchievement(userId, 'friends_10')) {
                const result = unlockAchievement(userId, 'friends_10');
                if (result.unlocked && result.achievement) unlockedAchievements.push(result.achievement);
            }

            // Crew achievements
            const crewMembership = db.prepare('SELECT crew_id FROM crew_members WHERE user_id = ?').get(userId) as { crew_id: number } | undefined;
            if (crewMembership && !hasAchievement(userId, 'crew_member')) {
                const result = unlockAchievement(userId, 'crew_member');
                if (result.unlocked && result.achievement) unlockedAchievements.push(result.achievement);
            }

            const crewLeadership = db.prepare('SELECT id FROM crews WHERE leader_id = ?').get(userId) as { id: number } | undefined;
            if (crewLeadership && !hasAchievement(userId, 'crew_leader')) {
                const result = unlockAchievement(userId, 'crew_leader');
                if (result.unlocked && result.achievement) unlockedAchievements.push(result.achievement);
            }

            // Nudge achievement
            const nudges = nudgeCount.count;
            updateAchievementProgress(userId, 'helpful', Math.min(100, (nudges / 10) * 100));

            if (nudges >= 10 && !hasAchievement(userId, 'helpful')) {
                const result = unlockAchievement(userId, 'helpful');
                if (result.unlocked && result.achievement) unlockedAchievements.push(result.achievement);
            }
        }

        // Check perfect week achievement
        if (trigger === 'upload') {
            // Get current active challenge
            const challenge = db.prepare(`
                SELECT id, start_date, end_date 
                FROM weekly_challenges 
                WHERE user_id = ? AND status = 'active'
                ORDER BY start_date DESC LIMIT 1
            `).get(userId) as { id: number; start_date: string; end_date: string } | undefined;

            if (challenge) {
                // Count uploads this week
                const weekUploads = db.prepare(`
                    SELECT COUNT(*) as count 
                    FROM daily_uploads 
                    WHERE user_id = ? 
                    AND challenge_id = ?
                    AND verification_status = 'approved'
                `).get(userId, challenge.id) as { count: number };

                // Count rest days this week
                const restDays = db.prepare(`
                    SELECT COUNT(*) as count 
                    FROM rest_days 
                    WHERE user_id = ? 
                    AND challenge_id = ?
                `).get(userId, challenge.id) as { count: number };

                // Perfect week = 7 uploads, 0 rest days
                if (weekUploads.count === 7 && restDays.count === 0 && !hasAchievement(userId, 'perfect_week')) {
                    const result = unlockAchievement(userId, 'perfect_week');
                    if (result.unlocked && result.achievement) unlockedAchievements.push(result.achievement);
                }
            }

            // Check weekend warrior - only count weekends after launch date
            const weekendUploads = db.prepare(`
                SELECT COUNT(*) as count 
                FROM daily_uploads 
                WHERE user_id = ? 
                AND verification_status = 'approved'
                AND DATE(upload_date) >= DATE(?)
                AND (CAST(strftime('%w', upload_date) AS INTEGER) = 0 OR CAST(strftime('%w', upload_date) AS INTEGER) = 6)
            `).get(userId, ACHIEVEMENT_SYSTEM_LAUNCH_DATE) as { count: number };

            // Count unique weekends (group by year-week)
            const uniqueWeekends = db.prepare(`
                SELECT COUNT(DISTINCT strftime('%Y-%W', upload_date)) as count
                FROM daily_uploads
                WHERE user_id = ?
                AND verification_status = 'approved'
                AND DATE(upload_date) >= DATE(?)
                AND (CAST(strftime('%w', upload_date) AS INTEGER) = 0 OR CAST(strftime('%w', upload_date) AS INTEGER) = 6)
            `).get(userId, ACHIEVEMENT_SYSTEM_LAUNCH_DATE) as { count: number };

            updateAchievementProgress(userId, 'weekend_warrior', Math.min(100, (uniqueWeekends.count / 10) * 100));

            if (uniqueWeekends.count >= 10 && !hasAchievement(userId, 'weekend_warrior')) {
                const result = unlockAchievement(userId, 'weekend_warrior');
                if (result.unlocked && result.achievement) unlockedAchievements.push(result.achievement);
            }

            // Check comeback kid (rebuilt streak after breaking it)
            if (streak && streak.longest_streak > streak.current_streak && streak.current_streak >= 7) {
                if (!hasAchievement(userId, 'comeback_kid')) {
                    const result = unlockAchievement(userId, 'comeback_kid');
                    if (result.unlocked && result.achievement) unlockedAchievements.push(result.achievement);
                }
            }
        }

    } catch (error) {
        console.error('Error checking achievements:', error);
    }

    return unlockedAchievements;
}

// Set featured badges on user profile
export function setFeaturedBadges(userId: number, achievementIds: number[]): boolean {
    try {
        // Validate that user has unlocked all these achievements
        for (const achievementId of achievementIds) {
            const unlocked = db.prepare(`
        SELECT 1 FROM user_achievements
        WHERE user_id = ? AND achievement_id = ?
      `).get(userId, achievementId);

            if (!unlocked) {
                console.error(`User ${userId} has not unlocked achievement ${achievementId}`);
                return false;
            }
        }

        // Limit to 3 featured badges
        const featured = achievementIds.slice(0, 3);

        // Update user
        db.prepare('UPDATE users SET featured_badges = ? WHERE id = ?')
            .run(JSON.stringify(featured), userId);

        return true;
    } catch (error) {
        console.error('Error setting featured badges:', error);
        return false;
    }
}

// Get achievement statistics
export function getAchievementStats(): any {
    try {
        const totalAchievements = db.prepare('SELECT COUNT(*) as count FROM achievements').get() as { count: number };
        const totalUnlocks = db.prepare('SELECT COUNT(*) as count FROM user_achievements').get() as { count: number };
        const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };

        const mostUnlocked = db.prepare(`
      SELECT a.name, a.icon, COUNT(*) as unlock_count
      FROM user_achievements ua
      JOIN achievements a ON ua.achievement_id = a.id
      GROUP BY a.id
      ORDER BY unlock_count DESC
      LIMIT 5
    `).all();

        const rarest = db.prepare(`
      SELECT a.name, a.icon, COUNT(*) as unlock_count
      FROM achievements a
      LEFT JOIN user_achievements ua ON a.id = ua.achievement_id
      GROUP BY a.id
      ORDER BY unlock_count ASC
      LIMIT 5
    `).all();

        return {
            totalAchievements: totalAchievements.count,
            totalUnlocks: totalUnlocks.count,
            averagePerUser: totalUsers.count > 0 ? (totalUnlocks.count / totalUsers.count).toFixed(1) : 0,
            mostUnlocked,
            rarest
        };
    } catch (error) {
        console.error('Error getting achievement stats:', error);
        return null;
    }
}
