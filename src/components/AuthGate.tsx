import { Button } from './ui/Button';
import { TextInput } from './ui/Field';
import { useState, FormEvent } from 'react';
import { supabase, isCloudConfigured, describeAuthError } from '../lib/supabase';
import { logError } from '../lib/debugLog';

interface Props {
  /** Called when a local-only session should start (cloud not configured). */
  onLocalOnly: () => void;
}

/**
 * Sign-in.
 *
 * There is deliberately no registration here. Accounts are created by the
 * operator in the Supabase dashboard, and public sign-up is switched off on the
 * project, so the server rejects account creation regardless of what the browser
 * asks for. That is simpler than an invite-code flow and has the same effect for
 * a small, known group of players.
 *
 * Passwords are never handled here beyond being passed to Supabase over TLS:
 * hashing, comparison and session issuing all happen server side.
 */
export function AuthGate({ onLocalOnly }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setIsBusy(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(describeAuthError(signInError));
        setPassword('');
      }
      // On success the auth listener in App switches the view; nothing to do here.
    } catch (e) {
      // A thrown error (network stack, blocked storage) used to leave the form
      // disabled for good, because isBusy was never reset.
      logError('auth', 'Sign-in failed', e);
      setError(describeAuthError(e as { message?: string }));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div key="login" className="flex-1 min-h-0 overflow-y-auto flex flex-col bg-ground animate-appear">
      <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-10 py-8 short:py-3 flex flex-col short:flex-row short:items-center gap-8 short:gap-10">
        <div className="short:shrink-0">
          <h1 className="font-label font-bold text-3xl leading-none uppercase tracking-label text-ink">Airline Manager Neo</h1>
          <p className="mt-2 text-base text-muted max-w-[40ch]">Start in 1960 with a hub and a budget, and build a route network month by month.</p>
        </div>

        <div className="w-full max-w-sm">
          {!isCloudConfigured ? (
            <div className="bg-surface border border-line p-4 flex flex-col gap-3">
              <h2 className="font-label font-semibold text-lg text-ink">Play without an account</h2>
              <p className="text-sm text-muted">
                This build has no Supabase project attached, so there are no accounts and no
                cloud savegames. You can still play: progress is kept in this browser only.
              </p>
              <Button variant="primary" size="lg" onClick={onLocalOnly}>Continue locally</Button>
            </div>
          ) : (
            <form onSubmit={handleSignIn} className="bg-surface border border-line p-4 flex flex-col gap-4">
              <h2 className="font-label font-semibold text-lg text-ink">Sign in</h2>
              {error && (
                <p role="alert" className="text-sm text-bad border-l-[3px] border-bad pl-3">{error}</p>
              )}
              <TextInput
                id="auth-email"
                label="Email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={isBusy}
                required
              />
              <TextInput
                id="auth-password"
                label="Password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={isBusy}
                required
              />
              <Button type="submit" variant="primary" size="lg" disabled={isBusy}>
                {isBusy ? 'Signing in…' : 'Sign in'}
              </Button>
              <p className="text-xs text-muted">
                Accounts are issued by the operator running this server.
                There is no self-registration.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
