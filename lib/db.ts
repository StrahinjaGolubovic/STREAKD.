import Database, { Statement } from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const dbPath = process.env.DATABASE_PATH || './data/gymble.db';

let databaseInstance: Database | null = null;
let initialized = false;

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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

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
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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

