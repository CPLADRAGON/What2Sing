import {setRequestLocale} from 'next-intl/server';
import {PickerExperience} from '@/components/picker/picker-experience';
import type {Locale} from '@/i18n/routing';

export default async function PickPage({params}: {params: Promise<{locale: Locale}>}) {
  const {locale} = await params;

  setRequestLocale(locale);

  return <PickerExperience />;
}
