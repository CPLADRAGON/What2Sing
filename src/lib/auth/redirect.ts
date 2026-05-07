import type {Locale} from '@/i18n/routing';

export function getAuthRedirectUrl(locale: Locale | string, currentOrigin: string, configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL) {
  const baseUrl = (configuredSiteUrl?.trim() || currentOrigin).replace(/\/$/, '');

  return `${baseUrl}/${locale}/login`;
}
