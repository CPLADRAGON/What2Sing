import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

describe('landing mobile navigation', () => {
  it('keeps the login link visible on phone-sized screens', () => {
    const source = readFileSync('src/components/landing/landing-experience.tsx', 'utf8');
    const loginLinkLine = source.split('\n').find((line) => line.includes('/login') && line.includes('className='));

    expect(loginLinkLine).toBeDefined();
    expect(loginLinkLine).not.toContain('hidden');
    expect(loginLinkLine).not.toContain('sm:inline-flex');
  });

  it('shows signed-in user identity beside the login action', () => {
    const source = readFileSync('src/components/landing/landing-experience.tsx', 'utf8');

    expect(source).toContain('displayName');
    expect(source).toContain('getUserDisplayName');
  });

  it('makes the library panel interactive', () => {
    const source = readFileSync('src/components/landing/landing-experience.tsx', 'utf8');

    expect(source).toContain('generateSingingOrder');
    expect(source).toContain('pickRandomSong');
    expect(source).toContain('handleDeleteBatch');
  });

  it('shows logout instead of login for signed-in users', () => {
    const source = readFileSync('src/components/landing/landing-experience.tsx', 'utf8');

    expect(source).toContain('signOut');
    expect(source).toContain("displayName ? (");
  });

  it('offers inline source tabs for QQ, Spotify, NetEase, and manual paste', () => {
    const source = readFileSync('src/components/landing/landing-experience.tsx', 'utf8');

    expect(source).toContain('setActiveSource');
    expect(source).toContain("activeSource === 'spotify'");
    expect(source).toContain("activeSource === 'netease'");
    expect(source).toContain("activeSource === 'manual'");
  });

  it('saves per-batch picker sessions and syncs to library', () => {
    const source = readFileSync('src/components/landing/landing-experience.tsx', 'utf8');

    expect(source).toContain('saveBatchSession');
    expect(source).toContain('addSongsToLibrary');
    expect(source).toContain('savePickerStateForCurrentUser');
    expect(source).toContain('getBatchProgress');
  });

  it('uses immediate card transitions instead of waiting for exit animations', () => {
    const source = readFileSync('src/components/picker/picker-experience.tsx', 'utf8');

    expect(source).not.toContain('mode="wait"');
    expect(source).toContain('isSwipeLocked');
  });
});
