import type {ImportedSong} from '@/lib/importers/qq';
import {songKey} from '@/lib/picker/song-key';
import {safeGetItem, safeSetItem} from '@/lib/safe-storage';

export type PickerDecision = 'like' | 'skip';
export type PickerOrderMode = 'ordered' | 'random';

export type CreatePickerStateOptions = {
  orderMode?: PickerOrderMode;
  seed?: string;
};

export type RestartWithUnselectedSongsOptions = {
  orderMode?: PickerOrderMode;
  seed?: string;
};

export type PickerState = {
  deck: ImportedSong[];
  defaultDeck: ImportedSong[];
  currentIndex: number;
  liked: ImportedSong[];
  skipped: ImportedSong[];
  orderMode: PickerOrderMode;
  updatedAt: string;
};

export type BatchSessionMap = Record<string, PickerState>;

export const PICKER_STORAGE_KEY = 'ktv-picker:songs';
export const BATCH_SESSIONS_KEY = 'ktv-picker:batch-sessions';

export function createPickerState(songs: ImportedSong[], options: CreatePickerStateOptions = {}): PickerState {
  const orderMode = options.orderMode ?? 'ordered';
  const deck = orderMode === 'random' ? shuffleSongs(songs, options.seed ?? `${Date.now()}-${songs.length}`) : songs;

  return {
    deck,
    defaultDeck: songs,
    currentIndex: 0,
    liked: [],
    skipped: [],
    orderMode,
    updatedAt: new Date().toISOString()
  };
}

export function shuffleSongs(songs: ImportedSong[], seed: string): ImportedSong[] {
  const shuffled = [...songs];
  let state = hashSeed(seed);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = nextRandomState(state);
    const swapIndex = state % (index + 1);
    const current = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = current;
  }

  return shuffled;
}

export function getCurrentSong(state: PickerState): ImportedSong | null {
  return state.deck[state.currentIndex] ?? null;
}

export function chooseCurrentSong(state: PickerState, decision: PickerDecision): PickerState {
  const currentSong = getCurrentSong(state);

  if (!currentSong) {
    return state;
  }

  return {
    ...state,
    currentIndex: state.currentIndex + 1,
    liked: decision === 'like' ? [...state.liked, currentSong] : state.liked,
    skipped: decision === 'skip' ? [...state.skipped, currentSong] : state.skipped,
    updatedAt: new Date().toISOString()
  };
}

export function isPickerComplete(state: PickerState): boolean {
  return state.currentIndex >= state.deck.length;
}

export function serializeImportedSongs(songs: ImportedSong[]): string {
  return JSON.stringify(songs);
}

export function serializePickerState(state: PickerState): string {
  return JSON.stringify(state);
}

export function deserializePickerState(value: string | null): PickerState | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (Array.isArray(parsed)) {
      const songs = parsed.filter(isImportedSong);
      return songs.length ? createPickerState(songs) : null;
    }

    if (!isPickerState(parsed)) {
      return null;
    }

    return normalizePickerState(parsed);
  } catch {
    return null;
  }
}

export function canEnterSelectionMode(state: PickerState): boolean {
  return state.liked.length > 0;
}

export function removeLikedSong(state: PickerState, indexToRemove: number): PickerState {
  return {
    ...state,
    liked: state.liked.filter((_, index) => index !== indexToRemove),
    updatedAt: new Date().toISOString()
  };
}

export function finishPickerQueue(state: PickerState): PickerState {
  return {
    ...state,
    currentIndex: state.deck.length,
    updatedAt: new Date().toISOString()
  };
}

export function appendSongsToSession(state: PickerState, songs: ImportedSong[]): PickerState {
  const existingKeys = new Set(state.deck.map(songKey));
  const newSongs = songs.filter((song) => {
    const key = songKey(song);

    if (existingKeys.has(key)) {
      return false;
    }

    existingKeys.add(key);
    return true;
  });

  if (newSongs.length === 0) {
    return state;
  }

  return {
    ...state,
    deck: [...state.deck, ...newSongs],
    defaultDeck: [...state.defaultDeck, ...newSongs],
    updatedAt: new Date().toISOString()
  };
}

export function reorderRemainingSongs(state: PickerState, orderMode: PickerOrderMode, seed = 'ktv-picker-resume'): PickerState {
  const completedDeck = state.deck.slice(0, state.currentIndex);
  const remainingDeck = state.deck.slice(state.currentIndex);
  const orderedRemainingDeck = orderSongsByDefaultDeck(remainingDeck, state.defaultDeck);
  const deck = orderMode === 'random' ? [...completedDeck, ...shuffleSongs(remainingDeck, seed)] : [...completedDeck, ...orderedRemainingDeck];

  return {
    ...state,
    deck,
    orderMode,
    updatedAt: new Date().toISOString()
  };
}

