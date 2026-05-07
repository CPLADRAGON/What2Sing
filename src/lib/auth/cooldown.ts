export const MAGIC_LINK_COOLDOWN_SECONDS = 60;

export function getMagicLinkCooldownSeconds(lastRequestedAt: number | null, now = Date.now(), cooldownSeconds = MAGIC_LINK_COOLDOWN_SECONDS) {
  if (!lastRequestedAt) {
    return 0;
  }

  const elapsedSeconds = Math.floor((now - lastRequestedAt) / 1000);
  return Math.max(0, cooldownSeconds - elapsedSeconds);
}
