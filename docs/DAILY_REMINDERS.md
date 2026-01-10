# Daily Upload Reminder System

## Overview

This system sends **persistent push notifications** throughout the day to remind users to upload their workout photo. Notifications continue until the user uploads or uses a rest day.

## How It Works

### Notification Schedule

The system sends reminders at different times with escalating urgency:

| Time Range | Title | Urgency | Behavior |
|------------|-------|---------|----------|
| 6am - 12pm | 🌅 Good morning! | Low | Gentle morning reminder |
| 12pm - 6pm | 💪 Afternoon reminder | Low | Standard reminder |
| 6pm - 9pm | ⏰ Evening reminder | Medium | Mentions streak if applicable |
| 9pm - 11pm | 🚨 URGENT: Upload needed! | High | Requires interaction, shows streak risk |
| 11pm - 12am | ⚠️ FINAL WARNING! | High | Critical alert, shows time remaining |

### Notification Features

- **Same Tag**: All reminders use tag `daily-reminder` so new ones replace old ones (not spammy)
- **Escalating Urgency**: Messages get more urgent as midnight approaches
- **Streak Awareness**: Shows current streak and risk of losing it
- **Action Buttons**: High-urgency notifications have "Upload Now" and "Dismiss" buttons
- **Require Interaction**: Late-night notifications stay visible until user acts

### Who Gets Notified

Users are notified if:
- ✅ They have push notifications enabled
- ✅ Daily reminders are enabled in preferences
- ✅ They haven't uploaded today
- ✅ They haven't used a rest day today
- ✅ They have an active weekly challenge

Users are **excluded** if:
- ❌ Already uploaded today
- ❌ Used a rest day today
- ❌ Disabled daily reminders
- ❌ No push subscriptions

## Setup Instructions

### Option 1: Railway Cron (Recommended for Railway deployment)

1. Add to `railway.toml`:
```toml
[[crons]]
schedule = "0 6-23 * * *"  # Every hour from 6am to 11pm
command = "curl -X GET https://your-app.railway.app/api/cron/daily-reminders -H 'Authorization: Bearer YOUR_CRON_SECRET'"
```

2. Add `CRON_SECRET` to environment variables

### Option 2: Vercel Cron (For Vercel deployment)

1. Create `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/daily-reminders",
      "schedule": "0 6-23 * * *"
    }
  ]
}
```

### Option 3: External Cron Service (cron-job.org, EasyCron, etc.)

1. Set up hourly cron job from 6am to 11pm
2. URL: `https://your-domain.com/api/cron/daily-reminders`
3. Method: GET
4. Header: `Authorization: Bearer YOUR_CRON_SECRET`

### Option 4: Manual Testing (Development)

```bash
# Test the endpoint
curl -X GET http://localhost:3000/api/cron/daily-reminders \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Environment Variables

Add to `.env.local`:

```env
# Optional: Secure cron endpoint
CRON_SECRET=your-random-secret-here
```

## Notification Preferences

Users can control reminders in their notification preferences:

```json
{
  "enabled": true,              // Master switch
  "dailyReminder": true,        // Daily upload reminders
  "dailyReminderTime": "18:00", // Preferred time (future enhancement)
  "streakWarning": true,        // Streak risk warnings
  "achievements": true,         // Achievement unlocks
  "friendActivity": true,       // Friend notifications
  "crewActivity": true,         // Crew notifications
  "adminMessages": true         // Admin broadcasts
}
```

## Response Format

```json
{
  "success": true,
  "timestamp": "2026-01-10T01:00:00.000Z",
  "currentHour": 18,
  "today": "2026-01-10",
  "stats": {
    "totalUsers": 150,
    "sent": 142,
    "skipped": 8,
    "errors": 0
  }
}
```

## Testing

### Test with a specific user:

1. Ensure user has push subscription
2. Ensure user hasn't uploaded today
3. Call cron endpoint
4. Check user receives notification

### Verify notification content:

- Morning (6am-12pm): Gentle reminder
- Afternoon (12pm-6pm): Standard reminder
- Evening (6pm-9pm): Streak-aware reminder
- Late (9pm-11pm): Urgent with action buttons
- Critical (11pm-12am): Final warning

## Monitoring

Check cron execution logs:
- Total users eligible for reminders
- Successfully sent notifications
- Skipped users (preferences disabled)
- Errors (expired subscriptions, etc.)

## Best Practices

1. **Frequency**: Run every hour during active hours (6am-11pm)
2. **Timezone**: All times are in Serbia timezone (Europe/Belgrade)
3. **Tag Strategy**: Use same tag to replace notifications (not spam)
4. **Urgency Levels**: Escalate as midnight approaches
5. **User Control**: Respect notification preferences
6. **Error Handling**: Log errors but don't fail entire batch

## Troubleshooting

**No notifications sent:**
- Check VAPID keys are configured
- Verify users have push subscriptions
- Ensure daily reminders enabled in preferences
- Check cron job is running

**Too many notifications:**
- Verify cron runs once per hour (not more)
- Check tag is set correctly (should replace old ones)
- Ensure users who uploaded are excluded

**Wrong timing:**
- Verify server timezone matches Serbia time
- Check cron schedule matches intended hours
- Test with different times of day

## Future Enhancements

- [ ] Respect user's preferred reminder time
- [ ] Smart frequency (reduce if user consistently uploads early)
- [ ] A/B test notification copy
- [ ] Analytics on notification effectiveness
- [ ] Snooze functionality
- [ ] Weekend vs weekday schedules
