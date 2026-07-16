'use client';

import {motion, useReducedMotion} from 'framer-motion';
import {useLocale, useTranslations} from 'next-intl';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect, useMemo, useRef, useState} from 'react';
import {getUserDisplayName} from '@/lib/auth/profile';
import {normalizeSongs} from '@/lib/importers/manual';
import type {ImportedSong} from '@/lib/importers/qq';
import {loadLatestPickerStateForCurrentUser, saveImportedDeckForCurrentUser, saveLibraryForCurrentUser, savePickerStateForCurrentUser, chooseSyncedLibrary, loadLibraryForCurrentUser} from '@/lib/picker/persistence';
import {generateSingingOrder, pickRandomSong} from '@/lib/picker/queue';
import {addSongsToLibrary, createLibrary, deserializeLibrary, getSongsForBatch, LIBRARY_STORAGE_KEY, migrateFromLegacyPickerState, quickAddPickedSong, removePickedSongFromLibrary, removeBatchFromLibrary, removeSongFromLibrary, serializeLibrary, type ImportBatch, type SongLibrary} from '@/lib/picker/library';
import {chooseSyncedPickerState, createPickerState, deserializePickerState, loadBatchSessions, PICKER_STORAGE_KEY, removeBatchSession, saveBatchSession, serializePickerState, type BatchSessionMap} from '@/lib/picker/session';
import {songKey} from '@/lib/picker/song-key';
import {safeGetItem, safeRemoveItem, safeSetItem} from '@/lib/safe-storage';
import {supabase} from '@/lib/supabase';
import {ImportLoadingPanel} from './import-loading-panel';
import {LibraryPanel} from './library-panel';

const sampleSongs = '青花瓷 - 周杰伦\n后来 - 刘若英\n修炼爱情 - 林俊杰\n倔强 - 五月天';
type ImportSource = 'qq' | 'spotify' | 'netease' | 'manual';
type DuplicateImportSummary = {
  added: number;
  skipped: number;
  total: number;
};

