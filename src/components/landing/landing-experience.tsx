'use client';

import {motion} from 'framer-motion';
import {useLocale, useTranslations} from 'next-intl';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect, useMemo, useState} from 'react';
import {getUserDisplayName} from '@/lib/auth/profile';
import {normalizeSongs} from '@/lib/importers/manual';
import type {ImportedSong} from '@/lib/importers/qq';
import {loadLatestPickerStateForCurrentUser, saveImportedDeckForCurrentUser, saveLibraryForCurrentUser, savePickerStateForCurrentUser, chooseSyncedLibrary, loadLibraryForCurrentUser} from '@/lib/picker/persistence';
import {generateSingingOrder, pickRandomSong} from '@/lib/picker/queue';
import {addSongsToLibrary, createLibrary, deserializeLibrary, getSongsForBatch, LIBRARY_STORAGE_KEY, migrateFromLegacyPickerState, quickAddPickedSong, removeSongFromLibrary, removeBatchFromLibrary, serializeLibrary, type ImportBatch, type SongLibrary} from '@/lib/picker/library';
import {appendSongsToSession, chooseSyncedPickerState, createPickerState, deserializePickerState, PICKER_STORAGE_KEY, serializePickerState} from '@/lib/picker/session';
import {supabase} from '@/lib/supabase';

const sampleSongs = '青花瓷 - 周杰伦\n后来 - 刘若英\n修炼爱情 - 林俊杰\n倔强 - 五月天';
type ImportSource = 'qq' | 'spotify' | 'manual';

