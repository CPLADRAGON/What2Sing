import {describe, expect, it} from 'vitest';
import {chooseSyncedLibrary, pickerStateFromSessionRow} from '@/lib/picker/persistence';
import type {ImportedSong} from '@/lib/importers/qq';
import type {SongLibrary} from '@/lib/picker/library';

const songs: ImportedSong[] = [
  {title: '稻香', artist: '周杰伦', platform: 'qq', tags: []},
  {title: '后来', artist: '刘若英', platform: 'manual', tags: []}
];

describe('picker persistence mapping', () => {
  it('maps the latest Supabase picker session row into local picker state', () => {
    expect(
      pickerStateFromSessionRow({
        order_mode: 'random',
        songs,
        liked: [songs[0]],
        skipped: [],
        current_index: 1,
        updated_at: '2026-05-07T08:12:00.000Z'
      })
    ).toEqual({
      deck: songs,
      defaultDeck: songs,
      orderMode: 'random',
      liked: [songs[0]],
      skipped: [],
      currentIndex: 1,
      updatedAt: '2026-05-07T08:12:00.000Z'
    });
  });

  it('maps persisted default deck metadata for restoring playlist order', () => {
    const shuffledSongs = [songs[1], songs[0]];

    expect(
      pickerStateFromSessionRow({
        order_mode: 'random',
        songs: {deck: shuffledSongs, defaultDeck: songs},
        liked: [],
        skipped: [],
        current_index: 0,
        updated_at: '2026-05-07T08:12:00.000Z'
      })
    ).toMatchObject({
      deck: shuffledSongs,
      defaultDeck: songs,
      orderMode: 'random'
    });
  });

  it('rejects malformed remote picker session rows', () => {
    expect(
      pickerStateFromSessionRow({
        order_mode: 'random',
        songs: [{title: 'bad'}],
        liked: [],
        skipped: [],
        current_index: 0,
        updated_at: '2026-05-07T08:12:00.000Z'
      })
    ).toBeNull();
  });
});

describe('library sync', () => {
  const baseLibrary: SongLibrary = {
    songs,
    batches: [],
    pickedSongs: [songs[0]],
    updatedAt: '2026-05-07T08:00:00.000Z'
  };

  it('chooses the newest library when syncing local and remote', () => {
    const older = {...baseLibrary, updatedAt: '2026-05-07T08:00:00.000Z'};
    const newer = {...baseLibrary, pickedSongs: songs, updatedAt: '2026-05-07T08:05:00.000Z'};

    expect(chooseSyncedLibrary(older, newer)).toBe(newer);
    expect(chooseSyncedLibrary(newer, older)).toBe(newer);
  });

  it('returns the available library when only one exists', () => {
    expect(chooseSyncedLibrary(baseLibrary, null)).toBe(baseLibrary);
    expect(chooseSyncedLibrary(null, baseLibrary)).toBe(baseLibrary);
  });

  it('returns null when both are missing', () => {
    expect(chooseSyncedLibrary(null, null)).toBeNull();
  });
});
