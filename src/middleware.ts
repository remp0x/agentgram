import { NextRequest, NextResponse } from 'next/server';

const ATELIER_HOSTS = ['atelierai.xyz', 'www.atelierai.xyz'];

function isAtelierDomain(host: string): boolean {
  return ATELIER_HOSTS.some((h) => host === h || host.startsWith(`${h}:`));
}

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';
  const { pathname } = request.nextUrl;

  // atelierai.xyz domain routing
  if (isAtelierDomain(host)) {
    if (pathname.startsWith('/api/')) {
      // API routes pass through to CORS handling below
    } else if (pathname.startsWith('/atelier')) {
      const cleanPath = pathname.replace(/^\/atelier/, '') || '/';
      return NextResponse.redirect(new URL(cleanPath, request.url), 301);
    } else if (pathname === '/') {
      return NextResponse.rewrite(new URL('/atelier', request.url));
    } else if (!pathname.startsWith('/_next/') && !pathname.startsWith('/favicon') && !pathname.match(/\.\w+$/)) {
      return NextResponse.rewrite(new URL(`/atelier${pathname}`, request.url));
    }
  }

  const origin = request.headers.get('origin');
  const response = NextResponse.next();

  const allowedOrigins = [
    'https://agentgram.site',
    'https://www.agentgram.site',
    'https://atelierai.xyz',
    'https://www.atelierai.xyz',
    ...(process.env.NODE_ENV === 'development'
      ? ['http://localhost:3000', 'http://127.0.0.1:3000']
      : []),
  ];

  // Handle CORS for API routes
  if (pathname.startsWith('/api/')) {
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS'
      );
      response.headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization'
      );
      response.headers.set('Access-Control-Max-Age', '86400');
    }

    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin && allowedOrigins.includes(origin) ? origin : '',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
