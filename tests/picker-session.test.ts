import {describe, expect, it} from 'vitest';
import {
  appendImportedSongsToPickerState,
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
  reorderRemainingSongs,
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

    expect(restarted.deck).toHaveLength(2);
    expect([...restarted.deck].sort((a, b) => a.title.localeCompare(b.title))).toEqual([songs[2], songs[1]].sort((a, b) => a.title.localeCompare(b.title)));
    expect(restarted.liked).toEqual([songs[0]]);
    expect(restarted.skipped).toEqual([]);
    expect(restarted.currentIndex).toBe(0);
    expect(isPickerComplete(restarted)).toBe(false);
  });

  it('can reshuffle unselected songs when restarting a completed pass', () => {
    const longerDeck: ImportedSong[] = [
      ...songs,
      {title: '晴天', artist: '周杰伦', platform: 'qq', tags: []},
      {title: '勇气', artist: '梁静茹', platform: 'manual', tags: []}
    ];
    const pickedFirst = chooseCurrentSong(createPickerState(longerDeck), 'like');
    const skippedRest = longerDeck.slice(1).reduce((state) => chooseCurrentSong(state, 'skip'), pickedFirst);
    const restarted = restartWithUnselectedSongs(finishPickerQueue(skippedRest), {orderMode: 'random', seed: 'reswipe-night'});
    const originalUnselected = longerDeck.slice(1);

    expect(restarted.deck).toHaveLength(originalUnselected.length);
    expect(restarted.deck).not.toEqual(originalUnselected);
    expect([...restarted.deck].sort((a, b) => a.title.localeCompare(b.title))).toEqual([...originalUnselected].sort((a, b) => a.title.localeCompare(b.title)));
    expect(restarted.orderMode).toBe('random');
    expect(restarted.liked).toEqual([longerDeck[0]]);
    expect(restarted.currentIndex).toBe(0);
  });

  it('adds manually imported songs without losing current swipe progress', () => {
    const inProgress = chooseCurrentSong(chooseCurrentSong(createPickerState(songs), 'like'), 'skip');
    const manualSong: ImportedSong = {title: '晴天', artist: '周杰伦', platform: 'manual', tags: []};
    const merged = appendImportedSongsToPickerState(inProgress, [manualSong]);

    expect(merged.deck).toEqual([...songs, manualSong]);
    expect(merged.liked).toEqual([songs[0]]);
    expect(merged.skipped).toEqual([songs[1]]);
    expect(merged.currentIndex).toBe(2);
    expect(getCurrentSong(merged)).toEqual(songs[2]);
  });

  it('does not duplicate songs already in the current swipe deck', () => {
    const inProgress = chooseCurrentSong(createPickerState(songs), 'like');
    const merged = appendImportedSongsToPickerState(inProgress, [songs[1]]);

    expect(merged.deck).toEqual(songs);
    expect(merged.currentIndex).toBe(1);
    expect(merged.liked).toEqual([songs[0]]);
  });

  it('reshuffles only songs still waiting for swiping', () => {
    const longerDeck: ImportedSong[] = [
      ...songs,
      {title: '晴天', artist: '周杰伦', platform: 'qq', tags: []},
      {title: '勇气', artist: '梁静茹', platform: 'manual', tags: []}
    ];
    const inProgress = chooseCurrentSong(chooseCurrentSong(createPickerState(longerDeck), 'like'), 'skip');
    const reordered = reorderRemainingSongs(inProgress, 'random', 'resume-random');

    expect(reordered.deck.slice(0, inProgress.currentIndex)).toEqual(longerDeck.slice(0, inProgress.currentIndex));
    expect(reordered.deck.slice(inProgress.currentIndex)).not.toEqual(longerDeck.slice(inProgress.currentIndex));
    expect([...reordered.deck.slice(inProgress.currentIndex)].sort((a, b) => a.title.localeCompare(b.title))).toEqual([...longerDeck.slice(inProgress.currentIndex)].sort((a, b) => a.title.localeCompare(b.title)));
    expect(reordered.currentIndex).toBe(inProgress.currentIndex);
    expect(reordered.liked).toEqual(inProgress.liked);
    expect(reordered.skipped).toEqual(inProgress.skipped);
    expect(reordered.orderMode).toBe('random');
  });
});
