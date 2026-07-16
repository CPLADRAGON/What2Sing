import {describe, expect, it} from 'vitest';
import {songKey} from '@/lib/picker/song-key';

describe('songKey', () => {
  it('matches identical songs modulo case and surrounding whitespace', () => {
    const first = songKey({title: '  Yellow  ', artist: '  Coldplay  '});
    const second = songKey({title: 'yellow', artist: 'COLDPLAY'});

    expect(first).toBe(second);
  });

  it('produces different keys for different titles or artists', () => {
    const original = songKey({title: 'Yellow', artist: 'Coldplay'});

    expect(songKey({title: 'Style', artist: 'Coldplay'})).not.toBe(original);
    expect(songKey({title: 'Yellow', artist: 'Taylor Swift'})).not.toBe(original);
  });
});
