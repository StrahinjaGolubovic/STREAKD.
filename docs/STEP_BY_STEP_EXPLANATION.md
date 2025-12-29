# Step-by-Step System Explanation

This document explains exactly what happens at each step when users interact with the Gymble system.

---

## 🎯 The Function You're Looking At: `awardWeeklyCompletionBonus`

**Location**: `lib/trophies.ts` line 174-208

### What This Function Does:
Awards bonus Dumbbells when a user completes a perfect week (7/7 days).

### Step-by-Step Breakdown:

```typescript
export function awardWeeklyCompletionBonus(userId: number, challengeId: number): void {
```

**Step 1**: Check if the challenge is perfect (7/7 days)
```typescript
const currentRow = db
  .prepare('SELECT status, completed_days FROM weekly_challenges WHERE id = ? AND user_id = ?')
  .get(challengeId, userId);
```
- **What it does**: Queries the database to get the challenge's status and completed days
- **Why**: We only award bonuses for perfect weeks (7/7), not 5/7 or 6/7

**Step 2**: Verify it's actually perfect
```typescript
const isPerfect = currentRow.status === 'completed' && Number(currentRow.completed_days ?? 0) >= 7;
if (!isPerfect) return; // Exit early if not perfect
```
- **What it does**: Checks if status is "completed" AND completed_days >= 7
- **Why**: If it's not perfect, we exit immediately (no bonus)

**Step 3**: Get ALL user's challenges (most recent first)
```typescript
const allChallenges = db
  .prepare(`
    SELECT id, status, completed_days
    FROM weekly_challenges
    WHERE user_id = ?
    ORDER BY id DESC  -- Most recent first!
  `)
  .all(userId);
```
- **What it does**: Gets every weekly challenge the user ever had, ordered newest to oldest
- **Why**: We need to count CONSECUTIVE perfect weeks (if they did 3 perfect weeks in a row, bonus scales)

**Step 4**: Count consecutive perfect weeks
```typescript
let consecutivePerfectWeeks = 0;
for (const ch of allChallenges) {
  const perfect = ch.status === 'completed' && Number(ch.completed_days ?? 0) >= 7;
  if (perfect) consecutivePerfectWeeks++;
  else break;  // Stop counting if we hit a non-perfect week
}
```
- **What it does**: 
  - Starts from the most recent challenge
  - If it's perfect (7/7), add 1 to the counter
  - If it's perfect, check the next one (previous week)
  - Keep going until we hit a week that's NOT perfect
  - **STOP** when we hit a non-perfect week (breaks the consecutive chain)
- **Example**:
  - Week 1 (most recent): 7/7 ✅ → count = 1
  - Week 2: 7/7 ✅ → count = 2
  - Week 3: 7/7 ✅ → count = 3
  - Week 4: 5/7 ❌ → **STOP** (not perfect, breaks chain)
  - Result: 3 consecutive perfect weeks

**Step 5**: Calculate bonus amount
```typescript
const bonus = Math.min(10 * consecutivePerfectWeeks, 70);
```
- **What it does**: 
  - Multiply consecutive weeks by 10
  - Cap at 70 (so 7+ weeks = 70, not infinite)
- **Examples**:
  - 1 consecutive perfect week → 10 × 1 = **+10 Dumbbells**
  - 2 consecutive perfect weeks → 10 × 2 = **+20 Dumbbells**
  - 3 consecutive perfect weeks → 10 × 3 = **+30 Dumbbells**
  - 7 consecutive perfect weeks → 10 × 7 = **+70 Dumbbells**
  - 10 consecutive perfect weeks → **+70 Dumbbells** (capped)

**Step 6**: Apply the bonus
```typescript
applyTrophyDelta(
  userId,
  null,  // No upload_id (this is a weekly bonus, not tied to a specific upload)
  bonus,
  `weekly_completion:challenge_${challengeId}:perfect_consecutive_${consecutivePerfectWeeks}`
);
```
- **What it does**: Adds the bonus Dumbbells to the user's account
- **Why `null` for upload_id**: This bonus isn't tied to a specific photo upload, it's for completing the whole week
- **The reason string**: Records WHY they got this bonus (for audit trail)

---

