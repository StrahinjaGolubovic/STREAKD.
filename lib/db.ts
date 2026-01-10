import Database, { Statement } from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { logError, logWarning } from './logger';

const dbPath = process.env.DATABASE_PATH || './data/gymble.db';

let databaseInstance: Database | null = null;
let initialized = false;
let migrationsRun = false;
let migrationsLock = false;
let migrationStartTime = 0;

// Ensure directories exist (lazy)
function ensureDirectories() {
  // For Railway, use /data if available, otherwise use ./data
  const dataDir = process.env.DATABASE_PATH
    ? join(process.env.DATABASE_PATH, '..')
    : join(process.cwd(), 'data');

  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // Use persistent volume for uploads and profiles (same location as database)
  const uploadsDir = join(dataDir, 'uploads');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }

  const profilesDir = join(dataDir, 'profiles');
  if (!existsSync(profilesDir)) {
    mkdirSync(profilesDir, { recursive: true });
  }
}

// Get database instance (lazy initialization)
function getDb(): Database {
  if (!databaseInstance) {
    ensureDirectories();
    databaseInstance = new Database(dbPath);
    // Enable foreign keys
    databaseInstance.pragma('foreign_keys = ON');
    // Initialize schema immediately after creating db
    if (!initialized) {
      try {
        initDatabase(databaseInstance);
        initialized = true;
      } catch (error) {
        // Reset ALL state on failure to allow clean retry
        databaseInstance = null;
        initialized = false;
        throw error;
      }
    }
  }

  // Run migrations only once to avoid blocking startup
  // Double-check locking pattern to prevent race conditions
  if (!migrationsRun) {
    // Check if another request is running migrations with timeout
    const now = Date.now();
    if (migrationsLock) {
      // If lock held for >30 seconds, assume deadlock and reset
      if (migrationStartTime > 0 && (now - migrationStartTime) > 30000) {
        logError('db:migration', new Error('Migration timeout detected, resetting lock'), { duration: now - migrationStartTime });
        migrationsLock = false;
        migrationStartTime = 0;
      } else {
        // Lock held by another request, skip migrations
        return databaseInstance;
      }
    }

    // Acquire lock
    migrationsLock = true;
    migrationStartTime = now;

    // Double-check after acquiring lock
    if (migrationsRun) {
      migrationsLock = false;
      migrationStartTime = 0;
      return databaseInstance;
    }

    try {
      // Check and add rest_days_available column if needed
      const challengesInfo = databaseInstance.prepare("PRAGMA table_info(weekly_challenges)").all() as Array<{ name: string }>;
      const challengesCols = challengesInfo.map((c) => c.name.toLowerCase());
      if (!challengesCols.includes('rest_days_available')) {
        try {
          databaseInstance.exec(`ALTER TABLE weekly_challenges ADD COLUMN rest_days_available INTEGER DEFAULT 3;`);
          databaseInstance.exec(`UPDATE weekly_challenges SET rest_days_available = 3 WHERE rest_days_available IS NULL;`);
        } catch (alterError: any) {
          // Column might already exist or there's another issue - continue
          logWarning('db:migration', 'Failed to add rest_days_available column', { error: alterError?.message });
        }
      }

      // Check if rest_days table exists
      const tableCheck = databaseInstance.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='rest_days'").get() as { name: string } | undefined;
      if (!tableCheck) {
        // Table doesn't exist, create it
        try {
          databaseInstance.exec(`
            CREATE TABLE IF NOT EXISTS rest_days (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              challenge_id INTEGER NOT NULL,
              user_id INTEGER NOT NULL,
              rest_date DATE NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (challenge_id) REFERENCES weekly_challenges(id) ON DELETE CASCADE,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
              UNIQUE(challenge_id, rest_date)
            )
          `);
          databaseInstance.exec(`
            CREATE INDEX IF NOT EXISTS idx_rest_days_challenge ON rest_days(challenge_id);
            CREATE INDEX IF NOT EXISTS idx_rest_days_user ON rest_days(user_id);
            CREATE INDEX IF NOT EXISTS idx_rest_days_date ON rest_days(rest_date);
          `);
        } catch (createError: any) {
          logError('db:migration', createError, { context: 'create rest_days table' });
        }
      }
      // Initialize shop items if needed
      try {
        const { initializeShopItems } = require('./coins');
        initializeShopItems();
      } catch (shopError: any) {
        logWarning('db:migration', 'Failed to initialize shop items', { error: shopError?.message });
      }

      // Check if achievements table exists
      const achievementsTableCheck = databaseInstance.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='achievements'").get() as { name: string } | undefined;
      if (!achievementsTableCheck) {
        try {
          databaseInstance.exec(`
            CREATE TABLE IF NOT EXISTS achievements (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              key TEXT UNIQUE NOT NULL,
              name TEXT NOT NULL,
              description TEXT NOT NULL,
              icon TEXT NOT NULL,
              category TEXT NOT NULL,
              tier TEXT DEFAULT 'bronze',
              points INTEGER DEFAULT 0,
              hidden BOOLEAN DEFAULT 0,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `);
          databaseInstance.exec(`
            CREATE INDEX IF NOT EXISTS idx_achievements_key ON achievements(key);
            CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);
          `);
        } catch (createError: any) {
          logError('db:migration', createError, { context: 'create achievements table' });
        }
      }

      // Check if user_achievements table exists
      const userAchievementsTableCheck = databaseInstance.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_achievements'").get() as { name: string } | undefined;
      if (!userAchievementsTableCheck) {
        try {
          databaseInstance.exec(`
            CREATE TABLE IF NOT EXISTS user_achievements (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              achievement_id INTEGER NOT NULL,
              unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              progress INTEGER DEFAULT 0,
              notified BOOLEAN DEFAULT 0,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
              FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
              UNIQUE(user_id, achievement_id)
            )
          `);
          databaseInstance.exec(`
            CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement ON user_achievements(achievement_id);
          `);
        } catch (createError: any) {
          logError('db:migration', createError, { context: 'create user_achievements table' });
        }
      }

      // Check if push_subscriptions table exists
      const pushSubscriptionsTableCheck = databaseInstance.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='push_subscriptions'").get() as { name: string } | undefined;
      if (!pushSubscriptionsTableCheck) {
        try {
          databaseInstance.exec(`
            CREATE TABLE IF NOT EXISTS push_subscriptions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              endpoint TEXT NOT NULL,
              p256dh TEXT NOT NULL,
              auth TEXT NOT NULL,
              user_agent TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
              UNIQUE(user_id, endpoint)
            )
          `);
          databaseInstance.exec(`
            CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
            CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);
          `);
        } catch (createError: any) {
          logError('db:migration', createError, { context: 'create push_subscriptions table' });
        }
      }

      // Add featured_badges and notification_preferences columns to users table if missing
      try {
        const usersInfo = databaseInstance.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
        const usersCols = usersInfo.map((c) => c.name);

        if (!usersCols.includes('featured_badges')) {
          databaseInstance.exec(`ALTER TABLE users ADD COLUMN featured_badges TEXT;`);
        }

        if (!usersCols.includes('notification_preferences')) {
          databaseInstance.exec(`ALTER TABLE users ADD COLUMN notification_preferences TEXT;`);
          // Set default preferences for existing users
          databaseInstance.exec(`
            UPDATE users 
            SET notification_preferences = '{"enabled":true,"dailyReminder":true,"dailyReminderTime":"18:00","streakWarning":true,"achievements":true,"friendActivity":true,"crewActivity":true,"adminMessages":true}'
            WHERE notification_preferences IS NULL
          `);
        }
      } catch (alterError: any) {
        logWarning('db:migration', 'Failed to add user columns for achievements/notifications', { error: alterError?.message });
      }

      // Initialize achievements if needed
      try {
        const { initializeAchievements } = require('./achievements');
        initializeAchievements();
      } catch (achievementsError: any) {
        logWarning('db:migration', 'Failed to initialize achievements', { error: achievementsError?.message });
      }


      // Mark as complete only after all migrations succeed
      migrationsRun = true;
    } catch (error: any) {
      // Don't block app startup if migrations fail - they'll be retried on next request
      logError('db:migration', error, { context: 'running migrations' });
    } finally {
      // Always release lock and reset timer
      migrationsLock = false;
      migrationStartTime = 0;
    }
  }

  return databaseInstance;
}

