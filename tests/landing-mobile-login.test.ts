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
});
