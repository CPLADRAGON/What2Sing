'use client';

import {useLocale, useTranslations} from 'next-intl';
import Link from 'next/link';
import {useEffect, useState} from 'react';
import {completeAuthRedirectFromUrl} from '@/lib/auth/callback';
import {getMagicLinkCooldownSeconds, MAGIC_LINK_COOLDOWN_SECONDS} from '@/lib/auth/cooldown';
import {requestEmailOtp, verifyEmailOtpCode} from '@/lib/auth/otp';
import {supabase} from '@/lib/supabase';

const MAGIC_LINK_LAST_REQUESTED_KEY = 'ktv-picker:magic-link-requested-at';

export function LoginForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'verifying' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

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

  useEffect(() => {
    function refreshCooldown() {
      const lastRequestedAt = Number(window.localStorage.getItem(MAGIC_LINK_LAST_REQUESTED_KEY));
      setCooldownSeconds(getMagicLinkCooldownSeconds(Number.isFinite(lastRequestedAt) ? lastRequestedAt : null));
    }

    refreshCooldown();
    const interval = window.setInterval(refreshCooldown, 1000);

    return () => window.clearInterval(interval);
  }, []);

  async function sendMagicLink() {
    if (!supabase) {
      setStatus('error');
      setMessage(t('unavailable'));
      return;
    }

    if (cooldownSeconds > 0) {
      setStatus('error');
      setMessage(t('retryIn', {seconds: cooldownSeconds}));
      return;
    }

    setStatus('sending');
    setMessage('');

    try {
      await requestEmailOtp(email.trim(), locale);
    } catch (error) {
      setStatus('error');
      const message = error instanceof Error ? error.message : t('unavailable');
      const isRateLimited = message.toLowerCase().includes('rate limit') || message.includes('429');

      if (isRateLimited) {
        window.localStorage.setItem(MAGIC_LINK_LAST_REQUESTED_KEY, String(Date.now()));
        setCooldownSeconds(MAGIC_LINK_COOLDOWN_SECONDS);
        setMessage(t('retryIn', {seconds: MAGIC_LINK_COOLDOWN_SECONDS}));
        return;
      }

      setMessage(message);
      return;
    }

    window.localStorage.setItem(MAGIC_LINK_LAST_REQUESTED_KEY, String(Date.now()));
    setCooldownSeconds(MAGIC_LINK_COOLDOWN_SECONDS);
    setStatus('sent');
    setMessage(t('sent'));
  }

  async function verifyCode() {
    if (!supabase) {
      setStatus('error');
      setMessage(t('unavailable'));
      return;
    }

    setStatus('verifying');
    setMessage('');

    try {
      await verifyEmailOtpCode(supabase, email.trim(), otpCode);
      const {data} = await supabase.auth.getSession();
      setSignedInEmail(data.session?.user.email ?? email.trim());
      setStatus('idle');
      setOtpCode('');
      setMessage(t('verified'));
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : t('unavailable'));
    }
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
              disabled={!email.trim() || status === 'sending' || cooldownSeconds > 0}
              className="mt-4 h-12 w-full rounded-2xl bg-white text-sm font-black text-canvas transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === 'sending' ? t('sending') : cooldownSeconds > 0 ? t('retryIn', {seconds: cooldownSeconds}) : t('sendLink')}
            </button>
            {status === 'sent' || status === 'verifying' || otpCode ? (
              <div className="mt-5 rounded-3xl border border-karaoke-cyan/20 bg-karaoke-cyan/10 p-4">
                <label htmlFor="otp-code" className="text-sm font-semibold text-ink-soft">
                  {t('codeLabel')}
                </label>
                <input
                  id="otp-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value)}
                  placeholder={t('codePlaceholder')}
                  className="mt-2 h-12 w-full rounded-2xl border border-hairline-strong bg-black/35 px-4 text-center text-lg font-black tracking-[0.35em] text-white outline-none transition placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-body-muted focus:border-karaoke-cyan/70 focus:shadow-[0_0_0_4px_rgba(85,230,255,0.10)]"
                />
                <p className="mt-2 text-xs leading-5 text-body-muted">{t('codeHint')}</p>
                <button
                  type="button"
                  onClick={verifyCode}
                  disabled={!email.trim() || !otpCode.replace(/\s+/g, '') || status === 'verifying'}
                  className="mt-3 h-11 w-full rounded-2xl bg-karaoke-cyan text-sm font-black text-canvas transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {status === 'verifying' ? t('verifying') : t('verifyCode')}
                </button>
              </div>
            ) : null}
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
