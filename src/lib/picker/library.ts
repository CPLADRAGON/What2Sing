import type {ImportedSong} from '@/lib/importers/qq';
import {songKey} from '@/lib/picker/song-key';

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
  const existingKeys = new Set(library.songs.map(songKey));
  const newSongs = songs.filter((song) => {
    const key = songKey(song);

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
  const existingKeys = new Set(library.pickedSongs.map(songKey));
  const uniqueNewPicks = sessionPicks.filter((song) => {
    const key = songKey(song);

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
  const key = songKey(song);
  const alreadyPicked = library.pickedSongs.some((s) => songKey(s) === key);

  if (alreadyPicked) {
    return {library, added: false};
  }

  const alreadyInSongs = library.songs.some((s) => songKey(s) === key);

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
  const key = songKey(song);
  const songIndex = library.songs.findIndex((s) => songKey(s) === key);

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
    // Picked songs are the user's curated selection; removing a song from the
    // imported source list must not delete it from their already-picked songs.
    pickedSongs: library.pickedSongs,
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

  return {
    ...library,
    songs: library.songs.filter((_, i) => i < startIndex || i >= startIndex + batch.songCount),
    batches: library.batches.filter((b) => b.id !== batchId),
    // Deleting an imported list only removes the import source; the user's picked
    // songs are kept so curated selections are never lost by managing imports.
    pickedSongs: library.pickedSongs,
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

export const LIBRARY_BACKUP_VERSION = 1;

type LibraryBackup = {
  app: 'ktv-picker';
  type: 'library-backup';
  version: number;
  exportedAt: string;
  library: SongLibrary;
};

// Serialize the whole library (imported songs, batches, and picked songs) into a
// portable, versioned backup the user can download and later restore.
export function exportLibraryBackup(library: SongLibrary): string {
  const backup: LibraryBackup = {
    app: 'ktv-picker',
    type: 'library-backup',
    version: LIBRARY_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    library
  };

  return JSON.stringify(backup, null, 2);
}

// Accepts either a wrapped backup ({library: ...}) or a raw serialized library.
export function parseLibraryBackup(value: string): SongLibrary | null {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (parsed && typeof parsed === 'object' && 'library' in parsed) {
      return deserializeLibrary(JSON.stringify((parsed as {library: unknown}).library));
    }

    return deserializeLibrary(value);
  } catch {
    return null;
  }
}

// Non-destructive union of picked songs. Restoring a backup can only ADD missing
// picks, never remove existing ones, so a restore can't lose the user's selection.
export function mergePickedSongs(base: SongLibrary, incoming: SongLibrary): SongLibrary {
  const existingKeys = new Set(base.pickedSongs.map(songKey));
  const additions = incoming.pickedSongs.filter((song) => {
    const key = songKey(song);

    if (existingKeys.has(key)) {
      return false;
    }

    existingKeys.add(key);
    return true;
  });

  if (additions.length === 0) {
    return base;
  }

  return {
    ...base,
    pickedSongs: [...base.pickedSongs, ...additions],
    updatedAt: new Date().toISOString()
  };
}

// Non-destructive union of two libraries: imported songs, batches, AND picked songs
// are all preserved (deduped by songKey / batch id), so syncing across devices never
// hides or overwrites an imported list. `base` wins ordering (pass the newer record).
// Tradeoff: a deletion on one device can reappear from another device that still has
// the item — deletions do not propagate through a union merge.
export function mergeLibraries(base: SongLibrary, incoming: SongLibrary): SongLibrary {
  const songs: ImportedSong[] = [];
  const batches: ImportBatch[] = [];
  const seenSongKeys = new Set<string>();
  const seenBatchIds = new Set<string>();

  const addBatchedSongs = (lib: SongLibrary) => {
    for (const batch of lib.batches) {
      if (seenBatchIds.has(batch.id)) {
        continue;
      }

      const batchSongs = getSongsForBatch(lib, batch.id).filter((song) => !seenSongKeys.has(songKey(song)));

      if (batchSongs.length === 0) {
        continue;
      }

      seenBatchIds.add(batch.id);

      for (const song of batchSongs) {
        seenSongKeys.add(songKey(song));
        songs.push(song);
      }

      batches.push({...batch, songCount: batchSongs.length});
    }
  };

  const addUnbatchedTail = (lib: SongLibrary) => {
    const batchedCount = lib.batches.reduce((sum, batch) => sum + batch.songCount, 0);

    for (const song of lib.songs.slice(batchedCount)) {
      if (seenSongKeys.has(songKey(song))) {
        continue;
      }

      seenSongKeys.add(songKey(song));
      songs.push(song);
    }
  };

  // Batched songs first (kept contiguous so getSongsForBatch stays valid), then any
  // unbatched tail songs (e.g. quick-added picks that were also added to songs).
  addBatchedSongs(base);
  addBatchedSongs(incoming);
  addUnbatchedTail(base);
  addUnbatchedTail(incoming);

  const pickedKeys = new Set(base.pickedSongs.map(songKey));
  const pickedSongs = [...base.pickedSongs];

  for (const pick of incoming.pickedSongs) {
    const key = songKey(pick);

    if (!pickedKeys.has(key)) {
      pickedKeys.add(key);
      pickedSongs.push(pick);
    }
  }

  return {
    songs,
    batches,
    pickedSongs,
    updatedAt: new Date().toISOString()
  };
}
