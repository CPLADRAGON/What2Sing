'use client';

import {AnimatePresence, animate, motion, useMotionValue, useTransform, type PanInfo} from 'framer-motion';
import {useLocale, useTranslations} from 'next-intl';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createLibrary, deserializeLibrary, LIBRARY_STORAGE_KEY, removePickedSongFromLibrary, serializeLibrary, syncPickedSongsToLibrary, type SongLibrary} from '@/lib/picker/library';
import type {ImportedSong} from '@/lib/importers/qq';
import {chooseSyncedLibrary, loadLatestPickerStateForCurrentUser, loadLibraryForCurrentUser, saveLibraryForCurrentUser, savePickerStateForCurrentUser} from '@/lib/picker/persistence';
import {generateSingingOrder, pickRandomSong} from '@/lib/picker/queue';
import {
  canEnterSelectionMode,
  chooseCurrentSong,
  chooseSyncedPickerState,
  createPickerState,
  deserializePickerState,
  finishPickerQueue,
  getCurrentSong,
  isPickerComplete,
  PICKER_STORAGE_KEY,
  reorderRemainingSongs,
  restartWithUnselectedSongs,
  saveBatchSession,
  serializePickerState,
  type PickerDecision,
  type PickerOrderMode,
  type PickerState
} from '@/lib/picker/session';