export function restartWithUnselectedSongs(state: PickerState, allPickedSongs: ImportedSong[], options: RestartWithUnselectedSongsOptions = {}): PickerState {
  const pickedKeys = new Set(allPickedSongs.map(songKey));
  const unselectedDeck = state.defaultDeck.filter((song) => !pickedKeys.has(songKey(song)));
  const orderMode = options.orderMode ?? 'random';
  const deck = orderMode === 'random' ? shuffleSongs(unselectedDeck, options.seed ?? `${Date.now()}-${unselectedDeck.length}`) : unselectedDeck;

  return {
    ...state,
    deck,
    defaultDeck: unselectedDeck,
    currentIndex: 0,
    orderMode,
    skipped: [],
    updatedAt: new Date().toISOString()
  };
}

export function chooseSyncedPickerState(localState: PickerState | null, remoteState: PickerState | null): PickerState | null {
  if (!localState) {
    return remoteState ? normalizePickerState(remoteState) : null;
  }

  if (!remoteState) {
    return normalizePickerState(localState);
  }

  return normalizePickerState(Date.parse(remoteState.updatedAt) > Date.parse(localState.updatedAt) ? remoteState : localState);
}

export function deserializeImportedSongs(value: string | null): ImportedSong[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isImportedSong);
  } catch {
    return [];
  }
}

export function loadBatchSessions(): BatchSessionMap {
  try {
    const raw = safeGetItem(BATCH_SESSIONS_KEY);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: BatchSessionMap = {};

    for (const [batchId, value] of Object.entries(parsed)) {
      const state = deserializePickerState(JSON.stringify(value));

      if (state) {
        result[batchId] = state;
      }
    }

    return result;
  } catch {
    return {};
  }
}

export function saveBatchSession(batchId: string, state: PickerState): void {
  const map = loadBatchSessions();
  map[batchId] = state;
  safeSetItem(BATCH_SESSIONS_KEY, JSON.stringify(map));
}

export function removeBatchSession(batchId: string): void {
  const map = loadBatchSessions();
  delete map[batchId];
  safeSetItem(BATCH_SESSIONS_KEY, JSON.stringify(map));
}

export function getBatchProgress(state: PickerState): {total: number; swiped: number; liked: number; skipped: number; complete: boolean} {
  return {
    total: state.deck.length,
    swiped: state.currentIndex,
    liked: state.liked.length,
    skipped: state.skipped.length,
    complete: state.currentIndex >= state.deck.length
  };
}

function isImportedSong(value: unknown): value is ImportedSong {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const song = value as Partial<ImportedSong>;

  return (
    typeof song.title === 'string' &&
    song.title.trim().length > 0 &&
    typeof song.artist === 'string' &&
    song.artist.trim().length > 0 &&
    (song.platform === 'qq' || song.platform === 'spotify' || song.platform === 'netease' || song.platform === 'manual') &&
    Array.isArray(song.tags)
  );
}

function normalizePickerState(state: PickerState): PickerState {
  return {
    deck: state.deck,
    defaultDeck: state.defaultDeck ?? state.deck,
    currentIndex: clampCurrentIndex(state.currentIndex, state.deck.length),
    liked: state.liked,
    skipped: state.skipped,
    orderMode: state.orderMode,
    updatedAt: state.updatedAt
  };
}

function orderSongsByDefaultDeck(songs: ImportedSong[], defaultDeck: ImportedSong[]): ImportedSong[] {
  const remainingByKey = new Map(songs.map((song) => [songKey(song), song]));
  const orderedSongs: ImportedSong[] = [];

  defaultDeck.forEach((song) => {
    const key = songKey(song);
    const remainingSong = remainingByKey.get(key);

    if (!remainingSong) {
      return;
    }

    orderedSongs.push(remainingSong);
    remainingByKey.delete(key);
  });

  return [...orderedSongs, ...Array.from(remainingByKey.values())];
}

function clampCurrentIndex(currentIndex: number, deckLength: number): number {
  return Math.max(0, Math.min(currentIndex, deckLength));
}

function isPickerState(value: unknown): value is PickerState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const state = value as Partial<PickerState>;

  return (
    Array.isArray(state.deck) &&
    state.deck.every(isImportedSong) &&
    (state.defaultDeck === undefined || (Array.isArray(state.defaultDeck) && state.defaultDeck.every(isImportedSong))) &&
    typeof state.currentIndex === 'number' &&
    Number.isInteger(state.currentIndex) &&
    Array.isArray(state.liked) &&
    state.liked.every(isImportedSong) &&
    Array.isArray(state.skipped) &&
    state.skipped.every(isImportedSong) &&
    (state.orderMode === 'ordered' || state.orderMode === 'random') &&
    typeof state.updatedAt === 'string'
  );
}

function hashSeed(seed: string): number {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function nextRandomState(state: number): number {
  return (Math.imul(state, 1664525) + 1013904223) >>> 0;
}
