import type {Metadata} from 'next';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {LandingExperience} from '@/components/landing/landing-experience';
import type {Locale} from '@/i18n/routing';

export async function generateMetadata({params}: {params: Promise<{locale: Locale}>}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: 'meta'});

  return {
    title: t('title'),
    description: t('description')
  };
}

export default async function HomePage({params}: {params: Promise<{locale: Locale}>}) {
  const {locale} = await params;

  setRequestLocale(locale);

  return <LandingExperience />;
}
