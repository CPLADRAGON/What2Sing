import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {POST} from '@/app/api/auth/otp/route';

const supabaseMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  signInWithOtp: vi.fn()
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: supabaseMocks.createClient
}));

describe('auth OTP route', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc123.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    supabaseMocks.createClient.mockReturnValue({auth: {signInWithOtp: supabaseMocks.signInWithOtp}});
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it('returns an actionable 502 when Supabase cannot send the login email', async () => {
    supabaseMocks.signInWithOtp.mockResolvedValue({
      error: Object.assign(new Error('Error sending confirmation email'), {status: 500})
    });

    const response = await POST(new Request('https://what2-sing.test/api/auth/otp', {
      method: 'POST',
      body: JSON.stringify({email: 'person@example.com', locale: 'en'})
    }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "We couldn't send the login email. The app's email service may be misconfigured — please try again later or contact the site owner."
    });
  });

  it('keeps rate limits as 429 responses', async () => {
    supabaseMocks.signInWithOtp.mockResolvedValue({
      error: new Error('Email rate limit exceeded')
    });

    const response = await POST(new Request('https://what2-sing.test/api/auth/otp', {
      method: 'POST',
      body: JSON.stringify({email: 'person@example.com', locale: 'en'})
    }));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({error: 'Email rate limit exceeded'});
  });
});
