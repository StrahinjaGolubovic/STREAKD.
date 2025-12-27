import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/admin';
import { cookies } from 'next/headers';
import db from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    const adminCheck = await checkAdmin(token);
    if (!adminCheck.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { crewId } = await request.json();

    if (!crewId || typeof crewId !== 'number') {
      return NextResponse.json({ error: 'Invalid crew ID' }, { status: 400 });
    }

    // Check if crew exists
    const crew = db.prepare('SELECT id, name FROM crews WHERE id = ?').get(crewId) as { id: number; name: string } | undefined;

    if (!crew) {
      return NextResponse.json({ error: 'Crew not found' }, { status: 404 });
    }

    // Delete crew members first (set crew_id to NULL)
    db.prepare('UPDATE users SET crew_id = NULL WHERE crew_id = ?').run(crewId);
    
    // Delete crew members entries
    db.prepare('DELETE FROM crew_members WHERE crew_id = ?').run(crewId);
    
    // Delete crew requests
    db.prepare('DELETE FROM crew_requests WHERE crew_id = ?').run(crewId);
    
    // Delete crew
    db.prepare('DELETE FROM crews WHERE id = ?').run(crewId);

    return NextResponse.json({ success: true, message: `Crew "${crew.name}" deleted successfully` });
  } catch (error: any) {
    console.error('Delete crew error:', error);
    return NextResponse.json(
      { error: 'Failed to delete crew' },
      { status: 500 }
    );
  }
}

