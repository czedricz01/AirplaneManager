import React, { useState, FormEvent } from 'react';
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
    'w-full bg-black border border-white/10 p-3 outline-none focus:border-aero-yellow transition-colors font-mono text-sm text-white disabled:opacity-50';
  const labelClass =
    'block text-[10px] uppercase tracking-widest text-white/40 mb-2 font-bold font-mono';

  return (
    <motion.div
      key="login"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col items-center justify-center p-4 relative w-full"
    >
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-aero-yellow rounded-full blur-[120px]" />
      </div>

      <div className="z-10 w-full max-w-md">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-col mb-6">
          <h1 className="text-7xl lg:text-8xl font-black italic tracking-tighter leading-none mb-2 flex flex-col items-start gap-4">
            <Bird className="text-aero-yellow shrink-0" size={80} strokeWidth={2.5} />
            <div>
              <span className="text-aero-yellow">AIRLINE</span>
              <br />
              <span className="text-white">MANAGERNEO</span>
            </div>
          </h1>
          <p className="text-[10px] tracking-[0.4em] font-light text-white/40 pl-2 uppercase">
            Aviation Management Core
          </p>
        </motion.div>

        {!isCloudConfigured ? (
          <div className="bg-aero-carbon p-4 rounded-sm border border-white/5 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3 text-aero-yellow">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div className="text-[11px] font-mono uppercase tracking-widest font-bold">
                Cloud accounts not configured
              </div>
            </div>
            <p className="text-[11px] font-mono text-white/50 leading-relaxed">
              This build has no Supabase project attached, so there are no accounts and no
              cloud savegames. You can still play — progress is kept in this browser only.
            </p>
            <button
              type="button"
              onClick={onLocalOnly}
              className="w-full bg-aero-yellow text-black py-4 font-black uppercase tracking-tighter hover:bg-white transition-all flex items-center justify-center gap-2"
            >
              Continue Locally <LogIn size={18} />
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSignIn}
            className="bg-aero-carbon p-4 rounded-sm border border-white/5 space-y-6 shadow-2xl"
          >
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-[#111] border-l-2 border-aero-yellow p-3"
              >
                <p className="text-[10px] font-mono text-aero-yellow/70 uppercase tracking-widest">
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
                className="w-full bg-white text-black py-4 font-black uppercase tracking-tighter hover:bg-aero-yellow transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isBusy ? 'Processing...' : 'Initialize System'} <LogIn size={18} />
              </button>

              <p className="text-[10px] font-mono text-white/30 leading-relaxed text-center">
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
