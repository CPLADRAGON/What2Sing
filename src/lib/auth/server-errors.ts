export function getSupabaseAuthFailureMessage(error: unknown, supabaseUrl?: string) {
  if (isFetchFailure(error)) {
    return `Could not reach Supabase Auth from the server (${getSupabaseHost(supabaseUrl)}). Check the Supabase project URL, project status, and Vercel network access.`;
  }

  return getErrorMessage(error) || 'Login failed. Please try again.';
}

export function getAuthServerErrorStatus(error: unknown) {
  return isFetchFailure(error) ? 502 : 400;
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

function getErrorName(error: unknown) {
  if (typeof error === 'object' && error && 'name' in error && typeof error.name === 'string') {
    return error.name;
  }

  return '';
}

function isFetchFailure(error: unknown) {
  // Supabase surfaces upstream network/DNS failures as AuthRetryableFetchError,
  // whose message can be an unhelpful "{}", so match on the error name too.
  if (getErrorName(error) === 'AuthRetryableFetchError') {
    return true;
  }

  return /fetch failed|failed to fetch|network|econnrefused|enotfound|etimedout|timeout/i.test(getErrorMessage(error));
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
