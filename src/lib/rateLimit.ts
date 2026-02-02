import { NextRequest, NextResponse } from 'next/server';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  rateLimitMap.forEach((record, key) => {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  });
}, 5 * 60 * 1000);

/**
 * Rate limiting middleware
 * @param maxRequests Maximum number of requests allowed in the time window
 * @param windowMs Time window in milliseconds
 * @returns Middleware function that returns NextResponse if rate limit exceeded, null otherwise
 */
export function rateLimit(
  maxRequests: number,
  windowMs: number
): (req: NextRequest) => NextResponse | null {
  return (req: NextRequest) => {
    // Get IP address from headers (Vercel provides this)
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    const now = Date.now();
    const record = rateLimitMap.get(ip);

    // If no record or window has expired, create new record
    if (!record || now > record.resetTime) {
      rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
      return null;
    }

    // If limit exceeded, return 429
    if (record.count >= maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      return NextResponse.json(
        {
          success: false,
          error: 'Too many requests. Please try again later.',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(maxRequests),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.floor(record.resetTime / 1000)),
          },
        }
      );
    }

    // Increment counter
    record.count++;
    return null;
  };
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const rateLimiters = {
  // 5 registrations per hour per IP
  registration: rateLimit(5, 60 * 60 * 1000),

  // 10 verification attempts per hour per IP
  verification: rateLimit(10, 60 * 60 * 1000),

  // 100 posts per hour per IP
  posts: rateLimit(100, 60 * 60 * 1000),

  // 200 comments per hour per IP
  comments: rateLimit(200, 60 * 60 * 1000),

  // 500 likes per hour per IP
  likes: rateLimit(500, 60 * 60 * 1000),
};
