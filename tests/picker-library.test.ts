import {describe, expect, it} from 'vitest';
import {
  addSongsToLibrary,
  createLibrary,
  deserializeLibrary,
  getSongsForBatch,
  migrateFromLegacyPickerState,
  removePickedSongFromLibrary,
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
});
