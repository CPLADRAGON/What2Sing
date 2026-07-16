import {NextResponse} from 'next/server';
import {IMPORT_FETCH_TIMEOUT_MS, isHostAllowed} from '@/lib/importers/fetch-guard';
import {extractNeteasePlaylistId, parseNeteaseApiResponse, parseNeteasePlaylistSongs} from '@/lib/importers/netease';

const NETEASE_HOST_PATTERN = /(^|\.)163\.com$/i;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {url?: string};
    const url = body.url?.trim();

    if (!url) {
      return NextResponse.json({error: 'NetEase Music playlist URL is required.'}, {status: 400});
    }

    const target = new URL(url);

    if (!NETEASE_HOST_PATTERN.test(target.hostname)) {
      return NextResponse.json({error: 'Only 163.com (NetEase Music) URLs are supported.'}, {status: 400});
    }

    const playlistId = extractNeteasePlaylistId(target.toString());

    // Try the web API first (more reliable than scraping)
    if (playlistId) {
      const apiSongs = await fetchFromApi(playlistId);

      if (apiSongs.length > 0) {
        return NextResponse.json({source: 'netease', count: apiSongs.length, songs: apiSongs});
      }
    }

    // Fall back to HTML scraping
    const response = await fetch(target.toString(), {
      headers: {
        'user-agent': 'Mozilla/5.0 KTV-Picker/0.1 (+https://vercel.app)',
        accept: 'text/html,application/xhtml+xml'
      },
      signal: AbortSignal.timeout(IMPORT_FETCH_TIMEOUT_MS),
      next: {revalidate: 300}
    });

    if (!isHostAllowed(new URL(response.url).hostname, NETEASE_HOST_PATTERN)) {
      return NextResponse.json({error: 'Import URL redirected to an unsupported host.'}, {status: 400});
    }

    if (!response.ok) {
      return NextResponse.json({error: `NetEase Music returned ${response.status}.`}, {status: 502});
    }

    const html = await response.text();
    const songs = parseNeteasePlaylistSongs(html);

    if (songs.length === 0) {
      return NextResponse.json(
        {
          error: 'No songs were found in this NetEase Music playlist. Try a public playlist URL or paste the song text instead.',
          source: 'netease',
          count: 0,
          songs: []
        },
        {status: 422}
      );
    }

    return NextResponse.json({source: 'netease', count: songs.length, songs});
  } catch (error) {
    if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return NextResponse.json({error: 'The music service took too long to respond. Please try again.'}, {status: 504});
    }

    const message = error instanceof TypeError ? 'Invalid URL.' : 'Unable to import this NetEase Music playlist.';
    return NextResponse.json({error: message}, {status: 400});
  }
}

async function fetchFromApi(playlistId: string) {
  try {
    const response = await fetch('https://music.163.com/api/playlist/detail', {
      method: 'POST',
      headers: {
        'user-agent': 'Mozilla/5.0 KTV-Picker/0.1 (+https://vercel.app)',
        'content-type': 'application/x-www-form-urlencoded',
        referer: 'https://music.163.com/'
      },
      body: new URLSearchParams({id: playlistId, n: '1000'}),
      signal: AbortSignal.timeout(IMPORT_FETCH_TIMEOUT_MS),
      next: {revalidate: 300}
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as unknown;
    return parseNeteaseApiResponse(payload);
  } catch {
    return [];
  }
}
