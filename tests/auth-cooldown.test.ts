import {describe, expect, it} from 'vitest';
import {getMagicLinkCooldownSeconds} from '@/lib/auth/cooldown';

describe('magic link email cooldown', () => {
  it('returns remaining seconds while a recent email request is cooling down', () => {
    expect(getMagicLinkCooldownSeconds(1_000, 31_000)).toBe(30);
  });

  it('returns zero when the cooldown has expired', () => {
    expect(getMagicLinkCooldownSeconds(1_000, 61_000)).toBe(0);
  });

  it('returns zero when no email has been requested yet', () => {
    expect(getMagicLinkCooldownSeconds(null, 61_000)).toBe(0);
  });
});
