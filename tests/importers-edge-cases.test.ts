import {describe, expect, it} from 'vitest';
import {normalizeSongs} from '@/lib/importers/manual';
import {parseNeteaseApiResponse, parseNeteasePlaylistSongs} from '@/lib/importers/netease';
import {parseQQMusicPayload, parseQQMusicSongs} from '@/lib/importers/qq';
import {parseSpotifyPageSongs} from '@/lib/importers/spotify';

describe('importer parser edge cases', () => {
  it('returns empty arrays for empty input', () => {
    expect(parseQQMusicSongs('')).toEqual([]);
    expect(parseQQMusicSongs('<html></html>')).toEqual([]);
    expect(parseNeteasePlaylistSongs('')).toEqual([]);
    expect(parseNeteasePlaylistSongs('<html></html>')).toEqual([]);
    expect(parseSpotifyPageSongs('')).toEqual([]);
    expect(parseSpotifyPageSongs('<html></html>')).toEqual([]);
    expect(normalizeSongs('')).toEqual([]);
  });

  it('returns empty arrays for malformed or garbage HTML', () => {
    const garbageHtml = '<html><script>window.__INITIAL_DATA__ = {not valid</script><div>???</div>';

    expect(parseQQMusicSongs(garbageHtml)).toEqual([]);
    expect(parseNeteasePlaylistSongs(garbageHtml)).toEqual([]);
    expect(parseSpotifyPageSongs(garbageHtml)).toEqual([]);
  });

  it('keeps title-only entries with Unknown artist', () => {
    const spotifyHtml = `
      <script type="application/ld+json">
        {"track":[{"name":"Untitled"}]}
      </script>
    `;

    expect(parseQQMusicPayload({songlist: [{songname: '无名歌曲'}]})).toEqual([
      {title: '无名歌曲', artist: 'Unknown artist', platform: 'qq', tags: []}
    ]);
    expect(parseNeteaseApiResponse({result: {tracks: [{name: '无名歌曲'}]}})).toEqual([
      {title: '无名歌曲', artist: 'Unknown artist', platform: 'netease', tags: []}
    ]);
    expect(parseSpotifyPageSongs(spotifyHtml)).toEqual([
      {title: 'Untitled', artist: 'Unknown artist', platform: 'spotify', tags: []}
    ]);
    expect(normalizeSongs('Untitled')).toEqual([
      {title: 'Untitled', artist: 'Unknown artist', platform: 'manual', tags: []}
    ]);
  });

  it('deduplicates entries case-insensitively', () => {
    const spotifyHtml = `
      <script type="application/ld+json">
        {
          "track": [
            {"name":"Yellow","byArtist":{"name":"Coldplay"}},
            {"name":" yellow ","byArtist":{"name":"COLDPLAY"}}
          ]
        }
      </script>
    `;

    expect(parseQQMusicPayload({songlist: [
      {songname: 'Yellow', singer: [{name: 'Coldplay'}]},
      {songname: ' yellow ', singer: [{name: 'COLDPLAY'}]}
    ]})).toEqual([{title: 'Yellow', artist: 'Coldplay', platform: 'qq', tags: []}]);
    expect(parseNeteaseApiResponse({result: {tracks: [
      {name: 'Yellow', artists: [{name: 'Coldplay'}]},
      {name: ' yellow ', artists: [{name: 'COLDPLAY'}]}
    ]}})).toEqual([{title: 'Yellow', artist: 'Coldplay', platform: 'netease', tags: []}]);
    expect(parseSpotifyPageSongs(spotifyHtml)).toEqual([{title: 'Yellow', artist: 'Coldplay', platform: 'spotify', tags: []}]);
    expect(normalizeSongs('Yellow - Coldplay\n yellow - COLDPLAY ')).toEqual([
      {title: 'Yellow', artist: 'Coldplay', platform: 'manual', tags: []}
    ]);
  });
});
