import {describe, expect, it, vi} from 'vitest';
import {verifyEmailOtpCode} from '@/lib/auth/otp';

describe('email OTP login for standalone PWA', () => {
  it('verifies the one-time code inside the current app context', async () => {
    const verifyOtp = vi.fn().mockResolvedValue({error: null});

    await expect(verifyEmailOtpCode({auth: {verifyOtp}}, 'person@example.com', '123456')).resolves.toBeUndefined();

    expect(verifyOtp).toHaveBeenCalledWith({
      email: 'person@example.com',
      token: '123456',
      type: 'email'
    });
  });

  it('normalizes spaces from pasted codes', async () => {
    const verifyOtp = vi.fn().mockResolvedValue({error: null});

    await verifyEmailOtpCode({auth: {verifyOtp}}, 'person@example.com', '123 456');

    expect(verifyOtp).toHaveBeenCalledWith({
      email: 'person@example.com',
      token: '123456',
      type: 'email'
    });
  });

  it('throws Supabase verification errors', async () => {
    const verifyOtp = vi.fn().mockResolvedValue({error: new Error('Token has expired')});

    await expect(verifyEmailOtpCode({auth: {verifyOtp}}, 'person@example.com', '123456')).rejects.toThrow('Token has expired');
  });
});
