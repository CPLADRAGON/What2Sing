import {describe, expect, it} from 'vitest';
import {extractSpotifyPlaylistId, parseSpotifyPageSongs} from '@/lib/importers/spotify';

describe('Spotify public page importer', () => {
  it('extracts a playlist id from Spotify playlist URLs', () => {
    expect(extractSpotifyPlaylistId('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc')).toBe('37i9dQZF1DXcBWIGoYBM5M');
  });

  it('parses songs from JSON-LD MusicPlaylist HTML when public metadata is present', () => {
    const html = `
      <html>
        <script type="application/ld+json">
          {
            "@type": "MusicPlaylist",
            "track": [
              {"@type": "MusicRecording", "name": "Yellow", "byArtist": {"name": "Coldplay"}},
              {"@type": "MusicRecording", "name": "Style", "byArtist": [{"name": "Taylor Swift"}]},
              {"@type": "MusicRecording", "name": " yellow ", "byArtist": {"name": "COLDPLAY"}},
              {"@type": "MusicRecording", "name": "Untitled"}
            ]
          }
        </script>
      </html>
    `;

    expect(parseSpotifyPageSongs(html)).toEqual([
      {title: 'Yellow', artist: 'Coldplay', platform: 'spotify', tags: []},
      {title: 'Style', artist: 'Taylor Swift', platform: 'spotify', tags: []},
      {title: 'Untitled', artist: 'Unknown artist', platform: 'spotify', tags: []}
    ]);
  });
});
