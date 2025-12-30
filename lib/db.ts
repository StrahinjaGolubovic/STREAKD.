import Database, { Statement } from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const dbPath = process.env.DATABASE_PATH || './data/gymble.db';

let databaseInstance: Database | null = null;
let initialized = false;
let migrationsRun = false;

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
      initDatabase(databaseInstance);
      initialized = true;
    }
  }
  
  // Run migrations only once to avoid blocking startup
  if (!migrationsRun) {
    migrationsRun = true;
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
          console.error('Migration: Failed to add rest_days_available column:', alterError?.message);
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
          console.error('Migration: Failed to create rest_days table:', createError?.message);
        }
      }
    } catch (error: any) {
      // Don't block app startup if migrations fail - they'll be retried on next request
      console.error('Migration: Error running migrations:', error?.message);
      migrationsRun = false; // Allow retry on next call
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

  // Migrate existing users table to add trophies column if missing
  try {
    const usersInfo = database.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
    const usersCols = usersInfo.map((c) => c.name);
    if (!usersCols.includes('trophies')) {
      database.exec(`ALTER TABLE users ADD COLUMN trophies INTEGER DEFAULT 0;`);
      database.exec(`UPDATE users SET trophies = 0 WHERE trophies IS NULL;`);
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
      related_user_id INTEGER,
      related_crew_id INTEGER,
      read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (related_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (related_crew_id) REFERENCES crews(id) ON DELETE SET NULL
    )
  `);

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

