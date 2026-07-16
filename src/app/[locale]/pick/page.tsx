import type {Viewport} from 'next';
import {setRequestLocale} from 'next-intl/server';
import {PickerExperience} from '@/components/picker/picker-experience';
import type {Locale} from '@/i18n/routing';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#050507'
};

export default async function PickPage({params}: {params: Promise<{locale: Locale}>}) {
  const {locale} = await params;

  setRequestLocale(locale);

  return <PickerExperience />;
}
