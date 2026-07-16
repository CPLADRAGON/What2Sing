import {describe, expect, it} from 'vitest';
import {IMPORT_FETCH_TIMEOUT_MS, isHostAllowed} from '@/lib/importers/fetch-guard';

describe('fetch guard', () => {
  const qqHostPattern = /(^|\.)qq\.com$/i;

  it('matches exact hosts', () => {
    expect(isHostAllowed('qq.com', qqHostPattern)).toBe(true);
  });

  it('matches subdomains', () => {
    expect(isHostAllowed('y.qq.com', qqHostPattern)).toBe(true);
  });

  it('rejects lookalike hosts', () => {
    expect(isHostAllowed('evilqq.com', qqHostPattern)).toBe(false);
    expect(isHostAllowed('qq.com.evil.com', qqHostPattern)).toBe(false);
  });

  it('rejects empty hosts', () => {
    expect(isHostAllowed('', qqHostPattern)).toBe(false);
  });

  it('exports a positive fetch timeout', () => {
    expect(IMPORT_FETCH_TIMEOUT_MS).toBeGreaterThan(0);
  });
});
