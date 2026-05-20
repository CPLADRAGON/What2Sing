import {afterEach, describe, expect, it, vi} from 'vitest';
import {requestEmailOtp, verifyEmailOtpCode} from '@/lib/auth/otp';

describe('email OTP login for standalone PWA', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests the login email through a same-origin route to avoid browser Supabase fetch failures', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ok: true}), {status: 200}));
    vi.stubGlobal('fetch', fetch);

    await expect(requestEmailOtp('person@example.com', 'zh')).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledWith('/api/auth/otp', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({email: 'person@example.com', locale: 'zh'})
    });
  });

  it('verifies the one-time code through a same-origin route and stores the returned session', async () => {
    const setSession = vi.fn().mockResolvedValue({error: null});
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({session: {access_token: 'access', refresh_token: 'refresh'}}), {status: 200}));
    vi.stubGlobal('fetch', fetch);

    await expect(verifyEmailOtpCode({auth: {setSession}}, 'person@example.com', '123456')).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledWith('/api/auth/verify', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({email: 'person@example.com', token: '123456'})
    });
    expect(setSession).toHaveBeenCalledWith({
      access_token: 'access',
      refresh_token: 'refresh'
    });
  });

  it('normalizes spaces from pasted codes', async () => {
    const setSession = vi.fn().mockResolvedValue({error: null});
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({session: {access_token: 'access', refresh_token: 'refresh'}}), {status: 200}));
    vi.stubGlobal('fetch', fetch);

    await verifyEmailOtpCode({auth: {setSession}}, 'person@example.com', '123 456');

    expect(fetch).toHaveBeenCalledWith('/api/auth/verify', expect.objectContaining({body: JSON.stringify({email: 'person@example.com', token: '123456'})}));
  });

  it('throws Supabase verification errors', async () => {
    const setSession = vi.fn();
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({error: 'Token has expired'}), {status: 400}));
    vi.stubGlobal('fetch', fetch);

    await expect(verifyEmailOtpCode({auth: {setSession}}, 'person@example.com', '123456')).rejects.toThrow('Token has expired');
  });

  it('throws network failures with a clear same-origin retry message', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('Load failed'));
    vi.stubGlobal('fetch', fetch);

    await expect(requestEmailOtp('person@example.com', 'zh')).rejects.toThrow('Could not reach the login service');
  });
});
