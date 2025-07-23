import { NextRequest, NextResponse } from 'next/server';
import { getDomainConfig } from './utils/customDomain';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostname = request.headers.get('host') || '';
  
  // Get domain configuration
  const customDomain = process.env.NEXT_PUBLIC_CUSTOM_DOMAIN;
  const isLocal = hostname.includes('localhost') || hostname.includes('127.0.0.1');
  const isVercel = hostname.includes('vercel.app');
  const isCustomDomain = customDomain && hostname === customDomain && !isLocal && !isVercel;

  // For custom domains, ensure we serve the content correctly
  if (isCustomDomain) {
    // Add custom headers to identify this as a custom domain request
    const response = NextResponse.next();
    response.headers.set('x-custom-domain', 'true');
    response.headers.set('x-domain', hostname);
    return response;
  }

  // For all other domains (Vercel, localhost), continue normally
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