## 🔄 Complete Flow: User Uploads Photo → Admin Approves

Let's trace what happens when a user uploads a photo and an admin approves it.

### Phase 1: User Uploads Photo

**File**: `app/api/upload/route.ts`

**Step 1**: User selects photo and clicks "Upload"
- Photo is sent to `/api/upload` endpoint
- Server saves photo file to disk
- Creates a database record in `daily_uploads` table:
  ```sql
  INSERT INTO daily_uploads (user_id, challenge_id, upload_date, photo_path, verification_status)
  VALUES (123, 456, '2025-01-15', '/uploads/123/photo.jpg', 'pending')
  ```
- **Status**: `verification_status = 'pending'` (waiting for admin approval)

**Step 2**: User sees "Pending" in their dashboard
- Dashboard shows the photo with a "pending" badge
- No Dumbbells awarded yet (must be approved first)
- No streak change yet (must be approved first)

---

### Phase 2: Admin Reviews Photo

**File**: `app/api/admin/verify-upload/route.ts`

**Step 3**: Admin opens verification page
- Sees all pending uploads
- Can see photo, user info, upload date

**Step 4**: Admin clicks "Approve" or "Reject"
- Sends request to `/api/admin/verify-upload`
- Request includes: `{ uploadId: 789, status: 'approved' }`

---

### Phase 3: System Processes Approval

**Step 5**: Update upload status
```typescript
verifyUpload(uploadId, 'approved', adminUserId);
```
- Changes `verification_status` from `'pending'` to `'approved'`
- Records which admin approved it (`verified_by`)
- Records when it was approved (`verified_at`)

**Step 6**: Recompute user's streak
```typescript
recomputeUserStreakFromUploads(upload.user_id);
```

**What `recomputeUserStreakFromUploads` does** (this is complex!):

**6a. Get all valid activity dates**
```typescript
// Get approved uploads
const uploadRows = db.prepare(`
  SELECT upload_date
  FROM daily_uploads
  WHERE user_id = ?
    AND verification_status != 'rejected'  -- Only approved uploads count!
  ORDER BY upload_date ASC
`).all(userId);

// Get rest days
const restDayRows = db.prepare(`
  SELECT rest_date as upload_date
  FROM rest_days
  WHERE user_id = ?
  ORDER BY rest_date ASC
`).all(userId);
```
- **What it does**: Collects ALL dates where user had valid activity (approved uploads OR rest days)
- **Example**: `['2025-01-10', '2025-01-11', '2025-01-12', '2025-01-14', '2025-01-15']`

**6b. Find consecutive sequences**
```typescript
const dates = [...new Set(allDates)].sort();  // Remove duplicates, sort chronologically
let currentRun = 0;
let longest = 0;

for (const d of dates) {
  if (!lastDate) {
    currentRun = 1;  // First date = streak of 1
  } else {
    const diff = diffDaysYMD(d, lastDate);
    if (diff === 1) {
      currentRun += 1;  // Consecutive day! Increment streak
    } else {
      currentRun = 1;  // Gap found! Reset to 1
    }
  }
  longest = Math.max(longest, currentRun);
  lastDate = d;
}
```
- **What it does**: Walks through dates chronologically, counting consecutive days
- **Example with dates above**:
  - `2025-01-10`: streak = 1
  - `2025-01-11`: consecutive! streak = 2
  - `2025-01-12`: consecutive! streak = 3
  - `2025-01-14`: gap of 2 days! streak = 1 (reset)
  - `2025-01-15`: consecutive! streak = 2
  - **Result**: `current_streak = 2`, `longest_streak = 3`

**6c. Check for rejection today**
```typescript
const rejectedToday = !!db
  .prepare("SELECT 1 FROM daily_uploads WHERE user_id = ? AND upload_date = ? AND verification_status = 'rejected'")
  .get(userId, today);

if (rejectedToday) {
  nextCurrent = 0;  // Rejection today = streak immediately becomes 0!
}
```
- **What it does**: If today's upload was rejected, streak = 0 (even if they had a streak before)
- **Why**: Rejection is worse than missing a day - it's a failure

