import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cxbevwccenradkjxoooh.supabase.co';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4YmV2d2NjZW5yYWRranhvb29oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2ODMxNjgsImV4cCI6MjA4MTI1OTE2OH0.DJSH0CpPAPciTPD4EsHsioLUOobkikiqVEW8wS02Itw';

  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const protectedPrefixes = [
    '/dashboard',
    '/tasks',
    '/my-tasks',
    '/wallet',
    '/referrals',
    '/pro',
    '/profile',
    '/notifications',
  ];

  const pathname = request.nextUrl.pathname;
  const isProtectedRoute = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  const isLoginRoute = pathname === '/login';
  const isAdminRoute = pathname.startsWith('/admin');

  // If public route (e.g. /, /rules, /privacy, /terms), bypass user network fetch for instant loading
  if (!isProtectedRoute && !isLoginRoute && !isAdminRoute) {
    return response;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (isProtectedRoute && !user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (isLoginRoute && user) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    if (isAdminRoute) {
      if (!user) {
        return NextResponse.redirect(new URL('/login?next=/admin', request.url));
      }

      const { data: profile } = await supabase
        .from('temutask_profiles')
        .select('role, status')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.status === 'suspended') {
        return NextResponse.redirect(new URL('/suspended', request.url));
      }

      if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  } catch (err) {
    console.error('Middleware auth check error:', err);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css)$).*)',
  ],
};
