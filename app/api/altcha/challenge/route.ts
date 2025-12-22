import { NextRequest, NextResponse } from 'next/server';
import { createChallenge } from 'altcha-lib';

// Get HMAC key from environment variable or use the provided key
const HMAC_KEY = process.env.ALTCHA_HMAC_KEY || 'fe48b4e61bad34a78d018f4f43e5c2f286760c7898a0aebd8891196b17e89a20';

export async function GET(request: NextRequest) {
  try {
    const challenge = await createChallenge({ 
      hmacKey: HMAC_KEY,
      maxNumber: 1000000, // Adjust difficulty if needed
    });
    return NextResponse.json(challenge);
  } catch (error) {
    console.error('ALTCHA challenge error:', error);
    return NextResponse.json({ error: 'Failed to generate challenge' }, { status: 500 });
  }
}

