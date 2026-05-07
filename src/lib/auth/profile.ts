type UserDisplaySource = {
  email?: string;
  user_metadata?: {
    name?: unknown;
    full_name?: unknown;
    username?: unknown;
  } | null;
} | null;

export function getUserDisplayName(user: UserDisplaySource) {
  if (!user) {
    return null;
  }

  const metadataName = [user.user_metadata?.name, user.user_metadata?.full_name, user.user_metadata?.username].find((value) => typeof value === 'string' && value.trim().length > 0);

  if (typeof metadataName === 'string') {
    return metadataName.trim();
  }

  const emailPrefix = user.email?.split('@')[0]?.trim();
  return emailPrefix || null;
}
