import * as cheerio from 'cheerio';
export {normalizeSongs} from './manual';

export type ImportedSong = {
  title: string;
  artist: string;
  platform: 'qq' | 'manual';
  tags: string[];
};

type UnknownRecord = Record<string, unknown>;

export function parseQQMusicSongs(html: string): ImportedSong[] {
  const $ = cheerio.load(html);
  const scriptText = $('script')
    .map((_, script) => $(script).text())
    .get()
    .find((text) => text.includes('__INITIAL_DATA__'));

  if (!scriptText) {
    return [];
  }

  const payload = extractInitialData(scriptText);

  if (!payload) {
    return [];
  }

  return collectSongCandidates(payload);
}

function extractInitialData(scriptText: string): unknown | null {
  const markerIndex = scriptText.indexOf('__INITIAL_DATA__');
  const assignmentIndex = scriptText.indexOf('=', markerIndex);

  if (assignmentIndex === -1) {
    return null;
  }

  const jsonish = readBalancedObject(scriptText.slice(assignmentIndex + 1));

  if (!jsonish) {
    return null;
  }

  return parseJsonish(jsonish);
}

function readBalancedObject(source: string): string | null {
  const start = source.search(/[\[{]/);

  if (start === -1) {
    return null;
  }

  const stack: string[] = [];
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === '{' || char === '[') {
      stack.push(char);
      continue;
    }

    if (char === '}' || char === ']') {
      const opener = stack.pop();
      const matches = (opener === '{' && char === '}') || (opener === '[' && char === ']');

      if (!matches) {
        return null;
      }

      if (stack.length === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  return null;
}

function parseJsonish(value: string): unknown | null {
  const normalized = value
    .replace(/([,{]\s*)([A-Za-z_$][\w$]*)(\s*:)/g, '$1"$2"$3')
    .replace(/'/g, '"')
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/\bundefined\b/g, 'null');

  try {
    return JSON.parse(normalized);
  } catch {
    return null;
  }
}

function collectSongCandidates(payload: unknown): ImportedSong[] {
  const songs: ImportedSong[] = [];
  const seen = new Set<string>();

  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const item of node) {
        const song = readSong(item);

        if (song) {
          const key = `${song.title}::${song.artist}`;

          if (!seen.has(key)) {
            seen.add(key);
            songs.push(song);
          }
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
  };

  visit(payload);

  return songs;
}

function readSong(item: unknown): ImportedSong | null {
  if (!isRecord(item)) {
    return null;
  }

  const title = readText(item.title) ?? readText(item.songname) ?? readText(item.songName) ?? readText(item.name);
  const artist = readSinger(item.singer) ?? readSinger(item.singers) ?? readText(item.singername) ?? readText(item.singerName);

  if (!title || !artist) {
    return null;
  }

  return {title, artist, platform: 'qq', tags: []};
}

function readSinger(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim() || null;
  }

  if (Array.isArray(value)) {
    const names = value
      .map((singer) => (isRecord(singer) ? readText(singer.name) : readText(singer)))
      .filter((name): name is string => Boolean(name));

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
