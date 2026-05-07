import type {ImportedSong} from '@/lib/importers/qq';
import {shuffleSongs} from './session';

export type SingingOrderOptions = {
  seed?: string;
  limit?: number | 'all';
};

export function generateSingingOrder(songs: ImportedSong[], options: SingingOrderOptions = {}) {
  const shuffled = shuffleSongs(songs, options.seed ?? `${Date.now()}-${songs.length}`);
  const limit = options.limit === 'all' || options.limit === undefined ? shuffled.length : Math.max(0, Math.min(options.limit, shuffled.length));

  return shuffled.slice(0, limit);
}

export function pickRandomSong(songs: ImportedSong[], seed = `${Date.now()}-${songs.length}`) {
  return generateSingingOrder(songs, {seed, limit: 1})[0] ?? null;
}