export function PickerExperience() {
  const t = useTranslations('picker');
  const locale = useLocale();
  const router = useRouter();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-24, 0, 24]);
  const scale = useTransform(x, [-200, 0, 200], [1.08, 1, 1.08]);
  const dragLift = useTransform(x, [-200, 0, 200], [-22, 0, -22]);
  const bgWashSkip = useTransform(x, [-180, -30, 0], [0.22, 0, 0]);
  const bgWashLike = useTransform(x, [0, 30, 180], [0, 0, 0.22]);
  const cardGlow = useTransform(x, [-180, 0, 180], ['0 24px 90px rgba(255,61,139,0.30)', '0 18px 70px rgba(0,0,0,0.35)', '0 24px 90px rgba(85,230,255,0.30)']);
  const stageGlowOpacity = useTransform(x, [-180, 0, 180], [0.5, 0, 0.5]);
  const stageGlowX = useTransform(x, [-180, 0, 180], ['-24%', '0%', '24%']);
  const likeOpacity = useTransform(x, [24, 120], [0, 1]);
  const skipOpacity = useTransform(x, [-120, -24], [1, 0]);
  const likeScale = useTransform(x, [24, 150], [0.92, 1.12]);
  const skipScale = useTransform(x, [-150, -24], [1.12, 0.92]);
  const directionCueOpacity = useTransform(x, [-160, -24, 0, 24, 160], [0.42, 0.14, 0, 0.14, 0.42]);
  const [state, setState] = useState<PickerState | null>(null);
  const [needsOrderChoice, setNeedsOrderChoice] = useState(true);
  const [viewMode, setViewMode] = useState<'swipe' | 'selection'>('swipe');
  const [swipeDirection, setSwipeDirection] = useState<1 | -1 | 0>(0);
  const [saveMessage, setSaveMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isSwipeLocked, setIsSwipeLocked] = useState(false);
  const [isShufflingDeck, setIsShufflingDeck] = useState(false);
  const [shuffleAnimationKey, setShuffleAnimationKey] = useState(0);
  const [feedbackMessage, setFeedbackMessage] = useState<{label: string; tone: 'like' | 'skip'; id: number} | null>(null);
  const flingRef = useRef<ReturnType<typeof animate> | null>(null);
  const lastHapticThreshold = useRef(0);
  const activeBatchId = useRef<string | null>(null);
  const [library, setLibrary] = useState<SongLibrary | null>(null);
  const loaded = state !== null;
  const safeState = state ?? createPickerState([]);
  const currentSong = getCurrentSong(safeState);
  const currentSongKey = currentSong ? `${currentSong.title}-${currentSong.artist}-${currentSong.platform}-${safeState.currentIndex}` : 'complete';
  const complete = isPickerComplete(safeState);
  const progress = safeState.deck.length ? Math.min(100, Math.round((safeState.currentIndex / safeState.deck.length) * 100)) : 0;

  useEffect(() => {
    let isMounted = true;
    const params = new URLSearchParams(window.location.search);
    const queueViewTimer = params.get('view') === 'queue'
      ? window.setTimeout(() => setViewMode('selection'), 0)
      : null;
    const batchParam = params.get('batch');

    if (batchParam) {
      activeBatchId.current = batchParam;
    }

    async function loadSavedProgress() {
      const raw = window.localStorage.getItem(PICKER_STORAGE_KEY);
      const localState = deserializePickerState(raw);

      if (isMounted) {
        setState(localState ?? createPickerState([]));
        setNeedsOrderChoice(isRawImportDeck(raw));
      }

      const remoteSession = await loadLatestPickerStateForCurrentUser();

      if (!isMounted || !remoteSession) {
        if (isMounted) {
          const rawLib = window.localStorage.getItem(LIBRARY_STORAGE_KEY);
          const lib = deserializeLibrary(rawLib);

          if (lib) {
            setLibrary(lib);
          }
        }

        return;
      }

      const syncedState = chooseSyncedPickerState(localState, remoteSession.state) ?? createPickerState([]);
      window.localStorage.setItem(PICKER_STORAGE_KEY, serializePickerState(syncedState));
      setState(syncedState);
      setNeedsOrderChoice(false);

      const localLib = deserializeLibrary(window.localStorage.getItem(LIBRARY_STORAGE_KEY));
      const remoteLib = await loadLibraryForCurrentUser();
      let lib = chooseSyncedLibrary(localLib, remoteLib);

      if (!lib && syncedState.deck.length > 0) {
        const legacyBatches = (syncedState as PickerState & {importBatches?: unknown[]}).importBatches ?? [];
        lib = {songs: syncedState.defaultDeck, batches: legacyBatches as SongLibrary['batches'], pickedSongs: syncedState.liked, updatedAt: syncedState.updatedAt};
      }

      if (lib) {
        window.localStorage.setItem(LIBRARY_STORAGE_KEY, serializeLibrary(lib));
        setLibrary(lib);
      }
    }

    void loadSavedProgress();

    return () => {
      isMounted = false;
      if (queueViewTimer) {
        window.clearTimeout(queueViewTimer);
      }
    };
  }, []);

  useEffect(() => {
    if (needsOrderChoice) {
      return;
    }

    const interval = window.setInterval(() => {
      if (isDragging || isSwipeLocked || isShufflingDeck) {
        return;
      }

      void loadLatestPickerStateForCurrentUser().then((remoteSession) => {
        if (!remoteSession) {
          return;
        }

        setState((current) => {
          if (!current || current.deck.length === 0) {
            return current;
          }

          const syncedState = chooseSyncedPickerState(current, remoteSession.state);

          if (!syncedState || syncedState === current) {
            return current;
          }

          if (syncedState.deck.length === 0 && current.deck.length > 0) {
            return current;
          }

          window.localStorage.setItem(PICKER_STORAGE_KEY, serializePickerState(syncedState));
          return syncedState;
        });
      });
    }, 15000);

    return () => window.clearInterval(interval);
  }, [isDragging, isShufflingDeck, isSwipeLocked, needsOrderChoice]);

  const stopFlingAndReset = useCallback(() => {
    if (flingRef.current) {
      flingRef.current.stop();
      flingRef.current = null;
    }

    x.set(0);
  }, [x]);

  useEffect(() => {
    if (!state || needsOrderChoice || state.deck.length === 0) {
      return;
    }

    window.localStorage.setItem(PICKER_STORAGE_KEY, serializePickerState(state));
    void savePickerStateForCurrentUser(state);

    if (activeBatchId.current) {
      saveBatchSession(activeBatchId.current, state);
    }

    if (state.liked.length > 0) {
      const rawLib = window.localStorage.getItem(LIBRARY_STORAGE_KEY);
      const currentLib = deserializeLibrary(rawLib) ?? createLibrary();
      const updatedLib = syncPickedSongsToLibrary(currentLib, state.liked);
      window.localStorage.setItem(LIBRARY_STORAGE_KEY, serializeLibrary(updatedLib));
      void saveLibraryForCurrentUser(updatedLib);
    }
  }, [needsOrderChoice, state]);

  const nextSongs = useMemo(() => safeState.deck.slice(safeState.currentIndex + 1, safeState.currentIndex + 4), [safeState]);
  const isDealing = isSwipeLocked && !isDragging;
  const deckLift = isDragging ? 12 : 18;
  const deckScaleStep = isDragging ? 0.025 : 0.035;
  const deckOpacityBase = isDragging ? 0.72 : 0.58;

  const allPickedSongs = useMemo(() => {
    const libPicks = library?.pickedSongs ?? [];
    const sessionPicks = safeState.liked;

    if (libPicks.length === 0) {
      return sessionPicks;
    }

    if (sessionPicks.length === 0) {
      return libPicks;
    }

    const existingKeys = new Set(libPicks.map((s) => `${s.title.trim().toLowerCase()}::${s.artist.trim().toLowerCase()}`));
    const newPicks = sessionPicks.filter((s) => !existingKeys.has(`${s.title.trim().toLowerCase()}::${s.artist.trim().toLowerCase()}`));
    return [...libPicks, ...newPicks];
  }, [library, safeState.liked]);

  const hasPickedSongs = allPickedSongs.length > 0;

  function handleRemovePick(indexToRemove: number) {
    const rawLib = window.localStorage.getItem(LIBRARY_STORAGE_KEY);
    const currentLib = deserializeLibrary(rawLib) ?? createLibrary();
    const updatedLib = removePickedSongFromLibrary(currentLib, indexToRemove);
    window.localStorage.setItem(LIBRARY_STORAGE_KEY, serializeLibrary(updatedLib));
    setLibrary(updatedLib);
    void saveLibraryForCurrentUser(updatedLib);

    const removedSong = currentLib.pickedSongs[indexToRemove];

    if (removedSong) {
      setState((current) => {
        if (!current) {
          return current;
        }

        const removedKey = `${removedSong.title.trim().toLowerCase()}::${removedSong.artist.trim().toLowerCase()}`;
        const filteredLiked = current.liked.filter((s) => `${s.title.trim().toLowerCase()}::${s.artist.trim().toLowerCase()}` !== removedKey);

        if (filteredLiked.length === current.liked.length) {
          return current;
        }

        return {...current, liked: filteredLiked, updatedAt: new Date().toISOString()};
      });
    }
  }

  function chooseMode(orderMode: PickerOrderMode) {
    const nextState = createPickerState(safeState.deck, {orderMode, seed: `${Date.now()}-${safeState.deck.length}`});
    setState(nextState);
    setNeedsOrderChoice(false);
    window.localStorage.setItem(PICKER_STORAGE_KEY, serializePickerState(nextState));
    void savePickerStateForCurrentUser(nextState);
  }

  function changeRemainingOrder(orderMode: PickerOrderMode) {
    stopFlingAndReset();
    setSwipeDirection(0);
    setIsDragging(false);
    setIsShufflingDeck(orderMode === 'random');
    setShuffleAnimationKey((current) => current + 1);
    setState((current) => (current ? reorderRemainingSongs(current, orderMode, `${Date.now()}-${current.currentIndex}-${current.deck.length}-${shuffleAnimationKey}`) : current));

    if (orderMode === 'random') {
      window.setTimeout(() => setIsShufflingDeck(false), 520);
    }
  }

  function decide(decision: PickerDecision) {
    if (isSwipeLocked || !currentSong) {
      return;
    }

    const exitDirection = decision === 'like' ? 1 : -1;
    setIsSwipeLocked(true);
    flushSync(() => setSwipeDirection(exitDirection));
    setFeedbackMessage({label: decision === 'like' ? t('pickedFeedback') : t('skippedFeedback'), tone: decision === 'like' ? 'like' : 'skip', id: Date.now()});
    vibrate(decision === 'like' ? [20, 44, 26, 44, 20] : [14, 22, 10]);
    const swipeExitDurationMs = 280;
    flingRef.current = animate(x, exitDirection * 620, {duration: swipeExitDurationMs / 1000, ease: [0.22, 1, 0.36, 1]});
    window.setTimeout(() => {
      stopFlingAndReset();
      setState((current) => (current ? chooseCurrentSong(current, decision) : current));
      setIsSwipeLocked(false);
      setSwipeDirection(0);
    }, swipeExitDurationMs);
    window.setTimeout(() => setFeedbackMessage(null), 520);
  }

  function handleDrag(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const absX = Math.abs(info.offset.x);
    const threshold = absX >= 88 ? 88 : absX >= 44 ? 44 : 0;

    if (threshold > lastHapticThreshold.current) {
      vibrate(threshold === 88 ? [18, 28, 18] : 8);
      lastHapticThreshold.current = threshold;
    }
  }

  function handleDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    setIsDragging(false);
    lastHapticThreshold.current = 0;

    if (info.offset.x > 88 || info.velocity.x > 620) {
      decide('like');
      return;
    }

    if (info.offset.x < -88 || info.velocity.x < -620) {
      decide('skip');
      return;
    }

    stopFlingAndReset();
  }

  function saveAndExit() {
    if (state) {
      window.localStorage.setItem(PICKER_STORAGE_KEY, serializePickerState(state));
    }
    setSaveMessage(t('saved'));
    router.push(`/${locale}`);
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

  if (needsOrderChoice) {
    return (
      <main className="relative grid min-h-screen place-items-center overflow-hidden bg-canvas px-5 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(85,230,255,0.18),transparent_28rem),radial-gradient(circle_at_20%_60%,rgba(255,61,139,0.18),transparent_22rem)]" />
        <section className="relative z-10 w-full max-w-md rounded-[2.25rem] border border-hairline-strong bg-surface-card/90 p-6 shadow-glow backdrop-blur-xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-karaoke-cyan">{safeState.deck.length} songs</p>
          <h1 className="mt-3 font-display text-4xl font-black leading-none tracking-[-0.06em]">{t('chooseModeTitle')}</h1>
          <p className="mt-3 text-sm leading-6 text-body-muted">{t('chooseModeBody')}</p>
          <div className="mt-6 grid gap-3">
            <button type="button" onClick={() => chooseMode('ordered')} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-left transition hover:border-karaoke-cyan/50 hover:bg-karaoke-cyan/10">
              <span className="text-lg font-black text-white">{t('orderedMode')}</span>
              <span className="mt-1 block text-sm text-body-muted">{t('orderedModeBody')}</span>
            </button>
            <button type="button" onClick={() => chooseMode('random')} className="rounded-3xl border border-karaoke/30 bg-karaoke/10 p-5 text-left transition hover:bg-karaoke/20">
              <span className="text-lg font-black text-white">{t('randomMode')}</span>
              <span className="mt-1 block text-sm text-body-muted">{t('randomModeBody')}</span>
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="relative h-[100dvh] overflow-hidden bg-canvas px-5 py-5 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,61,139,0.22),transparent_34rem),radial-gradient(circle_at_92%_28%,rgba(85,230,255,0.14),transparent_24rem)]" />
      <motion.div
        aria-hidden="true"
        style={{opacity: stageGlowOpacity, x: stageGlowX}}
        className="pointer-events-none absolute inset-y-20 left-1/2 z-0 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(85,230,255,0.22),rgba(255,61,139,0.16)_38%,transparent_70%)] blur-3xl"
      />
      <motion.div aria-hidden="true" style={{opacity: bgWashSkip}} className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,61,139,0.4),transparent_70%)]" />
      <motion.div aria-hidden="true" style={{opacity: bgWashLike}} className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_70%_50%,rgba(85,230,255,0.4),transparent_70%)]" />
      <nav className="relative z-10 mx-auto flex max-w-md items-center justify-between rounded-full border border-hairline-strong bg-white/[0.035] px-4 py-3 backdrop-blur-xl">
        <button type="button" onClick={saveAndExit} className="text-xs font-semibold text-ink-soft">
          {t('saveAndExit')}
        </button>
        <span className="text-xs font-black uppercase tracking-[0.22em] text-karaoke">{t('title')}</span>
        <span className="text-xs text-body-muted">{safeState.currentIndex}/{safeState.deck.length}</span>
      </nav>
      {saveMessage ? <p className="relative z-10 mx-auto mt-2 max-w-md text-center text-xs text-karaoke-cyan">{saveMessage}</p> : null}

      {viewMode === 'selection' ? (
        <SelectionPanel
          pickedSongs={allPickedSongs}
          onRemove={handleRemovePick}
          onContinue={() => setViewMode('swipe')}
          onFinish={() => {
            setState((current) => (current ? finishPickerQueue(current) : current));
            setViewMode('swipe');
          }}
        />
      ) : (
        <section className="relative z-10 mx-auto flex min-h-[calc(100vh-6rem)] max-w-md flex-col justify-center pb-5 pt-8">
          <div className="mb-5 h-2 overflow-hidden rounded-full bg-white/10">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-karaoke to-karaoke-cyan" animate={{width: `${progress}%`}} />
          </div>

          <div className="mb-4 rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-3 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-body-muted">{t('resumeOrderTitle')}</p>
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-karaoke-cyan">{safeState.orderMode}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => changeRemainingOrder('ordered')}
                disabled={isShufflingDeck || isSwipeLocked}
                className={`h-11 rounded-2xl text-xs font-black transition disabled:opacity-50 ${safeState.orderMode === 'ordered' ? 'bg-white text-canvas' : 'border border-white/10 bg-white/[0.04] text-ink-soft'}`}
              >
                {t('defaultOrder')}
              </button>
              <button
                type="button"
                onClick={() => changeRemainingOrder('random')}
                disabled={isShufflingDeck || isSwipeLocked}
                className={`relative h-11 overflow-hidden rounded-2xl text-xs font-black transition disabled:opacity-60 ${safeState.orderMode === 'random' ? 'bg-karaoke-cyan text-canvas shadow-cyan' : 'border border-karaoke-cyan/25 bg-karaoke-cyan/10 text-karaoke-cyan'}`}
              >
                <motion.span
                  key={shuffleAnimationKey}
                  aria-hidden="true"
                  initial={{x: '-120%'}}
                  animate={{x: isShufflingDeck ? '120%' : '-120%'}}
                  transition={{duration: 0.5, ease: 'easeOut'}}
                  className="absolute inset-y-0 left-0 w-1/2 skew-x-[-18deg] bg-white/30 blur-sm"
                />
                <span className="relative z-10">{safeState.orderMode === 'random' ? t('shuffleAgain') : t('shuffleCards')}</span>
              </button>
            </div>
          </div>

          <div className="relative h-[28rem]">
            <AnimatePresence>
              {feedbackMessage ? (
                <motion.div
                  key={feedbackMessage.id}
                  initial={{opacity: 0, scale: 0.6}}
                  animate={{opacity: 1, scale: 1}}
                  exit={{opacity: 0, scale: 0.8}}
                  transition={{type: 'spring', stiffness: 500, damping: 28}}
                  className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
                >
                  <span className={`rounded-2xl border-2 px-8 py-4 text-2xl font-black uppercase tracking-[0.22em] backdrop-blur-xl ${
                    feedbackMessage.tone === 'like' ? 'border-karaoke-cyan/50 bg-karaoke-cyan/25 text-karaoke-cyan shadow-cyan' : 'border-karaoke/50 bg-karaoke/25 text-karaoke shadow-glow'
                  }`}>
                    {feedbackMessage.label}
                  </span>
                </motion.div>
              ) : null}
            </AnimatePresence>
            <AnimatePresence>
              {isShufflingDeck ? (
                <motion.div
                  key={`shuffle-flare-${shuffleAnimationKey}`}
                  initial={{opacity: 0, scale: 0.92, rotate: -3}}
                  animate={{opacity: 1, scale: 1, rotate: 0}}
                  exit={{opacity: 0, scale: 1.04, rotate: 3}}
                  transition={{duration: 0.32, ease: 'easeOut'}}
                  className="pointer-events-none absolute inset-x-8 top-5 z-20 rounded-full border border-karaoke-cyan/30 bg-karaoke-cyan/15 px-4 py-2 text-center text-[10px] font-black uppercase tracking-[0.22em] text-karaoke-cyan shadow-cyan backdrop-blur-xl"
                >
                  {t('shuffleCards')}
                </motion.div>
              ) : null}
            </AnimatePresence>
            <motion.div
              aria-hidden="true"
              style={{opacity: directionCueOpacity}}
              className="pointer-events-none absolute inset-x-2 top-10 z-0 h-72 rounded-[2.5rem] bg-[linear-gradient(90deg,rgba(255,61,139,0.22),transparent_45%,rgba(85,230,255,0.24))] blur-2xl"
            />
            {nextSongs.map((song, index) => (
              <motion.div
                key={`${song.title}-${song.artist}-stack-${index}`}
                className="absolute inset-x-4 top-8 rounded-[2rem] border border-hairline-strong bg-surface-card/75 p-6 opacity-60 blur-[0.2px]"
                animate={{
                  y: isDealing && index === 0 ? 0 : (index + 1) * deckLift + (isShufflingDeck ? Math.sin(shuffleAnimationKey + index) * 8 : 0),
                  x: isShufflingDeck ? (index % 2 === 0 ? -12 : 12) : 0,
                  rotate: isShufflingDeck ? (index % 2 === 0 ? -4 : 4) : 0,
                  scale: isDealing && index === 0 ? 1 : 1 - (index + 1) * deckScaleStep,
                  opacity: isDealing && index === 0 ? 0.85 : deckOpacityBase - index * 0.1,
                  filter: isDealing && index === 0 ? 'blur(0px)' : 'blur(0.2px)'
                }}
                transition={{type: 'spring', stiffness: isDealing && index === 0 ? 280 : 360, damping: isDealing && index === 0 ? 26 : 34, mass: 0.75}}
              >
                <p className="truncate text-xl font-black text-white/60">{song.title}</p>
              </motion.div>
            ))}

            {currentSong && !complete ? (
              <motion.article
                key={`${currentSongKey}-${shuffleAnimationKey}`}
                custom={swipeDirection}
                drag="x"
                dragConstraints={{left: 0, right: 0}}
                dragElastic={0.38}
                onDragStart={() => setIsDragging(true)}
                onDrag={handleDrag}
                onDragEnd={handleDragEnd}
                style={{x, y: dragLift, rotate, scale, boxShadow: cardGlow}}
                initial={{opacity: 0, y: 36, scale: 0.9, rotate: -2}}
                animate={{opacity: 1, y: 0, rotate: isShufflingDeck ? [0, -3, 3, 0] : [0, 1.5, -1, 0.5, 0], scale: isShufflingDeck ? [1, 0.98, 1.02, 1] : 1}}
                exit={{opacity: 0, x: swipeDirection * 620, y: -48, rotate: swipeDirection * 26, scale: 0.86, transition: {duration: 0.24, ease: [0.22, 1, 0.36, 1]}}}
                transition={{type: 'spring', stiffness: 340, damping: 22, mass: 0.8}}
                className="absolute inset-0 flex touch-none cursor-grab flex-col justify-between rounded-[2.25rem] border border-hairline-strong bg-[linear-gradient(145deg,rgba(255,255,255,0.13),rgba(255,255,255,0.035))] p-7 shadow-glow backdrop-blur-xl active:cursor-grabbing"
              >
                <motion.div style={{opacity: skipOpacity, scale: skipScale}} className="pointer-events-none absolute left-6 top-20 rotate-[-10deg] rounded-2xl border-2 border-karaoke bg-karaoke/10 px-4 py-2 text-lg font-black uppercase tracking-[0.18em] text-karaoke shadow-[0_0_30px_rgba(255,61,139,0.28)]">
                  {t('skipBadge')}
                </motion.div>
                <motion.div style={{opacity: likeOpacity, scale: likeScale}} className="pointer-events-none absolute right-6 top-20 rotate-[10deg] rounded-2xl border-2 border-karaoke-cyan bg-karaoke-cyan/10 px-4 py-2 text-lg font-black uppercase tracking-[0.18em] text-karaoke-cyan shadow-[0_0_30px_rgba(85,230,255,0.28)]">
                  {t('likeBadge')}
                </motion.div>

                <motion.div
                  initial={{opacity: 0, y: 12}}
                  animate={{opacity: 1, y: 0}}
                  transition={{delay: 0.06, duration: 0.3, ease: 'easeOut'}}
                >
                  <div className="mb-5 flex items-center justify-between">
                    <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-soft">
                      {currentSong.platform} · {safeState.orderMode}
                    </span>
                    <span className="text-xs text-body-muted">#{safeState.currentIndex + 1}</span>
                  </div>
                  <motion.h1
                    initial={{opacity: 0, x: -8}}
                    animate={{opacity: 1, x: 0}}
                    transition={{delay: 0.1, duration: 0.32, ease: 'easeOut'}}
                    className="font-display text-5xl font-black leading-[0.94] tracking-[-0.07em] text-white"
                  >
                    {currentSong.title}
                  </motion.h1>
                  <motion.p
                    initial={{opacity: 0, x: -6}}
                    animate={{opacity: 1, x: 0}}
                    transition={{delay: 0.16, duration: 0.3, ease: 'easeOut'}}
                    className="mt-4 text-lg font-semibold text-karaoke-cyan"
                  >
                    {currentSong.artist}
                  </motion.p>
                </motion.div>

                <motion.div
                  initial={{opacity: 0, y: 10}}
                  animate={{opacity: 1, y: 0}}
                  transition={{delay: 0.22, duration: 0.28, ease: 'easeOut'}}
                  className="rounded-[1.5rem] border border-white/10 bg-black/25 p-4"
                >
                  <p className="text-xs leading-5 text-body-muted">{t('gestureHint')}</p>
                </motion.div>
              </motion.article>
            ) : complete ? (
              <CompletePanel
                state={safeState}
                pickedSongs={allPickedSongs}
                onSelection={() => setViewMode('selection')}
                onReswipe={() => {
                  setState((current) => (current ? restartWithUnselectedSongs(current, allPickedSongs, {orderMode: 'random', seed: `${Date.now()}-${current.deck.length}-${allPickedSongs.length}`}) : current));
                }}
              />
            ) : null}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => decide('skip')}
              disabled={!currentSong || isSwipeLocked}
              className="h-14 rounded-2xl border border-white/10 bg-white/[0.04] text-sm font-black text-ink-soft transition hover:bg-white/10 disabled:opacity-40"
            >
              {t('skip')}
            </button>
            <button
              type="button"
              onClick={() => decide('like')}
              disabled={!currentSong || isSwipeLocked}
              className="h-14 rounded-2xl bg-white text-sm font-black text-canvas transition hover:scale-[1.01] disabled:opacity-40"
            >
              {t('pick')}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setViewMode(hasPickedSongs ? 'selection' : 'swipe')}
            disabled={!hasPickedSongs}
            className="mt-3 h-12 rounded-2xl border border-karaoke-cyan/25 bg-karaoke-cyan/10 text-sm font-black text-karaoke-cyan transition hover:bg-karaoke-cyan/20 disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-body-muted"
          >
            {hasPickedSongs ? t('viewPicks') : t('selectionLocked')}
          </button>
        </section>
      )}
    </main>
  );
}

