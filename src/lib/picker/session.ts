import type {ImportedSong} from '@/lib/importers/qq';

export type PickerDecision = 'like' | 'skip';
export type PickerOrderMode = 'ordered' | 'random';

export type CreatePickerStateOptions = {
  orderMode?: PickerOrderMode;
  seed?: string;
};

export type PickerState = {
  deck: ImportedSong[];
  currentIndex: number;
  liked: ImportedSong[];
  skipped: ImportedSong[];
  orderMode: PickerOrderMode;
  updatedAt: string;
};

export const PICKER_STORAGE_KEY = 'ktv-picker:songs';

export function createPickerState(songs: ImportedSong[], options: CreatePickerStateOptions = {}): PickerState {
  const orderMode = options.orderMode ?? 'ordered';
  const deck = orderMode === 'random' ? shuffleSongs(songs, options.seed ?? 'ktv-picker') : songs;

  return {
    deck,
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

    return parsed;
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

export function chooseSyncedPickerState(localState: PickerState | null, remoteState: PickerState | null): PickerState | null {
  if (!localState) {
    return remoteState;
  }

  if (!remoteState) {
    return localState;
  }

  return Date.parse(remoteState.updatedAt) > Date.parse(localState.updatedAt) ? remoteState : localState;
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
    (song.platform === 'qq' || song.platform === 'manual') &&
    Array.isArray(song.tags)
  );
}

function isPickerState(value: unknown): value is PickerState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const state = value as Partial<PickerState>;

  return (
    Array.isArray(state.deck) &&
    state.deck.every(isImportedSong) &&
    typeof state.currentIndex === 'number' &&
    Number.isInteger(state.currentIndex) &&
    state.currentIndex >= 0 &&
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
