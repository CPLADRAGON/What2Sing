import * as cheerio from 'cheerio';
import type {ImportedSong} from './qq';
import {finalizeSongs} from './normalize-imported';

type UnknownRecord = Record<string, unknown>;

/**
 * Parse NetEase Cloud Music (网易云音乐) playlist pages.
 *
 * NetEase embeds song data in several places:
 * 1. `<textarea id="song-list-pre-cache">` containing JSON array of tracks
 * 2. `<ul class="f-hide">` with `<a>` tags (song titles only, no artists)
 * 3. Script tags with `window.__INITIAL_STATE__` or similar embedded JSON
 *
 * We try (1) first since it has full metadata, fall back to (3).
 */
export function parseNeteasePlaylistSongs(html: string): ImportedSong[] {
  const $ = cheerio.load(html);

  // Strategy 1: <textarea id="song-list-pre-cache">
  const textarea = $('#song-list-pre-cache').text().trim();

  if (textarea) {
    const songs = parseTextareaPayload(textarea);

    if (songs.length > 0) {
      return finalizeSongs(songs);
    }
  }

  // Strategy 2: Script tags with embedded JSON
  const scriptSongs = parseScriptPayloads($);

  if (scriptSongs.length > 0) {
    return finalizeSongs(scriptSongs);
  }

  // Strategy 3: Hidden list fallback (titles only, no artists)
  const hiddenSongs = parseHiddenList($);

  if (hiddenSongs.length > 0) {
    return finalizeSongs(hiddenSongs);
  }

  return [];
}

/**
 * Parse the NetEase Web API playlist detail response.
 * Endpoint: /api/playlist/detail?id=XXX or /api/v6/playlist/detail
 */
export function parseNeteaseApiResponse(payload: unknown): ImportedSong[] {
  if (!isRecord(payload)) {
    return [];
  }

  const result = isRecord(payload.result) ? payload.result : isRecord(payload.playlist) ? payload.playlist : null;

  if (!result) {
    return finalizeSongs(collectSongNodes(payload));
  }

  const tracks = Array.isArray(result.tracks) ? result.tracks : Array.isArray(result.trackIds) ? result.trackIds : null;

  if (!tracks) {
    return finalizeSongs(collectSongNodes(payload));
  }

  return finalizeSongs(tracks.flatMap(readTrack));
}

/**
 * Extract playlist ID from various NetEase URL formats.
 */
export function extractNeteasePlaylistId(url: string): string | null {
  // https://music.163.com/playlist?id=123456
  // https://music.163.com/#/playlist?id=123456
  // https://y.music.163.com/m/playlist?id=123456
  const idMatch = url.match(/[?&#]id=(\d{5,})/);

  if (idMatch) {
    return idMatch[1];
  }

  // https://music.163.com/playlist/123456/789
  const pathMatch = url.match(/\/playlist\/(\d{5,})/);

  return pathMatch?.[1] ?? null;
}

function parseTextareaPayload(text: string): ImportedSong[] {
  try {
    const parsed = JSON.parse(text) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap(readTrack);
  } catch {
    return [];
  }
}

function parseScriptPayloads($: cheerio.CheerioAPI): ImportedSong[] {
  const songs: ImportedSong[] = [];

  $('script').each((_, script) => {
    const text = $(script).text();

    if (!text.includes('song') && !text.includes('track') && !text.includes('name')) {
      return;
    }

    // Look for JSON objects/arrays embedded in script
    const jsonMatches = Array.from(text.matchAll(/(?:window\.__INITIAL_STATE__|window\.g_state|__NEXT_DATA__)\s*=\s*({[\s\S]*})\s*;?\s*$/gim));

    for (const match of jsonMatches) {
      try {
        const payload = JSON.parse(match[1]) as unknown;
        const found = collectSongNodes(payload);

        for (const song of found) {
          songs.push(song);
        }
      } catch {
        // Ignore malformed JSON
      }
    }
  });

  return songs;
}

function parseHiddenList($: cheerio.CheerioAPI): ImportedSong[] {
  const songs: ImportedSong[] = [];

  $('ul.f-hide a').each((_, el) => {
    const title = $(el).text().trim();

    if (title) {
      songs.push({title, artist: '', platform: 'netease', tags: []});
    }
  });

  return songs;
}

function collectSongNodes(payload: unknown): ImportedSong[] {
  const songs: ImportedSong[] = [];

  function visit(node: unknown): void {
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = readTrack(item);

        if (found.length > 0) {
          for (const song of found) {
            songs.push(song);
          }

          // Skip children — artist sub-objects also have "name" fields
          continue;
        }

        visit(item);
      }

      return;
    }

    if (isRecord(node)) {
      for (const value of Object.values(node)) {
        visit(value);
      }
    }
  }

  visit(payload);
  return songs;
}

function readTrack(node: unknown): ImportedSong[] {
  if (!isRecord(node)) {
    return [];
  }

  const title = stringValue(node.name) ?? stringValue(node.songName) ?? stringValue(node.title);

  if (!title) {
    return [];
  }

  const artist = extractArtist(node);

  return [{title, artist, platform: 'netease', tags: []}];
}

function extractArtist(node: UnknownRecord): string {
  // node.artists = [{name: "xxx"}, ...] or node.ar = [{name: "xxx"}, ...]
  const artistArray = Array.isArray(node.artists) ? node.artists : Array.isArray(node.ar) ? node.ar : null;

  if (artistArray) {
    const names = artistArray
      .filter(isRecord)
      .map((a) => stringValue(a.name))
      .filter(Boolean) as string[];

    if (names.length > 0) {
      return names.join(' / ');
    }
  }

  // node.artist or node.singer as a plain string
  const directArtist = stringValue(node.artist) ?? stringValue(node.singer);

  if (directArtist) {
    return directArtist;
  }

  // node.album.artist
  if (isRecord(node.album) || isRecord(node.al)) {
    const album = (isRecord(node.album) ? node.album : node.al) as UnknownRecord;
    const albumArtist = stringValue(album.artist);

    if (albumArtist) {
      return albumArtist;
    }
  }

  return '';
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
