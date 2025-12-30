import { NextRequest, NextResponse } from 'next/server';
import { clearExpiredCrewTags } from '@/lib/crews';

// This endpoint clears crew tags that are older than 48 hours
// Can be called manually or set up as a cron job
export async function POST(request: NextRequest) {
  try {
    const result = clearExpiredCrewTags();
    
    return NextResponse.json({ 
      success: true, 
      cleared: result.cleared,
      message: `Cleared ${result.cleared} expired crew tag(s)`
    });
  } catch (error) {
    console.error('Clear expired tags error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Also support GET for easier testing/cron setup
export async function GET(request: NextRequest) {
  return POST(request);
}
