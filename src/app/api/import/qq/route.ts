import {NextResponse} from 'next/server';
import {IMPORT_FETCH_TIMEOUT_MS, isHostAllowed} from '@/lib/importers/fetch-guard';
import {extractQQMusicPlaylistIds, parseQQMusicPayload, parseQQMusicSongs, type ImportedSong} from '@/lib/importers/qq';

const QQ_HOST_PATTERN = /(^|\.)qq\.com$/i;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {url?: string};
    const url = body.url?.trim();

    if (!url) {
      return NextResponse.json({error: 'QQ Music share URL is required.'}, {status: 400});
    }

    const target = new URL(url);

    if (!QQ_HOST_PATTERN.test(target.hostname)) {
      return NextResponse.json({error: 'Only qq.com share URLs are supported.'}, {status: 400});
    }

    const response = await fetch(target.toString(), {
      headers: {
        'user-agent': 'Mozilla/5.0 KTV-Picker/0.1 (+https://vercel.app)',
        accept: 'text/html,application/xhtml+xml'
      },
      signal: AbortSignal.timeout(IMPORT_FETCH_TIMEOUT_MS),
      next: {revalidate: 300}
    });

    if (!isHostAllowed(new URL(response.url).hostname, QQ_HOST_PATTERN)) {
      return NextResponse.json({error: 'Import URL redirected to an unsupported host.'}, {status: 400});
    }

    if (!response.ok) {
      return NextResponse.json({error: `QQ Music returned ${response.status}.`}, {status: 502});
    }

    const html = await response.text();
    let songs = parseQQMusicSongs(html);

    if (songs.length === 0) {
      const playlistIds = extractQQMusicPlaylistIds(target.toString(), response.url, html);
      songs = await fetchPlaylistSongs(playlistIds);

      if (songs.length === 0) {
        return NextResponse.json(
          {
            error: 'No songs were found in this QQ Music share. Try a public playlist URL or paste the song text instead.',
            source: 'qq',
            count: 0,
            songs: [],
            diagnostics: {
              finalUrl: response.url,
              playlistIds
            }
          },
          {status: 422}
        );
      }
    }

    return NextResponse.json({source: 'qq', count: songs.length, songs});
  } catch (error) {
    if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return NextResponse.json({error: 'The music service took too long to respond. Please try again.'}, {status: 504});
    }

    const message = error instanceof TypeError ? 'Invalid URL.' : 'Unable to import this QQ Music share.';
    return NextResponse.json({error: message}, {status: 400});
  }
}

async function fetchPlaylistSongs(playlistIds: string[]): Promise<ImportedSong[]> {
  for (const playlistId of playlistIds) {
    const response = await fetch(buildPlaylistApiUrl(playlistId), {
      headers: {
        'user-agent': 'Mozilla/5.0 KTV-Picker/0.1 (+https://vercel.app)',
        accept: 'application/json,text/plain,*/*',
        referer: 'https://y.qq.com/'
      },
      signal: AbortSignal.timeout(IMPORT_FETCH_TIMEOUT_MS),
      next: {revalidate: 300}
    });

    if (!response.ok) {
      continue;
    }

    const text = await response.text();
    const payload = parseQQJsonResponse(text);
    const songs = parseQQMusicPayload(payload);

    if (songs.length > 0) {
      return songs;
    }
  }

  return [];
}

function buildPlaylistApiUrl(playlistId: string) {
  const url = new URL('https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg');
  url.search = new URLSearchParams({
    type: '1',
    json: '1',
    utf8: '1',
    onlysong: '0',
    disstid: playlistId,
    format: 'json',
    g_tk: '5381',
    loginUin: '0',
    hostUin: '0',
    inCharset: 'utf8',
    outCharset: 'utf-8',
    notice: '0',
    platform: 'yqq.json',
    needNewCode: '0'
  }).toString();

  return url;
}

function parseQQJsonResponse(text: string): unknown {
  const trimmed = text.trim();
  const jsonpMatch = trimmed.match(/^[^(]+\(([\s\S]*)\);?$/);

  return JSON.parse(jsonpMatch?.[1] ?? trimmed);
}
