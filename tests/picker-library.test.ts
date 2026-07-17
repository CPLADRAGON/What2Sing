import {describe, expect, it} from 'vitest';
import {
  addSongsToLibrary,
  createLibrary,
  deserializeLibrary,
  exportLibraryBackup,
  getSongsForBatch,
  mergeLibraries,
  mergePickedSongs,
  migrateFromLegacyPickerState,
  parseLibraryBackup,
  quickAddPickedSong,
  removeBatchFromLibrary,
  removePickedSongFromLibrary,
  removeSongFromLibrary,
  serializeLibrary,
  syncPickedSongsToLibrary
} from '@/lib/picker/library';
import type {ImportedSong} from '@/lib/importers/qq';

const songs: ImportedSong[] = [
  {title: '稻香', artist: '周杰伦', platform: 'qq', tags: []},
  {title: '小幸运', artist: '田馥甄', platform: 'qq', tags: []},
  {title: '后来', artist: '刘若英', platform: 'manual', tags: []}
];

describe('song library', () => {
  it('creates an empty library', () => {
    const lib = createLibrary();

    expect(lib.songs).toEqual([]);
    expect(lib.batches).toEqual([]);
    expect(lib.pickedSongs).toEqual([]);
  });

  it('adds songs to library with a new batch', () => {
    const lib = createLibrary();
    const result = addSongsToLibrary(lib, songs, 'QQ Music');

    expect(result.library.songs).toEqual(songs);
    expect(result.added).toBe(3);
    expect(result.duplicatesSkipped).toBe(0);
    expect(result.library.batches).toHaveLength(1);
    expect(result.library.batches[0].label).toBe('QQ Music');
    expect(result.library.batches[0].songCount).toBe(3);
    expect(result.library.batches[0].platform).toBe('qq');
  });

  it('deduplicates songs across imports', () => {
    const lib = createLibrary();
    const first = addSongsToLibrary(lib, songs.slice(0, 2), 'Batch 1');
    const second = addSongsToLibrary(first.library, songs, 'Batch 2');

    expect(second.library.songs).toHaveLength(3);
    expect(second.added).toBe(1);
    expect(second.duplicatesSkipped).toBe(2);
    expect(second.library.batches).toHaveLength(2);
    expect(second.library.batches[1].songCount).toBe(1);
  });

  it('does not create a batch when all songs are duplicates', () => {
    const lib = createLibrary();
    const first = addSongsToLibrary(lib, songs, 'Batch 1');
    const second = addSongsToLibrary(first.library, songs, 'Batch 2');

    expect(second.added).toBe(0);
    expect(second.duplicatesSkipped).toBe(3);
    expect(second.library.batches).toHaveLength(1);
  });

  it('syncs picked songs from a session to the library', () => {
    const lib = createLibrary();
    const withSongs = addSongsToLibrary(lib, songs, 'QQ Music').library;
    const synced = syncPickedSongsToLibrary(withSongs, [songs[0], songs[2]]);

    expect(synced.pickedSongs).toEqual([songs[0], songs[2]]);
  });

  it('does not create duplicate picks when syncing', () => {
    const lib = createLibrary();
    const withSongs = addSongsToLibrary(lib, songs, 'QQ Music').library;
    const first = syncPickedSongsToLibrary(withSongs, [songs[0]]);
    const second = syncPickedSongsToLibrary(first, [songs[0], songs[1]]);

    expect(second.pickedSongs).toEqual([songs[0], songs[1]]);
  });

  it('removes a picked song by index', () => {
    const lib = createLibrary();
    const withSongs = addSongsToLibrary(lib, songs, 'QQ Music').library;
    const synced = syncPickedSongsToLibrary(withSongs, songs);
    const removed = removePickedSongFromLibrary(synced, 1);

    expect(removed.pickedSongs).toEqual([songs[0], songs[2]]);
  });

  it('retrieves songs for a specific batch', () => {
    const lib = createLibrary();
    const first = addSongsToLibrary(lib, songs.slice(0, 2), 'QQ Music');
    const manualSong: ImportedSong = {title: '晴天', artist: '周杰伦', platform: 'manual', tags: []};
    const second = addSongsToLibrary(first.library, [manualSong], 'Manual paste');

    expect(getSongsForBatch(second.library, first.library.batches[0].id)).toEqual(songs.slice(0, 2));
    expect(getSongsForBatch(second.library, second.library.batches[1].id)).toEqual([manualSong]);
  });

  it('round trips library through serialization', () => {
    const lib = createLibrary();
    const withSongs = addSongsToLibrary(lib, songs, 'QQ Music').library;
    const synced = syncPickedSongsToLibrary(withSongs, [songs[0]]);
    const restored = deserializeLibrary(serializeLibrary(synced));

    expect(restored).toEqual(synced);
  });

  it('returns null for invalid serialized library', () => {
    expect(deserializeLibrary(null)).toBeNull();
    expect(deserializeLibrary('{broken')).toBeNull();
    expect(deserializeLibrary('{"songs":[]}')).toBeNull();
  });

  it('migrates from legacy PickerState with import batches', () => {
    const legacyBatches = [{id: 'batch-1', label: 'QQ Music', platform: 'qq' as const, songCount: 3, createdAt: '2026-01-01T00:00:00.000Z'}];
    const lib = migrateFromLegacyPickerState(songs, legacyBatches, [songs[0]]);

    expect(lib.songs).toEqual(songs);
    expect(lib.batches).toEqual(legacyBatches);
    expect(lib.pickedSongs).toEqual([songs[0]]);
  });

  it('quick-adds a new song directly to the picked list', () => {
    const lib = createLibrary();
    const newSong: ImportedSong = {title: '晴天', artist: '周杰伦', platform: 'manual', tags: []};
    const result = quickAddPickedSong(lib, newSong);

    expect(result.added).toBe(true);
    expect(result.library.pickedSongs).toEqual([newSong]);
    expect(result.library.songs).toEqual([newSong]);
  });

  it('quick-adds a song already in the library without duplicating it in songs', () => {
    const lib = addSongsToLibrary(createLibrary(), songs, 'QQ Music').library;
    const result = quickAddPickedSong(lib, songs[1]);

    expect(result.added).toBe(true);
    expect(result.library.pickedSongs).toEqual([songs[1]]);
    expect(result.library.songs).toEqual(songs);
  });

  it('rejects quick-adding a song that is already picked', () => {
    const lib = createLibrary();
    const first = quickAddPickedSong(lib, songs[0]);
    const second = quickAddPickedSong(first.library, songs[0]);

    expect(second.added).toBe(false);
    expect(second.library.pickedSongs).toEqual([songs[0]]);
  });

  it('keeps picked songs when their imported batch is deleted', () => {
    const withBatch = addSongsToLibrary(createLibrary(), songs, 'QQ Music').library;
    const withPicks = syncPickedSongsToLibrary(withBatch, [songs[0], songs[1]]);
    const batchId = withPicks.batches[0].id;

    const afterDelete = removeBatchFromLibrary(withPicks, batchId);

    expect(afterDelete.songs).toEqual([]);
    expect(afterDelete.batches).toEqual([]);
    expect(afterDelete.pickedSongs).toEqual([songs[0], songs[1]]);
  });

  it('keeps a picked song when it is removed from the imported list', () => {
    const withBatch = addSongsToLibrary(createLibrary(), songs, 'QQ Music').library;
    const withPicks = syncPickedSongsToLibrary(withBatch, [songs[0]]);

    const afterRemove = removeSongFromLibrary(withPicks, songs[0]);

    expect(afterRemove.songs).not.toContainEqual(songs[0]);
    expect(afterRemove.pickedSongs).toEqual([songs[0]]);
  });

  it('round-trips a library through backup export and parse', () => {
    const withBatch = addSongsToLibrary(createLibrary(), songs, 'QQ Music').library;
    const withPicks = syncPickedSongsToLibrary(withBatch, [songs[0], songs[2]]);

    const restored = parseLibraryBackup(exportLibraryBackup(withPicks));

    expect(restored).not.toBeNull();
    expect(restored?.songs).toEqual(withPicks.songs);
    expect(restored?.batches).toEqual(withPicks.batches);
    expect(restored?.pickedSongs).toEqual(withPicks.pickedSongs);
  });

  it('parses a raw (unwrapped) library export and rejects garbage', () => {
    const raw = serializeLibrary(syncPickedSongsToLibrary(createLibrary(), [songs[0]]));

    expect(parseLibraryBackup(raw)?.pickedSongs).toEqual([songs[0]]);
    expect(parseLibraryBackup('not json')).toBeNull();
  });

  it('merges picked songs additively without duplicates', () => {
    const base = syncPickedSongsToLibrary(createLibrary(), [songs[0]]);
    const incoming = syncPickedSongsToLibrary(createLibrary(), [songs[0], songs[1]]);

    const merged = mergePickedSongs(base, incoming);

    expect(merged.pickedSongs).toEqual([songs[0], songs[1]]);
  });

  it('unions two libraries, deduping overlapping songs and adjusting batch counts', () => {
    const base = addSongsToLibrary(createLibrary(), [songs[0], songs[1]], 'QQ Music').library;
    // incoming shares songs[1] and adds songs[2]; overlap should not be duplicated.
    const incoming = addSongsToLibrary(createLibrary(), [songs[1], songs[2]], 'NetEase').library;

    const merged = mergeLibraries(base, incoming);

    expect(merged.songs).toEqual([songs[0], songs[1], songs[2]]);
    expect(merged.batches).toHaveLength(2);
    expect(merged.batches[0].songCount).toBe(2);
    expect(merged.batches[1].songCount).toBe(1);
    // getSongsForBatch stays valid after the merge (contiguous invariant preserved).
    expect(getSongsForBatch(merged, merged.batches[0].id)).toEqual([songs[0], songs[1]]);
    expect(getSongsForBatch(merged, merged.batches[1].id)).toEqual([songs[2]]);
  });
});
