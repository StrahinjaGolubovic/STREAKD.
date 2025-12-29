# Comprehensive Testing Guide

## Overview

This guide explains how to test every aspect of the Gymble system using the comprehensive test suite.

## Running Tests

### Prerequisites

1. **Server Running**: The Next.js dev server must be running (`npm run dev`)
2. **Database Access**: The test script needs direct database access (reads `DATABASE_PATH` env var or defaults to `./data/gymble.db`)
3. **Admin Account**: The test creates/uses an admin account with username `admin`

### Run All Tests

```bash
npm run test:comprehensive
```

### Environment Variables

- `SMOKE_BASE_URL`: Base URL for API calls (default: `http://localhost:3000`)
- `DATABASE_PATH`: Path to SQLite database (default: `./data/gymble.db`)
- `JWT_SECRET`: JWT secret for token generation (default: `your-secret-key-change-in-production`)

## Test Coverage

### ✅ Streak System (7 tests)

1. **STREAK-1**: First upload ever → streak = 1
2. **STREAK-2**: Consecutive days → streak increments
3. **STREAK-3**: Gap in streak → resets to 1
4. **STREAK-4**: Reject today → streak = 0 immediately
5. **STREAK-5**: Rest day maintains streak
6. **STREAK-6**: Admin sets streak baseline → survives verification
7. **STREAK-7**: Admin baseline + consecutive activity extends correctly

### ✅ Trophy/Dumbbell System (6 tests)

1. **TROPHY-1**: Approval reward = base (26-32) when streak maintained
2. **TROPHY-2**: Approval reward = half (13-16) when streak broken
3. **TROPHY-3**: Rest day yesterday → full reward today
4. **TROPHY-4**: Rejection penalty clamped at 0
5. **TROPHY-5**: Rejection penalty = -52 to -64 when user has enough
6. **TROPHY-6**: Admin-set trophies create transaction

### ✅ Rest Day System (3 tests)

1. **REST-1**: Rest day + upload same day = blocked
2. **REST-2**: Upload + rest day same day = blocked
3. **REST-3**: Max 3 rest days per week

### ✅ Weekly Challenge System (3 tests)

1. **WEEK-1**: Perfect week (7/7) → bonus awarded
2. **WEEK-2**: Failed week (< 5/7) → no bonus, no penalty
3. **WEEK-3**: Consecutive perfect weeks → bonus scales

### ✅ Admin Edit Consistency (3 tests)

1. **ADMIN-1**: Set streak to 5 → next upload = 6
2. **ADMIN-2**: Set longest_streak auto-updates if < current
3. **ADMIN-3**: Set trophies to 0 → stays at 0 even with rejection

## Understanding Test Results

### Success Output

```
[TEST] STREAK-1: First upload ever → streak = 1
  ✓ First upload → streak=1, longest=1
[PASS] STREAK-1: First upload ever → streak = 1
```

### Failure Output

```
[TEST] STREAK-1: First upload ever → streak = 1
[FAIL] STREAK-1: First upload ever → streak = 1
  Error: Expected streak=1, got 0
  Stack: at assert (comprehensive-test.mjs:XX)
```

## Manual Testing Scenarios

For scenarios that are difficult to automate (e.g., week rollover), refer to `docs/SYSTEM_LOGIC.md` for detailed explanations of expected behavior.

### Key Manual Test Cases

1. **Week Rollover**: Wait for actual week boundary, verify bonus awarded
2. **Consecutive Perfect Weeks**: Complete multiple perfect weeks, verify bonus scaling
3. **Timezone Edge Cases**: Test around midnight Serbia time
4. **Admin Baseline Preservation**: Set streak, verify it survives multiple verifications

## Adding New Tests

To add a new test:

```javascript
test('TEST-NAME: Description', async (db, adminToken) => {
  // Setup
  const userId = dbEnsureUser(db, `test_name_${Date.now()}`, 'pass');
  const token = tokenForUserId(userId);
  
  // Action
  // ... perform actions ...
  
  // Assertion
  assert(condition, 'Error message');
  console.log('  ✓ Success message');
});
```

## Troubleshooting

### Tests Fail with "Server not reachable"

- Ensure `npm run dev` is running
- Check `SMOKE_BASE_URL` matches your server URL
- Verify server is accessible (no firewall blocking)

### Tests Fail with Database Errors

- Ensure database file exists and is writable
- Check `DATABASE_PATH` is correct
- Verify database schema is up to date (run migrations)

### Tests Fail with Auth Errors

- Verify `JWT_SECRET` matches your server's secret
- Check admin account exists (test creates it automatically)

## Integration with CI/CD

The test suite can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run Comprehensive Tests
  run: |
    npm run dev &
    sleep 10
    npm run test:comprehensive
```

## Next Steps

1. Review `docs/SYSTEM_LOGIC.md` for detailed system behavior
2. Run `npm run test:comprehensive` to verify all scenarios
3. Add additional tests for edge cases specific to your use case

