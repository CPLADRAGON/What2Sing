import {describe, expect, it} from 'vitest';
import {extractQQMusicPlaylistIds, normalizeSongs, parseQQMusicPayload, parseQQMusicSongs} from '@/lib/importers/qq';

describe('QQ Music importer', () => {
  it('parses songs from window.__INITIAL_DATA__ HTML', () => {
    const html = `
      <html>
        <script>
          window.__INITIAL_DATA__ = {
            playlist: {
              songlist: [
                {songname: '稻香', singer: [{name: '周杰伦'}]},
                {title: '修炼爱情', singer: [{name: '林俊杰'}]}
              ]
            }
          };
        </script>
      </html>
    `;

    expect(parseQQMusicSongs(html)).toEqual([
      {title: '稻香', artist: '周杰伦', platform: 'qq', tags: []},
      {title: '修炼爱情', artist: '林俊杰', platform: 'qq', tags: []}
    ]);
  });

  it('normalizes pasted song text', () => {
    expect(normalizeSongs('后来 - 刘若英\n五月天 / 倔强')).toEqual([
      {title: '后来', artist: '刘若英', platform: 'manual', tags: []},
      {title: '五月天', artist: '倔强', platform: 'manual', tags: []}
    ]);
  });

  it('extracts playlist ids from QQ Music short-link landing HTML', () => {
    const html = `
      <html>
        <script>
          location.replace('https://y.qq.com/n/ryqq/playlist/9222222222');
        </script>
        <a href="https%3A%2F%2Fy.qq.com%2Fn%2Fryqq%2Fplaylist%2F9333333333">open</a>
      </html>
    `;

    expect(extractQQMusicPlaylistIds('https://c6.y.qq.com/base/fcgi-bin/u?__=abc', html)).toEqual([
      '9222222222',
      '9333333333'
    ]);
  });

  it('parses songs from QQ Music playlist API JSON', () => {
    const payload = {
      cdlist: [
        {
          songlist: [
            {songname: '突然好想你', singer: [{name: '五月天'}]},
            {songname: '小幸运', singer: [{name: '田馥甄'}]}
          ]
        }
      ]
    };

    expect(parseQQMusicPayload(payload)).toEqual([
      {title: '突然好想你', artist: '五月天', platform: 'qq', tags: []},
      {title: '小幸运', artist: '田馥甄', platform: 'qq', tags: []}
    ]);
  });
});
