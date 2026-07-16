export const IMPORT_FETCH_TIMEOUT_MS = 10000;

export function isHostAllowed(hostname: string, pattern: RegExp): boolean {
  return hostname.length > 0 && pattern.test(hostname);
}
