import { verifyToken, getUserById } from './auth';

const ADMIN_USERNAMES = ['admin', 'seuq', 'jakow', 'nikola'];

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

