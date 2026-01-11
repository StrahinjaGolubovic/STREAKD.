import db from './db';
import { addCoins } from './coins';

export interface Cosmetic {
    id: number;
    name: string;
    description: string | null;
    type: 'avatar_frame' | 'name_color' | 'chat_badge';
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    price: number;
    data: string; // JSON string
    requirements: string | null; // JSON string
    is_premium_only: number;
    is_active: number;
    created_at: string;
}

export interface UserCosmetic {
    id: number;
    user_id: number;
    cosmetic_id: number;
    purchased_at: string;
}

export interface EquippedCosmetic {
    user_id: number;
    cosmetic_type: string;
    cosmetic_id: number;
    equipped_at: string;
}

export interface CosmeticWithOwnership extends Cosmetic {
    owned: boolean;
    equipped: boolean;
}

/**
 * Get all available cosmetics
 */
export function getAllCosmetics(): Cosmetic[] {
    const stmt = db.prepare(`
    SELECT * FROM cosmetics
    WHERE is_active = 1
    ORDER BY type, rarity, price
  `);
    return stmt.all() as Cosmetic[];
}

/**
 * Get all cosmetics with ownership status for a user
 */
export function getCosmeticsWithOwnership(userId: number): CosmeticWithOwnership[] {
    const stmt = db.prepare(`
    SELECT 
      c.*,
      CASE WHEN uc.id IS NOT NULL THEN 1 ELSE 0 END as owned,
      CASE WHEN uec.cosmetic_id IS NOT NULL THEN 1 ELSE 0 END as equipped
    FROM cosmetics c
    LEFT JOIN user_cosmetics uc ON c.id = uc.cosmetic_id AND uc.user_id = ?
    LEFT JOIN user_equipped_cosmetics uec ON c.id = uec.cosmetic_id AND uec.user_id = ?
    WHERE c.is_active = 1
    ORDER BY c.type, c.rarity, c.price
  `);
    return stmt.all(userId, userId) as CosmeticWithOwnership[];
}

/**
 * Get cosmetics owned by a user
 */
export function getUserCosmetics(userId: number): Cosmetic[] {
    const stmt = db.prepare(`
    SELECT c.* FROM cosmetics c
    INNER JOIN user_cosmetics uc ON c.id = uc.cosmetic_id
    WHERE uc.user_id = ?
    ORDER BY c.type, c.rarity, c.price
  `);
    return stmt.all(userId) as Cosmetic[];
}

/**
 * Get equipped cosmetics for a user
 */
export function getEquippedCosmetics(userId: number): Record<string, Cosmetic> {
    const stmt = db.prepare(`
    SELECT c.*, uec.cosmetic_type FROM cosmetics c
    INNER JOIN user_equipped_cosmetics uec ON c.id = uec.cosmetic_id
    WHERE uec.user_id = ?
  `);
    const rows = stmt.all(userId) as (Cosmetic & { cosmetic_type: string })[];

    const equipped: Record<string, Cosmetic> = {};
    for (const row of rows) {
        const { cosmetic_type, ...cosmetic } = row;
        equipped[cosmetic_type] = cosmetic;
    }
    return equipped;
}

/**
 * Check if user owns a cosmetic
 */
export function ownsCosmetic(userId: number, cosmeticId: number): boolean {
    const stmt = db.prepare(`
    SELECT 1 FROM user_cosmetics
    WHERE user_id = ? AND cosmetic_id = ?
  `);
    return stmt.get(userId, cosmeticId) !== undefined;
}

/**
 * Check if user can purchase a cosmetic
 */
export function canPurchaseCosmetic(userId: number, cosmeticId: number): {
    canPurchase: boolean;
    reason?: string;
} {
    // Get cosmetic
    const cosmetic = db.prepare('SELECT * FROM cosmetics WHERE id = ?').get(cosmeticId) as Cosmetic | undefined;
    if (!cosmetic) {
        return { canPurchase: false, reason: 'Cosmetic not found' };
    }

    if (!cosmetic.is_active) {
        return { canPurchase: false, reason: 'Cosmetic is not available' };
    }

    // Check if already owned
    if (ownsCosmetic(userId, cosmeticId)) {
        return { canPurchase: false, reason: 'You already own this cosmetic' };
    }

    // Check if premium only
    if (cosmetic.is_premium_only) {
        const user = db.prepare('SELECT is_premium FROM users WHERE id = ?').get(userId) as { is_premium: number } | undefined;
        if (!user || !user.is_premium) {
            return { canPurchase: false, reason: 'This cosmetic is premium-only' };
        }
    }

    // Check requirements
    if (cosmetic.requirements) {
        try {
            const reqs = JSON.parse(cosmetic.requirements);
            // TODO: Implement requirement checking (level, streak, achievements, etc.)
            // For now, we'll skip this
        } catch (e) {
            // Invalid requirements JSON, skip
        }
    }

    // Check coins
    const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId) as { coins: number } | undefined;
    if (!user || user.coins < cosmetic.price) {
        return { canPurchase: false, reason: 'Not enough coins' };
    }

    return { canPurchase: true };
}