export function LandingExperience() {
  const t = useTranslations('landing');
  const locale = useLocale();
  const router = useRouter();
  const nextLocale = locale === 'zh' ? 'en' : 'zh';
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [activeSource, setActiveSource] = useState<ImportSource>('qq');
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [songs, setSongs] = useState<ImportedSong[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [hasSavedProgress, setHasSavedProgress] = useState(false);
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
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'picked' | string>('all');
  const [libraryExpanded, setLibraryExpanded] = useState(true);
  const steps = t.raw('steps') as string[];
  const loadingSteps = t.raw('loadingSteps') as string[];

  const filteredLibrarySongs = useMemo(() => {
    if (!library) {
      return [];
    }

    if (libraryFilter === 'picked') {
      return library.pickedSongs;
    }

    if (libraryFilter !== 'all') {
      return getSongsForBatch(library, libraryFilter);
    }

    return library.songs;
  }, [library, libraryFilter]);

  useEffect(() => {
    let isMounted = true;

    async function loadSavedProgress() {
      const localState = deserializePickerState(window.localStorage.getItem(PICKER_STORAGE_KEY));
      const remoteSession = await loadLatestPickerStateForCurrentUser();
      const savedState = chooseSyncedPickerState(localState, remoteSession?.state ?? null);

      if (!isMounted) {
        return;
      }

      if (savedState) {
        window.localStorage.setItem(PICKER_STORAGE_KEY, serializePickerState(savedState));
        setHasSavedProgress(savedState.currentIndex > 0 || savedState.liked.length > 0 || savedState.skipped.length > 0);
      }

      const localLib = deserializeLibrary(window.localStorage.getItem(LIBRARY_STORAGE_KEY));
      const remoteLib = await loadLibraryForCurrentUser();
      let lib = chooseSyncedLibrary(localLib, remoteLib);

      if (!lib && savedState) {
        const legacyBatches = ((savedState as unknown as Record<string, unknown>).importBatches ?? []) as ImportBatch[];
        lib = migrateFromLegacyPickerState(savedState.defaultDeck, legacyBatches, savedState.liked);
      }

      if (lib) {
        window.localStorage.setItem(LIBRARY_STORAGE_KEY, serializeLibrary(lib));
        setLibrary(lib);
      }
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
      setQuickAddMessage(t('quickAddDuplicate'));
      return;
    }

    window.localStorage.setItem(LIBRARY_STORAGE_KEY, serializeLibrary(result.library));
    setLibrary(result.library);
    void saveLibraryForCurrentUser(result.library);
    setQuickAddTitle('');
    setQuickAddArtist('');
    setQuickAddMessage(t('quickAddSuccess', {title}));
  }

  function handleDeleteSong(song: ImportedSong) {
    const currentLib = library ?? createLibrary();
    const updated = removeSongFromLibrary(currentLib, song);
    window.localStorage.setItem(LIBRARY_STORAGE_KEY, serializeLibrary(updated));
    setLibrary(updated);
    void saveLibraryForCurrentUser(updated);
  }

  function handleDeleteBatch(batchId: string) {
    const currentLib = library ?? createLibrary();
    const updated = removeBatchFromLibrary(currentLib, batchId);
    window.localStorage.setItem(LIBRARY_STORAGE_KEY, serializeLibrary(updated));
    setLibrary(updated);
    void saveLibraryForCurrentUser(updated);

    if (libraryFilter === batchId) {
      setLibraryFilter('all');
    }
  }

  function handleStartFresh() {
    window.localStorage.removeItem(PICKER_STORAGE_KEY);
    setSongs([]);
    setHasSavedProgress(false);
    setGeneratedQueue([]);
    setRandomSong(null);
    setStatus('idle');
    setMessage('');
  }

  function handleClearLibrary() {
    window.localStorage.removeItem(PICKER_STORAGE_KEY);
    window.localStorage.removeItem(LIBRARY_STORAGE_KEY);
    const emptyLib = {songs: [], batches: [], pickedSongs: [], updatedAt: new Date().toISOString()};
    void saveLibraryForCurrentUser(emptyLib);
    setLibrary(null);
    setSongs([]);
    setHasSavedProgress(false);
    setGeneratedQueue([]);
    setRandomSong(null);
    setStatus('idle');
    setMessage('');
  }

  async function handlePickBatch(batchId: string) {
    if (!library) {
      return;
    }

    const batchSongs = batchId === '__all__' ? library.songs : getSongsForBatch(library, batchId);

    if (batchSongs.length === 0) {
      return;
    }

    const freshSession = createPickerState(batchSongs);
    window.localStorage.setItem(PICKER_STORAGE_KEY, serializePickerState(freshSession));
    await savePickerStateForCurrentUser(freshSession);
    router.push(`/${locale}/pick`);
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
      const timeout = window.setTimeout(() => controller.abort(), 20000);

      if (activeSource !== 'manual' && url.trim()) {
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
      const batchLabel = activeSource === 'manual' ? t('manualBatchLabel') : activeSource === 'spotify' ? 'Spotify' : 'QQ Music';

      const currentLib = library ?? createLibrary();
      const libResult = addSongsToLibrary(currentLib, nextSongs, batchLabel);
      window.localStorage.setItem(LIBRARY_STORAGE_KEY, serializeLibrary(libResult.library));
      setLibrary(libResult.library);
      void saveLibraryForCurrentUser(libResult.library);

      const localState = deserializePickerState(window.localStorage.getItem(PICKER_STORAGE_KEY));
      const remoteSession = await loadLatestPickerStateForCurrentUser();
      const savedState = chooseSyncedPickerState(localState, remoteSession?.state ?? null);
      const savedStateHasProgress = savedState ? savedState.currentIndex > 0 || savedState.liked.length > 0 || savedState.skipped.length > 0 : false;

      if (savedState?.deck.length && savedStateHasProgress) {
        const updatedSession = appendSongsToSession(savedState, nextSongs);
        window.localStorage.setItem(PICKER_STORAGE_KEY, serializePickerState(updatedSession));
        await savePickerStateForCurrentUser(updatedSession);
        setSongs(updatedSession.deck);
        setHasSavedProgress(true);
      } else {
        const freshState = createPickerState(libResult.library.songs);
        window.localStorage.setItem(PICKER_STORAGE_KEY, serializePickerState(freshState));
        await saveImportedDeckForCurrentUser(libResult.library.songs);
        setSongs(libResult.library.songs);
        setHasSavedProgress(false);
      }

      setStatus('done');
      setMessage(libResult.duplicatesSkipped > 0
        ? t('importedWithDuplicates', {added: libResult.added, skipped: libResult.duplicatesSkipped, total: libResult.library.songs.length})
        : libResult.added < nextSongs.length || savedState?.deck.length
          ? t('importedMerged', {added: libResult.added, total: libResult.library.songs.length})
          : t('imported', {count: nextSongs.length}));
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
          {hasSavedProgress ? (
            <div className="mt-5 rounded-3xl border border-karaoke-cyan/25 bg-karaoke-cyan/10 p-4 sm:max-w-lg">
              <p className="text-sm text-ink-soft">{t('savedProgress')}</p>
              {savedLikedSongs.length ? (
                <div className="mt-3 space-y-2">
                  {savedLikedSongs.slice(0, 3).map((song, index) => (
                    <div key={`${song.title}-${song.artist}-${index}`} className="rounded-2xl border border-karaoke-cyan/20 bg-black/20 px-3 py-2">
                      <p className="text-sm font-bold text-white">{song.title}</p>
                      <p className="text-xs text-body-muted">{song.artist}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => router.push(`/${locale}/pick`)} className="h-11 rounded-2xl bg-karaoke-cyan px-5 text-sm font-black text-canvas">
                  {t('resumePicking')}
                </button>
                <button type="button" onClick={() => router.push(`/${locale}/pick?view=queue`)} className="h-11 rounded-2xl border border-karaoke-cyan/25 bg-white/[0.04] px-5 text-sm font-black text-karaoke-cyan">
                  {t('viewQueue')}
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" onClick={handleStartFresh} className="h-10 rounded-2xl border border-karaoke/25 bg-karaoke/10 text-xs font-black text-karaoke transition hover:bg-karaoke/20">
                  {t('startFresh')}
                </button>
                <button type="button" onClick={handleClearLibrary} className="h-10 rounded-2xl border border-white/15 bg-white/[0.04] text-xs font-black text-body-muted transition hover:border-karaoke/30 hover:bg-karaoke/10 hover:text-karaoke">
                  {t('clearLibrary')}
                </button>
              </div>
            </div>
          ) : null}
        </motion.div>

        <motion.div
          initial={{opacity: 0, scale: 0.96, y: 28}}
          animate={{opacity: 1, scale: 1, y: 0}}
          transition={{duration: 0.7, delay: 0.1}}
          className="rounded-[2rem] border border-hairline-strong bg-surface-card/90 p-4 shadow-glow backdrop-blur-xl sm:p-5"
        >
          <div className="rounded-[1.5rem] border border-white/10 bg-surface-elevated p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-semibold text-ink-soft" htmlFor="qq-url">
                {activeSource === 'manual' ? t('manualSourceTitle') : activeSource === 'spotify' ? t('spotifyUrlLabel') : activeSource === 'qq' ? t('urlLabel') : t('urlLabel')}
              </label>
              <button type="button" onClick={() => setShowSourcePicker(true)} className="rounded-full border border-karaoke-cyan/25 bg-karaoke-cyan/10 px-3 py-1.5 text-xs font-black text-karaoke-cyan">
                {t('chooseSource')}
              </button>
            </div>
            {activeSource !== 'manual' ? (
              <input
                id="qq-url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                disabled={status === 'loading'}
                placeholder={activeSource === 'spotify' ? t('spotifyUrlPlaceholder') : t('urlPlaceholder')}
                className="mt-2 h-12 w-full rounded-2xl border border-hairline-strong bg-black/35 px-4 text-sm text-white outline-none transition placeholder:text-body-muted focus:border-karaoke/70 focus:shadow-[0_0_0_4px_rgba(255,61,139,0.12)]"
              />
            ) : null}
            {activeSource === 'spotify' ? <p className="mt-2 text-xs leading-5 text-body-muted">{t('spotifyExperimental')}</p> : null}

            <label className="mt-5 block text-sm font-semibold text-ink-soft" htmlFor="song-text">
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
            {status === 'done' ? (
              <div className="mt-2 rounded-2xl border border-karaoke-cyan/20 bg-karaoke-cyan/10 p-3">
                <p className="text-xs leading-5 text-ink-soft">{t('nextAfterImport')}</p>
                <button
                  type="button"
                  onClick={() => router.push(`/${locale}/pick`)}
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
                className="row-span-2 grid h-full min-h-10 w-10 place-items-center self-stretch rounded-xl bg-karaoke-cyan text-sm font-black text-canvas transition hover:scale-105 disabled:opacity-40 sm:row-span-1"
              >
                +
              </button>
            </div>
            {quickAddMessage ? (
              <p className={`mt-2 text-xs ${quickAddMessage.includes('!') ? 'text-karaoke-cyan' : 'text-body-muted'}`}>{quickAddMessage}</p>
            ) : null}
          </div>

          <div className="mt-4 rounded-[1.5rem] border border-hairline-strong bg-black/30 p-4">
            <div className="mb-3 flex items-center justify-between">
              <button type="button" onClick={() => setLibraryExpanded((v) => !v)} className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white">{t('libraryTitle')}</h2>
                {library && library.songs.length > 0 ? (
                  <span className="rounded-full bg-karaoke-cyan/15 px-2 py-0.5 text-[10px] font-black text-karaoke-cyan">
                    {t('librarySongCount', {count: library.songs.length})}
                  </span>
                ) : null}
                {savedLikedSongs.length > 0 ? (
                  <span className="rounded-full bg-karaoke/15 px-2 py-0.5 text-[10px] font-black text-karaoke">
                    {t('libraryPickedCount', {count: savedLikedSongs.length})}
                  </span>
                ) : null}
              </button>
              <button type="button" onClick={() => setLibraryExpanded((v) => !v)} className="text-xs text-body-muted">
                {libraryExpanded ? '▲' : '▼'}
              </button>
            </div>
            {libraryExpanded ? (
              <>
                {library && (library.songs.length > 0 || savedLikedSongs.length > 0) ? (
                  <>
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => setLibraryFilter('all')} className={`rounded-full px-3 py-1.5 text-[10px] font-black transition ${libraryFilter === 'all' ? 'bg-white text-canvas' : 'border border-white/10 bg-white/[0.04] text-ink-soft'}`}>
                        {t('libraryFilterAll')}
                      </button>
                      {savedLikedSongs.length > 0 ? (
                        <button type="button" onClick={() => setLibraryFilter('picked')} className={`rounded-full px-3 py-1.5 text-[10px] font-black transition ${libraryFilter === 'picked' ? 'bg-karaoke text-white' : 'border border-karaoke/20 bg-karaoke/10 text-karaoke'}`}>
                          {t('libraryFilterPicked')} ({savedLikedSongs.length})
                        </button>
                      ) : null}
                      {importBatches.map((batch) => (
                        <button key={batch.id} type="button" onClick={() => setLibraryFilter(batch.id)} className={`group flex items-center gap-1 rounded-full px-3 py-1.5 text-[10px] font-black transition ${libraryFilter === batch.id ? 'bg-karaoke-cyan text-canvas' : 'border border-white/10 bg-white/[0.04] text-ink-soft'}`}>
                          <span>{batch.label} · {batch.songCount}</span>
                          <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); handleDeleteBatch(batch.id); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleDeleteBatch(batch.id); } }} className="ml-0.5 hidden rounded-full hover:bg-white/20 group-hover:inline-block">✕</span>
                        </button>
                      ))}
                    </div>

                    {savedLikedSongs.length > 0 ? (
                      <div className="mb-3 rounded-2xl border border-karaoke-cyan/20 bg-karaoke-cyan/10 p-3">
                        <p className="text-xs leading-5 text-ink-soft">{t('selectedCount', {count: savedLikedSongs.length})}</p>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {(['all', 5, 10] as const).map((limit) => (
                            <button key={limit} type="button" onClick={() => setQueueLimit(limit)} className={`h-9 rounded-xl text-xs font-black transition ${queueLimit === limit ? 'bg-white text-canvas' : 'border border-white/10 bg-white/[0.04] text-ink-soft'}`}>
                              {limit === 'all' ? t('queueLimitAll') : limit}
                            </button>
                          ))}
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button type="button" onClick={generateLandingQueue} className="h-10 rounded-xl bg-karaoke-cyan text-xs font-black text-canvas">
                            {t('generateQueue')}
                          </button>
                          <button type="button" onClick={pickLandingRandomSong} className="h-10 rounded-xl bg-white text-xs font-black text-canvas">
                            {t('pickOneRandom')}
                          </button>
                        </div>
                        {randomSong ? (
                          <div className="mt-3 rounded-2xl border border-karaoke/30 bg-karaoke/10 px-3 py-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-karaoke">{t('nextSong')}</p>
                            <p className="mt-1 text-sm font-black text-white">{randomSong.title}</p>
                            <p className="text-xs text-body-muted">{randomSong.artist}</p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {generatedQueue.length > 0 ? (
                      <div className="mb-3 space-y-2">
                        {generatedQueue.map((song, index) => (
                          <div key={`q-${song.title}-${song.artist}-${index}`} className="flex items-center justify-between rounded-2xl border border-karaoke-cyan/15 bg-karaoke-cyan/5 px-3 py-3">
                            <div>
                              <p className="text-sm font-bold text-white"><span className="mr-2 text-karaoke-cyan">#{index + 1}</span>{song.title}</p>
                              <p className="text-xs text-body-muted">{song.artist}</p>
                            </div>
                            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-ink-soft">{song.platform}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="max-h-[320px] space-y-2 overflow-y-auto">
                      {filteredLibrarySongs.map((song, index) => (
                        <div key={`${song.title}-${song.artist}-${index}`} className="group flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.035] px-3 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-white">{song.title}</p>
                            <p className="text-xs text-body-muted">{song.artist}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-ink-soft">{song.platform}</span>
                            <button type="button" onClick={() => handleDeleteSong(song)} className="hidden rounded-full border border-karaoke/20 bg-karaoke/10 px-2 py-1 text-[10px] font-black text-karaoke transition hover:bg-karaoke/20 group-hover:block">
                              {t('libraryDeleteSong')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {library && library.songs.length > 0 ? (
                      <button type="button" onClick={() => void handlePickBatch('__all__')} className="mt-3 h-11 w-full rounded-xl bg-karaoke-cyan text-sm font-black text-canvas transition hover:scale-[1.01]">
                        {t('libraryPickAll')}
                      </button>
                    ) : null}
                  </>
                ) : (
                  <p className="text-xs leading-5 text-body-muted">{t('libraryEmpty')}</p>
                )}
              </>
            ) : null}
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
      {showSourcePicker ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-hairline-strong bg-surface-card p-5 shadow-glow">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-black tracking-[-0.05em]">{t('sourcePickerTitle')}</h2>
              <button type="button" onClick={() => setShowSourcePicker(false)} className="rounded-full border border-white/10 px-3 py-1 text-xs text-ink-soft">
                {t('close')}
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              {(['qq', 'spotify', 'manual'] as const).map((source) => (
                <button
                  key={source}
                  type="button"
                  onClick={() => {
                    setActiveSource(source);
                    setShowSourcePicker(false);
                  }}
                  className={`rounded-3xl border p-4 text-left transition ${activeSource === source ? 'border-karaoke-cyan/50 bg-karaoke-cyan/10' : 'border-white/10 bg-white/[0.04]'}`}
                >
                  <span className="block text-sm font-black text-white">{t(`sources.${source}.title`)}</span>
                  <span className="mt-1 block text-xs leading-5 text-body-muted">{t(`sources.${source}.body`)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ImportLoadingPanel({loadingSteps, title, body}: {loadingSteps: string[]; title: string; body: string}) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-karaoke/20 bg-karaoke/10 p-4">
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full w-1/2 rounded-full bg-gradient-to-r from-karaoke to-karaoke-cyan"
          animate={{x: ['-100%', '220%']}}
          transition={{duration: 1.45, repeat: Infinity, ease: 'easeInOut'}}
        />
      </div>
      <p className="mt-3 text-sm font-black text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-body-muted">{body}</p>
      <div className="mt-3 grid gap-2">
        {loadingSteps.map((step, index) => (
          <div key={step} className="flex items-center gap-2 text-xs text-ink-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-karaoke-cyan" style={{opacity: 1 - index * 0.2}} />
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}
