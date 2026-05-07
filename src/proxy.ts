import createMiddleware from 'next-intl/middleware';
import {defaultLocale, locales} from './i18n/routing';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always'
});

export const config = {
  matcher: ['/', '/(en|zh)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)']
};