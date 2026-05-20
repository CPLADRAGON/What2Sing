import {createClient} from '@supabase/supabase-js';
import {NextResponse} from 'next/server';

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as {email?: unknown; token?: unknown} | null;
  const email = typeof payload?.email === 'string' ? payload.email.trim() : '';
  const token = typeof payload?.token === 'string' ? payload.token.replace(/\s+/g, '') : '';

  if (!email || !token) {
    return NextResponse.json({error: 'Email and code are required.'}, {status: 400});
  }

  const client = createAuthClient();

  if (!client) {
    return NextResponse.json({error: 'Supabase is not configured.'}, {status: 503});
  }

  const {data, error} = await client.auth.verifyOtp({
    email,
    token,
    type: 'email'
  });

  if (error) {
    return NextResponse.json({error: error.message}, {status: 400});
  }

  return NextResponse.json({session: data.session});
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