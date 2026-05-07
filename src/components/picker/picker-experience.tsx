'use client';

import {AnimatePresence, motion} from 'framer-motion';
import {useLocale, useTranslations} from 'next-intl';
import Link from 'next/link';
import {useEffect, useMemo, useState} from 'react';
import {
  chooseCurrentSong,
  createPickerState,
  deserializeImportedSongs,
  getCurrentSong,
  isPickerComplete,
  PICKER_STORAGE_KEY,
  type PickerState
} from '@/lib/picker/session';

export function PickerExperience() {
  const t = useTranslations('picker');
  const locale = useLocale();
  const [state, setState] = useState<PickerState | null>(null);
  const loaded = state !== null;
  const safeState = state ?? createPickerState([]);
  const currentSong = getCurrentSong(safeState);
  const complete = isPickerComplete(safeState);
  const progress = safeState.deck.length ? Math.min(100, Math.round((safeState.currentIndex / safeState.deck.length) * 100)) : 0;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedSongs = deserializeImportedSongs(window.localStorage.getItem(PICKER_STORAGE_KEY));
      setState(createPickerState(storedSongs));
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const nextSongs = useMemo(() => safeState.deck.slice(safeState.currentIndex + 1, safeState.currentIndex + 4), [safeState]);

  function decide(decision: 'like' | 'skip') {
    setState((current) => (current ? chooseCurrentSong(current, decision) : current));
  }

  if (!loaded) {
    return <main className="grid min-h-screen place-items-center bg-canvas px-5 text-white">{t('loading')}</main>;
  }

  if (safeState.deck.length === 0) {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas px-5 text-white">
        <div className="max-w-sm rounded-[2rem] border border-hairline-strong bg-surface-card p-6 text-center shadow-glow">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-karaoke">KTV-Picker</p>
          <h1 className="mt-3 font-display text-3xl font-black tracking-[-0.05em]">{t('emptyTitle')}</h1>
          <p className="mt-3 text-sm leading-6 text-body-muted">{t('emptyBody')}</p>
          <Link href={`/${locale}`} className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl bg-white px-5 text-sm font-black text-canvas">
            {t('backToImport')}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-canvas px-5 py-5 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,61,139,0.22),transparent_34rem),radial-gradient(circle_at_92%_28%,rgba(85,230,255,0.14),transparent_24rem)]" />
      <nav className="relative z-10 mx-auto flex max-w-md items-center justify-between rounded-full border border-hairline-strong bg-white/[0.035] px-4 py-3 backdrop-blur-xl">
        <Link href={`/${locale}`} className="text-xs font-semibold text-ink-soft">
          {t('backToImport')}
        </Link>
        <span className="text-xs font-black uppercase tracking-[0.22em] text-karaoke">{t('title')}</span>
        <span className="text-xs text-body-muted">{safeState.currentIndex}/{safeState.deck.length}</span>
      </nav>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-6rem)] max-w-md flex-col justify-center pb-5 pt-8">
        <div className="mb-5 h-2 overflow-hidden rounded-full bg-white/10">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-karaoke to-karaoke-cyan" animate={{width: `${progress}%`}} />
        </div>

        <div className="relative h-[28rem]">
          {nextSongs.map((song, index) => (
            <div
              key={`${song.title}-${song.artist}-stack-${index}`}
              className="absolute inset-x-4 top-8 rounded-[2rem] border border-hairline-strong bg-surface-card/75 p-6 opacity-60 blur-[0.2px]"
              style={{transform: `translateY(${(index + 1) * 18}px) scale(${1 - (index + 1) * 0.035})`}}
            >
              <p className="truncate text-xl font-black text-white/60">{song.title}</p>
            </div>
          ))}

          <AnimatePresence mode="wait">
            {currentSong && !complete ? (
              <motion.article
                key={`${currentSong.title}-${currentSong.artist}-${safeState.currentIndex}`}
                drag="x"
                dragConstraints={{left: 0, right: 0}}
                onDragEnd={(_, info) => {
                  if (info.offset.x > 90) decide('like');
                  if (info.offset.x < -90) decide('skip');
                }}
                initial={{opacity: 0, y: 32, rotate: -2}}
                animate={{opacity: 1, y: 0, rotate: 0}}
                exit={{opacity: 0, y: -28, scale: 0.94}}
                className="absolute inset-0 flex touch-pan-y flex-col justify-between rounded-[2.25rem] border border-hairline-strong bg-[linear-gradient(145deg,rgba(255,255,255,0.12),rgba(255,255,255,0.035))] p-7 shadow-glow backdrop-blur-xl"
              >
                <div>
                  <div className="mb-5 flex items-center justify-between">
                    <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-soft">
                      {currentSong.platform}
                    </span>
                    <span className="text-xs text-body-muted">#{safeState.currentIndex + 1}</span>
                  </div>
                  <h1 className="font-display text-5xl font-black leading-[0.94] tracking-[-0.07em] text-white">{currentSong.title}</h1>
                  <p className="mt-4 text-lg font-semibold text-karaoke-cyan">{currentSong.artist}</p>
                </div>

                <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-4">
                  <p className="text-xs leading-5 text-body-muted">{t('gestureHint')}</p>
                </div>
              </motion.article>
            ) : (
              <motion.div
                key="complete"
                initial={{opacity: 0, scale: 0.96}}
                animate={{opacity: 1, scale: 1}}
                className="absolute inset-0 flex flex-col justify-between rounded-[2.25rem] border border-hairline-strong bg-surface-card p-7 shadow-cyan"
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-karaoke-cyan">{t('completeEyebrow')}</p>
                  <h1 className="mt-3 font-display text-4xl font-black tracking-[-0.06em]">{t('completeTitle')}</h1>
                  <p className="mt-3 text-sm leading-6 text-body-muted">{t('completeBody', {count: safeState.liked.length})}</p>
                </div>
                <div className="space-y-2 overflow-y-auto">
                  {safeState.liked.map((song, index) => (
                    <div key={`${song.title}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                      <p className="text-sm font-bold">{song.title}</p>
                      <p className="text-xs text-body-muted">{song.artist}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => decide('skip')}
            disabled={!currentSong}
            className="h-14 rounded-2xl border border-white/10 bg-white/[0.04] text-sm font-black text-ink-soft transition hover:bg-white/10 disabled:opacity-40"
          >
            {t('skip')}
          </button>
          <button
            type="button"
            onClick={() => decide('like')}
            disabled={!currentSong}
            className="h-14 rounded-2xl bg-white text-sm font-black text-canvas transition hover:scale-[1.01] disabled:opacity-40"
          >
            {t('pick')}
          </button>
        </div>
      </section>
    </main>
  );
}
