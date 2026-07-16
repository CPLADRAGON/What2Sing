import {describe, expect, it} from 'vitest';
import {finalizeSongs} from '@/lib/importers/normalize-imported';
import type {ImportedSong} from '@/lib/importers/qq';

describe('finalizeSongs', () => {
  it('trims song title and artist whitespace', () => {
    const songs: ImportedSong[] = [
      {title: '  Yellow  ', artist: '  Coldplay  ', platform: 'spotify', tags: ['favorite']}
    ];

    expect(finalizeSongs(songs)).toEqual([
      {title: 'Yellow', artist: 'Coldplay', platform: 'spotify', tags: ['favorite']}
    ]);
  });

  it('drops songs with an empty title after trimming', () => {
    const songs: ImportedSong[] = [
      {title: '   ', artist: 'Coldplay', platform: 'spotify', tags: []},
      {title: 'Style', artist: 'Taylor Swift', platform: 'spotify', tags: []}
    ];

    expect(finalizeSongs(songs)).toEqual([
      {title: 'Style', artist: 'Taylor Swift', platform: 'spotify', tags: []}
    ]);
  });

  it('defaults an empty artist to Unknown artist', () => {
    const songs: ImportedSong[] = [
      {title: '突然好想你', artist: '   ', platform: 'netease', tags: []}
    ];

    expect(finalizeSongs(songs)).toEqual([
      {title: '突然好想你', artist: 'Unknown artist', platform: 'netease', tags: []}
    ]);
  });

  it('deduplicates case-insensitively while preserving first-seen order', () => {
    const songs: ImportedSong[] = [
      {title: 'Yellow', artist: 'Coldplay', platform: 'spotify', tags: ['first']},
      {title: 'Style', artist: 'Taylor Swift', platform: 'spotify', tags: []},
      {title: ' yellow ', artist: ' COLDPLAY ', platform: 'qq', tags: ['duplicate']}
    ];

    expect(finalizeSongs(songs)).toEqual([
      {title: 'Yellow', artist: 'Coldplay', platform: 'spotify', tags: ['first']},
      {title: 'Style', artist: 'Taylor Swift', platform: 'spotify', tags: []}
    ]);
  });
});
