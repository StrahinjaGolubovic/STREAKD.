import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { transferCrewLeadership } from '@/lib/crews';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { crew_id, new_leader_id } = await request.json();

    if (!crew_id || !new_leader_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = transferCrewLeadership(user.userId, crew_id, new_leader_id);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ message: result.message });
  } catch (error: any) {
    console.error('Transfer leadership error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
