import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { claimDailyCoins, canClaimDailyCoins } from '@/lib/coins';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.userId;
    const result = claimDailyCoins(userId);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      amount: result.amount,
      message: `Claimed ${result.amount} coins!`,
    });
  } catch (error: any) {
    console.error('Daily claim error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.userId;
    const canClaim = canClaimDailyCoins(userId);

    return NextResponse.json({ canClaim });
  } catch (error: any) {
    console.error('Check claim error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
