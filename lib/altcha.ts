import { verifySolution } from 'altcha-lib';

// Get HMAC key from environment variable or use the provided key
// Must match the key used in the challenge endpoint
const HMAC_KEY = process.env.ALTCHA_HMAC_KEY || 'fe48b4e61bad34a78d018f4f43e5c2f286760c7898a0aebd8891196b17e89a20';

export async function verifyAltcha(solution: string): Promise<boolean> {
  try {
    if (!solution) {
      return false;
    }
    const isValid = await verifySolution(solution, HMAC_KEY);
    return isValid;
  } catch (error) {
    console.error('ALTCHA verification error:', error);
    return false;
  }
}