**6d. Handle admin baseline**
```typescript
const baselineDate = streak.admin_baseline_date;
const baselineStreak = streak.admin_baseline_streak;

if (baselineDate && baselineStreak > 0) {
  // Extend baseline through consecutive valid dates
  let k = 0;
  while (dateSet.has(addDaysYMD(baselineDate, k + 1))) {
    k += 1;  // Count how many consecutive days after baseline
  }
  baselineCurrent = baselineStreak + k;  // Admin set 5, + 2 consecutive days = 7
}
```
- **What it does**: If admin set a streak baseline (e.g., "set streak to 5"), extend it through consecutive activity
- **Why**: Admin edits should survive verification recomputation

**6e. Update streak in database**
```typescript
db.prepare('UPDATE streaks SET current_streak = ?, longest_streak = ?, last_activity_date = ? WHERE user_id = ?')
  .run(nextCurrent, nextLongest, nextLastDate, userId);
```
- **What it does**: Saves the computed streak values
- **Result**: User's streak is now updated!

**Step 7**: Update weekly challenge progress
```typescript
const progress = getChallengeProgress(upload.challenge_id);
db.prepare('UPDATE weekly_challenges SET completed_days = ? WHERE id = ?')
  .run(progress.completedDays, upload.challenge_id);
```
- **What it does**: Counts how many days in the week are completed (approved uploads + rest days)
- **Example**: If user has 5 approved uploads + 1 rest day = `completed_days = 6`

**Step 8**: Award/penalize Dumbbells
```typescript
syncTrophiesForUpload({
  userId: upload.user_id,
  uploadId,
  uploadDate: upload.upload_date,
  status: 'approved',
});
```

**What `syncTrophiesForUpload` does**:

**8a. Check if already processed**
```typescript
const existing = db.prepare('SELECT delta FROM trophy_transactions WHERE upload_id = ?').get(uploadId);
if (existing) {
  // Already awarded/penalized, need to reverse it first
  // (in case admin toggles approve → reject → approve)
}
```
- **What it does**: Checks if we already gave Dumbbells for this upload
- **Why**: If admin toggles approve/reject, we need to reverse previous transactions

**8b. Calculate reward amount**
```typescript
const reward = trophiesAwardForApproval(userId, uploadId, uploadDate);
```

**What `trophiesAwardForApproval` does**:

