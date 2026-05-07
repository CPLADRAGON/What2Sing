import {describe, expect, it} from 'vitest';
import {
  canEnterSelectionMode,
  chooseCurrentSong,
  chooseSyncedPickerState,
  createPickerState,
  deserializeImportedSongs,
  deserializePickerState,
  finishPickerQueue,
  getCurrentSong,
  isPickerComplete,
  removeLikedSong,
  restartWithUnselectedSongs,
  serializeImportedSongs,
  serializePickerState
} from '@/lib/picker/session';
import type {ImportedSong} from '@/lib/importers/qq';

const songs: ImportedSong[] = [
  {title: '稻香', artist: '周杰伦', platform: 'qq', tags: []},
  {title: '小幸运', artist: '田馥甄', platform: 'qq', tags: []},
  {title: '后来', artist: '刘若英', platform: 'manual', tags: []}
];

describe('picker session', () => {
  it('creates a picker state from imported songs', () => {
    const state = createPickerState(songs);

    expect(state.deck).toEqual(songs);
    expect(state.orderMode).toBe('ordered');
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
    const third = chooseCurrentSong(second, 'skip');

    expect(third.skipped).toEqual([songs[0], songs[2]]);
    expect(third.liked).toEqual([songs[1]]);
    expect(getCurrentSong(third)).toBeNull();
    expect(isPickerComplete(third)).toBe(true);
  });

  it('round trips imported songs through safe storage serialization', () => {
    expect(deserializeImportedSongs(serializeImportedSongs(songs))).toEqual(songs);
    expect(deserializeImportedSongs('{broken')).toEqual([]);
    expect(deserializeImportedSongs('[{"title":"bad"}]')).toEqual([]);
  });

  it('keeps import order in ordered mode', () => {
    const state = createPickerState(songs, {orderMode: 'ordered'});

    expect(state.deck.map((song) => song.title)).toEqual(['稻香', '小幸运', '后来']);
    expect(state.orderMode).toBe('ordered');
  });

  it('shuffles songs in random mode without losing songs', () => {
    const state = createPickerState(songs, {orderMode: 'random', seed: 'ktv-night'});

    expect(state.deck).toHaveLength(songs.length);
    expect(state.deck).not.toEqual(songs);
    expect([...state.deck].sort((a, b) => a.title.localeCompare(b.title))).toEqual([...songs].sort((a, b) => a.title.localeCompare(b.title)));
    expect(state.orderMode).toBe('random');
  });

  it('round trips full picker progress through storage serialization', () => {
    const state = chooseCurrentSong(chooseCurrentSong(createPickerState(songs, {orderMode: 'random', seed: 'ktv-night'}), 'like'), 'skip');

    expect(deserializePickerState(serializePickerState(state))).toEqual(state);
    expect(deserializePickerState('{broken')).toBeNull();
    expect(deserializePickerState('[{"title":"bad"}]')).toBeNull();
  });

  it('allows selection mode only after at least one song is liked and can remove picked songs', () => {
    const empty = createPickerState(songs);
    const liked = chooseCurrentSong(empty, 'like');
    const removed = removeLikedSong(liked, 0);

    expect(canEnterSelectionMode(empty)).toBe(false);
    expect(canEnterSelectionMode(liked)).toBe(true);
    expect(removed.liked).toEqual([]);
    expect(canEnterSelectionMode(removed)).toBe(false);
  });

  it('chooses the newest picker progress when syncing devices', () => {
    const local = {...chooseCurrentSong(createPickerState(songs), 'like'), updatedAt: '2026-05-07T08:00:00.000Z'};
    const remote = {...chooseCurrentSong(chooseCurrentSong(createPickerState(songs), 'skip'), 'like'), updatedAt: '2026-05-07T08:02:00.000Z'};

    expect(chooseSyncedPickerState(local, remote)).toEqual(remote);
    expect(chooseSyncedPickerState(remote, local)).toEqual(remote);
  });

  it('finishes the queue so picked songs become the final KTV list', () => {
    const liked = chooseCurrentSong(createPickerState(songs), 'like');
    const finished = finishPickerQueue(liked);

    expect(finished.currentIndex).toBe(songs.length);
    expect(finished.liked).toEqual([songs[0]]);
    expect(isPickerComplete(finished)).toBe(true);
  });

  it('restarts swiping with all unselected songs while keeping picked songs', () => {
    const first = chooseCurrentSong(createPickerState(songs), 'like');
    const second = chooseCurrentSong(first, 'skip');
    const restarted = restartWithUnselectedSongs(finishPickerQueue(second));

    expect(restarted.deck).toEqual([songs[1], songs[2]]);
    expect(restarted.liked).toEqual([songs[0]]);
    expect(restarted.skipped).toEqual([]);
    expect(restarted.currentIndex).toBe(0);
    expect(isPickerComplete(restarted)).toBe(false);
  });
});
