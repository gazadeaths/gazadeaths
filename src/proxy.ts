import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { defaultLocale, isValidLocale, getLocaleFromPathname, type Locale } from './lib/i18n';

// Define routes that should not have locale prefix
const isNonLocalizedRoute = createRouteMatcher([
  '/tools(.*)',      // Admin tools stay in English
  '/api(.*)',        // API routes don't need locale
  '/_next(.*)',      // Next.js internals
  '/sign-in(.*)',    // Clerk sign-in
  '/sign-up(.*)',    // Clerk sign-up
  '/favicon.ico',
  '/icon.png',
  '/apple-icon.png',
  '/flag.webp',
  '/people(.*)',
  '/team(.*)',
]);

function getPreferredLocale(request: NextRequest): Locale {
  // Check if there's a locale cookie
  const localeCookie = request.cookies.get('NEXT_LOCALE')?.value;
  if (localeCookie && isValidLocale(localeCookie)) {
    return localeCookie;
  }

  // Check Accept-Language header
  const acceptLanguage = request.headers.get('accept-language');
  if (acceptLanguage) {
    // Parse accept-language header (e.g., "ar,en-US;q=0.9,en;q=0.8")
    const languages = acceptLanguage
      .split(',')
      .map(lang => {
        const [code, qValue] = lang.trim().split(';');
        const quality = qValue ? parseFloat(qValue.replace('q=', '')) : 1.0;
        const langCode = code.split('-')[0]; // Get just the language code (ar from ar-EG)
        return { code: langCode, quality };
      })
      .sort((a, b) => b.quality - a.quality);

    for (const { code } of languages) {
      if (isValidLocale(code)) {
        return code;
      }
    }
  }

  return defaultLocale;
}

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;

  // Skip locale handling for non-localized routes
  if (isNonLocalizedRoute(request)) {
    return NextResponse.next();
  }

  // Check if pathname already has a valid locale
  const currentLocale = getLocaleFromPathname(pathname);

  // If no locale in pathname, redirect to localized version
  if (!currentLocale) {
    const preferredLocale = getPreferredLocale(request);
    const localizedUrl = new URL(`/${preferredLocale}${pathname}`, request.url);
    
    // Preserve query parameters
    localizedUrl.search = request.nextUrl.search;
    
    const response = NextResponse.redirect(localizedUrl);
    
    // Set locale cookie for future requests
    response.cookies.set('NEXT_LOCALE', preferredLocale, {
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
    });
    
    return response;
  }

  // If locale is valid, continue with request and set cookie
  if (isValidLocale(currentLocale)) {
    const response = NextResponse.next();
    
    // Update locale cookie if different
    const currentCookie = request.cookies.get('NEXT_LOCALE')?.value;
    if (currentCookie !== currentLocale) {
      response.cookies.set('NEXT_LOCALE', currentLocale, {
        maxAge: 60 * 60 * 24 * 365, // 1 year
        path: '/',
      });
    }
    
    return response;
  }

  // If locale is invalid, redirect to default locale
  const pathWithoutInvalidLocale = pathname.replace(/^\/[^/]+/, '');
  const defaultUrl = new URL(`/${defaultLocale}${pathWithoutInvalidLocale}`, request.url);
  defaultUrl.search = request.nextUrl.search;
  
  return NextResponse.redirect(defaultUrl);
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
