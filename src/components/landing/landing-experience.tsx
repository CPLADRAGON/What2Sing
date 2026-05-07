'use client';

import {motion} from 'framer-motion';
import {useLocale, useTranslations} from 'next-intl';
import Link from 'next/link';
import {useMemo, useState} from 'react';
import {normalizeSongs} from '@/lib/importers/manual';
import type {ImportedSong} from '@/lib/importers/qq';

const sampleSongs = '青花瓷 - 周杰伦\n后来 - 刘若英\n修炼爱情 - 林俊杰\n倔强 - 五月天';

export function LandingExperience() {
  const t = useTranslations('landing');
  const locale = useLocale();
  const nextLocale = locale === 'zh' ? 'en' : 'zh';
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [songs, setSongs] = useState<ImportedSong[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const steps = t.raw('steps') as string[];

  const previewSongs = useMemo(
    () => (songs.length ? songs : normalizeSongs(sampleSongs)).slice(0, 4),
    [songs]
  );

  async function handleImport() {
    setMessage('');

    const manualSongs = normalizeSongs(text);

    if (!url.trim() && manualSongs.length === 0) {
      setStatus('error');
      setMessage(t('emptyHint'));
      return;
    }

    setStatus('loading');

    try {
      let importedSongs: ImportedSong[] = [];

      if (url.trim()) {
        const response = await fetch('/api/import/qq', {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify({url})
        });
        const payload = (await response.json()) as {songs?: ImportedSong[]; error?: string};

        if (!response.ok) {
          throw new Error(payload.error ?? 'Import failed');
        }

        importedSongs = payload.songs ?? [];
      }

      const nextSongs = [...importedSongs, ...manualSongs];
      setSongs(nextSongs);
      setStatus('done');
      setMessage(t('imported', {count: nextSongs.length}));
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Import failed');
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-5 py-5 text-white sm:px-8 lg:px-12">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:52px_52px] [mask-image:radial-gradient(circle_at_center,black,transparent_72%)]" />
      <div className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-karaoke/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-28 top-44 h-80 w-80 rounded-full bg-karaoke-cyan/10 blur-3xl" />

      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between rounded-full border border-hairline-strong bg-white/[0.03] px-4 py-3 backdrop-blur-xl">
        <Link href={`/${locale}`} className="flex items-center gap-2 font-display text-sm font-black tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-canvas">唱</span>
          KTV-Picker
        </Link>
        <Link href={`/${nextLocale}`} className="rounded-full border border-hairline-strong px-3 py-1.5 text-xs text-ink-soft transition hover:border-white/30 hover:bg-white/10">
          {t('language')}
        </Link>
      </nav>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-10 pb-12 pt-12 lg:grid-cols-[1.04fr_0.96fr] lg:items-center lg:pb-20 lg:pt-20">
        <motion.div initial={{opacity: 0, y: 22}} animate={{opacity: 1, y: 0}} transition={{duration: 0.65}}>
          <div className="mb-5 inline-flex rounded-full border border-karaoke/30 bg-karaoke/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-karaoke">
            {t('badge')}
          </div>
          <h1 className="font-display text-5xl font-black leading-[0.95] tracking-[-0.06em] text-white sm:text-6xl lg:text-7xl">
            {t('title')}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-body-muted sm:text-lg">
            {t('subtitle')}
          </p>

          <div className="mt-7 grid grid-cols-3 gap-2 text-xs text-ink-soft sm:max-w-lg">
            {steps.map((step, index) => (
              <div key={step} className="rounded-2xl border border-hairline-strong bg-white/[0.035] p-3">
                <span className="mb-4 block text-body-muted">0{index + 1}</span>
                <span className="font-semibold">{step}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{opacity: 0, scale: 0.96, y: 28}}
          animate={{opacity: 1, scale: 1, y: 0}}
          transition={{duration: 0.7, delay: 0.1}}
          className="rounded-[2rem] border border-hairline-strong bg-surface-card/90 p-4 shadow-glow backdrop-blur-xl sm:p-5"
        >
          <div className="rounded-[1.5rem] border border-white/10 bg-surface-elevated p-4 sm:p-5">
            <label className="text-sm font-semibold text-ink-soft" htmlFor="qq-url">
              {t('urlLabel')}
            </label>
            <input
              id="qq-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder={t('urlPlaceholder')}
              className="mt-2 h-12 w-full rounded-2xl border border-hairline-strong bg-black/35 px-4 text-sm text-white outline-none transition placeholder:text-body-muted focus:border-karaoke/70 focus:shadow-[0_0_0_4px_rgba(255,61,139,0.12)]"
            />

            <label className="mt-5 block text-sm font-semibold text-ink-soft" htmlFor="song-text">
              {t('textLabel')}
            </label>
            <textarea
              id="song-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={t('textPlaceholder')}
              rows={6}
              className="mt-2 w-full resize-none rounded-2xl border border-hairline-strong bg-black/35 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-body-muted focus:border-karaoke-cyan/70 focus:shadow-[0_0_0_4px_rgba(85,230,255,0.10)]"
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <button
                type="button"
                onClick={handleImport}
                disabled={status === 'loading'}
                className="h-12 rounded-2xl bg-white px-5 text-sm font-black text-canvas transition hover:scale-[1.01] hover:bg-ink-soft disabled:cursor-wait disabled:opacity-70"
              >
                {status === 'loading' ? '...' : t('importButton')}
              </button>
              <button
                type="button"
                onClick={() => setText(sampleSongs)}
                className="h-12 rounded-2xl border border-hairline-strong px-5 text-sm font-semibold text-ink-soft transition hover:border-white/25 hover:bg-white/10"
              >
                {t('sampleButton')}
              </button>
            </div>

            {message ? (
              <p className={`mt-3 text-sm ${status === 'error' ? 'text-karaoke' : 'text-karaoke-cyan'}`}>{message}</p>
            ) : null}
            {status === 'done' ? (
              <p className="mt-2 rounded-2xl border border-karaoke-cyan/20 bg-karaoke-cyan/10 px-3 py-2 text-xs leading-5 text-ink-soft">
                {t('nextAfterImport')}
              </p>
            ) : null}
          </div>

          <div className="mt-4 rounded-[1.5rem] border border-hairline-strong bg-black/30 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black text-white">{t('previewTitle')}</h2>
              <div className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-karaoke" />
                <span className="h-2 w-2 rounded-full bg-karaoke-cyan" />
                <span className="h-2 w-2 rounded-full bg-white/40" />
              </div>
            </div>
            <div className="space-y-2">
              {previewSongs.map((song, index) => (
                <div key={`${song.title}-${song.artist}-${index}`} className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.035] px-3 py-3">
                  <div>
                    <p className="text-sm font-bold text-white">{song.title}</p>
                    <p className="text-xs text-body-muted">{song.artist}</p>
                  </div>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-ink-soft">
                    {song.platform}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-3 pb-8 sm:grid-cols-3">
        {(['import', 'swipe', 'realtime'] as const).map((feature) => (
          <div key={feature} className="rounded-3xl border border-hairline-strong bg-white/[0.03] p-5 text-sm font-semibold text-ink-soft backdrop-blur">
            {t(`features.${feature}`)}
          </div>
        ))}
      </section>
    </main>
  );
}
