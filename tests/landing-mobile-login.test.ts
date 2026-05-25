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
    expect(source).toContain('handleDeleteSong');
  });

  it('shows logout instead of login for signed-in users', () => {
    const source = readFileSync('src/components/landing/landing-experience.tsx', 'utf8');

    expect(source).toContain('signOut');
    expect(source).toContain("displayName ? (");
  });

  it('offers an import source popup with QQ, Spotify, and manual paste', () => {
    const source = readFileSync('src/components/landing/landing-experience.tsx', 'utf8');

    expect(source).toContain('showSourcePicker');
    expect(source).toContain("activeSource === 'spotify'");
    expect(source).toContain("activeSource === 'qq'");
    expect(source).toContain("activeSource === 'manual'");
  });

  it('merges newly keyed songs with existing swipe progress instead of overwriting it', () => {
    const source = readFileSync('src/components/landing/landing-experience.tsx', 'utf8');

    expect(source).toContain('appendSongsToSession');
    expect(source).toContain('addSongsToLibrary');
    expect(source).toContain('savePickerStateForCurrentUser');
  });

  it('uses immediate card transitions instead of waiting for exit animations', () => {
    const source = readFileSync('src/components/picker/picker-experience.tsx', 'utf8');

    expect(source).not.toContain('mode="wait"');
    expect(source).toContain('isSwipeLocked');
  });
});
