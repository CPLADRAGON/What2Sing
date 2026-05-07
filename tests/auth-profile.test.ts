import {describe, expect, it} from 'vitest';
import {getUserDisplayName} from '@/lib/auth/profile';

describe('auth profile display', () => {
  it('uses explicit display metadata when available', () => {
    expect(getUserDisplayName({email: 'person@example.com', user_metadata: {name: 'Bo'}})).toBe('Bo');
  });

  it('defaults to the email prefix for magic-link users', () => {
    expect(getUserDisplayName({email: 'wby1279501447@gmail.com', user_metadata: {}})).toBe('wby1279501447');
  });

  it('falls back to guest when no email is available', () => {
    expect(getUserDisplayName(null)).toBeNull();
  });
});
