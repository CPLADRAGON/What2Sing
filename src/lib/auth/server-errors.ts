export function getSupabaseAuthFailureMessage(error: unknown, supabaseUrl?: string) {
  const message = getErrorMessage(error);

  if (isFetchFailure(message)) {
    return `Could not reach Supabase Auth from the server (${getSupabaseHost(supabaseUrl)}). Check the Supabase project URL, project status, and Vercel network access.`;
  }

  return message || 'Login failed. Please try again.';
}

export function getAuthServerErrorStatus(error: unknown) {
  return isFetchFailure(getErrorMessage(error)) ? 502 : 400;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }

  return typeof error === 'string' ? error : '';
}

function isFetchFailure(message: string) {
  return /fetch failed|network|econnrefused|enotfound|etimedout|timeout/i.test(message);
}

function getSupabaseHost(supabaseUrl?: string) {
  if (!supabaseUrl) {
    return 'missing Supabase URL';
  }

  try {
    return new URL(supabaseUrl).host;
  } catch {
    return 'invalid Supabase URL';
  }
}