export function LandingExperience() {
  const t = useTranslations('landing');
  const locale = useLocale();
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const nextLocale = locale === 'zh' ? 'en' : 'zh';
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [activeSource, setActiveSource] = useState<ImportSource>('qq');
  const [songs, setSongs] = useState<ImportedSong[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [duplicateImportSummary, setDuplicateImportSummary] = useState<DuplicateImportSummary | null>(null);
  const [library, setLibrary] = useState<SongLibrary | null>(null);
  const savedLikedSongs = useMemo(() => library?.pickedSongs ?? [], [library]);
  const importBatches = useMemo(() => library?.batches ?? [], [library]);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [generatedQueue, setGeneratedQueue] = useState<ImportedSong[]>([]);
  const [queueLimit, setQueueLimit] = useState<number | 'all'>('all');
  const [randomSong, setRandomSong] = useState<ImportedSong | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [quickAddArtist, setQuickAddArtist] = useState('');
  const [quickAddMessage, setQuickAddMessage] = useState('');
  const [quickAddStatus, setQuickAddStatus] = useState<'idle' | 'success' | 'duplicate'>('idle');
  const [libraryExpanded, setLibraryExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'selected' | 'imported'>('selected');
  const [exportMessage, setExportMessage] = useState('');
  const [batchSessions, setBatchSessions] = useState<BatchSessionMap>({});
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [librarySearch, setLibrarySearch] = useState('');
  const queueCardRef = useRef<HTMLDivElement>(null);
  const exportMessageTimerRef = useRef<number | null>(null);
  const quickAddMessageTimerRef = useRef<number | null>(null);
  const steps = t.raw('steps') as string[];
  const loadingSteps = t.raw('loadingSteps') as string[];
  const queueText = useMemo(() => {
    if (generatedQueue.length === 0) {
      return '';
    }

    const header = t('exportQueueTitle');
    const lines = generatedQueue.map((song, i) => `${i + 1}. ${song.title} - ${song.artist}`);
    const footer = `-- ${t('exportBranding')}`;
    return [header, ...lines, '', footer].join('\n');
  }, [generatedQueue, t]);

  useEffect(() => {
    let isMounted = true;

    async function loadSavedProgress() {
      const localState = deserializePickerState(safeGetItem(PICKER_STORAGE_KEY));
      const remoteSession = await loadLatestPickerStateForCurrentUser();
      const savedState = chooseSyncedPickerState(localState, remoteSession?.state ?? null);

      if (!isMounted) {
        return;
      }

      if (savedState) {
        safeSetItem(PICKER_STORAGE_KEY, serializePickerState(savedState));
      }

      const localLib = deserializeLibrary(safeGetItem(LIBRARY_STORAGE_KEY));
      const remoteLib = await loadLibraryForCurrentUser();
      let lib = chooseSyncedLibrary(localLib, remoteLib);

      if (!lib && savedState) {
        const legacyBatches = ((savedState as unknown as Record<string, unknown>).importBatches ?? []) as ImportBatch[];
        lib = migrateFromLegacyPickerState(savedState.defaultDeck, legacyBatches, savedState.liked);
      }

      if (lib) {
        safeSetItem(LIBRARY_STORAGE_KEY, serializeLibrary(lib));
        setLibrary(lib);
      }

      setBatchSessions(loadBatchSessions());
    }

    void loadSavedProgress();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const client = supabase;

    if (!client) {
      return;
    }

    void client.auth.getSession().then(({data}) => setDisplayName(getUserDisplayName(data.session?.user ?? null)));
    const {data: subscription} = client.auth.onAuthStateChange((_event, session) => {
      setDisplayName(getUserDisplayName(session?.user ?? null));
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => () => {
    [exportMessageTimerRef, quickAddMessageTimerRef].forEach((timerRef) => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    });
  }, []);

  function showQuickAddMessage(nextMessage: string, nextStatus: 'success' | 'duplicate') {
    if (quickAddMessageTimerRef.current !== null) {
      window.clearTimeout(quickAddMessageTimerRef.current);
    }

    setQuickAddMessage(nextMessage);
    setQuickAddStatus(nextStatus);
    quickAddMessageTimerRef.current = window.setTimeout(() => {
      setQuickAddMessage('');
      setQuickAddStatus('idle');
      quickAddMessageTimerRef.current = null;
    }, 2400);
  }

  function generateLandingQueue() {
    setGeneratedQueue(generateSingingOrder(savedLikedSongs, {limit: queueLimit, seed: `${Date.now()}-${savedLikedSongs.length}`}));
    setRandomSong(null);
  }

  function pickLandingRandomSong() {
    setRandomSong(pickRandomSong(savedLikedSongs, `${Date.now()}-${savedLikedSongs.length}`));
  }

  function handleQuickAdd() {
    const title = quickAddTitle.trim();
    const artist = quickAddArtist.trim();

    if (!title || !artist) {
      return;
    }

    const song: ImportedSong = {title, artist, platform: 'manual', tags: []};
    const currentLib = library ?? createLibrary();
    const result = quickAddPickedSong(currentLib, song);

    if (!result.added) {
      showQuickAddMessage(t('quickAddDuplicate'), 'duplicate');
      return;
    }

    safeSetItem(LIBRARY_STORAGE_KEY, serializeLibrary(result.library));
    setLibrary(result.library);
    void saveLibraryForCurrentUser(result.library);
    setQuickAddTitle('');
    setQuickAddArtist('');
    showQuickAddMessage(t('quickAddSuccess', {title}), 'success');
  }

  function handleDeleteBatch(batchId: string) {
    const batch = importBatches.find((b) => b.id === batchId);
    if (!window.confirm(t('confirmDeleteBatch', {count: batch?.songCount ?? 0}))) {
      return;
    }

    const currentLib = library ?? createLibrary();
    const updated = removeBatchFromLibrary(currentLib, batchId);
    safeSetItem(LIBRARY_STORAGE_KEY, serializeLibrary(updated));
    setLibrary(updated);
    void saveLibraryForCurrentUser(updated);

    removeBatchSession(batchId);
    setBatchSessions(loadBatchSessions());
  }

  function handleRemoveSongFromBatch(song: ImportedSong) {
    if (!window.confirm(t('confirmRemoveSong'))) {
      return;
    }

    const currentLib = library ?? createLibrary();
    const updated = removeSongFromLibrary(currentLib, song);
    safeSetItem(LIBRARY_STORAGE_KEY, serializeLibrary(updated));
    setLibrary(updated);
    void saveLibraryForCurrentUser(updated);
  }

  function handleRemovePickedSong(index: number) {
    if (!window.confirm(t('confirmRemoveSong'))) {
      return;
    }

    const currentLib = library ?? createLibrary();
    const removedSong = currentLib.pickedSongs[index];
    const updated = removePickedSongFromLibrary(currentLib, index);
    safeSetItem(LIBRARY_STORAGE_KEY, serializeLibrary(updated));
    setLibrary(updated);
    void saveLibraryForCurrentUser(updated);

    if (removedSong) {
      const removedKey = songKey(removedSong);
      const localState = deserializePickerState(safeGetItem(PICKER_STORAGE_KEY));

      if (localState) {
        const filteredLiked = localState.liked.filter((s) => songKey(s) !== removedKey);

        if (filteredLiked.length !== localState.liked.length) {
          const updatedState = {...localState, liked: filteredLiked, updatedAt: new Date().toISOString()};
          safeSetItem(PICKER_STORAGE_KEY, serializePickerState(updatedState));
          void savePickerStateForCurrentUser(updatedState);
        }
      }

      setGeneratedQueue((q) => q.filter((s) => songKey(s) !== removedKey));
    }
  }

  function handleCopyQueueText() {
    if (!queueText) {
      return;
    }

    void navigator.clipboard.writeText(queueText).then(() => {
      if (exportMessageTimerRef.current !== null) {
        window.clearTimeout(exportMessageTimerRef.current);
      }
      setExportMessage(t('exportCopied'));
      exportMessageTimerRef.current = window.setTimeout(() => {
        setExportMessage('');
        exportMessageTimerRef.current = null;
      }, 2000);
    });
  }

  async function handleSaveQueueImage() {
    if (!queueCardRef.current || generatedQueue.length === 0) {
      return;
    }

    const {default: html2canvas} = await import('html2canvas');
    const canvas = await html2canvas(queueCardRef.current, {
      backgroundColor: '#0a0a0f',
      scale: 2,
      useCORS: true
    });
    const link = document.createElement('a');
    link.download = `ktv-queue-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function handleClearLibrary() {
    if (!window.confirm(t('confirmClearLibrary'))) {
      return;
    }

    safeRemoveItem(PICKER_STORAGE_KEY);
    safeRemoveItem(LIBRARY_STORAGE_KEY);
    safeRemoveItem('ktv-picker:batch-sessions');
    const emptyLib = {songs: [], batches: [], pickedSongs: [], updatedAt: new Date().toISOString()};
    void saveLibraryForCurrentUser(emptyLib);
    setLibrary(null);
    setBatchSessions({});
    setSongs([]);
    setGeneratedQueue([]);
    setRandomSong(null);
    setStatus('idle');
    setMessage('');
    setDuplicateImportSummary(null);
  }

  async function handlePickBatch(batchId: string) {
    if (!library) {
      return;
    }

    const batchSongs = getSongsForBatch(library, batchId);

    if (batchSongs.length === 0) {
      return;
    }

    // Resume existing session or create fresh
    const existingSession = batchSessions[batchId];
    const session = existingSession ?? createPickerState(batchSongs);
    safeSetItem(PICKER_STORAGE_KEY, serializePickerState(session));
    saveBatchSession(batchId, session);
    setBatchSessions(loadBatchSessions());
    await savePickerStateForCurrentUser(session);
    router.push(`/${locale}/pick?batch=${encodeURIComponent(batchId)}`);
  }

  function handleResetBatch(batchId: string) {
    if (!library) {
      return;
    }

    if (!window.confirm(t('batchConfirmReset'))) {
      return;
    }

    const batchSongs = getSongsForBatch(library, batchId);
    const freshSession = createPickerState(batchSongs);
    saveBatchSession(batchId, freshSession);
    setBatchSessions(loadBatchSessions());
  }

  async function signOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setDisplayName(null);
  }

  async function handleImport() {
    setMessage('');
    setDuplicateImportSummary(null);

    const manualSongs = normalizeSongs(text);

    if ((activeSource === 'manual' && manualSongs.length === 0) || (activeSource !== 'manual' && !url.trim() && manualSongs.length === 0)) {
      setStatus('error');
      setMessage(t('emptyHint'));
      return;
    }

    setStatus('loading');

    try {
      let importedSongs: ImportedSong[] = [];
      const controller = new AbortController();

      if (activeSource !== 'manual' && url.trim()) {
        const timeout = window.setTimeout(() => controller.abort(), 20000);

        try {
          const response = await fetch(`/api/import/${activeSource}`, {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({url}),
            signal: controller.signal
          });
          const payload = (await response.json()) as {songs?: ImportedSong[]; error?: string};

          if (!response.ok) {
            throw new Error(payload.error ?? 'Import failed');
          }

          importedSongs = payload.songs ?? [];
        } finally {
          window.clearTimeout(timeout);
        }
      }

      const nextSongs = [...importedSongs, ...manualSongs];
      const batchLabel = activeSource === 'manual' ? t('manualBatchLabel') : activeSource === 'spotify' ? 'Spotify' : activeSource === 'netease' ? 'NetEase' : 'QQ Music';

      const currentLib = library ?? createLibrary();
      const libResult = addSongsToLibrary(currentLib, nextSongs, batchLabel);
      safeSetItem(LIBRARY_STORAGE_KEY, serializeLibrary(libResult.library));
      setLibrary(libResult.library);
      void saveLibraryForCurrentUser(libResult.library);

      // Create a fresh batch session for the newly imported batch
      const newBatch = libResult.library.batches[libResult.library.batches.length - 1];

      if (newBatch && libResult.added > 0) {
        const batchSongs = getSongsForBatch(libResult.library, newBatch.id);
        const freshBatchState = createPickerState(batchSongs);
        saveBatchSession(newBatch.id, freshBatchState);
        setBatchSessions(loadBatchSessions());

        // Also set as active picker state
        safeSetItem(PICKER_STORAGE_KEY, serializePickerState(freshBatchState));
        await saveImportedDeckForCurrentUser(batchSongs);
        setSongs(batchSongs);
      }

      setStatus('done');
      setDuplicateImportSummary(libResult.duplicatesSkipped > 0
        ? {added: libResult.added, skipped: libResult.duplicatesSkipped, total: libResult.library.songs.length}
        : null);
      setMessage(libResult.duplicatesSkipped > 0
        ? t('importedWithDuplicates', {added: libResult.added, skipped: libResult.duplicatesSkipped, total: libResult.library.songs.length})
        : t('imported', {count: libResult.added}));
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof DOMException && error.name === 'AbortError' ? t('timeoutError') : error instanceof Error ? error.message : 'Import failed');
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-5 py-5 text-white sm:px-8 lg:px-12">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:52px_52px] [mask-image:radial-gradient(circle_at_center,black,transparent_72%)]" />
      <div className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-karaoke/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-28 top-44 h-80 w-80 rounded-full bg-karaoke-cyan/10 blur-3xl" />

      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between gap-2 rounded-full border border-hairline-strong bg-white/[0.03] px-3 py-3 backdrop-blur-xl sm:px-4">
        <Link href={`/${locale}`} className="flex min-w-0 items-center gap-2 font-display text-sm font-black tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-canvas">唱</span>
          <span className="hidden xs:inline sm:inline">KTV-Picker</span>
        </Link>
        <div className="flex items-center gap-2">
        {displayName ? (
          <>
            <span className="max-w-[8rem] truncate rounded-full border border-karaoke-cyan/30 bg-karaoke-cyan/10 px-2.5 py-1.5 text-xs font-black text-karaoke-cyan sm:max-w-none sm:px-3">
              {displayName}
            </span>
            <button type="button" onClick={signOut} className="rounded-full border border-hairline-strong px-2.5 py-1.5 text-xs text-ink-soft transition hover:border-white/30 hover:bg-white/10 sm:px-3">
              {t('logout')}
            </button>
          </>
        ) : (
          <Link href={`/${locale}/login`} className="rounded-full border border-hairline-strong px-2.5 py-1.5 text-xs text-ink-soft transition hover:border-white/30 hover:bg-white/10 sm:px-3">
            {t('login')}
          </Link>
        )}
        <Link href={`/${nextLocale}`} className="rounded-full border border-hairline-strong px-2.5 py-1.5 text-xs text-ink-soft transition hover:border-white/30 hover:bg-white/10 sm:px-3">
          {t('language')}
        </Link>
        </div>
      </nav>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-10 pb-12 pt-12 lg:grid-cols-[1.04fr_0.96fr] lg:items-center lg:pb-20 lg:pt-20">
        <motion.div initial={prefersReducedMotion ? false : {opacity: 0, y: 22}} animate={{opacity: 1, y: 0}} transition={prefersReducedMotion ? {duration: 0} : {duration: 0.65}}>
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
          initial={prefersReducedMotion ? false : {opacity: 0, scale: 0.96, y: 28}}
          animate={{opacity: 1, scale: 1, y: 0}}
          transition={prefersReducedMotion ? {duration: 0} : {duration: 0.7, delay: 0.1}}
          className="rounded-[2rem] border border-hairline-strong bg-surface-card/90 p-4 shadow-glow backdrop-blur-xl sm:p-5"
        >
          <div className="rounded-[1.5rem] border border-white/10 bg-surface-elevated p-4 sm:p-5">
            <div className="flex flex-wrap gap-2">
              {(['qq', 'spotify', 'netease', 'manual'] as const).map((source) => (
                <button
                  key={source}
                  type="button"
                  onClick={() => setActiveSource(source)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-black transition ${
                    activeSource === source
                      ? 'bg-karaoke-cyan text-canvas shadow-[0_0_12px_rgba(85,230,255,0.3)]'
                      : 'border border-white/10 bg-white/[0.04] text-ink-soft hover:bg-white/[0.08]'
                  }`}
                >
                  {t(`sources.${source}.title`)}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-body-muted">{t(`sources.${activeSource}.body`)}</p>
            {activeSource !== 'manual' ? (
              <input
                id="qq-url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                disabled={status === 'loading'}
                placeholder={activeSource === 'spotify' ? t('spotifyUrlPlaceholder') : activeSource === 'netease' ? t('neteaseUrlPlaceholder') : t('urlPlaceholder')}
                className="mt-3 h-12 w-full rounded-2xl border border-hairline-strong bg-black/35 px-4 text-sm text-white outline-none transition placeholder:text-body-muted focus:border-karaoke/70 focus:shadow-[0_0_0_4px_rgba(255,61,139,0.12)]"
              />
            ) : null}

            <label className="mt-4 block text-sm font-semibold text-ink-soft" htmlFor="song-text">
              {t('textLabel')}
            </label>
            <textarea
              id="song-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              disabled={status === 'loading'}
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
                {status === 'loading' ? t('importing') : t('importButton')}
              </button>
              <button
                type="button"
                onClick={() => setText(sampleSongs)}
                disabled={status === 'loading'}
                className="h-12 rounded-2xl border border-hairline-strong px-5 text-sm font-semibold text-ink-soft transition hover:border-white/25 hover:bg-white/10"
              >
                {t('sampleButton')}
              </button>
            </div>

            {message ? (
              <p className={`mt-3 text-sm ${status === 'error' ? 'text-karaoke' : 'text-karaoke-cyan'}`}>{message}</p>
            ) : null}
            {duplicateImportSummary ? (
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl border border-karaoke-cyan/20 bg-black/30 p-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-body-muted">{t('importSummaryAdded')}</p>
                  <p className="mt-1 text-lg font-black text-white">{duplicateImportSummary.added}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-body-muted">{t('importSummarySkippedDuplicates')}</p>
                  <p className="mt-1 text-lg font-black text-karaoke">{duplicateImportSummary.skipped}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-body-muted">{t('importSummaryTotal')}</p>
                  <p className="mt-1 text-lg font-black text-karaoke-cyan">{duplicateImportSummary.total}</p>
                </div>
              </div>
            ) : null}
            {status === 'done' ? (
              <div className="mt-2 rounded-2xl border border-karaoke-cyan/20 bg-karaoke-cyan/10 p-3">
                <p className="text-xs leading-5 text-ink-soft">{t('nextAfterImport')}</p>
                <button
                  type="button"
                  onClick={() => {
                    const lastBatch = library?.batches[library.batches.length - 1];
                    const batchParam = lastBatch ? `?batch=${encodeURIComponent(lastBatch.id)}` : '';
                    router.push(`/${locale}/pick${batchParam}`);
                  }}
                  className="mt-3 h-11 w-full rounded-xl bg-karaoke-cyan text-sm font-black text-canvas transition hover:scale-[1.01]"
                >
                  {t('startPicking')}
                </button>
              </div>
            ) : null}
            {status === 'loading' ? <ImportLoadingPanel loadingSteps={loadingSteps} title={t('loadingTitle')} body={t('loadingBody')} /> : null}
          </div>

          <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-surface-elevated p-4 sm:p-5">
            <p className="text-sm font-semibold text-ink-soft">{t('quickAddTitle')}</p>
            <div className="mt-2 grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                value={quickAddTitle}
                onChange={(event) => setQuickAddTitle(event.target.value)}
                placeholder={t('quickAddTitlePlaceholder')}
                className="h-10 min-w-0 rounded-xl border border-hairline-strong bg-black/35 px-3 text-sm text-white outline-none transition placeholder:text-body-muted focus:border-karaoke-cyan/70 sm:col-span-1"
              />
              <input
                value={quickAddArtist}
                onChange={(event) => setQuickAddArtist(event.target.value)}
                placeholder={t('quickAddArtistPlaceholder')}
                className="col-start-1 h-10 min-w-0 rounded-xl border border-hairline-strong bg-black/35 px-3 text-sm text-white outline-none transition placeholder:text-body-muted focus:border-karaoke-cyan/70 sm:col-start-auto sm:row-start-auto"
              />
              <button
                type="button"
                onClick={handleQuickAdd}
                disabled={!quickAddTitle.trim() || !quickAddArtist.trim()}
                aria-label={t('quickAddAria')}
                className="row-span-2 grid h-full min-h-10 w-10 place-items-center self-stretch rounded-xl bg-karaoke-cyan text-sm font-black text-canvas transition hover:scale-105 disabled:opacity-40 sm:row-span-1"
              >
                +
              </button>
            </div>
            {quickAddMessage ? (
              <p className={`mt-2 text-xs ${quickAddStatus === 'success' ? 'text-karaoke-cyan' : 'text-body-muted'}`}>{quickAddMessage}</p>
            ) : null}
          </div>

          <LibraryPanel
            library={library}
            savedLikedSongs={savedLikedSongs}
            importBatches={importBatches}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            librarySearch={librarySearch}
            setLibrarySearch={setLibrarySearch}
            queueLimit={queueLimit}
            setQueueLimit={setQueueLimit}
            generateLandingQueue={generateLandingQueue}
            pickLandingRandomSong={pickLandingRandomSong}
            randomSong={randomSong}
            generatedQueue={generatedQueue}
            queueText={queueText}
            queueCardRef={queueCardRef}
            handleCopyQueueText={handleCopyQueueText}
            exportMessage={exportMessage}
            handleSaveQueueImage={handleSaveQueueImage}
            handleRemovePickedSong={handleRemovePickedSong}
            batchSessions={batchSessions}
            expandedBatches={expandedBatches}
            setExpandedBatches={setExpandedBatches}
            handleDeleteBatch={handleDeleteBatch}
            handlePickBatch={handlePickBatch}
            handleResetBatch={handleResetBatch}
            handleRemoveSongFromBatch={handleRemoveSongFromBatch}
            libraryExpanded={libraryExpanded}
            setLibraryExpanded={setLibraryExpanded}
          />
        </motion.div>
      </section>

    </main>
  );
}
