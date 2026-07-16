// Guarded localStorage access. Never throws: returns null / false on failure
// (SSR, disabled storage, Safari private mode, QuotaExceededError).

export function safeGetItem(key: string): string | null {
  try {
    if (typeof window === 'undefined') {
      return null;
    }

    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetItem(key: string, value: string): boolean {
  try {
    if (typeof window === 'undefined') {
      return false;
    }

    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeRemoveItem(key: string): boolean {
  try {
    if (typeof window === 'undefined') {
      return false;
    }

    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
