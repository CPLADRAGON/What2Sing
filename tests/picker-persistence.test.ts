import {describe, expect, it} from 'vitest';
import {pickerStateFromSessionRow} from '@/lib/picker/persistence';
import type {ImportedSong} from '@/lib/importers/qq';

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
      orderMode: 'random',
      liked: [songs[0]],
      skipped: [],
      currentIndex: 1,
      updatedAt: '2026-05-07T08:12:00.000Z'
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