function SelectionPanel({pickedSongs, onRemove, onContinue, onFinish}: {pickedSongs: ImportedSong[]; onRemove: (index: number) => void; onContinue: () => void; onFinish: () => void}) {
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
                  const libraryIndex = pickedSongs.findIndex((picked) => picked.title === song.title && picked.artist === song.artist);
                  onRemove(libraryIndex);
                  setSingingOrder((current) => current.filter((queued) => queued.title !== song.title || queued.artist !== song.artist));
                  setRandomSong((current) => (current?.title === song.title && current.artist === song.artist ? null : current));
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

function CompletePanel({state, pickedSongs, onSelection, onReswipe}: {state: PickerState; pickedSongs: ImportedSong[]; onSelection: () => void; onReswipe: () => void}) {
  const t = useTranslations('picker');
  const pickedKeys = new Set(pickedSongs.map((song) => `${song.title.trim().toLowerCase()}::${song.artist.trim().toLowerCase()}`));
  const unselectedCount = state.deck.filter((song) => !pickedKeys.has(`${song.title.trim().toLowerCase()}::${song.artist.trim().toLowerCase()}`)).length;

  return (
    <motion.div
      key="complete"
      initial={{opacity: 0, scale: 0.96}}
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

function isRawImportDeck(value: string | null): boolean {
  if (!value) {
    return false;
  }

  try {
    return Array.isArray(JSON.parse(value) as unknown);
  } catch {
    return false;
  }
}

function vibrate(pattern: VibratePattern = 10) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}
