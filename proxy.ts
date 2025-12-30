import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, RATE_LIMITS, type RateLimitConfig } from './lib/rate-limit';

// Route-specific rate limit configurations
const ROUTE_LIMITS: { [key: string]: RateLimitConfig } = {
  // Authentication routes - strict
  '/api/auth/login': RATE_LIMITS.AUTH,
  '/api/auth/register': RATE_LIMITS.AUTH,
  
  // Upload routes - moderate
  '/api/upload': RATE_LIMITS.UPLOAD,
  '/api/profile/picture': RATE_LIMITS.UPLOAD,
  
  // Chat routes - per-minute limits
  '/api/chat/send': RATE_LIMITS.CHAT,
  '/api/crew-chat/send': RATE_LIMITS.CHAT,
  
  // Admin routes - higher limits
  '/api/admin': RATE_LIMITS.ADMIN,
};

function isPublicAsset(pathname: string): boolean {
  if (pathname.startsWith('/_next/')) return true;
  if (pathname === '/favicon.ico') return true;
  if (pathname === '/sw.js' || pathname === '/worker.js') return true;
  if (pathname.startsWith('/android-chrome-') || pathname.startsWith('/apple-touch-icon')) return true;
  // public images/assets
  if (pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|css|js|map)$/i)) return true;
  return false;
}

// Proxy (previously called Middleware) — runs on Node.js runtime
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Apply rate limiting to all API routes FIRST (before maintenance check)
  if (pathname.startsWith('/api/')) {
    const clientIp = getClientIp(request);
    
    // Determine rate limit config for this route
    let config = RATE_LIMITS.STANDARD; // Default
    
    // Check for specific route configs
    for (const [route, limit] of Object.entries(ROUTE_LIMITS)) {
      if (pathname.startsWith(route)) {
        config = limit;
        break;
      }
    }
    
    // Check rate limit
    const result = checkRateLimit(`${clientIp}:${pathname}`, config);
    
    if (!result.success) {
      return NextResponse.json(
        { 
          error: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((result.resetTime - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(result.limit),
            'X-RateLimit-Remaining': String(result.remaining),
            'X-RateLimit-Reset': String(result.resetTime),
          }
        }
      );
    }
  }

  // Force HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    const proto = request.headers.get('x-forwarded-proto');
    if (proto && proto !== 'https') {
      const host = request.headers.get('host');
      if (host) {
        return NextResponse.redirect(
          `https://${host}${pathname}${request.nextUrl.search}`,
          301
        );
      }
    }
  }

  if (isPublicAsset(pathname)) return NextResponse.next();

  // Avoid recursion / allow maintenance page and the status endpoint
  if (pathname.startsWith('/maintenance')) return NextResponse.next();
  if (pathname.startsWith('/api/maintenance/status')) return NextResponse.next();

  // Always allow auth endpoints & login page so admins can log in to disable maintenance
  if (pathname.startsWith('/login')) return NextResponse.next();
  if (pathname.startsWith('/api/auth/login')) return NextResponse.next();
  if (pathname.startsWith('/api/auth/logout')) return NextResponse.next();
  if (pathname.startsWith('/api/auth/me')) return NextResponse.next();

  // Ask the server (node runtime) whether maintenance is enabled and whether this user is an admin.
  try {
    const statusUrl = new URL('/api/maintenance/status', request.url);
    const res = await fetch(statusUrl, {
      headers: {
        cookie: request.headers.get('cookie') ?? '',
      },
      cache: 'no-store',
    });
    const json = (await res.json().catch(() => null)) as { maintenance?: boolean; isAdmin?: boolean } | null;
    const maintenance = !!json?.maintenance;
    const isAdmin = !!json?.isAdmin;

    if (maintenance && !isAdmin) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Maintenance break. Please check again later.' }, { status: 503 });
      }
      const url = request.nextUrl.clone();
      url.pathname = '/maintenance';
      url.search = '';
      return NextResponse.redirect(url);
    }
  } catch {
    // Fail-open: if status check fails, don't brick the site.
  }

  // Add security headers to all responses
  const response = NextResponse.next();
  
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob:; " +
    "font-src 'self' data:; " +
    "connect-src 'self';"
  );
  
  // Strict-Transport-Security (HSTS) - only in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }
  
  // Add rate limit headers for API routes
  if (pathname.startsWith('/api/')) {
    const clientIp = getClientIp(request);
    let config = RATE_LIMITS.STANDARD;
    for (const [route, limit] of Object.entries(ROUTE_LIMITS)) {
      if (pathname.startsWith(route)) {
        config = limit;
        break;
      }
    }
    const result = checkRateLimit(`${clientIp}:${pathname}`, config);
    response.headers.set('X-RateLimit-Limit', String(result.limit));
    response.headers.set('X-RateLimit-Remaining', String(result.remaining));
    response.headers.set('X-RateLimit-Reset', String(result.resetTime));
  }
  
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};


