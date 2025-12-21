import db from './db';

export interface WeeklyChallenge {
  id: number;
  user_id: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'completed' | 'failed';
  completed_days: number;
  created_at: string;
}

export interface DailyUpload {
  id: number;
  challenge_id: number;
  user_id: number;
  upload_date: string;
  photo_path: string;
  verification_status: 'pending' | 'approved' | 'rejected';
  metadata: string | null;
  verified_at: string | null;
  verified_by: number | null;
  created_at: string;
}

export interface Streak {
  id: number;
  user_id: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
}

// Get the start of the current week based on user registration date
export function getWeekStartForUser(registrationDate: Date, currentDate: Date = new Date()): Date {
  const regDate = new Date(registrationDate);
  regDate.setHours(0, 0, 0, 0);
  
  const current = new Date(currentDate);
  current.setHours(0, 0, 0, 0);
  
  // Calculate days since registration
  const daysSinceReg = Math.floor((current.getTime() - regDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Calculate which week (0-indexed) we're in
  const weekNumber = Math.floor(daysSinceReg / 7);
  
  // Start date is registration date + (weekNumber * 7 days)
  const weekStart = new Date(regDate);
  weekStart.setDate(weekStart.getDate() + (weekNumber * 7));
  
  return weekStart;
}

// Get the end of the current week (6 days after start)
export function getWeekEndForUser(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

// Format date as YYYY-MM-DD (using local time, not UTC)
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get or create active challenge for user
export function getOrCreateActiveChallenge(userId: number): WeeklyChallenge {
  // Get user registration date
  const user = db.prepare('SELECT created_at FROM users WHERE id = ?').get(userId) as { created_at: string } | undefined;
  if (!user) {
    throw new Error('User not found');
  }
  
  const registrationDate = new Date(user.created_at);
  const weekStartDate = getWeekStartForUser(registrationDate);
  const weekEndDate = getWeekEndForUser(weekStartDate);
  
  const weekStart = formatDate(weekStartDate);
  const weekEnd = formatDate(weekEndDate);

  // Check if active challenge exists
  let challenge = db
    .prepare(
      'SELECT * FROM weekly_challenges WHERE user_id = ? AND start_date = ? AND status = ?'
    )
    .get(userId, weekStart, 'active') as WeeklyChallenge | undefined;

  if (!challenge) {
    // Check if there's a previous active challenge that needs to be closed
    const previousChallenge = db
      .prepare('SELECT * FROM weekly_challenges WHERE user_id = ? AND status = ? ORDER BY start_date DESC LIMIT 1')
      .get(userId, 'active') as WeeklyChallenge | undefined;

    if (previousChallenge) {
      // Evaluate previous challenge
      const completedDays = db
        .prepare('SELECT COUNT(*) as count FROM daily_uploads WHERE challenge_id = ?')
        .get(previousChallenge.id) as { count: number };

      const status = completedDays.count >= 5 ? 'completed' : 'failed';
      
      // Update previous challenge
      db.prepare('UPDATE weekly_challenges SET status = ?, completed_days = ? WHERE id = ?').run(
        status,
        completedDays.count,
        previousChallenge.id
      );

      // Apply penalty if failed (add 200 to debt)
      if (status === 'failed') {
        db.prepare('UPDATE users SET credits = credits + 200 WHERE id = ?').run(userId);
      }

      // Update streak
      updateStreak(userId, status === 'completed');
    }

    // Create new challenge
    const result = db
      .prepare(
        'INSERT INTO weekly_challenges (user_id, start_date, end_date, status) VALUES (?, ?, ?, ?)'
      )
      .run(userId, weekStart, weekEnd, 'active');

    challenge = db
      .prepare('SELECT * FROM weekly_challenges WHERE id = ?')
      .get(result.lastInsertRowid) as WeeklyChallenge;
  }

  return challenge;
}

// Get challenge progress
export function getChallengeProgress(challengeId: number): {
  totalDays: number;
  completedDays: number;
  days: Array<{ date: string; uploaded: boolean; photo_path?: string; verification_status?: string }>;
} {
  const challenge = db
    .prepare('SELECT * FROM weekly_challenges WHERE id = ?')
    .get(challengeId) as WeeklyChallenge;

  const days: Array<{ date: string; uploaded: boolean; photo_path?: string; verification_status?: string }> = [];

  // Get all uploads for this challenge (only approved ones count)
  const uploads = db
    .prepare('SELECT upload_date, photo_path, verification_status FROM daily_uploads WHERE challenge_id = ?')
    .all(challengeId) as Array<{ upload_date: string; photo_path: string; verification_status: string }>;

  const uploadMap = new Map(uploads.map((u) => [u.upload_date, { path: u.photo_path, status: u.verification_status }]));

  // Get user registration date - this is where we start counting the 7 days
  const user = db.prepare('SELECT created_at FROM users WHERE id = ?').get(challenge.user_id) as { created_at: string } | undefined;
  if (!user) {
    // Fallback if user not found
    return { totalDays: 7, completedDays: 0, days: [] };
  }

  // Parse the registration date string and extract just the date part (YYYY-MM-DD)
  // SQLite stores DATETIME as strings, we need to extract just the date portion
  const createdAtStr = user.created_at;
  // Extract date part (before space or T, whichever comes first)
  const datePart = createdAtStr.split(' ')[0].split('T')[0];
  // Parse as YYYY-MM-DD to avoid timezone issues
  const [year, month, day] = datePart.split('-').map(Number);
  const registrationDate = new Date(year, month - 1, day); // month is 0-indexed in JS
  registrationDate.setHours(0, 0, 0, 0);

  // Generate exactly 7 days starting from registration date
  for (let i = 0; i < 7; i++) {
    const date = new Date(registrationDate);
    date.setDate(date.getDate() + i);
    date.setHours(0, 0, 0, 0);
    
    const dateStr = formatDate(date);
    const upload = uploadMap.get(dateStr);
    // uploaded is true if there's any upload (pending, approved, or rejected)
    // We check verification_status separately in the UI
    days.push({
      date: dateStr,
      uploaded: !!upload, // true if upload exists, regardless of status
      photo_path: upload?.path,
      verification_status: upload?.status,
    });
  }

  const completedDays = days.filter((d) => d.uploaded).length;

  return {
    totalDays: 7,
    completedDays,
    days,
  };
}

// Add daily upload
export function addDailyUpload(
  userId: number,
  challengeId: number,
  uploadDate: string,
  photoPath: string
): DailyUpload {
  // Check if upload already exists for this date
  const existing = db
    .prepare('SELECT * FROM daily_uploads WHERE challenge_id = ? AND upload_date = ?')
    .get(challengeId, uploadDate) as DailyUpload | undefined;

  if (existing) {
    throw new Error('Upload already exists for this date');
  }

  const result = db
    .prepare(
      'INSERT INTO daily_uploads (challenge_id, user_id, upload_date, photo_path, verification_status) VALUES (?, ?, ?, ?, ?)'
    )
    .run(challengeId, userId, uploadDate, photoPath, 'pending');

  // Update challenge completed_days
  const progress = getChallengeProgress(challengeId);
  db.prepare('UPDATE weekly_challenges SET completed_days = ? WHERE id = ?').run(
    progress.completedDays,
    challengeId
  );

  return db.prepare('SELECT * FROM daily_uploads WHERE id = ?').get(result.lastInsertRowid) as DailyUpload;
}

// Get user streak
export function getUserStreak(userId: number): Streak {
  let streak = db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(userId) as Streak | undefined;

  if (!streak) {
    db.prepare('INSERT INTO streaks (user_id, current_streak, longest_streak) VALUES (?, 0, 0)').run(userId);
    streak = db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(userId) as Streak;
  }

  return streak;
}

// Update streak based on daily upload (days instead of weeks)
export function updateStreak(userId: number, challengeCompleted: boolean): void {
  const streak = getUserStreak(userId);
  const today = formatDate(new Date());

  if (challengeCompleted) {
    // Check if last activity was yesterday
    if (!streak.last_activity_date) {
      // First completion - start with 1 day streak
      db.prepare('UPDATE streaks SET current_streak = 1, longest_streak = 1, last_activity_date = ? WHERE user_id = ?').run(
        today,
        userId
      );
    } else {
      const lastDate = new Date(streak.last_activity_date);
      const daysDiff = Math.floor((new Date(today).getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff === 1) {
        // Consecutive day, increment streak
        const newStreak = streak.current_streak + 1;
        const newLongest = Math.max(newStreak, streak.longest_streak);
        db.prepare(
          'UPDATE streaks SET current_streak = ?, longest_streak = ?, last_activity_date = ? WHERE user_id = ?'
        ).run(newStreak, newLongest, today, userId);
      } else if (daysDiff === 0) {
        // Same day, don't increment but update date
        db.prepare('UPDATE streaks SET last_activity_date = ? WHERE user_id = ?').run(today, userId);
      } else {
        // Streak broken (more than 1 day gap), reset to 1
        db.prepare('UPDATE streaks SET current_streak = 1, last_activity_date = ? WHERE user_id = ?').run(
          today,
          userId
        );
      }
    }
  } else {
    // Challenge failed, reset streak to 0
    db.prepare('UPDATE streaks SET current_streak = 0 WHERE user_id = ?').run(userId);
  }
}

// Update streak when a day is completed (called on upload)
export function updateStreakOnUpload(userId: number, uploadDate: string): void {
  const streak = getUserStreak(userId);
  const upload = new Date(uploadDate);
  upload.setHours(0, 0, 0, 0);
  const uploadDateStr = formatDate(upload);

  if (!streak.last_activity_date) {
    // First upload
    db.prepare('UPDATE streaks SET current_streak = 1, longest_streak = 1, last_activity_date = ? WHERE user_id = ?').run(
      uploadDateStr,
      userId
    );
  } else {
    const lastDate = new Date(streak.last_activity_date);
    lastDate.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor((upload.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff === 1) {
      // Consecutive day
      const newStreak = streak.current_streak + 1;
      const newLongest = Math.max(newStreak, streak.longest_streak);
      db.prepare(
        'UPDATE streaks SET current_streak = ?, longest_streak = ?, last_activity_date = ? WHERE user_id = ?'
      ).run(newStreak, newLongest, uploadDateStr, userId);
    } else if (daysDiff === 0) {
      // Same day, don't increment
      // Do nothing
    } else {
      // Gap in streak, reset to 1
      db.prepare('UPDATE streaks SET current_streak = 1, last_activity_date = ? WHERE user_id = ?').run(
        uploadDateStr,
        userId
      );
    }
  }
}

// Get user dashboard data
export function getUserDashboard(userId: number): {
  challenge: WeeklyChallenge;
  progress: ReturnType<typeof getChallengeProgress>;
  streak: Streak;
  debt: number;
} {
  const challenge = getOrCreateActiveChallenge(userId);
  const progress = getChallengeProgress(challenge.id);
  const streak = getUserStreak(userId);
  const user = db.prepare('SELECT credits FROM users WHERE id = ?').get(userId) as { credits: number };

  return {
    challenge,
    progress,
    streak,
    debt: user.credits, // credits column stores debt amount
  };
}