/**
 * Purchase a cosmetic
 */
export function purchaseCosmetic(userId: number, cosmeticId: number): {
    success: boolean;
    message: string;
    newBalance?: number;
} {
    const check = canPurchaseCosmetic(userId, cosmeticId);
    if (!check.canPurchase) {
        return { success: false, message: check.reason || 'Cannot purchase this cosmetic' };
    }

    const cosmetic = db.prepare('SELECT * FROM cosmetics WHERE id = ?').get(cosmeticId) as Cosmetic;

    try {
        // Deduct coins
        addCoins(userId, -cosmetic.price, `Purchased ${cosmetic.name}`);

        // Add to user_cosmetics
        db.prepare(`
      INSERT INTO user_cosmetics (user_id, cosmetic_id)
      VALUES (?, ?)
    `).run(userId, cosmeticId);

        // Get new balance
        const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId) as { coins: number };

        return {
            success: true,
            message: `Successfully purchased ${cosmetic.name}!`,
            newBalance: user.coins
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || 'Failed to purchase cosmetic'
        };
    }
}

/**
 * Equip a cosmetic
 */
export function equipCosmetic(userId: number, cosmeticId: number): {
    success: boolean;
    message: string;
} {
    // Check if user owns the cosmetic
    if (!ownsCosmetic(userId, cosmeticId)) {
        return { success: false, message: 'You do not own this cosmetic' };
    }

    // Get cosmetic type
    const cosmetic = db.prepare('SELECT type FROM cosmetics WHERE id = ?').get(cosmeticId) as { type: string } | undefined;
    if (!cosmetic) {
        return { success: false, message: 'Cosmetic not found' };
    }

    try {
        // Replace existing equipped cosmetic of this type (or insert if none)
        db.prepare(`
      INSERT INTO user_equipped_cosmetics (user_id, cosmetic_type, cosmetic_id, equipped_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, cosmetic_type) DO UPDATE SET
        cosmetic_id = excluded.cosmetic_id,
        equipped_at = CURRENT_TIMESTAMP
    `).run(userId, cosmetic.type, cosmeticId);

        return { success: true, message: 'Cosmetic equipped successfully' };
    } catch (error: any) {
        return { success: false, message: error.message || 'Failed to equip cosmetic' };
    }
}

/**
 * Unequip a cosmetic
 */
export function unequipCosmetic(userId: number, cosmeticType: string): {
    success: boolean;
    message: string;
} {
    try {
        const result = db.prepare(`
      DELETE FROM user_equipped_cosmetics
      WHERE user_id = ? AND cosmetic_type = ?
    `).run(userId, cosmeticType);

        if (result.changes === 0) {
            return { success: false, message: 'No cosmetic equipped in this slot' };
        }

        return { success: true, message: 'Cosmetic unequipped successfully' };
    } catch (error: any) {
        return { success: false, message: error.message || 'Failed to unequip cosmetic' };
    }
}

/**
 * Initialize default cosmetics
 */
