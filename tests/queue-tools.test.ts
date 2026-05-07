import {describe, expect, it} from 'vitest';
import {generateSingingOrder, pickRandomSong} from '@/lib/picker/queue';
import type {ImportedSong} from '@/lib/importers/qq';

const songs: ImportedSong[] = [
  {title: '稻香', artist: '周杰伦', platform: 'qq', tags: []},
  {title: '后来', artist: '刘若英', platform: 'manual', tags: []},
  {title: '小幸运', artist: '田馥甄', platform: 'qq', tags: []},
  {title: '修炼爱情', artist: '林俊杰', platform: 'qq', tags: []}
];

describe('tonight queue tools', () => {
  it('generates a shuffled singing order from all selected songs', () => {
    const queue = generateSingingOrder(songs, {seed: 'ktv-night'});

    expect(queue).toHaveLength(songs.length);
    expect(queue).not.toEqual(songs);
    expect([...queue].sort((a, b) => a.title.localeCompare(b.title))).toEqual([...songs].sort((a, b) => a.title.localeCompare(b.title)));
  });

  it('limits the generated singing order when a limit is provided', () => {
    const queue = generateSingingOrder(songs, {seed: 'ktv-night', limit: 2});

    expect(queue).toHaveLength(2);
    expect(queue.every((song) => songs.some((candidate) => candidate.title === song.title && candidate.artist === song.artist))).toBe(true);
  });

  it('picks one deterministic random song from selected songs', () => {
    expect(pickRandomSong(songs, 'next-song')).toEqual(pickRandomSong(songs, 'next-song'));
    expect(songs).toContainEqual(pickRandomSong(songs, 'next-song'));
  });

  it('returns null when picking from an empty selected list', () => {
    expect(pickRandomSong([], 'next-song')).toBeNull();
  });
});
