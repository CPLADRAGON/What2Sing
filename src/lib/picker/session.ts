import type {ImportedSong} from '@/lib/importers/qq';

export type PickerDecision = 'like' | 'skip';

export type PickerState = {
  deck: ImportedSong[];
  currentIndex: number;
  liked: ImportedSong[];
  skipped: ImportedSong[];
};

export const PICKER_STORAGE_KEY = 'ktv-picker:songs';

export function createPickerState(songs: ImportedSong[]): PickerState {
  return {
    deck: songs,
    currentIndex: 0,
    liked: [],
    skipped: []
  };
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
    skipped: decision === 'skip' ? [...state.skipped, currentSong] : state.skipped
  };
}

export function isPickerComplete(state: PickerState): boolean {
  return state.currentIndex >= state.deck.length;
}

export function serializeImportedSongs(songs: ImportedSong[]): string {
  return JSON.stringify(songs);
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