export function initializeCosmetics() {
    // Check if cosmetics already exist
    const count = db.prepare('SELECT COUNT(*) as count FROM cosmetics').get() as { count: number };
    if (count.count > 0) {
        return; // Already initialized
    }

    const cosmetics = [
        // AVATAR FRAMES - Common
        {
            name: 'Gold Border',
            description: 'A classic golden frame',
            type: 'avatar_frame',
            rarity: 'common',
            price: 500,
            data: JSON.stringify({ borderColor: '#FFD700', borderWidth: 3, borderStyle: 'solid' })
        },
        {
            name: 'Silver Border',
            description: 'A sleek silver frame',
            type: 'avatar_frame',
            rarity: 'common',
            price: 500,
            data: JSON.stringify({ borderColor: '#C0C0C0', borderWidth: 3, borderStyle: 'solid' })
        },
        {
            name: 'Bronze Border',
            description: 'A sturdy bronze frame',
            type: 'avatar_frame',
            rarity: 'common',
            price: 500,
            data: JSON.stringify({ borderColor: '#CD7F32', borderWidth: 3, borderStyle: 'solid' })
        },

        // AVATAR FRAMES - Rare
        {
            name: 'Fire Frame',
            description: 'A blazing gradient frame',
            type: 'avatar_frame',
            rarity: 'rare',
            price: 1500,
            data: JSON.stringify({ gradient: 'linear-gradient(45deg, #ff0000, #ff7f00)', borderWidth: 4 })
        },
        {
            name: 'Ice Frame',
            description: 'A cool icy gradient frame',
            type: 'avatar_frame',
            rarity: 'rare',
            price: 1500,
            data: JSON.stringify({ gradient: 'linear-gradient(45deg, #00ffff, #0080ff)', borderWidth: 4 })
        },
        {
            name: 'Electric Frame',
            description: 'An electrifying gradient frame',
            type: 'avatar_frame',
            rarity: 'rare',
            price: 1500,
            data: JSON.stringify({ gradient: 'linear-gradient(45deg, #ffff00, #00ff00)', borderWidth: 4 })
        },

        // AVATAR FRAMES - Epic
        {
            name: 'Pulse Frame',
            description: 'An animated pulsing frame',
            type: 'avatar_frame',
            rarity: 'epic',
            price: 3000,
            data: JSON.stringify({ gradient: 'linear-gradient(45deg, #8b5cf6, #ec4899)', borderWidth: 5, animation: 'pulse' })
        },
        {
            name: 'Glow Frame',
            description: 'A glowing animated frame',
            type: 'avatar_frame',
            rarity: 'epic',
            price: 3000,
            data: JSON.stringify({ gradient: 'linear-gradient(45deg, #3b82f6, #06b6d4)', borderWidth: 5, animation: 'glow' })
        },

        // AVATAR FRAMES - Legendary
        {
            name: 'Diamond Frame',
            description: 'The ultimate diamond frame',
            type: 'avatar_frame',
            rarity: 'legendary',
            price: 5000,
            data: JSON.stringify({ gradient: 'linear-gradient(45deg, #ffffff, #e0e0e0, #ffffff)', borderWidth: 6, animation: 'shimmer' })
        },
        {
            name: 'Rainbow Frame',
            description: 'A mesmerizing rainbow frame',
            type: 'avatar_frame',
            rarity: 'legendary',
            price: 5000,
            data: JSON.stringify({ gradient: 'linear-gradient(45deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3)', borderWidth: 6, animation: 'rainbow' })
        },

        // NAME COLORS - Common
        {
            name: 'Red Name',
            description: 'Bold red username',
            type: 'name_color',
            rarity: 'common',
            price: 300,
            data: JSON.stringify({ color: '#ef4444' })
        },
        {
            name: 'Blue Name',
            description: 'Cool blue username',
            type: 'name_color',
            rarity: 'common',
            price: 300,
            data: JSON.stringify({ color: '#3b82f6' })
        },
        {
            name: 'Green Name',
            description: 'Fresh green username',
            type: 'name_color',
            rarity: 'common',
            price: 300,
            data: JSON.stringify({ color: '#22c55e' })
        },
        {
            name: 'Purple Name',
            description: 'Royal purple username',
            type: 'name_color',
            rarity: 'common',
            price: 300,
            data: JSON.stringify({ color: '#a855f7' })
        },

        // NAME COLORS - Rare
        {
            name: 'Sunset Gradient',
            description: 'Beautiful sunset gradient',
            type: 'name_color',
            rarity: 'rare',
            price: 1000,
            data: JSON.stringify({ gradient: 'linear-gradient(90deg, #ff6b6b, #feca57)' })
        },
        {
            name: 'Ocean Gradient',
            description: 'Deep ocean gradient',
            type: 'name_color',
            rarity: 'rare',
            price: 1000,
            data: JSON.stringify({ gradient: 'linear-gradient(90deg, #0066cc, #00cccc)' })
        },
        {
            name: 'Forest Gradient',
            description: 'Lush forest gradient',
            type: 'name_color',
            rarity: 'rare',
            price: 1000,
            data: JSON.stringify({ gradient: 'linear-gradient(90deg, #2d5016, #7cb342)' })
        },

        // NAME COLORS - Epic
        {
            name: 'Rainbow Shift',
            description: 'Animated rainbow gradient',
            type: 'name_color',
            rarity: 'epic',
            price: 2500,
            data: JSON.stringify({ gradient: 'linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #8b00ff)', animation: 'shift' })
        },
        {
            name: 'Pulse Gradient',
            description: 'Pulsing gradient effect',
            type: 'name_color',
            rarity: 'epic',
            price: 2500,
            data: JSON.stringify({ gradient: 'linear-gradient(90deg, #8b5cf6, #ec4899)', animation: 'pulse' })
        },

        // NAME COLORS - Legendary
        {
            name: 'Glow Text',
            description: 'Glowing text effect',
            type: 'name_color',
            rarity: 'legendary',
            price: 4000,
            data: JSON.stringify({ color: '#3b82f6', glow: true, glowColor: '#60a5fa' })
        },
        {
            name: 'Shimmer Text',
            description: 'Shimmering text effect',
            type: 'name_color',
            rarity: 'legendary',
            price: 4000,
            data: JSON.stringify({ gradient: 'linear-gradient(90deg, #ffd700, #ffffff, #ffd700)', animation: 'shimmer' })
        },

        // CHAT BADGES - Common
        {
            name: 'Star Badge',
            description: 'A simple star icon',
            type: 'chat_badge',
            rarity: 'common',
            price: 200,
            data: JSON.stringify({ icon: '⭐' })
        },
        {
            name: 'Heart Badge',
            description: 'A lovely heart icon',
            type: 'chat_badge',
            rarity: 'common',
            price: 200,
            data: JSON.stringify({ icon: '❤️' })
        },
        {
            name: 'Fire Badge',
            description: 'A fiery icon',
            type: 'chat_badge',
            rarity: 'common',
            price: 200,
            data: JSON.stringify({ icon: '🔥' })
        },
        {
            name: 'Muscle Badge',
            description: 'Show your strength',
            type: 'chat_badge',
            rarity: 'common',
            price: 200,
            data: JSON.stringify({ icon: '💪' })
        },

        // CHAT BADGES - Rare
        {
            name: '100 Day Badge',
            description: 'For 100+ day streaks',
            type: 'chat_badge',
            rarity: 'rare',
            price: 800,
            data: JSON.stringify({ icon: '💯', requirements: { minStreak: 100 } })
        },
        {
            name: 'Trophy Badge',
            description: 'For high achievers',
            type: 'chat_badge',
            rarity: 'rare',
            price: 800,
            data: JSON.stringify({ icon: '🏆' })
        },
        {
            name: 'Crown Badge',
            description: 'Royalty status',
            type: 'chat_badge',
            rarity: 'rare',
            price: 800,
            data: JSON.stringify({ icon: '👑' })
        },

        // CHAT BADGES - Epic
        {
            name: 'MVP Badge',
            description: 'Most Valuable Player',
            type: 'chat_badge',
            rarity: 'epic',
            price: 2000,
            data: JSON.stringify({ icon: '🌟', color: '#ffd700' })
        },
        {
            name: 'Legend Badge',
            description: 'Legendary status',
            type: 'chat_badge',
            rarity: 'epic',
            price: 2000,
            data: JSON.stringify({ icon: '⚡', color: '#ffff00' })
        },
        {
            name: 'Champion Badge',
            description: 'True champion',
            type: 'chat_badge',
            rarity: 'epic',
            price: 2000,
            data: JSON.stringify({ icon: '🥇', color: '#ffd700' })
        },

        // CHAT BADGES - Legendary
        {
            name: 'Founder Badge',
            description: 'Early supporter',
            type: 'chat_badge',
            rarity: 'legendary',
            price: 3500,
            data: JSON.stringify({ icon: '🎖️', color: '#8b5cf6', glow: true })
        },
        {
            name: 'Elite Badge',
            description: 'Elite member',
            type: 'chat_badge',
            rarity: 'legendary',
            price: 3500,
            data: JSON.stringify({ icon: '💎', color: '#60a5fa', glow: true })
        },
    ];

    const stmt = db.prepare(`
    INSERT INTO cosmetics (name, description, type, rarity, price, data)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

    for (const cosmetic of cosmetics) {
        stmt.run(
            cosmetic.name,
            cosmetic.description,
            cosmetic.type,
            cosmetic.rarity,
            cosmetic.price,
            cosmetic.data
        );
    }
}
