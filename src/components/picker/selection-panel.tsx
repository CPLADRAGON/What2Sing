'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import type {ImportedSong} from '@/lib/importers/qq';
import {generateSingingOrder, pickRandomSong} from '@/lib/picker/queue';
import {songKey} from '@/lib/picker/song-key';

export function SelectionPanel({pickedSongs, onRemove, onContinue, onFinish}: {pickedSongs: ImportedSong[]; onRemove: (index: number) => void; onContinue: () => void; onFinish: () => void}) {
  const t = useTranslations('picker');
  const [queueLimit, setQueueLimit] = useState<number | 'all'>('all');
  const [singingOrder, setSingingOrder] = useState(pickedSongs);
  const [randomSong, setRandomSong] = useState<ImportedSong | null>(pickedSongs[0] ?? null);

  function generateQueue() {
    setSingingOrder(generateSingingOrder(pickedSongs, {limit: queueLimit, seed: `${Date.now()}-${pickedSongs.length}`}));
    setRandomSong(null);
  }

  function chooseRandomSong() {
    setRandomSong(pickRandomSong(pickedSongs, `${Date.now()}-${pickedSongs.length}`));
  }

  return (
    <section className="relative z-10 mx-auto flex min-h-[calc(100vh-6rem)] max-w-md flex-col py-8">
      <div className="rounded-[2rem] border border-hairline-strong bg-surface-card/90 p-6 shadow-cyan backdrop-blur-xl">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-karaoke-cyan">{pickedSongs.length} songs</p>
        <h1 className="mt-3 font-display text-4xl font-black tracking-[-0.06em]">{t('selectionTitle')}</h1>
        <p className="mt-3 text-sm leading-6 text-body-muted">{t('selectionBody')}</p>
        <div className="mt-5 rounded-[1.5rem] border border-karaoke-cyan/20 bg-karaoke-cyan/10 p-4">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-karaoke-cyan">{t('queueTools')}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(['all', 5, 10] as const).map((limit) => (
              <button
                key={limit}
                type="button"
                onClick={() => setQueueLimit(limit)}
                className={`h-9 rounded-xl text-xs font-black transition ${queueLimit === limit ? 'bg-white text-canvas' : 'border border-white/10 bg-white/[0.04] text-ink-soft'}`}
              >
                {limit === 'all' ? t('queueLimitAll') : limit}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={generateQueue} disabled={!pickedSongs.length} className="h-11 rounded-2xl bg-karaoke-cyan text-xs font-black text-canvas disabled:opacity-40">
              {t('generateQueue')}
            </button>
            <button type="button" onClick={chooseRandomSong} disabled={!pickedSongs.length} className="h-11 rounded-2xl border border-white/10 bg-white/[0.04] text-xs font-black text-ink-soft disabled:opacity-40">
              {t('pickOneRandom')}
            </button>
          </div>
          {randomSong ? (
            <div className="mt-3 rounded-2xl border border-karaoke/30 bg-karaoke/10 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-karaoke">{t('nextSong')}</p>
              <p className="mt-1 text-sm font-black text-white">{randomSong.title}</p>
              <p className="text-xs text-body-muted">{randomSong.artist}</p>
            </div>
          ) : null}
        </div>
        <div className="mt-5 max-h-[52vh] space-y-2 overflow-y-auto pr-1">
          {singingOrder.map((song, index) => (
            <div key={`${song.title}-${song.artist}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <div>
                <p className="text-sm font-bold"><span className="mr-2 text-karaoke-cyan">#{index + 1}</span>{song.title}</p>
                <p className="text-xs text-body-muted">{song.artist}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const targetKey = songKey(song);
                  const libraryIndex = pickedSongs.findIndex((picked) => songKey(picked) === targetKey);
                  onRemove(libraryIndex);
                  setSingingOrder((current) => current.filter((queued) => songKey(queued) !== targetKey));
                  setRandomSong((current) => (current && songKey(current) === targetKey ? null : current));
                }}
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-ink-soft"
              >
                {t('remove')}
              </button>
            </div>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={onContinue} className="h-12 rounded-2xl border border-white/10 bg-white/[0.04] text-sm font-black text-ink-soft">
            {t('continueSwiping')}
          </button>
          <button type="button" onClick={onFinish} className="h-12 rounded-2xl bg-white text-sm font-black text-canvas">
            {t('finishQueue')}
          </button>
        </div>
      </div>
    </section>
  );
}
