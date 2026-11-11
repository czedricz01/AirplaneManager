import { useState, FormEvent } from 'react';
import { motion } from 'motion/react';
import { Bird, LogIn, AlertTriangle } from 'lucide-react';
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

  const inputClass =
    'w-full bg-ground border border-line p-3 outline-none focus:border-accent transition-colors font-mono text-sm text-ink disabled:opacity-50';
  const labelClass =
    'block text-2xs uppercase tracking-label text-muted mb-2 font-semibold font-label';

  return (
    <motion.div
      key="login"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center p-4 relative w-full"
    >
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent rounded-full" />
      </div>

      <div className="z-10 w-full max-w-md">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-col mb-6">
          <h1 className="text-3xl lg:text-3xl font-semibold leading-none mb-3 flex flex-col items-start gap-4">
            <Bird className="text-accent shrink-0" size={72} strokeWidth={2.5} />
            {/* One line per word: the name as a single token overflowed the column and wrapped mid-name. */}
            <div>
              <span className="text-accent">AIRLINE</span>
              <br />
              <span className="text-ink">MANAGER</span>
              <br />
              <span className="text-accent">NEO</span>
            </div>
          </h1>
          <p className="text-2xs tracking-label font-normal text-muted pl-2 uppercase">
            Aviation Management Core
          </p>
        </motion.div>

        {!isCloudConfigured ? (
          <div className="bg-raised p-4 rounded-sm border border-line space-y-4">
            <div className="flex items-start gap-3 text-accent">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div className="text-xs font-label uppercase tracking-label font-semibold">
                Cloud accounts not configured
              </div>
            </div>
            <p className="text-xs font-mono text-muted leading-relaxed">
              This build has no Supabase project attached, so there are no accounts and no
              cloud savegames. You can still play — progress is kept in this browser only.
            </p>
            <button
              type="button"
              onClick={onLocalOnly}
              className="w-full bg-accent text-on-accent py-4 font-semibold uppercase hover:bg-ink transition-all flex items-center justify-center gap-2"
            >
              Continue Locally <LogIn size={18} />
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSignIn}
            className="bg-raised p-4 rounded-sm border border-line space-y-6"
          >
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-surface border-l-2 border-accent p-3"
              >
                <p className="text-2xs font-label text-accent uppercase tracking-label">
                  {error}
                </p>
              </motion.div>
            )}

            <div>
              <label className={labelClass} htmlFor="auth-email">Operator Email</label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                placeholder="operator@airline.neo"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={isBusy}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="auth-password">Bio-Key (Password)</label>
              <input
                id="auth-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={isBusy}
                className={inputClass}
                required
              />
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={isBusy}
                className="w-full bg-ink text-on-accent py-4 font-semibold uppercase hover:bg-accent transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isBusy ? 'Processing...' : 'Initialize System'} <LogIn size={18} />
              </button>

              <p className="text-2xs font-mono text-muted leading-relaxed text-center">
                Accounts are issued by the operator running this server.
                There is no self-registration.
              </p>
            </div>
          </form>
        )}
      </div>
    </motion.div>
  );
}
