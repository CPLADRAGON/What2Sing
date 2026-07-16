'use client';

import {motion, useReducedMotion} from 'framer-motion';
import {useTranslations} from 'next-intl';
import type {ImportedSong} from '@/lib/importers/qq';
import {songKey} from '@/lib/picker/song-key';
import type {PickerState} from '@/lib/picker/session';

export function CompletePanel({state, pickedSongs, onSelection, onReswipe}: {state: PickerState; pickedSongs: ImportedSong[]; onSelection: () => void; onReswipe: () => void}) {
  const t = useTranslations('picker');
  const prefersReducedMotion = useReducedMotion();
  const pickedKeys = new Set(pickedSongs.map(songKey));
  const unselectedCount = state.deck.filter((song) => !pickedKeys.has(songKey(song))).length;

  return (
    <motion.div
      key="complete"
      initial={prefersReducedMotion ? false : {opacity: 0, scale: 0.96}}
      animate={{opacity: 1, scale: 1}}
      className="absolute inset-0 flex flex-col justify-between rounded-[2.25rem] border border-hairline-strong bg-surface-card p-7 shadow-cyan"
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-karaoke-cyan">{t('completeEyebrow')}</p>
        <h1 className="mt-3 font-display text-4xl font-black tracking-[-0.06em]">{t('completeTitle')}</h1>
        <p className="mt-3 text-sm leading-6 text-body-muted">{t('completeBody', {count: pickedSongs.length})}</p>
        <p className="mt-2 rounded-2xl border border-karaoke-cyan/20 bg-karaoke-cyan/10 px-3 py-2 text-xs leading-5 text-ink-soft">{t('allSwiped')}</p>
      </div>
      <div className="space-y-2 overflow-y-auto">
        {pickedSongs.map((song, index) => (
          <div key={`${song.title}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="text-sm font-bold">{song.title}</p>
            <p className="text-xs text-body-muted">{song.artist}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button type="button" onClick={onSelection} className="h-12 rounded-2xl bg-white text-sm font-black text-canvas">
          {t('viewPicks')}
        </button>
        <button type="button" onClick={onReswipe} disabled={unselectedCount === 0} className="h-12 rounded-2xl border border-karaoke-cyan/25 bg-karaoke-cyan/10 text-sm font-black text-karaoke-cyan disabled:opacity-40">
          {t('reswipeUnselected')}
        </button>
      </div>
    </motion.div>
  );
}
