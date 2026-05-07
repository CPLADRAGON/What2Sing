import type {ImportedSong} from './qq';

export function normalizeSongs(input: string): ImportedSong[] {
  const songs: ImportedSong[] = [];

  input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [rawTitle, ...rest] = line.split(/\s*(?:-|–|—|\/|｜|\|)\s*/);
      const title = rawTitle?.trim();
      const artist = rest.join(' / ').trim() || 'Unknown artist';

      if (!title) {
        return;
      }

      songs.push({title, artist, platform: 'manual', tags: []});
    });

  return songs;
}
