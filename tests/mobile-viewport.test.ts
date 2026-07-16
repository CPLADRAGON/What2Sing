import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

describe('mobile viewport stability', () => {
  it('locks zoom gestures on the picker route to protect swipe interactions', () => {
    const source = readFileSync('src/app/[locale]/pick/page.tsx', 'utf8');

    expect(source).toContain('initialScale: 1');
    expect(source).toContain('maximumScale: 1');
    expect(source).toContain('userScalable: false');
  });

  it('allows pinch-zoom on the rest of the app for accessibility', () => {
    const source = readFileSync('src/app/layout.tsx', 'utf8');

    expect(source).toContain('initialScale: 1');
    expect(source).not.toContain('maximumScale: 1');
    expect(source).not.toContain('userScalable: false');
  });

  it('uses touch-action manipulation to prevent double-tap zoom during swipes', () => {
    const source = readFileSync('src/app/globals.css', 'utf8');

    expect(source).toContain('touch-action: manipulation');
  });

  it('keeps form controls at 16px to avoid iOS focus zoom', () => {
    const source = readFileSync('src/app/globals.css', 'utf8');

    expect(source).toMatch(/input,\s*textarea,\s*select/);
    expect(source).toContain('font-size: 16px');
  });
});
