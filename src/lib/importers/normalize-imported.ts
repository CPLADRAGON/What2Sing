import {songKey} from '@/lib/picker/song-key';
import type {ImportedSong} from './qq';

export function finalizeSongs(songs: ImportedSong[]): ImportedSong[] {
  const seen = new Set<string>();
  const finalized: ImportedSong[] = [];

  for (const song of songs) {
    const title = song.title.trim();

    if (!title) {
      continue;
    }

    const artist = song.artist.trim() || 'Unknown artist';
    const normalizedSong = {...song, title, artist};
    const key = songKey(normalizedSong);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    finalized.push(normalizedSong);
  }

  return finalized;
}
