import {describe, expect, it} from 'vitest';
import {chooseCurrentSong, createPickerState, deserializeImportedSongs, getCurrentSong, isPickerComplete, serializeImportedSongs} from '@/lib/picker/session';
import type {ImportedSong} from '@/lib/importers/qq';

const songs: ImportedSong[] = [
  {title: '稻香', artist: '周杰伦', platform: 'qq', tags: []},
  {title: '小幸运', artist: '田馥甄', platform: 'qq', tags: []}
];

describe('picker session', () => {
  it('creates a picker state from imported songs', () => {
    const state = createPickerState(songs);

    expect(state.deck).toEqual(songs);
    expect(state.currentIndex).toBe(0);
    expect(state.liked).toEqual([]);
    expect(state.skipped).toEqual([]);
    expect(getCurrentSong(state)).toEqual(songs[0]);
  });

  it('likes the current song and advances to the next song', () => {
    const state = chooseCurrentSong(createPickerState(songs), 'like');

    expect(state.liked).toEqual([songs[0]]);
    expect(state.skipped).toEqual([]);
    expect(state.currentIndex).toBe(1);
    expect(getCurrentSong(state)).toEqual(songs[1]);
  });

  it('skips the current song and completes after the final decision', () => {
    const first = chooseCurrentSong(createPickerState(songs), 'skip');
    const second = chooseCurrentSong(first, 'like');

    expect(second.skipped).toEqual([songs[0]]);
    expect(second.liked).toEqual([songs[1]]);
    expect(getCurrentSong(second)).toBeNull();
    expect(isPickerComplete(second)).toBe(true);
  });

  it('round trips imported songs through safe storage serialization', () => {
    expect(deserializeImportedSongs(serializeImportedSongs(songs))).toEqual(songs);
    expect(deserializeImportedSongs('{broken')).toEqual([]);
    expect(deserializeImportedSongs('[{"title":"bad"}]')).toEqual([]);
  });
});
