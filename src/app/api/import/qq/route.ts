import {NextResponse} from 'next/server';
import {parseQQMusicSongs} from '@/lib/importers/qq';

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
      next: {revalidate: 300}
    });

    if (!response.ok) {
      return NextResponse.json({error: `QQ Music returned ${response.status}.`}, {status: 502});
    }

    const html = await response.text();
    const songs = parseQQMusicSongs(html);

    return NextResponse.json({source: 'qq', count: songs.length, songs});
  } catch (error) {
    const message = error instanceof TypeError ? 'Invalid URL.' : 'Unable to import this QQ Music share.';
    return NextResponse.json({error: message}, {status: 400});
  }
}
