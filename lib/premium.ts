import db from './db';
import { formatDateTimeSerbia } from './timezone';

export interface PremiumUser {
    id: number;
    username: string;
    is_premium: boolean;
    premium_granted_at?: string;
    premium_granted_by?: number;
    username_color?: string;
}

// Check if user has premium status
export function isPremiumUser(userId: number): boolean {
    try {
        const user = db.prepare('SELECT is_premium FROM users WHERE id = ?').get(userId) as { is_premium: number } | undefined;
        return user?.is_premium === 1;
    } catch (error) {
        console.error('Error checking premium status:', error);
        return false;
    }
}

// Grant premium to a user (admin only)
export function grantPremium(userId: number, grantedBy: number): boolean {
    try {
        const now = formatDateTimeSerbia();
        const defaultColor = 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)';

        db.prepare(`
            UPDATE users 
            SET is_premium = 1,
                premium_granted_at = ?,
                premium_granted_by = ?,
                username_color = COALESCE(username_color, ?)
            WHERE id = ?
        `).run(now, grantedBy, defaultColor, userId);

        console.log(`Premium granted to user ${userId} by admin ${grantedBy}`);
        return true;
    } catch (error) {
        console.error('Error granting premium:', error);
        return false;
    }
}

// Revoke premium from a user (admin only)
export function revokePremium(userId: number): boolean {
    try {
        db.prepare(`
            UPDATE users 
            SET is_premium = 0,
                premium_granted_at = NULL,
                premium_granted_by = NULL
            WHERE id = ?
        `).run(userId);

        console.log(`Premium revoked from user ${userId}`);
        return true;
    } catch (error) {
        console.error('Error revoking premium:', error);
        return false;
    }
}

// Get all premium users
export function getPremiumUsers(): PremiumUser[] {
    try {
        return db.prepare(`
            SELECT id, username, is_premium, premium_granted_at, premium_granted_by, username_color
            FROM users
            WHERE is_premium = 1
            ORDER BY premium_granted_at DESC
        `).all() as PremiumUser[];
    } catch (error) {
        console.error('Error getting premium users:', error);
        return [];
    }
}

// Update premium user's username color (admin only)
export function setPremiumUsernameColor(userId: number, color: string): boolean {
    try {
        if (!isPremiumUser(userId)) {
            return false;
        }

        db.prepare('UPDATE users SET username_color = ? WHERE id = ?').run(color, userId);
        return true;
    } catch (error) {
        console.error('Error setting username color:', error);
        return false;
    }
}

// Get premium rest day limit
export function getPremiumRestDayLimit(userId: number): number {
    return isPremiumUser(userId) ? 5 : 3;
}

// Get premium daily coins multiplier
export function getPremiumCoinMultiplier(userId: number): number {
    return isPremiumUser(userId) ? 1.5 : 1.0;
}
