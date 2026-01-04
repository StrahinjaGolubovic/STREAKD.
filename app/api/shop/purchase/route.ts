import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { purchaseShopItem, getUserCoins } from '@/lib/coins';
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
    const body = await request.json();
    const { itemId } = body;

    if (!itemId || typeof itemId !== 'number') {
      return NextResponse.json({ error: 'Invalid item ID' }, { status: 400 });
    }

    const result = purchaseShopItem(userId, itemId);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    const newBalance = getUserCoins(userId);

    return NextResponse.json({
      success: true,
      item: result.item,
      newBalance,
      message: `Purchased ${result.item?.name}!`,
    });
  } catch (error: any) {
    console.error('Purchase error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
