import * as cheerio from 'cheerio';
import type {ImportedSong} from './qq';
import {finalizeSongs} from './normalize-imported';

type UnknownRecord = Record<string, unknown>;

export function extractSpotifyPlaylistId(url: string): string | null {
  try {
    const target = new URL(url);
    const match = target.pathname.match(/\/playlist\/([A-Za-z0-9]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function parseSpotifyPageSongs(html: string): ImportedSong[] {
  const $ = cheerio.load(html);
  const songs: ImportedSong[] = [];

  $('script[type="application/ld+json"]').each((_, script) => {
    const text = $(script).text().trim();

    if (!text) {
      return;
    }

    try {
      collectSpotifySongs(JSON.parse(text) as unknown, songs);
    } catch {
      // Ignore malformed metadata blocks; Spotify public pages vary by region/session.
    }
  });

  return finalizeSongs(songs);
}

function collectSpotifySongs(node: unknown, songs: ImportedSong[]) {
  if (Array.isArray(node)) {
    for (const item of node) {
      collectSpotifySongs(item, songs);
    }
    return;
  }

  if (!isRecord(node)) {
    return;
  }

  const trackNode = node.track ?? node.tracks ?? node.itemListElement;

  if (Array.isArray(trackNode)) {
    for (const track of trackNode) {
      const song = readSpotifySong(track);

      if (song) {
        songs.push(song);
        continue;
      }

      collectSpotifySongs(track, songs);
    }
  }

  for (const value of Object.values(node)) {
    if (value !== trackNode) {
      collectSpotifySongs(value, songs);
    }
  }
}

function readSpotifySong(value: unknown): ImportedSong | null {
  const item = isRecord(value) && isRecord(value.item) ? value.item : value;

  if (!isRecord(item)) {
    return null;
  }

  const title = readText(item.name);
  const artist = readArtist(item.byArtist ?? item.artist ?? item.artists);

  if (!title) {
    return null;
  }

  return {title, artist: artist ?? '', platform: 'spotify', tags: []};
}

function readArtist(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim() || null;
  }

  if (Array.isArray(value)) {
    const names = value.map((item) => (isRecord(item) ? readText(item.name) : readText(item))).filter((name): name is string => Boolean(name));
    return names.join(' / ') || null;
  }

  if (isRecord(value)) {
    return readText(value.name);
  }

  return null;
}

function readText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
