import db from './db';
import { formatDateSerbia, formatDateTimeSerbia } from './timezone';

// ============================================================================
// Types
// ============================================================================

export interface CoinTransaction {
  id: number;
  user_id: number;
  delta: number;
  reason: string;
  created_at: string;
}

export interface ShopItem {
  id: number;
  name: string;
  description: string | null;
  price: number;
  item_type: string;
  enabled: number;
  created_at: string;
}

// ============================================================================
// Coin Balance Management
// ============================================================================

export function getUserCoins(userId: number): number {
  const row = db
    .prepare('SELECT COALESCE(coins, 0) as coins FROM users WHERE id = ?')
    .get(userId) as { coins: number } | undefined;
  return row?.coins ?? 0;
}

function applyCoinDelta(userId: number, delta: number, reason: string): void {
  if (delta === 0) return;

  const createdAt = formatDateTimeSerbia();
  
  // Update user balance (never go below 0)
  const current = getUserCoins(userId);
  const newBalance = Math.max(0, current + delta);
  const actualDelta = newBalance - current;
  
  if (actualDelta !== 0) {
    db.prepare('UPDATE users SET coins = ? WHERE id = ?').run(newBalance, userId);
    
    // Log transaction
    db.prepare(`
      INSERT INTO coin_transactions (user_id, delta, reason, created_at)
      VALUES (?, ?, ?, ?)
    `).run(userId, actualDelta, reason, createdAt);
  }
}

export function addCoins(userId: number, amount: number, reason: string): void {
  if (amount <= 0) return;
  applyCoinDelta(userId, amount, reason);
}

export function deductCoins(userId: number, amount: number, reason: string): boolean {
  if (amount <= 0) return false;
  
  const current = getUserCoins(userId);
  if (current < amount) return false;
  
  applyCoinDelta(userId, -amount, reason);
  return true;
}

// ============================================================================
// Daily Claim
// ============================================================================

export function canClaimDailyCoins(userId: number): boolean {
  const today = formatDateSerbia();
  const row = db
    .prepare('SELECT last_daily_claim FROM users WHERE id = ?')
    .get(userId) as { last_daily_claim: string | null } | undefined;
  
  return row?.last_daily_claim !== today;
}

export function claimDailyCoins(userId: number): { success: boolean; amount?: number; message?: string } {
  if (!canClaimDailyCoins(userId)) {
    return { success: false, message: 'Already claimed today' };
  }
  
  const today = formatDateSerbia();
  const amount = Math.floor(Math.random() * 26) + 75; // 75-100 coins
  
  addCoins(userId, amount, 'daily_claim');
  db.prepare('UPDATE users SET last_daily_claim = ? WHERE id = ?').run(today, userId);
  
  return { success: true, amount };
}

// ============================================================================
// Shop
// ============================================================================

export function getShopItems(): ShopItem[] {
  return db
    .prepare('SELECT * FROM shop_items WHERE enabled = 1 ORDER BY id ASC')
    .all() as ShopItem[];
}

export function purchaseShopItem(userId: number, itemId: number): { 
  success: boolean; 
  message?: string;
  item?: ShopItem;
} {
  const item = db
    .prepare('SELECT * FROM shop_items WHERE id = ? AND enabled = 1')
    .get(itemId) as ShopItem | undefined;
  
  if (!item) {
    return { success: false, message: 'Item not found or unavailable' };
  }
  
  const userCoins = getUserCoins(userId);
  if (userCoins < item.price) {
    return { success: false, message: 'Not enough coins' };
  }
  
  // Deduct coins
  const deducted = deductCoins(userId, item.price, `shop_purchase:${item.name}`);
  if (!deducted) {
    return { success: false, message: 'Failed to deduct coins' };
  }
  
  // Apply item effect
  if (item.item_type === 'rest_day') {
    // Add 1 rest day to current active challenge
    try {
      const challenge = db
        .prepare(`
          SELECT id, rest_days_available 
          FROM weekly_challenges 
          WHERE user_id = ? AND status = 'active' 
          ORDER BY start_date DESC 
          LIMIT 1
        `)
        .get(userId) as { id: number; rest_days_available: number } | undefined;
      
      if (challenge) {
        const newRestDays = (challenge.rest_days_available ?? 3) + 1;
        db.prepare('UPDATE weekly_challenges SET rest_days_available = ? WHERE id = ?')
          .run(newRestDays, challenge.id);
      }
    } catch (error) {
      console.error('Error applying rest day:', error);
    }
  }
  
  return { success: true, item };
}

export function initializeShopItems(): void {
  // Check if shop items already exist
  const count = db
    .prepare('SELECT COUNT(*) as count FROM shop_items')
    .get() as { count: number };
  
  if (count.count === 0) {
    // Insert default shop items
    const createdAt = formatDateTimeSerbia();
    db.prepare(`
      INSERT INTO shop_items (name, description, price, item_type, enabled, created_at)
      VALUES (?, ?, ?, ?, 1, ?)
    `).run(
      '1x Rest Day',
      'Add one extra rest day to your current week',
      500,
      'rest_day',
      createdAt
    );
  }
}

// ============================================================================
// Referral Rewards
// ============================================================================

export function trackReferral(referrerId: number, referredId: number): void {
  try {
    const createdAt = formatDateTimeSerbia();
    db.prepare(`
      INSERT OR IGNORE INTO referral_rewards (referrer_id, referred_id, reward_claimed, created_at)
      VALUES (?, ?, 0, ?)
    `).run(referrerId, referredId, createdAt);
  } catch (error) {
    console.error('Error tracking referral:', error);
  }
}

export function checkAndRewardReferral(referredUserId: number): void {
  // Check if this user was referred and hasn't been rewarded yet
  const referral = db
    .prepare(`
      SELECT referrer_id, reward_claimed 
      FROM referral_rewards 
      WHERE referred_id = ? AND reward_claimed = 0
    `)
    .get(referredUserId) as { referrer_id: number; reward_claimed: number } | undefined;
  
  if (!referral) return;
  
  // Check if referred user has at least one approved upload
  const approvedUpload = db
    .prepare(`
      SELECT 1 FROM daily_uploads 
      WHERE user_id = ? AND verification_status = 'approved' 
      LIMIT 1
    `)
    .get(referredUserId);
  
  if (approvedUpload) {
    // Reward BOTH the referrer AND the referred user (150 coins each)
    const claimedAt = formatDateTimeSerbia();
    addCoins(referral.referrer_id, 150, `referral_reward:referred_user_${referredUserId}`);
    addCoins(referredUserId, 150, `referral_reward:referrer_${referral.referrer_id}`);
    db.prepare(`
      UPDATE referral_rewards 
      SET reward_claimed = 1, claimed_at = ? 
      WHERE referrer_id = ? AND referred_id = ?
    `).run(claimedAt, referral.referrer_id, referredUserId);
  }
}

export function getCoinTransactions(userId: number, limit: number = 20): CoinTransaction[] {
  return db
    .prepare(`
      SELECT * FROM coin_transactions 
      WHERE user_id = ? 
      ORDER BY id DESC 
      LIMIT ?
    `)
    .all(userId, limit) as CoinTransaction[];
}
