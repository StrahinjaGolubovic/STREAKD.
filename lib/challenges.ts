import db from './db';
import { formatDateSerbia, formatDateDisplay, isTodaySerbia, isPastSerbia, parseSerbiaDate } from './timezone';
import { deductWeeklyFailurePenalty, awardWeeklyCompletionBonus, getUserTrophies } from './trophies';
import { purgeUserUploadsBeforeDate } from './purge';

function parseYMD(dateString: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateString.split('-').map(Number);
  return { year, month, day };
}

// Add days to a YYYY-MM-DD date string (treating it as a calendar day, timezone-agnostic)
function addDaysYMD(dateString: string, deltaDays: number): string {
  const { year, month, day } = parseYMD(dateString);
  const dt = new Date(Date.UTC(year, month - 1, day + deltaDays));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function diffDaysYMD(a: string, b: string): number {
  const A = parseYMD(a);
  const B = parseYMD(b);
  const tA = Date.UTC(A.year, A.month - 1, A.day);
  const tB = Date.UTC(B.year, B.month - 1, B.day);
  return Math.floor((tA - tB) / (1000 * 60 * 60 * 24));
}

export interface WeeklyChallenge {
  id: number;
  user_id: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'completed' | 'failed';
  completed_days: number;
  rest_days_available: number;
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

export interface RestDay {
  id: number;
  challenge_id: number;
  user_id: number;
  rest_date: string;
  created_at: string;
}

export interface Streak {
  id: number;
  user_id: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
}

/**
 * Recompute a user's streak from daily uploads, excluding rejected uploads.
 * This is used when an upload is approved/rejected so streak reflects legitimacy.
 *
 * Rules:
 * - A "valid day" is any day with at least one upload whose verification_status != 'rejected'
 *   (pending counts until rejected; approved counts).
 * - current_streak is the length of the most recent consecutive-day run ending on the latest valid day,
 *   but is 0 if that latest valid day is before yesterday (Serbia day).
 * - If the user has a rejected upload for Serbia-today, current_streak is forced to 0
 *   (a rejected day is treated as a failed streak day).
 * - longest_streak is the maximum consecutive-day run across all valid days.
 */
export function recomputeUserStreakFromUploads(userId: number): Streak {
  // Ensure streak row exists
  let streak = db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(userId) as Streak | undefined;
  if (!streak) {
    db.prepare('INSERT INTO streaks (user_id, current_streak, longest_streak) VALUES (?, 0, 0)').run(userId);
    streak = db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(userId) as Streak;
  }

  // Get all valid activity dates (approved uploads + rest days)
  const uploadRows = db
    .prepare(
      `SELECT upload_date
       FROM daily_uploads
       WHERE user_id = ?
         AND verification_status != 'rejected'
       ORDER BY upload_date ASC`
    )
    .all(userId) as Array<{ upload_date: string }>;

  const restDayRows = db
    .prepare(
      `SELECT rest_date as upload_date
       FROM rest_days
       WHERE user_id = ?
       ORDER BY rest_date ASC`
    )
    .all(userId) as Array<{ upload_date: string }>;

  // Combine and deduplicate dates
  const allDates = [...uploadRows.map((r) => r.upload_date), ...restDayRows.map((r) => r.upload_date)];
  const dates = [...new Set(allDates)].sort();
  const dateSet = new Set(dates);

  let longest = 0;
  let currentRun = 0;
  let lastDate: string | null = null;

  for (const d of dates) {
    if (!lastDate) {
      currentRun = 1;
      longest = Math.max(longest, currentRun);
      lastDate = d;
      continue;
    }

    const diff = diffDaysYMD(d, lastDate);
    if (diff === 0) {
      // same day duplicate (shouldn't happen), ignore
      continue;
    }
    if (diff === 1) {
      currentRun += 1;
    } else {
      currentRun = 1;
    }
    longest = Math.max(longest, currentRun);
    lastDate = d;
  }

  const today = formatDateSerbia();
  const yesterday = addDaysYMD(today, -1);

  // Product rule: if today's upload is rejected, streak should drop to 0 immediately.
  // This is different from the "carry yesterday's streak until you miss a full day" model.
  const rejectedToday = !!db
    .prepare("SELECT 1 FROM daily_uploads WHERE user_id = ? AND upload_date = ? AND verification_status = 'rejected'")
    .get(userId, today);

  let current = 0;
  if (lastDate) {
    // Determine the run length ending at lastDate by walking backwards through the sequence
    // (we can compute it by scanning again from the end).
    let run = 1;
    for (let i = dates.length - 1; i > 0; i--) {
      const a = dates[i];
      const b = dates[i - 1];
      const diff = diffDaysYMD(a, b);
      if (diff === 1) run += 1;
      else if (diff === 0) continue;
      else break;
    }

    // If the last valid upload is too old, streak is considered broken.
    current = lastDate < yesterday ? 0 : run;
  }

  // Admin baseline support:
  // Admins can set a "baseline streak" that should survive verification recomputes (especially for fresh accounts).
  // We extend that baseline only through consecutive valid activity dates.
  const baselineDate = (streak as any).admin_baseline_date as string | null | undefined;
  const baselineStreak = Number((streak as any).admin_baseline_streak ?? 0) || 0;
  const baselineLongest = Number((streak as any).admin_baseline_longest ?? 0) || 0;

  let baselineEnd: string | null = null;
  let baselineCurrent = 0;
  if (baselineDate && baselineStreak > 0) {
    // Extend baseline through consecutive valid dates after baselineDate.
    let k = 0;
    while (dateSet.has(addDaysYMD(baselineDate, k + 1))) {
      k += 1;
    }
    baselineEnd = addDaysYMD(baselineDate, k);
    baselineCurrent = baselineEnd < yesterday ? 0 : baselineStreak + k;
  }

  // Choose the streak that ends most recently; if equal end date, keep the larger streak.
  let nextLastDate: string | null = lastDate;
  let nextCurrent = current;
  if (baselineEnd) {
    if (!nextLastDate || baselineEnd > nextLastDate) {
      nextLastDate = baselineEnd;
      nextCurrent = baselineCurrent;
    } else if (baselineEnd === nextLastDate) {
      nextCurrent = Math.max(nextCurrent, baselineCurrent);
    }
  }

  if (rejectedToday) {
    nextCurrent = 0;
  }

  const nextLongest = Math.max(longest, streak.longest_streak, baselineLongest, baselineStreak, nextCurrent);

  db.prepare('UPDATE streaks SET current_streak = ?, longest_streak = ?, last_activity_date = ? WHERE user_id = ?').run(
    nextCurrent,
    nextLongest,
    nextLastDate,
    userId
  );

  return db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(userId) as Streak;
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

// Format date as YYYY-MM-DD (using Serbia timezone)
export function formatDate(date: Date = new Date()): string {
  return formatDateSerbia(date);
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
  // Try to get challenge with rest_days_available, fallback if column doesn't exist
  let challenge: WeeklyChallenge | undefined;
  try {
    challenge = db
      .prepare(
        'SELECT *, COALESCE(rest_days_available, 3) as rest_days_available FROM weekly_challenges WHERE user_id = ? AND start_date = ? AND status = ?'
      )
      .get(userId, weekStart, 'active') as WeeklyChallenge | undefined;
  } catch (error) {
    // If rest_days_available column doesn't exist yet, select without it and add default
    const challengeRow = db
      .prepare(
        'SELECT * FROM weekly_challenges WHERE user_id = ? AND start_date = ? AND status = ?'
      )
      .get(userId, weekStart, 'active') as any;
    
    if (challengeRow) {
      challenge = { ...challengeRow, rest_days_available: 3 } as WeeklyChallenge;
    }
  }

  if (!challenge) {
    const hadAnyChallenge = !!db
      .prepare('SELECT 1 FROM weekly_challenges WHERE user_id = ? LIMIT 1')
      .get(userId);

    // Check if there's a previous active challenge that needs to be closed
    const previousChallengeRow = db
      .prepare('SELECT * FROM weekly_challenges WHERE user_id = ? AND status = ? ORDER BY start_date DESC LIMIT 1')
      .get(userId, 'active') as any;
    
    const previousChallenge = previousChallengeRow 
      ? { ...previousChallengeRow, rest_days_available: previousChallengeRow.rest_days_available ?? 3 } as WeeklyChallenge
      : undefined;

    if (previousChallenge) {
      // Evaluate previous challenge (count uploads + rest days)
      const uploadCount = db
        .prepare("SELECT COUNT(*) as count FROM daily_uploads WHERE challenge_id = ? AND verification_status != 'rejected'")
        .get(previousChallenge.id) as { count: number };

      let restDayCount = { count: 0 };
      try {
        restDayCount = db
          .prepare('SELECT COUNT(*) as count FROM rest_days WHERE challenge_id = ?')
          .get(previousChallenge.id) as { count: number };
      } catch (error) {
        // rest_days table might not exist yet, use 0
        restDayCount = { count: 0 };
      }

      const completedDays = (uploadCount.count || 0) + (restDayCount.count || 0);
      const status = completedDays >= 5 ? 'completed' : 'failed';
      
      // Update previous challenge
      db.prepare('UPDATE weekly_challenges SET status = ?, completed_days = ? WHERE id = ?').run(
        status,
        completedDays,
        previousChallenge.id
      );

      // Apply trophy penalty for failed challenge (replaces old debt system)
      if (status === 'failed') {
        deductWeeklyFailurePenalty(userId, previousChallenge.id);
      } else if (status === 'completed') {
        // Award bonus for completing weekly challenge
        awardWeeklyCompletionBonus(userId, previousChallenge.id);
      }

      // Update streak
      updateStreak(userId, status === 'completed');
    }

    // Create new challenge (reset rest days to 3 for new week)
    // Check if rest_days_available column exists
    let result;
    try {
      result = db
        .prepare(
          'INSERT INTO weekly_challenges (user_id, start_date, end_date, status, rest_days_available) VALUES (?, ?, ?, ?, ?)'
        )
        .run(userId, weekStart, weekEnd, 'active', 3);
    } catch (error) {
      // Column doesn't exist, insert without it
      result = db
        .prepare(
          'INSERT INTO weekly_challenges (user_id, start_date, end_date, status) VALUES (?, ?, ?, ?)'
        )
        .run(userId, weekStart, weekEnd, 'active');
    }

    // Ensure rest_days_available is always in the returned challenge
    let challengeRow: any;
    try {
      challengeRow = db
        .prepare('SELECT *, COALESCE(rest_days_available, 3) as rest_days_available FROM weekly_challenges WHERE id = ?')
        .get(result.lastInsertRowid);
    } catch (error) {
      // Column doesn't exist, select without it
      challengeRow = db
        .prepare('SELECT * FROM weekly_challenges WHERE id = ?')
        .get(result.lastInsertRowid);
    }
    
    // Ensure rest_days_available always exists in the result
    challenge = { 
      ...challengeRow, 
      rest_days_available: challengeRow?.rest_days_available ?? 3 
    } as WeeklyChallenge;

    // Resource saver:
    // When we roll into a new week (meaning "This Week's Progress" starts empty), delete old uploads + files.
    // We keep pending uploads so admins can still verify them.
    // Best-effort: never block dashboard creation.
    if (hadAnyChallenge && previousChallenge) {
      purgeUserUploadsBeforeDate(userId, weekStart).catch(() => {
        // ignore
      });
    }
  }

  // Final safety check - ensure rest_days_available is always present
  if (challenge && typeof challenge.rest_days_available !== 'number') {
    challenge.rest_days_available = 3;
  }

  return challenge;
}

// Get challenge progress
export function getChallengeProgress(challengeId: number): {
  totalDays: number;
  completedDays: number;
  days: Array<{ date: string; uploaded: boolean; photo_path?: string; verification_status?: string; is_rest_day?: boolean }>;
} {
  let challengeRow: any;
  try {
    challengeRow = db
      .prepare('SELECT *, COALESCE(rest_days_available, 3) as rest_days_available FROM weekly_challenges WHERE id = ?')
      .get(challengeId);
  } catch (error) {
    // Column doesn't exist, select without it
    challengeRow = db
      .prepare('SELECT * FROM weekly_challenges WHERE id = ?')
      .get(challengeId);
  }
  
  // Ensure rest_days_available always exists
  const challenge = { 
    ...challengeRow, 
    rest_days_available: challengeRow?.rest_days_available ?? 3 
  } as WeeklyChallenge;

  const days: Array<{ date: string; uploaded: boolean; photo_path?: string; verification_status?: string; is_rest_day?: boolean }> = [];

  // Get all uploads for this challenge (only approved ones count)
  const uploads = db
    .prepare('SELECT upload_date, photo_path, verification_status FROM daily_uploads WHERE challenge_id = ?')
    .all(challengeId) as Array<{ upload_date: string; photo_path: string; verification_status: string }>;

  const uploadMap = new Map(uploads.map((u) => [u.upload_date, { path: u.photo_path, status: u.verification_status }]));

  // Get all rest days for this challenge
  let restDays: Array<{ rest_date: string }> = [];
  try {
    restDays = db
      .prepare('SELECT rest_date FROM rest_days WHERE challenge_id = ?')
      .all(challengeId) as Array<{ rest_date: string }>;
  } catch (error) {
    // rest_days table might not exist yet
    restDays = [];
  }

  const restDaySet = new Set(restDays.map((r) => r.rest_date));

  // Get user registration date - this is where we start counting the 7 days
  // Generate exactly 7 days for the challenge week (start_date .. start_date + 6)
  for (let i = 0; i < 7; i++) {
    const dateStr = addDaysYMD(challenge.start_date, i);
    const upload = uploadMap.get(dateStr);
    const isRestDay = restDaySet.has(dateStr);
    // uploaded is true if there's any upload (pending, approved, or rejected)
    // We check verification_status separately in the UI
    days.push({
      date: dateStr,
      uploaded: !!upload, // true if upload exists, regardless of status
      photo_path: upload?.path,
      verification_status: upload?.status,
      is_rest_day: isRestDay,
    });
  }

  // Rejected uploads should not count as completed. Rest days count as completed.
  const completedDays = days.filter((d) => 
    (d.uploaded && d.verification_status !== 'rejected') || d.is_rest_day
  ).length;

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

  // Check if rest day was already used for this date
  if (hasRestDay(challengeId, uploadDate)) {
    throw new Error('Rest day already used for this date');
  }

  const result = db
    .prepare(
      'INSERT INTO daily_uploads (challenge_id, user_id, upload_date, photo_path, verification_status) VALUES (?, ?, ?, ?, ?)'
    )
    .run(challengeId, userId, uploadDate, photoPath, 'pending');

  // Update streak immediately on upload submit (pending uploads still count as "done" for the day)
  // This keeps streak consistent even before admin verification.
  updateStreakOnUpload(userId, uploadDate);

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

  // Auto-reset streak if the user missed at least one full Serbia day.
  // Without a cron, this ensures the first request/heartbeat after midnight corrects the streak.
  if (streak.last_activity_date) {
    const today = formatDateSerbia();
    const yesterday = addDaysYMD(today, -1);

    // Check if there's any activity (upload or rest day) for yesterday
    const hasYesterdayUpload = db
      .prepare("SELECT 1 FROM daily_uploads WHERE user_id = ? AND upload_date = ? AND verification_status != 'rejected'")
      .get(userId, yesterday);
    
    let hasYesterdayRestDay = false;
    try {
      const restDayResult = db
        .prepare('SELECT 1 FROM rest_days WHERE user_id = ? AND rest_date = ?')
        .get(userId, yesterday);
      hasYesterdayRestDay = !!restDayResult;
    } catch (error) {
      // rest_days table might not exist yet
      hasYesterdayRestDay = false;
    }
    
    const hasYesterdayActivity = hasYesterdayUpload || hasYesterdayRestDay;

    // If last activity is before yesterday AND no activity yesterday, streak is broken
    if (streak.last_activity_date < yesterday && !hasYesterdayActivity && streak.current_streak !== 0) {
      db.prepare('UPDATE streaks SET current_streak = 0 WHERE user_id = ?').run(userId);
      streak.current_streak = 0;
    }
  }

  return streak;
}

// Update streak based on daily upload (days instead of weeks)
export function updateStreak(userId: number, challengeCompleted: boolean): void {
  const streak = getUserStreak(userId);
  const today = formatDateSerbia();

  if (challengeCompleted) {
    // Check if last activity was yesterday
    if (!streak.last_activity_date) {
      // First completion - start with 1 day streak
      db.prepare('UPDATE streaks SET current_streak = 1, longest_streak = 1, last_activity_date = ? WHERE user_id = ?').run(
        today,
        userId
      );
    } else {
      const daysDiff = diffDaysYMD(today, streak.last_activity_date);

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
  // uploadDate is already a Serbia YYYY-MM-DD string (from the app), treat it as a day key.
  const uploadDateStr = uploadDate;

  if (!streak.last_activity_date) {
    // First upload
    db.prepare('UPDATE streaks SET current_streak = 1, longest_streak = 1, last_activity_date = ? WHERE user_id = ?').run(
      uploadDateStr,
      userId
    );
  } else {
    const daysDiff = diffDaysYMD(uploadDateStr, streak.last_activity_date);

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
    } else if (daysDiff > 1) {
      // Gap in streak, reset to 1
      db.prepare('UPDATE streaks SET current_streak = 1, last_activity_date = ? WHERE user_id = ?').run(
        uploadDateStr,
        userId
      );
    } else {
      // Upload is older than last_activity_date (e.g., admin verifies an old upload) — ignore.
    }
  }
}

// Check if user used a rest day on a specific date
export function hasRestDay(challengeId: number, date: string): boolean {
  try {
    const restDay = db
      .prepare('SELECT * FROM rest_days WHERE challenge_id = ? AND rest_date = ?')
      .get(challengeId, date) as RestDay | undefined;
    return !!restDay;
  } catch (error) {
    // rest_days table might not exist yet
    return false;
  }
}

// Use a rest day for today
export function useRestDay(userId: number, challengeId: number, restDate: string): { success: boolean; message: string } {
  // Get challenge
  let challenge: WeeklyChallenge | undefined;
  try {
    challenge = db
      .prepare('SELECT *, COALESCE(rest_days_available, 3) as rest_days_available FROM weekly_challenges WHERE id = ? AND user_id = ? AND status = ?')
      .get(challengeId, userId, 'active') as WeeklyChallenge | undefined;
  } catch (error) {
    // If column doesn't exist, get without it
    const challengeRow = db
      .prepare('SELECT * FROM weekly_challenges WHERE id = ? AND user_id = ? AND status = ?')
      .get(challengeId, userId, 'active') as any;
    
    if (challengeRow) {
      challenge = { ...challengeRow, rest_days_available: 3 } as WeeklyChallenge;
    }
  }

  if (!challenge) {
    return { success: false, message: 'Challenge not found or not active' };
  }

  // Check if rest days available (default to 3 if column doesn't exist)
  const restDaysAvailable = challenge.rest_days_available ?? 3;
  if (restDaysAvailable <= 0) {
    return { success: false, message: 'No rest days available this week' };
  }

  // Check if already used rest day for this date
  if (hasRestDay(challengeId, restDate)) {
    return { success: false, message: 'Rest day already used for this date' };
  }

  // Check if already uploaded photo for this date
  const existingUpload = db
    .prepare('SELECT * FROM daily_uploads WHERE challenge_id = ? AND upload_date = ?')
    .get(challengeId, restDate) as DailyUpload | undefined;

  if (existingUpload) {
    return { success: false, message: 'Photo already uploaded for this date' };
  }

  try {
    // Insert rest day (wrap in try-catch in case table doesn't exist)
    try {
      db.prepare('INSERT INTO rest_days (challenge_id, user_id, rest_date) VALUES (?, ?, ?)')
        .run(challengeId, userId, restDate);
    } catch (error) {
      // If rest_days table doesn't exist, the migration should have created it
      // But if it still fails, throw error
      throw new Error('Rest days feature not available - database migration may be needed');
    }

    // Decrement rest days available (handle if column doesn't exist)
    try {
      db.prepare('UPDATE weekly_challenges SET rest_days_available = rest_days_available - 1 WHERE id = ?')
        .run(challengeId);
    } catch (error) {
      // Column might not exist yet, that's okay - we'll just track in rest_days table
      // The migration will add the column on next init
    }

    // Update streak (rest day counts as activity)
    updateStreakOnRestDay(userId, restDate);

    return { success: true, message: 'Rest day used successfully' };
  } catch (error) {
    console.error('Error using rest day:', error);
    return { success: false, message: 'Failed to use rest day' };
  }
}

// Update streak when rest day is used (similar to upload)
export function updateStreakOnRestDay(userId: number, restDate: string): void {
  const streak = getUserStreak(userId);
  const restDateStr = restDate;

  if (!streak.last_activity_date) {
    // First activity
    db.prepare('UPDATE streaks SET current_streak = 1, longest_streak = 1, last_activity_date = ? WHERE user_id = ?').run(
      restDateStr,
      userId
    );
  } else {
    const daysDiff = diffDaysYMD(restDateStr, streak.last_activity_date);

    if (daysDiff === 1) {
      // Consecutive day
      const newStreak = streak.current_streak + 1;
      const newLongest = Math.max(newStreak, streak.longest_streak);
      db.prepare(
        'UPDATE streaks SET current_streak = ?, longest_streak = ?, last_activity_date = ? WHERE user_id = ?'
      ).run(newStreak, newLongest, restDateStr, userId);
    } else if (daysDiff === 0) {
      // Same day, don't increment
      // Do nothing
    } else if (daysDiff > 1) {
      // Gap in streak, reset to 1
      db.prepare('UPDATE streaks SET current_streak = 1, last_activity_date = ? WHERE user_id = ?').run(
        restDateStr,
        userId
      );
    }
    // If restDate is before last_activity_date, ignore (shouldn't happen)
  }
}

// Get user dashboard data
export function getUserDashboard(userId: number): {
  challenge: WeeklyChallenge;
  progress: ReturnType<typeof getChallengeProgress>;
  streak: Streak;
  trophies: number;
} {
  const challenge = getOrCreateActiveChallenge(userId);
  const progress = getChallengeProgress(challenge.id);
  const streak = getUserStreak(userId);
  const trophies = getUserTrophies(userId);

  // If the new week's progress has no photos at all, purge old uploads to save resources.
  // (Best-effort; doesn't block returning the dashboard.)
  const hasAnyPhotoThisWeek = progress.days.some((d) => d.uploaded);
  if (!hasAnyPhotoThisWeek) {
    purgeUserUploadsBeforeDate(userId, challenge.start_date).catch(() => {
      // ignore
    });
  }

  return {
    challenge,
    progress,
    streak,
    trophies,
  };
}

