import type {ImportedSong} from '@/lib/importers/qq';

// Canonical dedup/identity key for a song: case-insensitive, whitespace-trimmed
// title + artist. This is the single source of truth for "are these the same song".
export function songKey(song: Pick<ImportedSong, 'title' | 'artist'>): string {
  return `${song.title.trim().toLowerCase()}::${song.artist.trim().toLowerCase()}`;
}