// Initialize database schema
function initDatabase(database: Database) {
  // Users table
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      credits INTEGER DEFAULT 0,
      trophies INTEGER DEFAULT 0,
      profile_picture TEXT,
      created_at DATE
    )
  `);

  // Migrate existing users table to add trophies and coins columns if missing
  try {
    const usersInfo = database.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
    const usersCols = usersInfo.map((c) => c.name);
    if (!usersCols.includes('trophies')) {
      database.exec(`ALTER TABLE users ADD COLUMN trophies INTEGER DEFAULT 0;`);
      database.exec(`UPDATE users SET trophies = 0 WHERE trophies IS NULL;`);
    }
    if (!usersCols.includes('coins')) {
      database.exec(`ALTER TABLE users ADD COLUMN coins INTEGER DEFAULT 0;`);
      database.exec(`UPDATE users SET coins = 0 WHERE coins IS NULL;`);
    }
    if (!usersCols.includes('last_daily_claim')) {
      database.exec(`ALTER TABLE users ADD COLUMN last_daily_claim DATE;`);
    }
    if (!usersCols.includes('referred_by')) {
      database.exec(`ALTER TABLE users ADD COLUMN referred_by INTEGER;`);
    }
    // Premium columns
    if (!usersCols.includes('is_premium')) {
      database.exec(`ALTER TABLE users ADD COLUMN is_premium BOOLEAN DEFAULT 0;`);
      database.exec(`UPDATE users SET is_premium = 0 WHERE is_premium IS NULL;`);
    }
    if (!usersCols.includes('premium_granted_at')) {
      database.exec(`ALTER TABLE users ADD COLUMN premium_granted_at DATETIME;`);
    }
    if (!usersCols.includes('premium_granted_by')) {
      database.exec(`ALTER TABLE users ADD COLUMN premium_granted_by INTEGER;`);
    }
    if (!usersCols.includes('username_color')) {
      database.exec(`ALTER TABLE users ADD COLUMN username_color TEXT;`);
    }
  } catch (error) {
    console.log('Users migration note:', error);
  }

  // Weekly challenges table
  database.exec(`
    CREATE TABLE IF NOT EXISTS weekly_challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status TEXT DEFAULT 'active',
      completed_days INTEGER DEFAULT 0,
      rest_days_available INTEGER DEFAULT 3,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Migrate existing weekly_challenges table to add rest_days_available column if missing
  try {
    const challengesInfo = database.prepare("PRAGMA table_info(weekly_challenges)").all() as Array<{ name: string }>;
    const challengesCols = challengesInfo.map((c) => c.name);
    if (!challengesCols.includes('rest_days_available')) {
      database.exec(`ALTER TABLE weekly_challenges ADD COLUMN rest_days_available INTEGER DEFAULT 3;`);
      database.exec(`UPDATE weekly_challenges SET rest_days_available = 3 WHERE rest_days_available IS NULL;`);
    }
  } catch (error) {
    console.log('Weekly challenges migration note:', error);
  }

  // Daily uploads table
  database.exec(`
    CREATE TABLE IF NOT EXISTS daily_uploads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challenge_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      upload_date DATE NOT NULL,
      photo_path TEXT NOT NULL,
      verification_status TEXT DEFAULT 'pending',
      metadata TEXT,
      verified_at DATETIME,
      verified_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (challenge_id) REFERENCES weekly_challenges(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE(challenge_id, upload_date)
    )
  `);

  // Migrate existing daily_uploads table to add new columns if they don't exist
  try {
    // Check if verification_status column exists
    const tableInfo = database.prepare("PRAGMA table_info(daily_uploads)").all() as Array<{ name: string }>;
    const columnNames = tableInfo.map(col => col.name);

    if (!columnNames.includes('verification_status')) {
      database.exec(`
        ALTER TABLE daily_uploads ADD COLUMN verification_status TEXT DEFAULT 'approved';
        UPDATE daily_uploads SET verification_status = 'approved' WHERE verification_status IS NULL;
      `);
    }

    if (!columnNames.includes('metadata')) {
      database.exec(`ALTER TABLE daily_uploads ADD COLUMN metadata TEXT;`);
    }

    if (!columnNames.includes('verified_at')) {
      database.exec(`ALTER TABLE daily_uploads ADD COLUMN verified_at DATETIME;`);
    }

    if (!columnNames.includes('verified_by')) {
      database.exec(`ALTER TABLE daily_uploads ADD COLUMN verified_by INTEGER;`);
    }
  } catch (error) {
    // Ignore errors if columns already exist or migration fails
    console.log('Migration note:', error);
  }

  // Streaks table
  database.exec(`
    CREATE TABLE IF NOT EXISTS streaks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      last_activity_date DATE,
      last_rollup_date DATE,
      admin_baseline_date DATE,
      admin_baseline_streak INTEGER DEFAULT 0,
      admin_baseline_longest INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Migrate existing streaks table to add admin baseline columns if missing
  try {
    const streaksInfo = database.prepare("PRAGMA table_info(streaks)").all() as Array<{ name: string }>;
    const streaksCols = streaksInfo.map((c) => c.name);
    if (!streaksCols.includes('last_rollup_date')) {
      database.exec(`ALTER TABLE streaks ADD COLUMN last_rollup_date DATE;`);
    }
    if (!streaksCols.includes('admin_baseline_date')) {
      database.exec(`ALTER TABLE streaks ADD COLUMN admin_baseline_date DATE;`);
    }
    if (!streaksCols.includes('admin_baseline_streak')) {
      database.exec(`ALTER TABLE streaks ADD COLUMN admin_baseline_streak INTEGER DEFAULT 0;`);
      database.exec(`UPDATE streaks SET admin_baseline_streak = 0 WHERE admin_baseline_streak IS NULL;`);
    }
    if (!streaksCols.includes('admin_baseline_longest')) {
      database.exec(`ALTER TABLE streaks ADD COLUMN admin_baseline_longest INTEGER DEFAULT 0;`);
      database.exec(`UPDATE streaks SET admin_baseline_longest = 0 WHERE admin_baseline_longest IS NULL;`);
    }
  } catch (error) {
    console.log('Streaks migration note:', error);
  }

  // Coin transactions ledger (auditable)
  database.exec(`
    CREATE TABLE IF NOT EXISTS coin_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Shop items table
  database.exec(`
    CREATE TABLE IF NOT EXISTS shop_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price INTEGER NOT NULL,
      item_type TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Referral rewards tracking
  database.exec(`
    CREATE TABLE IF NOT EXISTS referral_rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_id INTEGER NOT NULL,
      referred_id INTEGER NOT NULL,
      reward_claimed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      claimed_at DATETIME,
      FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (referred_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(referrer_id, referred_id)
    )
  `);

  // Trophy transactions ledger (auditable)
  database.exec(`
    CREATE TABLE IF NOT EXISTS trophy_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      upload_id INTEGER,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (upload_id) REFERENCES daily_uploads(id) ON DELETE SET NULL
    )
  `);

  // User activity table (for "online users" tracking)
  database.exec(`
    CREATE TABLE IF NOT EXISTS user_activity (
      user_id INTEGER PRIMARY KEY,
      last_seen DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Invite codes table
  database.exec(`
    CREATE TABLE IF NOT EXISTS invite_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      code TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Friends table (bidirectional friendship)
  database.exec(`
    CREATE TABLE IF NOT EXISTS friends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      friend_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, friend_id),
      CHECK(user_id != friend_id)
    )
  `);

  // Global chat messages table
  database.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Crews table
  database.exec(`
    CREATE TABLE IF NOT EXISTS crews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      leader_id INTEGER NOT NULL,
      tag TEXT,
      tag_color TEXT DEFAULT '#0ea5e9',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Migrate existing crews table to add tag columns if missing
  try {
    const crewsInfo = database.prepare("PRAGMA table_info(crews)").all() as Array<{ name: string }>;
    const crewsCols = crewsInfo.map((c) => c.name);
    if (!crewsCols.includes('tag')) {
      database.exec(`ALTER TABLE crews ADD COLUMN tag TEXT;`);
    }
    if (!crewsCols.includes('tag_color')) {
      database.exec(`ALTER TABLE crews ADD COLUMN tag_color TEXT DEFAULT '#0ea5e9';`);
    }
    if (!crewsCols.includes('tag_updated_at')) {
      database.exec(`ALTER TABLE crews ADD COLUMN tag_updated_at DATETIME;`);
    }
  } catch (error) {
    console.log('Crews migration note:', error);
  }

  // Crew members table
  database.exec(`
    CREATE TABLE IF NOT EXISTS crew_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      crew_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (crew_id) REFERENCES crews(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(crew_id, user_id)
    )
  `);

  // Crew join requests table
  database.exec(`
    CREATE TABLE IF NOT EXISTS crew_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      crew_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (crew_id) REFERENCES crews(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(crew_id, user_id)
    )
  `);

  // Crew chat messages table
  database.exec(`
    CREATE TABLE IF NOT EXISTS crew_chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      crew_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (crew_id) REFERENCES crews(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Notifications table
  database.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      data TEXT,
      related_user_id INTEGER,
      related_crew_id INTEGER,
      read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (related_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (related_crew_id) REFERENCES crews(id) ON DELETE SET NULL
    )
  `);

  // Add data column to notifications if it doesn't exist (migration)
  try {
    database.exec(`ALTER TABLE notifications ADD COLUMN data TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Nudges table - tracks when users nudge friends (once per day limit)
  database.exec(`
    CREATE TABLE IF NOT EXISTS nudges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL,
      to_user_id INTEGER NOT NULL,
      nudge_date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(from_user_id, to_user_id, nudge_date)
    )
  `);

  // Rest days table - tracks when users use rest day credits
  database.exec(`
    CREATE TABLE IF NOT EXISTS rest_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challenge_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      rest_date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (challenge_id) REFERENCES weekly_challenges(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(challenge_id, rest_date)
    )
  `);

  // Feedback table - user feedback submissions
  database.exec(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      feedback_text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // App settings (key/value)
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add profile privacy and crew_id to users table
  try {
    const usersInfo = database.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
    const usersCols = usersInfo.map((c) => c.name);
    if (!usersCols.includes('profile_private')) {
      database.exec(`ALTER TABLE users ADD COLUMN profile_private BOOLEAN DEFAULT 0;`);
    }
    if (!usersCols.includes('crew_id')) {
      database.exec(`ALTER TABLE users ADD COLUMN crew_id INTEGER;`);
      database.exec(`CREATE INDEX IF NOT EXISTS idx_users_crew ON users(crew_id);`);
    }
  } catch (error) {
    console.log('Users migration note:', error);
  }

  // Create indexes for better performance
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_challenges_user ON weekly_challenges(user_id);
    CREATE INDEX IF NOT EXISTS idx_uploads_user ON daily_uploads(user_id);
    CREATE INDEX IF NOT EXISTS idx_uploads_challenge ON daily_uploads(challenge_id);
    CREATE INDEX IF NOT EXISTS idx_uploads_date ON daily_uploads(upload_date);
    CREATE INDEX IF NOT EXISTS idx_invite_codes_user ON invite_codes(user_id);
    CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
    CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id);
    CREATE INDEX IF NOT EXISTS idx_friends_friend ON friends(friend_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_user_activity_last_seen ON user_activity(last_seen);
    CREATE INDEX IF NOT EXISTS idx_trophy_transactions_user ON trophy_transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_trophy_transactions_upload ON trophy_transactions(upload_id);
    CREATE INDEX IF NOT EXISTS idx_crews_leader ON crews(leader_id);
    CREATE INDEX IF NOT EXISTS idx_crews_name ON crews(name);
    CREATE INDEX IF NOT EXISTS idx_crew_members_crew ON crew_members(crew_id);
    CREATE INDEX IF NOT EXISTS idx_crew_members_user ON crew_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_crew_requests_crew ON crew_requests(crew_id);
    CREATE INDEX IF NOT EXISTS idx_crew_requests_user ON crew_requests(user_id);
    CREATE INDEX IF NOT EXISTS idx_crew_requests_status ON crew_requests(status);
    CREATE INDEX IF NOT EXISTS idx_crew_chat_messages_crew ON crew_chat_messages(crew_id);
    CREATE INDEX IF NOT EXISTS idx_crew_chat_messages_created ON crew_chat_messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
    CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
    CREATE INDEX IF NOT EXISTS idx_nudges_from_user ON nudges(from_user_id);
    CREATE INDEX IF NOT EXISTS idx_nudges_to_user ON nudges(to_user_id);
    CREATE INDEX IF NOT EXISTS idx_nudges_date ON nudges(nudge_date);
    CREATE INDEX IF NOT EXISTS idx_rest_days_challenge ON rest_days(challenge_id);
    CREATE INDEX IF NOT EXISTS idx_rest_days_user ON rest_days(user_id);
    CREATE INDEX IF NOT EXISTS idx_rest_days_date ON rest_days(rest_date);
  `);

  // Nudge templates table (for premium custom nudges)
  database.exec(`
    CREATE TABLE IF NOT EXISTS nudge_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_nudge_templates_user ON nudge_templates(user_id);
  `);
}

// Database interface for the exported db object
interface DatabaseInterface {
  prepare: (sql: string) => Statement;
  exec: (sql: string) => Database;
  pragma: (pragma: string, options?: { simple?: boolean }) => any;
}

// Export database - initialization happens on first access
const db: DatabaseInterface = {
  prepare: (sql: string) => getDb().prepare(sql),
  exec: (sql: string) => getDb().exec(sql),
  pragma: (pragma: string, options?: { simple?: boolean }) => getDb().pragma(pragma, options),
};

export default db;

