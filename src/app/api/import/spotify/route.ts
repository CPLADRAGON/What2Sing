import {NextResponse} from 'next/server';
import {extractSpotifyPlaylistId, parseSpotifyPageSongs} from '@/lib/importers/spotify';

const SPOTIFY_HOST_PATTERN = /(^|\.)spotify\.com$/i;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {url?: string};
    const url = body.url?.trim();

    if (!url) {
      return NextResponse.json({error: 'Spotify playlist URL is required.'}, {status: 400});
    }

    const target = new URL(url);

    if (!SPOTIFY_HOST_PATTERN.test(target.hostname) || !extractSpotifyPlaylistId(target.toString())) {
      return NextResponse.json({error: 'Only Spotify playlist URLs are supported.'}, {status: 400});
    }

    const response = await fetch(target.toString(), {
      headers: {
        'user-agent': 'Mozilla/5.0 KTV-Picker/0.1 (+https://vercel.app)',
        accept: 'text/html,application/xhtml+xml'
      },
      next: {revalidate: 300}
    });

    if (!response.ok) {
      return NextResponse.json({error: `Spotify returned ${response.status}.`}, {status: 502});
    }

    const html = await response.text();
    const songs = parseSpotifyPageSongs(html);

    if (songs.length === 0) {
      return NextResponse.json(
        {
          error: 'No songs were found in this Spotify page. Public Spotify parsing is experimental; paste the playlist text instead if this fails.',
          source: 'spotify',
          count: 0,
          songs: []
        },
        {status: 422}
      );
    }

    return NextResponse.json({source: 'spotify', count: songs.length, songs});
  } catch (error) {
    const message = error instanceof TypeError ? 'Invalid URL.' : 'Unable to import this Spotify playlist.';
    return NextResponse.json({error: message}, {status: 400});
  }
}
