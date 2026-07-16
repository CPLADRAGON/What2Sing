'use client';

export function isRawImportDeck(value: string | null): boolean {
  if (!value) {
    return false;
  }

  try {
    return Array.isArray(JSON.parse(value) as unknown);
  } catch {
    return false;
  }
}

export function vibrate(pattern: VibratePattern = 10) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}
