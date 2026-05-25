import type {ImportedSong} from '@/lib/importers/qq';

export type ImportBatch = {
  id: string;
  label: string;
  platform: ImportedSong['platform'];
  songCount: number;
  createdAt: string;
};

export type SongLibrary = {
  songs: ImportedSong[];
  batches: ImportBatch[];
  pickedSongs: ImportedSong[];
  updatedAt: string;
};

export type AddSongsResult = {
  library: SongLibrary;
  added: number;
  duplicatesSkipped: number;
};

export const LIBRARY_STORAGE_KEY = 'ktv-picker:library';

export function createLibrary(): SongLibrary {
  return {
    songs: [],
    batches: [],
    pickedSongs: [],
    updatedAt: new Date().toISOString()
  };
}

export function addSongsToLibrary(library: SongLibrary, songs: ImportedSong[], batchLabel: string): AddSongsResult {
  const existingKeys = new Set(library.songs.map(getSongKey));
  const newSongs = songs.filter((song) => {
    const key = getSongKey(song);

    if (existingKeys.has(key)) {
      return false;
    }

    existingKeys.add(key);
    return true;
  });

  const duplicatesSkipped = songs.length - newSongs.length;
  const platform = newSongs[0]?.platform ?? songs[0]?.platform ?? 'manual';
  const batch: ImportBatch = {
    id: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: batchLabel,
    platform,
    songCount: newSongs.length,
    createdAt: new Date().toISOString()
  };

  return {
    library: {
      ...library,
      songs: [...library.songs, ...newSongs],
      batches: newSongs.length > 0 ? [...library.batches, batch] : library.batches,
      updatedAt: new Date().toISOString()
    },
    added: newSongs.length,
    duplicatesSkipped
  };
}

export function syncPickedSongsToLibrary(library: SongLibrary, sessionPicks: ImportedSong[]): SongLibrary {
  const existingKeys = new Set(library.pickedSongs.map(getSongKey));
  const uniqueNewPicks = sessionPicks.filter((song) => {
    const key = getSongKey(song);

    if (existingKeys.has(key)) {
      return false;
    }

    existingKeys.add(key);
    return true;
  });

  if (uniqueNewPicks.length === 0) {
    return library;
  }

  return {
    ...library,
    pickedSongs: [...library.pickedSongs, ...uniqueNewPicks],
    updatedAt: new Date().toISOString()
  };
}

export function quickAddPickedSong(library: SongLibrary, song: ImportedSong): {library: SongLibrary; added: boolean} {
  const key = getSongKey(song);
  const alreadyPicked = library.pickedSongs.some((s) => getSongKey(s) === key);

  if (alreadyPicked) {
    return {library, added: false};
  }

  const alreadyInSongs = library.songs.some((s) => getSongKey(s) === key);

  return {
    library: {
      ...library,
      songs: alreadyInSongs ? library.songs : [...library.songs, song],
      pickedSongs: [...library.pickedSongs, song],
      updatedAt: new Date().toISOString()
    },
    added: true
  };
}

export function removePickedSongFromLibrary(library: SongLibrary, indexToRemove: number): SongLibrary {
  return {
    ...library,
    pickedSongs: library.pickedSongs.filter((_, index) => index !== indexToRemove),
    updatedAt: new Date().toISOString()
  };
}

export function removeSongFromLibrary(library: SongLibrary, song: ImportedSong): SongLibrary {
  const key = getSongKey(song);
  const songIndex = library.songs.findIndex((s) => getSongKey(s) === key);

  if (songIndex === -1) {
    return library;
  }

  const updatedBatches: ImportBatch[] = [];
  let cursor = 0;

  for (const batch of library.batches) {
    const batchEnd = cursor + batch.songCount;

    if (songIndex >= cursor && songIndex < batchEnd) {
      const newCount = batch.songCount - 1;

      if (newCount > 0) {
        updatedBatches.push({...batch, songCount: newCount});
      }
    } else {
      updatedBatches.push(batch);
    }

    cursor = batchEnd;
  }

  return {
    ...library,
    songs: library.songs.filter((_, i) => i !== songIndex),
    batches: updatedBatches,
    pickedSongs: library.pickedSongs.filter((s) => getSongKey(s) !== key),
    updatedAt: new Date().toISOString()
  };
}

export function removeBatchFromLibrary(library: SongLibrary, batchId: string): SongLibrary {
  const batchIndex = library.batches.findIndex((b) => b.id === batchId);

  if (batchIndex === -1) {
    return library;
  }

  const batch = library.batches[batchIndex];
  const startIndex = library.batches.slice(0, batchIndex).reduce((sum, b) => sum + b.songCount, 0);
  const removedSongs = new Set(library.songs.slice(startIndex, startIndex + batch.songCount).map(getSongKey));

  return {
    ...library,
    songs: library.songs.filter((_, i) => i < startIndex || i >= startIndex + batch.songCount),
    batches: library.batches.filter((b) => b.id !== batchId),
    pickedSongs: library.pickedSongs.filter((s) => !removedSongs.has(getSongKey(s))),
    updatedAt: new Date().toISOString()
  };
}

export function getSongsForBatch(library: SongLibrary, batchId: string): ImportedSong[] {
  const batch = library.batches.find((b) => b.id === batchId);

  if (!batch) {
    return [];
  }

  const batchIndex = library.batches.indexOf(batch);
  const startIndex = library.batches.slice(0, batchIndex).reduce((sum, b) => sum + b.songCount, 0);
  return library.songs.slice(startIndex, startIndex + batch.songCount);
}

export function serializeLibrary(library: SongLibrary): string {
  return JSON.stringify(library);
}

export function deserializeLibrary(value: string | null): SongLibrary | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const lib = parsed as Partial<SongLibrary>;

    if (!Array.isArray(lib.songs) || !Array.isArray(lib.batches) || !Array.isArray(lib.pickedSongs)) {
      return null;
    }

    return {
      songs: lib.songs,
      batches: lib.batches,
      pickedSongs: lib.pickedSongs,
      updatedAt: typeof lib.updatedAt === 'string' ? lib.updatedAt : new Date().toISOString()
    };
  } catch {
    return null;
  }
}

export function migrateFromLegacyPickerState(defaultDeck: ImportedSong[], importBatches: ImportBatch[], pickedSongs: ImportedSong[]): SongLibrary {
  return {
    songs: defaultDeck,
    batches: importBatches,
    pickedSongs,
    updatedAt: new Date().toISOString()
  };
}

function getSongKey(song: ImportedSong) {
  return `${song.title.trim().toLowerCase()}::${song.artist.trim().toLowerCase()}`;
}
