import {afterEach, describe, expect, it} from 'vitest';
import {safeGetItem, safeRemoveItem, safeSetItem} from '@/lib/safe-storage';

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

function restoreWindow() {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
    return;
  }

  Reflect.deleteProperty(globalThis, 'window');
}

function setMockStorage(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {localStorage: storage}
  });
}

describe('safe-storage', () => {
  afterEach(() => {
    restoreWindow();
  });

  it('round-trips set, get, and remove with localStorage', () => {
    const values = new Map<string, string>();

    setMockStorage({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      }
    });

    expect(safeSetItem('song', 'Yellow')).toBe(true);
    expect(safeGetItem('song')).toBe('Yellow');
    expect(safeRemoveItem('song')).toBe(true);
    expect(safeGetItem('song')).toBeNull();
  });

  it('returns null or false when localStorage throws', () => {
    const quotaError = new DOMException('Full', 'QuotaExceededError');

    setMockStorage({
      getItem: () => {
        throw new Error('storage unavailable');
      },
      setItem: () => {
        throw quotaError;
      },
      removeItem: () => {
        throw new Error('storage unavailable');
      }
    });

    expect(safeGetItem('song')).toBeNull();
    expect(safeSetItem('song', 'Yellow')).toBe(false);
    expect(safeRemoveItem('song')).toBe(false);
  });

  it('returns safe values when window is undefined', () => {
    Reflect.deleteProperty(globalThis, 'window');

    expect(safeGetItem('song')).toBeNull();
    expect(safeSetItem('song', 'Yellow')).toBe(false);
    expect(safeRemoveItem('song')).toBe(false);
  });
});
