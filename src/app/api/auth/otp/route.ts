import {createClient} from '@supabase/supabase-js';
import {NextResponse} from 'next/server';
import {getAuthRedirectUrl} from '@/lib/auth/redirect';
import {getAuthServerErrorStatus, getSupabaseAuthFailureMessage} from '@/lib/auth/server-errors';

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as {email?: unknown; locale?: unknown} | null;
  const email = typeof payload?.email === 'string' ? payload.email.trim() : '';
  const locale = typeof payload?.locale === 'string' ? payload.locale : 'en';

  if (!email) {
    return NextResponse.json({error: 'Email is required.'}, {status: 400});
  }

  const client = createAuthClient();

  if (!client) {
    return NextResponse.json({error: 'Supabase is not configured.'}, {status: 503});
  }

  try {
    const {error} = await client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: getAuthRedirectUrl(locale, new URL(request.url).origin)
      }
    });

    if (error) {
      return NextResponse.json({error: error.message}, {status: error.message.toLowerCase().includes('rate limit') ? 429 : 400});
    }

    return NextResponse.json({ok: true});
  } catch (error) {
    console.error('Supabase OTP request failed', error);
    return NextResponse.json({error: getSupabaseAuthFailureMessage(error, process.env.NEXT_PUBLIC_SUPABASE_URL)}, {status: getAuthServerErrorStatus(error)});
  }
}

function createAuthClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}