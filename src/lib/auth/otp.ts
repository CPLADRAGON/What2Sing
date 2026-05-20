type EmailOtpClient = {
  auth: {
    setSession: (session: {access_token: string; refresh_token: string}) => Promise<{error: Error | {message: string} | null}>;
  };
};

type AuthSessionPayload = {
  session?: {
    access_token?: unknown;
    refresh_token?: unknown;
  } | null;
  error?: unknown;
};

export async function requestEmailOtp(email: string, locale: string) {
  const response = await postAuthJson('/api/auth/otp', {email, locale});

  if (!response.ok) {
    throw new Error(await readAuthError(response));
  }
}

export async function verifyEmailOtpCode(client: EmailOtpClient, email: string, code: string) {
  const token = code.replace(/\s+/g, '');
  const response = await postAuthJson('/api/auth/verify', {email, token});

  if (!response.ok) {
    throw new Error(await readAuthError(response));
  }

  const payload = (await response.json()) as AuthSessionPayload;
  const accessToken = payload.session?.access_token;
  const refreshToken = payload.session?.refresh_token;

  if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
    throw new Error('Login code verified, but no session was returned. Please request a new code.');
  }

  const {error} = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });

  if (error) {
    throw error;
  }
}

async function postAuthJson(url: string, body: unknown) {
  try {
    return await fetch(url, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify(body)
    });
  } catch {
    throw new Error('Could not reach the login service. Please check your network and try again.');
  }
}

async function readAuthError(response: Response) {
  try {
    const payload = (await response.json()) as AuthSessionPayload;

    if (typeof payload.error === 'string') {
      return payload.error;
    }
  } catch {
    // Ignore invalid error payloads and use a generic message below.
  }

  if (response.status >= 500) {
    return 'The login service could not reach Supabase. Please try again, then check Vercel function logs if it continues.';
  }

  return 'Login failed. Please try again.';
}