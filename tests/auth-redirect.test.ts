import {describe, expect, it} from 'vitest';
import {getAuthRedirectUrl} from '@/lib/auth/redirect';

describe('auth redirect URL', () => {
  it('uses configured public site URL instead of localhost origin when available', () => {
    expect(getAuthRedirectUrl('zh', 'http://localhost:3000', 'https://what2-sing.vercel.app')).toBe('https://what2-sing.vercel.app/zh/login');
  });

  it('falls back to current origin for local development', () => {
    expect(getAuthRedirectUrl('en', 'http://localhost:3000')).toBe('http://localhost:3000/en/login');
  });

  it('removes trailing slash from configured public site URL', () => {
    expect(getAuthRedirectUrl('zh', 'http://localhost:3000', 'https://what2-sing.vercel.app/')).toBe('https://what2-sing.vercel.app/zh/login');
  });
});
