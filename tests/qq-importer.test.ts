import {describe, expect, it} from 'vitest';
import {normalizeSongs, parseQQMusicSongs} from '@/lib/importers/qq';

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
});