**8b-i. Get base reward**
```typescript
const base = baseTrophiesForUpload(uploadId);
// Returns: 26 + (uploadId % 7) = 26-32 Dumbbells
```
- **What it does**: Calculates base reward (26-32 Dumbbells, deterministic based on uploadId)
- **Why deterministic**: Same upload always gives same reward (can't spam/re-roll)

**8b-ii. Check if streak was maintained**
```typescript
const yesterday = addDaysYMD(uploadDate, -1);

// Check if user had approved upload yesterday
const hasYesterdayApproved = !!db
  .prepare('SELECT 1 FROM daily_uploads WHERE user_id = ? AND verification_status = "approved" AND upload_date = ?')
  .get(userId, yesterday);

// Check if user used rest day yesterday
const hasYesterdayRestDay = !!db
  .prepare('SELECT 1 FROM rest_days WHERE user_id = ? AND rest_date = ?')
  .get(userId, yesterday);

const hasYesterdayActivity = hasYesterdayApproved || hasYesterdayRestDay;
```
- **What it does**: Checks if user had activity yesterday (upload OR rest day)
- **Why**: If they did, streak was maintained = full reward

**8b-iii. Check if this is first activity ever**
```typescript
const hasPriorActivity = /* check if any approved uploads or rest days before this date */;
const maintainedStreak = hasPriorActivity ? hasYesterdayActivity : true;
```
- **What it does**: 
  - If this is user's FIRST upload ever → full reward (no penalty)
  - If they had activity before → check if streak maintained
- **Why**: Don't penalize new users!

**8b-iv. Calculate final reward**
```typescript
return maintainedStreak ? base : Math.max(1, Math.round(base / 2));
```
- **If streak maintained**: Full reward (26-32 Dumbbells)
- **If streak broken**: Half reward (13-16 Dumbbells)

**8c. Apply Dumbbell change**
```typescript
applyTrophyDelta(userId, uploadId, reward, 'upload_approved');
```

**What `applyTrophyDelta` does**:

**8c-i. Check current Dumbbells**
```typescript
const current = db.prepare('SELECT COALESCE(trophies, 0) as trophies FROM users WHERE id = ?').get(userId).trophies;
```
- **What it does**: Gets user's current Dumbbell count

**8c-ii. Clamp negative values**
```typescript
let appliedDelta = delta;
if (delta < 0 && current + delta < 0) {
  appliedDelta = -current;  // Only subtract what's available (bring to 0)
}
```
- **What it does**: If penalty would make Dumbbells negative, clamp to 0
- **Why**: Users can never have negative Dumbbells!

**8c-iii. Update user's Dumbbells**
```typescript
db.prepare('UPDATE users SET trophies = COALESCE(trophies, 0) + ? WHERE id = ?')
  .run(appliedDelta, userId);
```
- **What it does**: Adds/subtracts Dumbbells from user's account

**8c-iv. Record transaction**
```typescript
db.prepare('INSERT INTO trophy_transactions (user_id, upload_id, delta, reason) VALUES (?, ?, ?, ?)')
  .run(userId, uploadId, appliedDelta, reason);
```
- **What it does**: Records WHY Dumbbells changed (for audit trail)
- **Example**: `{ userId: 123, uploadId: 789, delta: +28, reason: 'upload_approved' }`

---

### Phase 4: Weekly Challenge Completion

**When**: A new week starts (Monday Serbia time)

**File**: `lib/challenges.ts` → `getOrCreateActiveChallenge()`

**Step 9**: System detects new week
```typescript
// Check if active challenge exists for current week
const challenge = db.prepare('SELECT * FROM weekly_challenges WHERE user_id = ? AND start_date = ? AND status = "active"')
  .get(userId, currentWeekStart);

if (!challenge) {
  // No challenge for this week = new week started!
  // Need to close previous week and create new one
}
```

**Step 10**: Close previous week
```typescript
// Count completed days in previous week
const uploadCount = db.prepare('SELECT COUNT(*) FROM daily_uploads WHERE challenge_id = ? AND verification_status != "rejected"')
  .get(previousChallengeId).count;

const restDayCount = db.prepare('SELECT COUNT(*) FROM rest_days WHERE challenge_id = ?')
  .get(previousChallengeId).count;

const completedDays = uploadCount + restDayCount;
const status = completedDays >= 5 ? 'completed' : 'failed';

// Update previous challenge
db.prepare('UPDATE weekly_challenges SET status = ?, completed_days = ? WHERE id = ?')
  .run(status, completedDays, previousChallengeId);
```
- **What it does**: 
  - Counts approved uploads + rest days from previous week
  - If >= 5 days → `status = 'completed'`
  - If < 5 days → `status = 'failed'`

**Step 11**: Award weekly bonus (if perfect)
```typescript
if (status === 'completed') {
  awardWeeklyCompletionBonus(userId, previousChallengeId);
}
```
- **What it does**: Calls the function you're looking at!
- **Only if**: Week was completed (5+ days) AND perfect (7/7 days)
- **Result**: User gets bonus Dumbbells (10-70 depending on consecutive perfect weeks)

**Step 12**: Create new weekly challenge
```typescript
db.prepare('INSERT INTO weekly_challenges (user_id, start_date, end_date, status, rest_days_available) VALUES (?, ?, ?, ?, ?)')
  .run(userId, newWeekStart, newWeekEnd, 'active', 3);
```
- **What it does**: Creates fresh challenge for new week
- **Rest days reset**: `rest_days_available = 3` (fresh start!)

**Step 13**: Purge old uploads (resource saving)
```typescript
purgeUserUploadsBeforeDate(userId, newWeekStart);
```
- **What it does**: Deletes old upload photos and database entries from previous weeks
- **Why**: Save disk space and database size
- **Keeps**: Pending uploads (so admins can still verify them)

---

## 🎮 Example: Complete User Journey

Let's trace a real example:

### Day 1 (Monday): User's First Upload
1. User uploads photo → Status: `pending`
2. Admin approves → **Streak = 1**, **Dumbbells = +28** (full reward, first upload)
3. Weekly challenge: `completed_days = 1`

### Day 2 (Tuesday): Consecutive Day
1. User uploads photo → Status: `pending`
2. Admin approves → **Streak = 2**, **Dumbbells = +30** (full reward, streak maintained)
3. Weekly challenge: `completed_days = 2`

### Day 3 (Wednesday): Uses Rest Day
1. User clicks "Use Rest Day" → **Streak = 3** (rest day counts!), **Dumbbells = 0** (no reward for rest day)
2. Weekly challenge: `completed_days = 3`, `rest_days_available = 2`

### Day 4 (Thursday): Upload After Rest Day
1. User uploads photo → Status: `pending`
2. Admin approves → **Streak = 4**, **Dumbbells = +26** (full reward! rest day yesterday maintained streak)
3. Weekly challenge: `completed_days = 4`

### Day 5 (Friday): Upload Approved
1. User uploads photo → Status: `pending`
2. Admin approves → **Streak = 5**, **Dumbbells = +29** (full reward)
3. Weekly challenge: `completed_days = 5` → **Status changes to "completed"** (5+ days!)

### Day 6 (Saturday): Upload Approved
1. User uploads photo → Status: `pending`
2. Admin approves → **Streak = 6**, **Dumbbells = +31** (full reward)
3. Weekly challenge: `completed_days = 6`

### Day 7 (Sunday): Perfect Week!
1. User uploads photo → Status: `pending`
2. Admin approves → **Streak = 7**, **Dumbbells = +27** (full reward)
3. Weekly challenge: `completed_days = 7` → **Perfect week!**

### Monday (Next Week): Week Rollover
1. User opens dashboard → System detects new week
2. Previous week closed: `status = 'completed'`, `completed_days = 7`
3. **Bonus awarded**: `awardWeeklyCompletionBonus()` called
   - Checks: Is it perfect? ✅ (7/7)
   - Checks: How many consecutive perfect weeks?
     - Most recent: 7/7 ✅ → count = 1
     - Previous week: (doesn't exist, first week) → **STOP**
   - **Bonus = 10 × 1 = +10 Dumbbells**
4. New challenge created: `rest_days_available = 3` (reset!)
5. Old uploads purged (photos deleted, database entries removed)

**Final Result**:
- **Streak**: 7 days
- **Dumbbells**: 28 + 30 + 26 + 29 + 31 + 27 + 10 (bonus) = **181 Dumbbells**
- **Weekly challenge**: Perfect week completed, +10 bonus awarded

---

## 🔍 Key Concepts Explained

### Why Recompute Streak Every Time?
- **Reason**: Streaks can change when:
  - Admin approves/rejects uploads
  - User uses rest days
  - Admin sets baseline streaks
- **Solution**: Always recalculate from scratch to ensure accuracy

### Why Check "Yesterday" for Reward?
- **Reason**: To determine if streak was maintained
- **Logic**: 
  - If you had activity yesterday → streak maintained → full reward
  - If you didn't → streak broken → half reward

### Why Clamp Dumbbells at 0?
- **Reason**: Users shouldn't go into "debt"
- **Logic**: If penalty would make Dumbbells negative, only subtract down to 0

### Why Only Perfect Weeks Get Bonus?
- **Reason**: Encourages consistency (7/7 is harder than 5/7)
- **Logic**: 
  - 5/7 or 6/7 = completed but not perfect = no bonus
  - 7/7 = perfect = bonus awarded

### Why Consecutive Perfect Weeks Scale?
- **Reason**: Rewards long-term consistency
- **Logic**: 
  - 1 perfect week = +10
  - 2 consecutive = +20 (harder!)
  - 3 consecutive = +30 (even harder!)
  - Capped at +70 (7+ weeks)

---

## 📊 Database Tables Involved

1. **`users`**: Stores Dumbbell count (`trophies`)
2. **`streaks`**: Stores current/longest streak, admin baselines
3. **`daily_uploads`**: Stores photo uploads, verification status
4. **`rest_days`**: Stores rest day usage
5. **`weekly_challenges`**: Stores weekly challenge progress
6. **`trophy_transactions`**: Audit trail of all Dumbbell changes

---

This is how the entire system works step-by-step! Every action triggers a chain of database queries, calculations, and updates to keep everything consistent.

