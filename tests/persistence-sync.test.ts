import {describe, expect, it} from 'vitest';
import type {ImportedSong} from '@/lib/importers/qq';
import type {ImportBatch, SongLibrary} from '@/lib/picker/library';
import {chooseSyncedLibrary} from '@/lib/picker/persistence';

const songs: ImportedSong[] = [
  {title: '稻香', artist: '周杰伦', platform: 'qq', tags: []},
  {title: '小幸运', artist: '田馥甄', platform: 'qq', tags: []},
  {title: '后来', artist: '刘若英', platform: 'manual', tags: []},
  {title: '晴天', artist: '周杰伦', platform: 'manual', tags: []}
];

const localBatch: ImportBatch = {
  id: 'local-batch',
  label: 'Local imports',
  platform: 'qq',
  songCount: 2,
  createdAt: '2026-07-17T01:00:00.000Z'
};

const remoteBatch: ImportBatch = {
  id: 'remote-batch',
  label: 'Remote imports',
  platform: 'manual',
  songCount: 2,
  createdAt: '2026-07-17T02:00:00.000Z'
};

function library(overrides: Partial<SongLibrary> = {}): SongLibrary {
  return {
    songs: songs.slice(0, 2),
    batches: [localBatch],
    pickedSongs: [],
    updatedAt: '2026-07-17T08:00:00.000Z',
    ...overrides
  };
}

describe('library sync pick merging', () => {
  it('returns the available library when only local or remote exists', () => {
    const local = library();
    const remote = library({updatedAt: '2026-07-17T09:00:00.000Z'});

    expect(chooseSyncedLibrary(local, null)).toBe(local);
    expect(chooseSyncedLibrary(null, remote)).toBe(remote);
  });

  it('keeps newer remote structure and unions local-only picks without duplicates', () => {
    const local = library({
      songs: songs.slice(0, 2),
      batches: [localBatch],
      pickedSongs: [songs[0], songs[1]],
      updatedAt: '2026-07-17T08:00:00.000Z'
    });
    const remote = library({
      songs: songs.slice(2, 4),
      batches: [remoteBatch],
      pickedSongs: [songs[0], songs[2]],
      updatedAt: '2026-07-17T09:00:00.000Z'
    });

    const synced = chooseSyncedLibrary(local, remote);

    expect(synced?.songs).toBe(remote.songs);
    expect(synced?.batches).toBe(remote.batches);
    expect(synced?.updatedAt).toBe(remote.updatedAt);
    expect(synced?.pickedSongs).toEqual([songs[0], songs[2], songs[1]]);
  });

  it('keeps newer local structure and unions remote-only picks', () => {
    const local = library({
      songs: songs.slice(0, 2),
      batches: [localBatch],
      pickedSongs: [songs[0], songs[1]],
      updatedAt: '2026-07-17T10:00:00.000Z'
    });
    const remote = library({
      songs: songs.slice(2, 4),
      batches: [remoteBatch],
      pickedSongs: [songs[2]],
      updatedAt: '2026-07-17T09:00:00.000Z'
    });

    const synced = chooseSyncedLibrary(local, remote);

    expect(synced?.songs).toBe(local.songs);
    expect(synced?.batches).toBe(local.batches);
    expect(synced?.updatedAt).toBe(local.updatedAt);
    expect(synced?.pickedSongs).toEqual([songs[0], songs[1], songs[2]]);
  });

  it('does not duplicate identical picks and preserves base order', () => {
    const local = library({
      pickedSongs: [songs[1], songs[0]],
      updatedAt: '2026-07-17T10:00:00.000Z'
    });
    const remote = library({
      pickedSongs: [songs[0], songs[1]],
      updatedAt: '2026-07-17T09:00:00.000Z'
    });

    const synced = chooseSyncedLibrary(local, remote);

    expect(synced).toBe(local);
    expect(synced?.pickedSongs).toEqual([songs[1], songs[0]]);
  });
});
