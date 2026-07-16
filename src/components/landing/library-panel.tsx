'use client';

import {motion, useReducedMotion} from 'framer-motion';
import {useTranslations} from 'next-intl';
import {useSyncExternalStore, type Dispatch, type RefObject, type SetStateAction} from 'react';
import type {ImportedSong} from '@/lib/importers/qq';
import {getSongsForBatch, type ImportBatch, type SongLibrary} from '@/lib/picker/library';
import {getBatchProgress, type BatchSessionMap} from '@/lib/picker/session';

type LibraryPanelProps = {
  library: SongLibrary | null;
  savedLikedSongs: ImportedSong[];
  importBatches: ImportBatch[];
  activeTab: 'selected' | 'imported';
  setActiveTab: Dispatch<SetStateAction<'selected' | 'imported'>>;
  librarySearch: string;
  setLibrarySearch: Dispatch<SetStateAction<string>>;
  queueLimit: number | 'all';
  setQueueLimit: Dispatch<SetStateAction<number | 'all'>>;
  generateLandingQueue: () => void;
  pickLandingRandomSong: () => void;
  randomSong: ImportedSong | null;
  generatedQueue: ImportedSong[];
  queueText: string;
  queueCardRef: RefObject<HTMLDivElement | null>;
  handleCopyQueueText: () => void;
  exportMessage: string;
  handleSaveQueueImage: () => Promise<void>;
  handleRemovePickedSong: (index: number) => void;
  batchSessions: BatchSessionMap;
  expandedBatches: Set<string>;
  setExpandedBatches: Dispatch<SetStateAction<Set<string>>>;
  handleDeleteBatch: (batchId: string) => void;
  handlePickBatch: (batchId: string) => Promise<void>;
  handleResetBatch: (batchId: string) => void;
  handleRemoveSongFromBatch: (song: ImportedSong) => void;
  libraryExpanded: boolean;
  setLibraryExpanded: Dispatch<SetStateAction<boolean>>;
};

function subscribeToShareSupport() {
  return () => {};
}

function getShareSupportSnapshot() {
  return typeof navigator !== 'undefined' && 'share' in navigator;
}

