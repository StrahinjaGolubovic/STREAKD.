import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { kickCrewMember } from '@/lib/crews';
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

    const { crew_id, target_user_id } = await request.json();

    if (!crew_id || !target_user_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = kickCrewMember(user.userId, crew_id, target_user_id);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ message: result.message });
  } catch (error: any) {
    console.error('Kick member error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
