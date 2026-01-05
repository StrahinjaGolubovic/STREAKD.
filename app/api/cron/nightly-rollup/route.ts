import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { formatDateSerbia } from '@/lib/timezone';
import { getSetting, setSetting } from '@/lib/settings';
import { runDailyRollupForUser } from '@/lib/streak-core';
import { getOrCreateActiveChallenge } from '@/lib/week-core';
import { syncAllWeeklyBonuses } from '@/lib/trophy-core';
import { onUploadVerified } from '@/lib/challenges';

function getCronSecret(): string {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: CRON_SECRET environment variable must be set in production');
    }
    return 'dev_cron_secret';
  }
  return secret;
}

function isAuthorized(request: NextRequest): boolean {
  const secret = getCronSecret();
  const header = request.headers.get('authorization') || '';
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7) : '';
  const xCron = request.headers.get('x-cron-secret') || '';
  return bearer === secret || xCron === secret;
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const today = formatDateSerbia();
    const lastRun = getSetting('cron_last_rollup_date');

    if (lastRun === today) {
      return NextResponse.json({ success: true, skipped: true, today });
    }

    // Auto-verify all pending uploads before midnight rollup
    const pendingUploads = db.prepare(`
      SELECT id, user_id, challenge_id 
      FROM daily_uploads 
      WHERE verification_status = 'pending'
    `).all() as Array<{ id: number; user_id: number; challenge_id: number }>;

    let autoVerified = 0;
    for (const upload of pendingUploads) {
      try {
        // Auto-approve pending uploads that admin didn't verify in time
        db.prepare(`
          UPDATE daily_uploads 
          SET verification_status = 'approved', verified_by = NULL, verified_at = ?
          WHERE id = ?
        `).run(formatDateSerbia(), upload.id);
        
        // Trigger the verification handler to update trophies, streaks, etc.
        onUploadVerified(upload.id, upload.user_id, upload.challenge_id, 'approved');
        autoVerified++;
      } catch (e: any) {
        console.error(`Auto-verify failed for upload ${upload.id}:`, e);
      }
    }

    const users = db.prepare('SELECT id FROM users').all() as Array<{ id: number }>;

    let rollupsApplied = 0;
    let rollupsSkipped = 0;
    let weekSynced = 0;
    let bonusSynced = 0;
    const errors: Array<{ userId: number; error: string }> = [];

    for (const u of users) {
      try {
        const rollup = runDailyRollupForUser(u.id);
        if (rollup.rollupApplied) rollupsApplied++;
        else rollupsSkipped++;

        // Ensure week rollover happens on schedule even without user traffic.
        // This evaluates the previous week's challenge and sets its status to completed/failed.
        getOrCreateActiveChallenge(u.id);
        weekSynced++;

        // Weekly bonuses are applied AFTER week rollover so the previous week's status is finalized.
        // This ensures completed weeks (7/7) get their bonus before creating the new week.
        syncAllWeeklyBonuses(u.id);
        bonusSynced++;
      } catch (e: any) {
        errors.push({ userId: u.id, error: e?.message || String(e) });
      }
    }

    setSetting('cron_last_rollup_date', today);

    return NextResponse.json({
      success: true,
      today,
      autoVerified,
      usersProcessed: users.length,
      rollupsApplied,
      rollupsSkipped,
      weekSynced,
      bonusSynced,
      errors,
    });
  } catch (error: any) {
    console.error('Nightly rollup cron error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
