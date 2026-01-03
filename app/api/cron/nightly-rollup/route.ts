import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { formatDateSerbia } from '@/lib/timezone';
import { getSetting, setSetting } from '@/lib/settings';
import { runDailyRollupForUser } from '@/lib/streak-core';
import { getOrCreateActiveChallenge } from '@/lib/week-core';
import { syncAllWeeklyBonuses } from '@/lib/trophy-core';

function getCronSecret(): string {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: CRON_SECRET environment variable must be set in production');
    }
    throw new Error('CRITICAL: CRON_SECRET environment variable must be set');
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
        getOrCreateActiveChallenge(u.id);
        weekSynced++;

        // Weekly bonuses are applied only during this cron run (midnight rollup).
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
