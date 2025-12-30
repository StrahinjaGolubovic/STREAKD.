import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Clear all user_activity entries
    db.prepare(`DELETE FROM user_activity`).run();
    
    return NextResponse.json({ 
      success: true, 
      message: 'All user activity entries cleared' 
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ 
      error: 'Failed to cleanup',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
