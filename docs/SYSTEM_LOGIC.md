# Gymble System Logic Documentation

This document explains how every aspect of the Gymble system works, covering all scenarios and edge cases.

## Table of Contents

1. [Streak System](#streak-system)
2. [Trophy/Dumbbell System](#trophydumbbell-system)
3. [Rest Days](#rest-days)
4. [Weekly Challenges](#weekly-challenges)
5. [Admin Edits](#admin-edits)
6. [Edge Cases & Combinations](#edge-cases--combinations)

---

## Streak System

### Core Logic

The streak system tracks consecutive days of gym activity. A "valid day" is either:
- An **approved upload** for that date
- A **rest day** used for that date

### How Streaks Are Calculated

1. **Collection**: All valid activity dates are collected (approved uploads + rest days)
2. **Sequencing**: Dates are sorted chronologically
3. **Consecutive Detection**: The system finds the longest consecutive sequence ending at the most recent valid date
4. **Current Streak**: The length of the consecutive sequence ending at or after "yesterday" (Serbia time)
5. **Longest Streak**: The maximum consecutive sequence ever achieved

### Scenario Breakdown

#### ✅ **Scenario 1: First Upload Ever**
- **Action**: User uploads their first photo and it's approved
- **Result**: `current_streak = 1`, `longest_streak = 1`
- **Logic**: First activity starts a streak of 1

#### ✅ **Scenario 2: Consecutive Days**
- **Action**: User uploads yesterday and today, both approved
- **Result**: `current_streak = 2`, `longest_streak = 2`
- **Logic**: Consecutive dates increment the streak

#### ✅ **Scenario 3: Gap in Streak**
- **Action**: User uploads 2 days ago, misses yesterday, uploads today
- **Result**: `current_streak = 1` (reset), `longest_streak = 2` (preserved)
- **Logic**: A gap of 2+ days breaks the streak, new upload starts at 1

#### ✅ **Scenario 4: Rejection Today → Streak = 0**
- **Action**: User has streak of 5, uploads today, admin rejects it
- **Result**: `current_streak = 0` **immediately**
- **Logic**: A rejected upload for today immediately resets the streak to 0 (different from missing a day)

#### ✅ **Scenario 5: Rest Day Maintains Streak**
- **Action**: User has streak of 3, uses rest day today
- **Result**: `current_streak = 4` (increments)
- **Logic**: Rest days count as valid activity and maintain/extend the streak

#### ✅ **Scenario 6: Admin Baseline Preservation**
- **Action**: Admin sets user's streak to 5, user uploads next day
- **Result**: `current_streak = 6` (5 + 1)
- **Logic**: Admin-set baselines are preserved and extended through consecutive activity

#### ✅ **Scenario 7: Admin Baseline + Consecutive Activity**
- **Action**: Admin sets baseline to 3 (as of yesterday), user uploads yesterday and today
- **Result**: Streak extends from baseline (3) through consecutive days
- **Logic**: Baseline is extended through any consecutive valid dates after the baseline date

---

## Trophy/Dumbbell System

### Core Logic

Dumbbells (formerly "Trophies") are the currency/reward system. They are:
- **Awarded** for approved uploads
- **Penalized** for rejected uploads
- **Never negative** (clamped at 0)

### Reward Calculation

#### **Base Reward**: 26-32 Dumbbells (randomized per upload)

#### **Reward Modifiers**:

1. **Full Reward (26-32)**:
   - ✅ First upload ever (no prior activity)
   - ✅ Streak maintained (approved upload or rest day yesterday)
   - ✅ Rest day used yesterday → upload today gets full reward

2. **Half Reward (13-16)**:
   - ❌ Streak broken (gap of 2+ days between last activity and today)

### Penalty Calculation

#### **Rejection Penalty**: -52 to -64 Dumbbells (2x base reward)
- Applied when an upload is rejected
- **Clamped at 0**: If user has < 52 Dumbbells, penalty brings them to 0 (not negative)

### Weekly Bonus System

#### **Perfect Week Bonus**:
- **Requirement**: Complete exactly 7/7 days in a week (perfect week)
- **Bonus Scale**:
  - 1st perfect week: +10 Dumbbells
  - 2nd consecutive perfect week: +20 Dumbbells
  - 3rd consecutive perfect week: +30 Dumbbells
  - 4th consecutive perfect week: +40 Dumbbells
  - 5th consecutive perfect week: +50 Dumbbells
  - 6th consecutive perfect week: +60 Dumbbells
  - 7th+ consecutive perfect week: +70 Dumbbells (capped)

#### **Important Rules**:
- ❌ **No bonus** for 5/7, 6/7, etc. (only perfect 7/7)
- ❌ **No penalty** for failing a week (< 5/7)
- ✅ **Consecutive tracking**: Bonus resets if a week is not perfect

### Scenario Breakdown

#### ✅ **Scenario 1: First Upload**
- **Action**: User uploads first photo, approved
- **Result**: +26 to +32 Dumbbells
- **Logic**: No prior activity = full reward

#### ✅ **Scenario 2: Consecutive Days (Streak Maintained)**
- **Action**: User uploads yesterday and today, both approved
- **Result**: +26 to +32 Dumbbells each
- **Logic**: Streak maintained = full reward

#### ✅ **Scenario 3: Gap in Streak**
- **Action**: User uploads 2 days ago, misses yesterday, uploads today
- **Result**: +13 to +16 Dumbbells (half reward)
- **Logic**: Streak broken = half reward

#### ✅ **Scenario 4: Rest Day Yesterday → Full Reward Today**
- **Action**: User uses rest day yesterday, uploads today
- **Result**: +26 to +32 Dumbbells (full reward)
- **Logic**: Rest day counts as maintaining streak

#### ✅ **Scenario 5: Rejection Penalty**
- **Action**: User uploads, admin rejects
- **Result**: -52 to -64 Dumbbells (clamped at 0)
- **Logic**: Rejection penalty = 2x base reward

#### ✅ **Scenario 6: Rejection at 0 Dumbbells**
- **Action**: User has 0 Dumbbells, uploads, admin rejects
- **Result**: Stays at 0 (clamped)
- **Logic**: Never go negative

#### ✅ **Scenario 7: Perfect Week Bonus**
- **Action**: User completes 7/7 days in a week
- **Result**: +10 Dumbbells (first perfect week)
- **Logic**: Perfect week = bonus awarded

#### ✅ **Scenario 8: Consecutive Perfect Weeks**
- **Action**: User completes 3 consecutive perfect weeks
- **Result**: +10, +20, +30 = +60 total bonus
- **Logic**: Bonus scales with consecutive perfect weeks

#### ✅ **Scenario 9: Failed Week**
- **Action**: User completes 4/7 days (failed week)
- **Result**: No bonus, no penalty
- **Logic**: Failed weeks don't award bonuses or penalties

---

## Rest Days

### Core Logic

Rest days are a **credit system** that allows users to skip a gym day while maintaining their streak.

### Rules

1. **Credits**: 3 rest days per week (max 3)
2. **Mutual Exclusivity**: Cannot use rest day and upload photo on the same date
3. **Streak Maintenance**: Rest days count as valid activity for streak purposes
4. **Weekly Reset**: Rest days reset to 3 at the start of each new weekly challenge

### Scenario Breakdown

#### ✅ **Scenario 1: Using a Rest Day**
- **Action**: User has 3/3 rest days, uses one for today
- **Result**: Rest day recorded, streak maintained/incremented, credits: 2/3
- **Logic**: Rest day counts as valid activity

#### ✅ **Scenario 2: Rest Day + Upload Same Day = Blocked**
- **Action**: User uses rest day for today, then tries to upload
- **Result**: Upload fails with "Rest day already used for this date"
- **Logic**: Mutual exclusivity enforced

#### ✅ **Scenario 3: Upload + Rest Day Same Day = Blocked**
- **Action**: User uploads photo for today, then tries to use rest day
- **Result**: Rest day fails with "Photo already uploaded for this date"
- **Logic**: Mutual exclusivity enforced

#### ✅ **Scenario 4: Max 3 Rest Days Per Week**
- **Action**: User uses 3 rest days, tries to use a 4th
- **Result**: 4th rest day fails with "No rest days available this week"
- **Logic**: Credit limit enforced

#### ✅ **Scenario 5: Rest Day Maintains Streak**
- **Action**: User has streak of 5, uses rest day today
- **Result**: Streak becomes 6
- **Logic**: Rest days count as valid activity

#### ✅ **Scenario 6: Rest Day Yesterday → Full Reward Today**
- **Action**: User uses rest day yesterday, uploads today
- **Result**: Full reward (26-32 Dumbbells), not half
- **Logic**: Rest day counts as maintaining streak for reward purposes

---

## Weekly Challenges

### Core Logic

Each user has a weekly challenge that runs from Monday to Sunday (Serbia time). Challenges track:
- **Status**: `active`, `completed`, `failed`
- **Completed Days**: Count of approved uploads + rest days
- **Rest Days Available**: Credits remaining (3 max, resets each week)

### Challenge Completion

- **Completed**: 5+ days completed (including rest days)
- **Failed**: < 5 days completed
- **Perfect**: 7/7 days completed (triggers bonus)

### Week Rollover

When a new week starts:
1. Old challenge is marked `completed` or `failed`
2. New challenge is created with `rest_days_available = 3`
3. **Perfect week bonus** is awarded if applicable
4. **Old uploads are purged** (non-pending uploads from previous weeks are deleted)

### Scenario Breakdown

#### ✅ **Scenario 1: Perfect Week (7/7)**
- **Action**: User completes all 7 days (uploads + rest days)
- **Result**: Challenge marked `completed`, +10 bonus (first perfect week)
- **Logic**: Perfect week = bonus awarded

#### ✅ **Scenario 2: Completed Week (5-6/7)**
- **Action**: User completes 5 or 6 days
- **Result**: Challenge marked `completed`, no bonus, no penalty
- **Logic**: Completed but not perfect = no bonus

#### ✅ **Scenario 3: Failed Week (< 5/7)**
- **Action**: User completes < 5 days
- **Result**: Challenge marked `failed`, no bonus, no penalty
- **Logic**: Failed weeks don't award bonuses or penalties

#### ✅ **Scenario 4: Week Rollover**
- **Action**: New week starts
- **Result**: New challenge created, rest days reset to 3, old uploads purged
- **Logic**: Fresh start each week

---

## Admin Edits

### Core Logic

Admins can set user values (streak, trophies, etc.). These edits must be **consistent** and **preserved** across the system.

### Streak Edits

#### **Admin Sets Current Streak**:
- **Baseline Storage**: Admin-set streak is stored as `admin_baseline_date`, `admin_baseline_streak`, `admin_baseline_longest`
- **Preservation**: Baseline survives verification recomputation
- **Extension**: Baseline is extended through consecutive valid activity dates
- **Next Upload**: If admin sets streak to 5, next approved upload makes it 6

#### **Invariants**:
- `longest_streak >= current_streak` (auto-enforced)
- If `current_streak > 0` set without `last_activity_date`, `last_activity_date` is set to **yesterday** (Serbia)
- If `current_streak = 0` set without `last_activity_date`, `last_activity_date` is cleared

### Trophy Edits

#### **Admin Sets Trophies**:
- **Transaction Record**: Creates `trophy_transactions` entry with `reason = 'admin_set'`
- **Consistency**: Future awards/penalties adjust from this baseline
- **Clamping**: Still enforced (never negative)

### Scenario Breakdown

#### ✅ **Scenario 1: Admin Sets Streak to 5 → Next Upload = 6**
- **Action**: Admin sets `current_streak = 5`, user uploads next day
- **Result**: `current_streak = 6` after approval
- **Logic**: Baseline preserved and extended

#### ✅ **Scenario 2: Admin Sets Longest < Current → Auto-Updated**
- **Action**: Admin sets `current_streak = 10`, `longest_streak = 5`
- **Result**: `longest_streak` auto-updated to 10
- **Logic**: Invariant enforcement

#### ✅ **Scenario 3: Admin Sets Trophies**
- **Action**: Admin sets `trophies = 100`
- **Result**: User has 100 Dumbbells, transaction recorded
- **Logic**: Admin edits create audit trail

#### ✅ **Scenario 4: Admin Sets Streak → Rejection Still Resets**
- **Action**: Admin sets streak to 5, user uploads, admin rejects
- **Result**: `current_streak = 0` (rejection overrides baseline)
- **Logic**: Rejection always resets streak, even with admin baseline

---

## Edge Cases & Combinations

### Complex Scenarios

#### ✅ **Scenario 1: Rest Day → Upload → Rejection**
- **Action**: User uses rest day yesterday, uploads today, admin rejects
- **Result**: Streak = 0 (rejection resets), Dumbbells penalized (clamped at 0)
- **Logic**: Rejection overrides rest day benefit

#### ✅ **Scenario 2: Admin Baseline → Gap → Upload**
- **Action**: Admin sets streak to 5, user misses 2 days, uploads
- **Result**: Streak = 1 (gap breaks baseline)
- **Logic**: Gaps break streaks, even with admin baseline

#### ✅ **Scenario 3: Perfect Week with Rest Days**
- **Action**: User completes 7 days using 2 rest days + 5 uploads
- **Result**: Perfect week bonus awarded (+10)
- **Logic**: Rest days count toward weekly completion

#### ✅ **Scenario 4: Consecutive Perfect Weeks → Failed Week → Reset**
- **Action**: User completes 3 perfect weeks (+10, +20, +30), then fails 4th week
- **Result**: 4th week = no bonus, 5th perfect week = +10 (reset)
- **Logic**: Consecutive bonus resets on non-perfect week

#### ✅ **Scenario 5: Admin Sets Streak → Rest Day → Upload**
- **Action**: Admin sets streak to 5, user uses rest day, then uploads
- **Result**: Streak = 7 (5 baseline + rest day + upload)
- **Logic**: Baseline extends through rest days and uploads

#### ✅ **Scenario 6: Rejection at 0 Dumbbells → Upload → Approval**
- **Action**: User has 0 Dumbbells, uploads, admin rejects, then uploads again and approves
- **Result**: Stays at 0 after rejection, gets +26-32 after approval
- **Logic**: Clamping prevents negative, approval rewards normally

---

## Summary of Key Rules

### Streak Rules
1. ✅ Approved uploads and rest days count as valid activity
2. ✅ Consecutive days increment streak
3. ✅ Gaps of 2+ days break streak (resets to 1)
4. ✅ Rejection today → streak = 0 immediately
5. ✅ Admin baselines are preserved and extended

### Dumbbell Rules
1. ✅ Full reward (26-32) for maintained streaks
2. ✅ Half reward (13-16) for broken streaks
3. ✅ Rejection penalty (-52 to -64) clamped at 0
4. ✅ Perfect week bonus (+10 to +70) only for 7/7
5. ✅ No penalty for failed weeks

### Rest Day Rules
1. ✅ 3 rest days per week (max)
2. ✅ Mutual exclusivity with uploads (same date)
3. ✅ Rest days maintain streaks
4. ✅ Rest days count toward weekly completion

### Admin Edit Rules
1. ✅ Streak edits create baselines that survive verification
2. ✅ Trophy edits create transaction records
3. ✅ Invariants enforced (longest >= current)
4. ✅ Rejection still resets streak (overrides baseline)

---

## Testing

Run the comprehensive test suite:

```bash
npm run test:comprehensive
```

This tests all scenarios documented above and verifies the system behaves correctly in every situation.

