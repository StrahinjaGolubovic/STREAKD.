# TROPHY SYSTEM ANALYSIS

## YOUR REQUIREMENTS (from user request)

```
Accepted: +26-32
Rejected: 26-32 x 2 (so -52 to -64)
Missed: half of 26-32 (so 13-16)
Rest: Counts +1 streak only (no trophies)
```

## CURRENT IMPLEMENTATION

### Scenario 1: Upload Approved (Streak Maintained)
- **Code:** `base` (26-32)
- **Result:** ✅ **26-32 trophies**
- **Status:** CORRECT

### Scenario 2: Upload Approved (Streak Broken - gap in days)
- **Code:** `Math.round(base / 2)` (13-16)
- **Result:** ❌ **13-16 trophies** (This is your +15!)
- **Status:** UNCLEAR - Is this "Missed" or should it be 0?

### Scenario 3: Upload Rejected
- **Code:** `-Math.round(base * 2)` (-52 to -64)
- **Result:** ✅ **-52 to -64 trophies**
- **Status:** CORRECT

### Scenario 4: Rest Day Used
- **Code:** No trophy transaction, only streak +1
- **Result:** ✅ **0 trophies, +1 streak**
- **Status:** CORRECT

## THE CONFUSION

**Question:** What does "Missed: half of 26-32" mean?

**Option A:** User uploads photo but broke their streak (gap in days)
- Current code: Gives 13-16 trophies ❌
- Should be: 0 trophies? Or keep 13-16?

**Option B:** User completely misses a day (no upload at all)
- Current code: Gives 0 trophies ✅
- This is already correct (no upload = no trophy transaction)

## SUSPECTED BUG

The +15 trophies you're seeing is from **Scenario 2**:
- User uploads photo on Day 5
- User had no activity on Day 4 (broke streak)
- Upload gets approved
- System gives: `Math.round(29 / 2) = 15 trophies`

**This seems wrong because:**
1. User still uploaded and got approved
2. But they broke their streak
3. Should they get full reward (26-32) or penalty (0 or half)?

## PROPOSED FIX

Based on "plain and simple" requirements, I believe:

1. **Accepted upload = ALWAYS 26-32** (regardless of streak)
2. **Rejected upload = ALWAYS -52 to -64** (regardless of streak)
3. **Rest day = 0 trophies, +1 streak**
4. **Missed day (no upload, no rest) = 0 trophies, streak resets to 0**

The "half of 26-32" might be a **misunderstanding** - there's no scenario where giving 13-16 makes sense.

## QUESTIONS FOR USER

1. Should an approved upload ALWAYS give 26-32, even if streak was broken?
2. Or should breaking streak reduce the reward to 13-16?
3. What is the actual "Missed" scenario you're referring to?
