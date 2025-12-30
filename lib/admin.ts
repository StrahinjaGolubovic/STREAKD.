import { verifyToken, getUserById } from './auth';

// Load admin usernames from environment variable
// Format: ADMIN_USERNAMES=admin,seuq,jakow,nikola
const ADMIN_USERNAMES = (process.env.ADMIN_USERNAMES || 'admin').split(',').map(u => u.trim()).filter(Boolean);

if (ADMIN_USERNAMES.length === 0) {
  console.warn('WARNING: No admin usernames configured. Defaulting to "admin".');
  ADMIN_USERNAMES.push('admin');
}

export function isAdmin(userId: number): boolean {
  const user = getUserById(userId);
  return user?.username ? ADMIN_USERNAMES.includes(user.username) : false;
}

export async function checkAdmin(token: string | undefined): Promise<{ isAdmin: boolean; userId?: number }> {
  if (!token) {
    return { isAdmin: false };
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return { isAdmin: false };
  }

  return {
    isAdmin: isAdmin(decoded.userId),
    userId: decoded.userId,
  };
}