export function LibraryPanel({
  library,
  savedLikedSongs,
  importBatches,
  activeTab,
  setActiveTab,
  librarySearch,
  setLibrarySearch,
  queueLimit,
  setQueueLimit,
  generateLandingQueue,
  pickLandingRandomSong,
  randomSong,
  generatedQueue,
  queueText,
  queueCardRef,
  handleCopyQueueText,
  exportMessage,
  handleSaveQueueImage,
  handleRemovePickedSong,
  batchSessions,
  expandedBatches,
  setExpandedBatches,
  handleDeleteBatch,
  handlePickBatch,
  handleResetBatch,
  handleRemoveSongFromBatch,
  libraryExpanded,
  setLibraryExpanded
}: LibraryPanelProps) {
  const t = useTranslations('landing');
  const prefersReducedMotion = useReducedMotion();
  const canShareQueue = useSyncExternalStore(subscribeToShareSupport, getShareSupportSnapshot, () => false);

  function handleDownloadQueueText() {
    if (!queueText) {
      return;
    }

    const blob = new Blob([queueText], {type: 'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ktv-queue-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleShareQueueText() {
    if (!queueText || typeof navigator === 'undefined' || !('share' in navigator)) {
      return;
    }

    void navigator.share({title: t('exportQueueTitle'), text: queueText});
  }

  return (
          <div className="mt-4 rounded-[1.5rem] border border-hairline-strong bg-black/30 p-4">
            <div className="mb-3 flex items-center justify-between">
              <button type="button" onClick={() => setLibraryExpanded((v) => !v)} className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white">{t('libraryTitle')}</h2>
              </button>
              <button type="button" onClick={() => setLibraryExpanded((v) => !v)} aria-label={libraryExpanded ? t('libraryCollapseAria') : t('libraryExpandAria')} className="text-xs text-body-muted">
                {libraryExpanded ? '▲' : '▼'}
              </button>
            </div>
            {libraryExpanded ? (
              <>
                {library && (library.songs.length > 0 || savedLikedSongs.length > 0) ? (
                  <>
                    {/* ── Tab bar ── */}
                    <div className="mb-3 flex rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
                      <button type="button" onClick={() => setActiveTab('selected')} className={`flex-1 rounded-lg py-2 text-xs font-black transition ${activeTab === 'selected' ? 'bg-karaoke-cyan text-canvas' : 'text-ink-soft hover:text-white'}`}>
                        {t('tabSelected')} ({savedLikedSongs.length})
                      </button>
                      <button type="button" onClick={() => setActiveTab('imported')} className={`flex-1 rounded-lg py-2 text-xs font-black transition ${activeTab === 'imported' ? 'bg-white text-canvas' : 'text-ink-soft hover:text-white'}`}>
                        {t('tabImported')} ({library?.songs.length ?? 0})
                      </button>
                    </div>

                    {/* ── Search input ── */}
                    <div className="relative mb-3">
                      <input
                        value={librarySearch}
                        onChange={(event) => setLibrarySearch(event.target.value)}
                        placeholder={t('searchPlaceholder')}
                        className="h-9 w-full rounded-xl border border-white/10 bg-black/35 pl-3 pr-8 text-xs text-white outline-none transition placeholder:text-body-muted focus:border-karaoke-cyan/50"
                      />
                      {librarySearch ? (
                        <button type="button" onClick={() => setLibrarySearch('')} aria-label={t('searchClearAria')} className="absolute right-2 top-1/2 -translate-y-1/2 text-body-muted transition hover:text-white">
                          <span className="text-xs">✕</span>
                        </button>
                      ) : null}
                    </div>

                    {/* ── Selected tab ── */}
                    {activeTab === 'selected' ? (
                      <div>
                        {savedLikedSongs.length > 0 ? (
                          <>
                            <div className="rounded-2xl border border-karaoke-cyan/20 bg-karaoke-cyan/10 p-3">
                              <div className="grid grid-cols-3 gap-1.5">
                                {(['all', 5, 10] as const).map((limit) => (
                                  <button key={limit} type="button" onClick={() => setQueueLimit(limit)} className={`h-8 rounded-lg text-[10px] font-black transition ${queueLimit === limit ? 'bg-white text-canvas' : 'border border-white/10 bg-white/[0.04] text-ink-soft'}`}>
                                    {limit === 'all' ? t('queueLimitAll') : limit}
                                  </button>
                                ))}
                              </div>
                              <div className="mt-2 grid grid-cols-2 gap-1.5">
                                <button type="button" onClick={generateLandingQueue} className="h-9 rounded-lg bg-karaoke-cyan text-[10px] font-black text-canvas">
                                  {t('generateQueue')}
                                </button>
                                <button type="button" onClick={pickLandingRandomSong} className="h-9 rounded-lg bg-white text-[10px] font-black text-canvas">
                                  {t('pickOneRandom')}
                                </button>
                              </div>
                              {randomSong ? (
                                <div className="mt-2.5 rounded-xl border border-karaoke/30 bg-karaoke/10 px-3 py-2">
                                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-karaoke">{t('nextSong')}</p>
                                  <p className="mt-1 text-sm font-black text-white">{randomSong.title}</p>
                                  <p className="text-xs text-body-muted">{randomSong.artist}</p>
                                </div>
                              ) : null}
                            </div>

                            {generatedQueue.length > 0 ? (
                              <>
                                <div ref={queueCardRef} className="mt-3 rounded-2xl border border-karaoke-cyan/15 bg-[#0a0a0f] p-4">
                                  <p className="mb-3 text-xs font-black text-karaoke-cyan">{t('exportQueueTitle')}</p>
                                  <div className="space-y-1.5">
                                    {generatedQueue.map((song, index) => (
                                      <div key={`q-${song.title}-${song.artist}-${index}`} className="flex items-center justify-between rounded-xl border border-karaoke-cyan/15 bg-white/[0.035] px-3 py-2.5">
                                        <div className="min-w-0 flex-1">
                                          <p className="text-sm font-bold text-white"><span className="mr-2 text-karaoke-cyan">#{index + 1}</span>{song.title}</p>
                                          <p className="text-xs text-body-muted">{song.artist}</p>
                                        </div>
                                        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-ink-soft">{song.platform}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <p className="mt-3 text-right text-[10px] text-body-muted">{t('exportBranding')}</p>
                                </div>
                                <div className={`mt-2 grid gap-1.5 ${canShareQueue ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                                  <button type="button" onClick={handleCopyQueueText} className="h-9 rounded-lg border border-white/10 bg-white/[0.04] text-[10px] font-black text-ink-soft transition hover:bg-white/10">
                                    {exportMessage || t('exportCopyText')}
                                  </button>
                                  <button type="button" onClick={handleDownloadQueueText} className="h-9 rounded-lg border border-white/10 bg-white/[0.04] text-[10px] font-black text-ink-soft transition hover:bg-white/10">
                                    {t('exportDownloadText')}
                                  </button>
                                  {canShareQueue ? (
                                    <button type="button" onClick={handleShareQueueText} className="h-9 rounded-lg border border-white/10 bg-white/[0.04] text-[10px] font-black text-ink-soft transition hover:bg-white/10">
                                      {t('exportShare')}
                                    </button>
                                  ) : null}
                                  <button type="button" onClick={() => void handleSaveQueueImage()} className="h-9 rounded-lg border border-white/10 bg-white/[0.04] text-[10px] font-black text-ink-soft transition hover:bg-white/10">
                                    {t('exportSaveImage')}
                                  </button>
                                </div>
                              </>
                            ) : null}

                            <div className="mt-3 max-h-[400px] space-y-1.5 overflow-y-auto">
                              {savedLikedSongs.map((song, index) => {
                                if (librarySearch) {
                                  const q = librarySearch.toLowerCase();
                                  if (!song.title.toLowerCase().includes(q) && !song.artist.toLowerCase().includes(q)) {
                                    return null;
                                  }
                                }

                                return (
                                <div key={`p-${song.title}-${song.artist}-${index}`} className="group flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2.5">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-white">{song.title}</p>
                                    <p className="text-xs text-body-muted">{song.artist}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-ink-soft">{song.platform}</span>
                                    <button type="button" onClick={() => handleRemovePickedSong(index)} className="hidden shrink-0 rounded-full border border-karaoke/20 bg-karaoke/10 px-2 py-1 text-[10px] font-black text-karaoke transition hover:bg-karaoke/20 group-hover:block">
                                      {t('removePicked')}
                                    </button>
                                  </div>
                                </div>
                                );
                              })}
                            </div>
                          </>
                        ) : (
                          <p className="py-8 text-center text-xs leading-5 text-body-muted">{t('noPickedSongs')}</p>
                        )}
                      </div>
                    ) : null}

                    {/* ── Imported tab ── */}
                    {activeTab === 'imported' ? (
                      <div>
                        {library && library.songs.length > 0 && importBatches.length > 0 ? (
                          <div className="space-y-2.5">
                            {importBatches.map((batch) => {
                              const session = batchSessions[batch.id];
                              const progress = session ? getBatchProgress(session) : null;
                              const hasProgress = progress && progress.swiped > 0;
                              const isComplete = progress?.complete ?? false;
                              const pct = progress ? Math.round((progress.swiped / progress.total) * 100) : 0;
                              const isExpanded = expandedBatches.has(batch.id);
                              const batchSongs = isExpanded ? getSongsForBatch(library, batch.id) : [];
                              const filteredBatchSongs = librarySearch
                                ? batchSongs.filter((s) => s.title.toLowerCase().includes(librarySearch.toLowerCase()) || s.artist.toLowerCase().includes(librarySearch.toLowerCase()))
                                : batchSongs;

                              return (
                                <div key={batch.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                                  <div className="p-3.5">
                                    <div className="flex items-start justify-between gap-2">
                                      <button type="button" onClick={() => setExpandedBatches((prev) => {const next = new Set(prev); if (next.has(batch.id)) next.delete(batch.id); else next.add(batch.id); return next;})} aria-label={t(isExpanded ? 'batchCollapseAria' : 'batchExpandAria', {label: batch.label})} className="flex min-w-0 flex-1 items-start gap-2 text-left">
                                        <motion.svg
                                          animate={{rotate: isExpanded ? 180 : 0}}
                                          transition={prefersReducedMotion ? {duration: 0} : {duration: 0.2}}
                                          className="mt-0.5 h-4 w-4 shrink-0 text-body-muted"
                                          viewBox="0 0 16 16"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        >
                                          <path d="M4 6l4 4 4-4" />
                                        </motion.svg>
                                        <div className="min-w-0">
                                          <p className="text-sm font-black text-white">{batch.label}</p>
                                          <p className="mt-0.5 text-[10px] text-body-muted">{batch.songCount} songs</p>
                                        </div>
                                      </button>
                                      <div className="flex shrink-0 items-center gap-1.5">
                                        {isComplete ? (
                                          <span className="rounded-full bg-karaoke-cyan/15 px-2.5 py-1 text-[10px] font-black text-karaoke-cyan">{t('batchComplete')}</span>
                                        ) : null}
                                        <button type="button" onClick={() => handleDeleteBatch(batch.id)} aria-label={t('deleteBatchAria', {label: batch.label})} className="rounded-full p-1 text-body-muted transition hover:bg-white/10 hover:text-white">
                                          <span className="text-xs">✕</span>
                                        </button>
                                      </div>
                                    </div>

                                    {hasProgress ? (
                                      <div className="mt-2.5">
                                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                                          <div className={`h-full rounded-full transition-all ${isComplete ? 'bg-karaoke-cyan' : 'bg-gradient-to-r from-karaoke to-karaoke-cyan'}`} style={{width: `${pct}%`}} />
                                        </div>
                                        <div className="mt-1.5 flex gap-3 text-[10px] text-body-muted">
                                          <span>{t('batchProgress', {swiped: progress.swiped, total: progress.total})}</span>
                                          <span className="text-karaoke-cyan">{t('batchLiked', {count: progress.liked})}</span>
                                          <span>{t('batchSkipped', {count: progress.skipped})}</span>
                                        </div>
                                      </div>
                                    ) : null}

                                    <div className={`${hasProgress ? 'mt-2.5' : 'mt-3'} flex gap-2`}>
                                      <button type="button" onClick={() => void handlePickBatch(batch.id)} className={`h-9 flex-1 rounded-xl text-xs font-black transition hover:scale-[1.01] ${isComplete ? 'border border-karaoke-cyan/25 bg-karaoke-cyan/10 text-karaoke-cyan' : 'bg-karaoke-cyan text-canvas'}`}>
                                        {hasProgress ? t('batchResumePicking') : t('batchStartPicking')}
                                      </button>
                                      {hasProgress ? (
                                        <button type="button" onClick={() => handleResetBatch(batch.id)} className="h-9 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-ink-soft transition hover:bg-white/10">
                                          {t('batchResetProgress')}
                                        </button>
                                      ) : null}
                                    </div>

                                    {isExpanded && filteredBatchSongs.length > 0 ? (
                                      <div className="mt-3 max-h-[300px] space-y-1.5 overflow-y-auto border-t border-white/5 pt-3">
                                        {filteredBatchSongs.map((song, index) => (
                                          <div key={`b-${batch.id}-${song.title}-${song.artist}-${index}`} className="group flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2.5">
                                            <div className="min-w-0 flex-1">
                                              <p className="text-sm font-bold text-white">{song.title}</p>
                                              <p className="text-xs text-body-muted">{song.artist}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-ink-soft">{song.platform}</span>
                                              <button type="button" onClick={() => handleRemoveSongFromBatch(song)} className="hidden shrink-0 rounded-full border border-karaoke/20 bg-karaoke/10 px-2 py-1 text-[10px] font-black text-karaoke transition hover:bg-karaoke/20 group-hover:block">
                                                {t('removeSong')}
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="py-8 text-center text-xs leading-5 text-body-muted">{t('libraryEmpty')}</p>
                        )}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="text-xs leading-5 text-body-muted">{t('libraryEmpty')}</p>
                )}
              </>
            ) : null}
          </div>
  );
}
