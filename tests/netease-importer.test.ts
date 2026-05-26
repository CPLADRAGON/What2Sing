import {describe, expect, it} from 'vitest';
import {extractNeteasePlaylistId, parseNeteaseApiResponse, parseNeteasePlaylistSongs} from '@/lib/importers/netease';

describe('NetEase Cloud Music importer', () => {
  it('parses songs from textarea#song-list-pre-cache', () => {
    const html = `
      <html>
        <textarea id="song-list-pre-cache">
          [{"name":"稻香","artists":[{"name":"周杰伦"}]},{"name":"修炼爱情","artists":[{"name":"林俊杰"}]}]
        </textarea>
      </html>
    `;

    expect(parseNeteasePlaylistSongs(html)).toEqual([
      {title: '稻香', artist: '周杰伦', platform: 'netease', tags: []},
      {title: '修炼爱情', artist: '林俊杰', platform: 'netease', tags: []}
    ]);
  });

  it('parses songs from hidden ul.f-hide list', () => {
    const html = `
      <html>
        <ul class="f-hide">
          <li><a href="/song?id=123">突然好想你</a></li>
          <li><a href="/song?id=456">小幸运</a></li>
        </ul>
      </html>
    `;

    expect(parseNeteasePlaylistSongs(html)).toEqual([
      {title: '突然好想你', artist: 'Unknown', platform: 'netease', tags: []},
      {title: '小幸运', artist: 'Unknown', platform: 'netease', tags: []}
    ]);
  });

  it('parses songs from window.__INITIAL_STATE__ script', () => {
    const html = `
      <html>
        <script>
          window.__INITIAL_STATE__ = {"tracks":[{"name":"后来","ar":[{"name":"刘若英"}]},{"name":"演员","ar":[{"name":"薛之谦"}]}]};
        </script>
      </html>
    `;

    expect(parseNeteasePlaylistSongs(html)).toEqual([
      {title: '后来', artist: '刘若英', platform: 'netease', tags: []},
      {title: '演员', artist: '薛之谦', platform: 'netease', tags: []}
    ]);
  });

  it('parses API response with result.tracks', () => {
    const payload = {
      result: {
        tracks: [
          {name: '稻香', artists: [{name: '周杰伦'}]},
          {name: '小幸运', artists: [{name: '田馥甄'}]}
        ]
      }
    };

    expect(parseNeteaseApiResponse(payload)).toEqual([
      {title: '稻香', artist: '周杰伦', platform: 'netease', tags: []},
      {title: '小幸运', artist: '田馥甄', platform: 'netease', tags: []}
    ]);
  });

  it('parses API response with playlist.tracks using ar[] array', () => {
    const payload = {
      playlist: {
        tracks: [
          {name: '突然好想你', ar: [{name: '五月天'}]},
          {name: '倔强', ar: [{name: '五月天'}]}
        ]
      }
    };

    expect(parseNeteaseApiResponse(payload)).toEqual([
      {title: '突然好想你', artist: '五月天', platform: 'netease', tags: []},
      {title: '倔强', artist: '五月天', platform: 'netease', tags: []}
    ]);
  });

  it('handles multiple artists joined with /', () => {
    const payload = {
      result: {
        tracks: [{name: '匆匆那年', artists: [{name: '王菲'}, {name: '陈奕迅'}]}]
      }
    };

    expect(parseNeteaseApiResponse(payload)).toEqual([{title: '匆匆那年', artist: '王菲 / 陈奕迅', platform: 'netease', tags: []}]);
  });

  it('deduplicates songs', () => {
    const payload = {
      result: {
        tracks: [
          {name: '稻香', artists: [{name: '周杰伦'}]},
          {name: '稻香', artists: [{name: '周杰伦'}]}
        ]
      }
    };

    expect(parseNeteaseApiResponse(payload)).toEqual([{title: '稻香', artist: '周杰伦', platform: 'netease', tags: []}]);
  });

  it('returns empty for invalid payload', () => {
    expect(parseNeteaseApiResponse(null)).toEqual([]);
    expect(parseNeteaseApiResponse('not valid')).toEqual([]);
    expect(parseNeteaseApiResponse({})).toEqual([]);
  });

  describe('extractNeteasePlaylistId', () => {
    it('extracts from standard URL with query param', () => {
      expect(extractNeteasePlaylistId('https://music.163.com/playlist?id=2829816518')).toBe('2829816518');
    });

    it('extracts from hash-based URL', () => {
      expect(extractNeteasePlaylistId('https://music.163.com/#/playlist?id=2829816518')).toBe('2829816518');
    });

    it('extracts from mobile URL', () => {
      expect(extractNeteasePlaylistId('https://y.music.163.com/m/playlist?id=2829816518')).toBe('2829816518');
    });

    it('extracts from path-based URL', () => {
      expect(extractNeteasePlaylistId('https://music.163.com/playlist/2829816518/12345')).toBe('2829816518');
    });

    it('returns null for unknown format', () => {
      expect(extractNeteasePlaylistId('https://example.com/page')).toBeNull();
    });
  });
});
