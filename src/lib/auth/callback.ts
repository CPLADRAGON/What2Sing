type SupabaseAuthRedirectClient = {
  auth: {
    exchangeCodeForSession: (code: string) => Promise<{error: Error | {message: string} | null}>;
    setSession: (session: {access_token: string; refresh_token: string}) => Promise<{error: Error | {message: string} | null}>;
  };
};

export async function completeAuthRedirectFromUrl(client: SupabaseAuthRedirectClient, href: string) {
  const url = new URL(href);
  const code = url.searchParams.get('code');

  if (code) {
    const {error} = await client.auth.exchangeCodeForSession(code);

    if (error) {
      throw error;
    }

    url.searchParams.delete('code');
    return buildCleanUrl(url);
  }

  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');

  if (accessToken && refreshToken) {
    const {error} = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    if (error) {
      throw error;
    }

    url.hash = '';
    return buildCleanUrl(url);
  }

  return null;
}

function buildCleanUrl(url: URL) {
  return `${url.origin}${url.pathname}${url.search}`;
}
