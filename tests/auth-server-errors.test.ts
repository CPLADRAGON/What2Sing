import {describe, expect, it} from 'vitest';
import {getAuthServerErrorStatus, getSupabaseAuthFailureMessage} from '@/lib/auth/server-errors';

describe('auth server diagnostics', () => {
  it('turns thrown Supabase fetch failures into actionable diagnostics', () => {
    expect(getSupabaseAuthFailureMessage(new TypeError('fetch failed'), 'https://abc123.supabase.co')).toBe(
      'Could not reach Supabase Auth from the server (abc123.supabase.co). Check the Supabase project URL, project status, and Vercel network access.'
    );
  });

  it('uses 502 for upstream Supabase network failures', () => {
    expect(getAuthServerErrorStatus(new TypeError('fetch failed'))).toBe(502);
  });

  it('treats Supabase AuthRetryableFetchError as an upstream network failure', () => {
    const retryable = Object.assign(new Error('{}'), {name: 'AuthRetryableFetchError'});
    expect(getSupabaseAuthFailureMessage(retryable, 'https://abc123.supabase.co')).toBe(
      'Could not reach Supabase Auth from the server (abc123.supabase.co). Check the Supabase project URL, project status, and Vercel network access.'
    );
    expect(getAuthServerErrorStatus(retryable)).toBe(502);
  });

  it('preserves normal Supabase auth error messages as client errors', () => {
    expect(getSupabaseAuthFailureMessage(new Error('Token has expired'), 'https://abc123.supabase.co')).toBe('Token has expired');
    expect(getAuthServerErrorStatus(new Error('Token has expired'))).toBe(400);
  });
});
