'use client';

import {useLocale, useTranslations} from 'next-intl';
import Link from 'next/link';
import {useEffect, useState} from 'react';
import {completeAuthRedirectFromUrl} from '@/lib/auth/callback';
import {getAuthRedirectUrl} from '@/lib/auth/redirect';
import {supabase} from '@/lib/supabase';

export function LoginForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);

  useEffect(() => {
    const client = supabase;
    let isMounted = true;

    if (!client) {
      return;
    }

    const authClient = client;

    async function syncSessionFromRedirect() {
      try {
        const cleanUrl = await completeAuthRedirectFromUrl(authClient, window.location.href);

        if (cleanUrl) {
          window.history.replaceState(window.history.state, document.title, cleanUrl);
        }

        const {data} = await authClient.auth.getSession();

        if (isMounted) {
          setSignedInEmail(data.session?.user.email ?? null);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setStatus('error');
        setMessage(error instanceof Error ? error.message : t('unavailable'));
      }
    }

    void syncSessionFromRedirect();

    const {data: subscription} = authClient.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setSignedInEmail(session?.user.email ?? null);
      }
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [t]);

  async function sendMagicLink() {
    if (!supabase) {
      setStatus('error');
      setMessage(t('unavailable'));
      return;
    }

    setStatus('sending');
    setMessage('');

    const {error} = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: getAuthRedirectUrl(locale, window.location.origin)
      }
    });

    if (error) {
      setStatus('error');
      setMessage(error.message);
      return;
    }

    setStatus('sent');
    setMessage(t('sent'));
  }

  async function signOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setSignedInEmail(null);
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-canvas px-5 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(85,230,255,0.18),transparent_28rem),radial-gradient(circle_at_12%_65%,rgba(255,61,139,0.20),transparent_24rem)]" />
      <section className="relative z-10 w-full max-w-md rounded-[2.25rem] border border-hairline-strong bg-surface-card/90 p-6 shadow-glow backdrop-blur-xl">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-karaoke-cyan">KTV-Picker</p>
        <h1 className="mt-3 font-display text-4xl font-black leading-none tracking-[-0.06em]">{t('loginTitle')}</h1>
        <p className="mt-3 text-sm leading-6 text-body-muted">{t('loginBody')}</p>

        {signedInEmail ? (
          <div className="mt-6 rounded-3xl border border-karaoke-cyan/20 bg-karaoke-cyan/10 p-4">
            <p className="text-sm text-ink-soft">{t('signedInAs', {email: signedInEmail})}</p>
            <button type="button" onClick={signOut} className="mt-4 h-11 w-full rounded-2xl bg-white text-sm font-black text-canvas">
              {t('signOut')}
            </button>
          </div>
        ) : (
          <div className="mt-6">
            <label htmlFor="email" className="text-sm font-semibold text-ink-soft">
              {t('emailLabel')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t('emailPlaceholder')}
              className="mt-2 h-12 w-full rounded-2xl border border-hairline-strong bg-black/35 px-4 text-sm text-white outline-none transition placeholder:text-body-muted focus:border-karaoke-cyan/70 focus:shadow-[0_0_0_4px_rgba(85,230,255,0.10)]"
            />
            <button
              type="button"
              onClick={sendMagicLink}
              disabled={!email.trim() || status === 'sending'}
              className="mt-4 h-12 w-full rounded-2xl bg-white text-sm font-black text-canvas transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === 'sending' ? t('sending') : t('sendLink')}
            </button>
            {message ? <p className={`mt-3 text-sm ${status === 'error' ? 'text-karaoke' : 'text-karaoke-cyan'}`}>{message}</p> : null}
          </div>
        )}

        {!supabase ? <p className="mt-4 rounded-2xl border border-karaoke/20 bg-karaoke/10 px-3 py-2 text-xs leading-5 text-ink-soft">{t('unavailable')}</p> : null}
        <Link href={`/${locale}`} className="mt-5 inline-flex text-sm font-semibold text-ink-soft hover:text-white">
          {t('backHome')}
        </Link>
      </section>
    </main>
  );
}
