import {describe, expect, it, vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {completeAuthRedirectFromUrl} from '@/lib/auth/callback';

describe('auth callback completion', () => {
  it('exchanges a PKCE code in the redirect URL and returns a clean URL', async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({error: null});
    const setSession = vi.fn();

    const cleanUrl = await completeAuthRedirectFromUrl(
      {auth: {exchangeCodeForSession, setSession}},
      'https://what2-sing.vercel.app/zh/login?code=abc123&next=/pick'
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc123');
    expect(setSession).not.toHaveBeenCalled();
    expect(cleanUrl).toBe('https://what2-sing.vercel.app/zh/login?next=%2Fpick');
  });

  it('persists implicit magic-link tokens from the URL hash and returns a clean URL', async () => {
    const exchangeCodeForSession = vi.fn();
    const setSession = vi.fn().mockResolvedValue({error: null});

    const cleanUrl = await completeAuthRedirectFromUrl(
      {auth: {exchangeCodeForSession, setSession}},
      'https://what2-sing.vercel.app/zh/login#access_token=access-token&refresh_token=refresh-token&type=magiclink'
    );

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(setSession).toHaveBeenCalledWith({
      access_token: 'access-token',
      refresh_token: 'refresh-token'
    });
    expect(cleanUrl).toBe('https://what2-sing.vercel.app/zh/login');
  });

  it('does nothing when the URL has no auth payload', async () => {
    const exchangeCodeForSession = vi.fn();
    const setSession = vi.fn();

    const cleanUrl = await completeAuthRedirectFromUrl(
      {auth: {exchangeCodeForSession, setSession}},
      'https://what2-sing.vercel.app/zh/login'
    );

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(setSession).not.toHaveBeenCalled();
    expect(cleanUrl).toBeNull();
  });

  it('keeps an in-app email code option for iOS Home Screen mode', () => {
    const source = readFileSync('src/components/auth/login-form.tsx', 'utf8');

    expect(source).toContain('verifyEmailOtpCode');
    expect(source).toContain('otpCode');
    expect(source).toContain('verifyCode');
  });
});
