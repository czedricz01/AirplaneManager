import React, { useState, FormEvent } from 'react';
import { motion } from 'motion/react';
import { Bird, LogIn, UserPlus, AlertTriangle } from 'lucide-react';
import { supabase, isCloudConfigured, describeAuthError } from '../lib/supabase';

type Mode = 'signin' | 'signup';

interface Props {
  /** Called when a local-only session should start (cloud not configured). */
  onLocalOnly: () => void;
}

/**
 * Sign-in and registration.
 *
 * Passwords are never handled here beyond being passed to Supabase over TLS:
 * hashing, comparison and session issuing all happen server side. Registration
 * additionally requires an invite code, which a database trigger validates —
 * see supabase/schema.sql. Nothing about that check can be bypassed from the
 * browser, because the browser never performs it.
 */
export function AuthGate({ onLocalOnly }: Props) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const resetMessages = () => {
    setError(null);
    setNotice(null);
  };

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setIsBusy(true);
    resetMessages();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(describeAuthError(signInError));
      setPassword('');
    }
    // On success the auth listener in App switches the view; nothing to do here.
    setIsBusy(false);
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setIsBusy(true);
    resetMessages();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: displayName.trim(),
          invite_code: inviteCode.trim(),
        },
      },
    });

    if (signUpError) {
      setError(describeAuthError(signUpError));
      setPassword('');
    } else if (!data.session) {
      setNotice('Account created. Check your email to confirm it, then sign in.');
      setMode('signin');
      setPassword('');
    }
    setIsBusy(false);
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
            onSubmit={mode === 'signin' ? handleSignIn : handleSignUp}
            className="bg-aero-carbon p-4 rounded-sm border border-white/5 space-y-6 shadow-2xl"
          >
            {(error || notice) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className={`bg-[#111] border-l-2 p-3 ${error ? 'border-aero-yellow' : 'border-white/20'}`}
              >
                <p className="text-[10px] font-mono text-aero-yellow/70 uppercase tracking-widest">
                  {error || notice}
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

            {mode === 'signup' && (
              <div>
                <label className={labelClass} htmlFor="auth-name">Callsign (Display Name)</label>
                <input
                  id="auth-name"
                  type="text"
                  autoComplete="nickname"
                  placeholder="Captain Neo"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  disabled={isBusy}
                  className={inputClass}
                  required
                />
              </div>
            )}

            <div>
              <label className={labelClass} htmlFor="auth-password">Bio-Key (Password)</label>
              <input
                id="auth-password"
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={isBusy}
                className={inputClass}
                minLength={6}
                required
              />
            </div>

            {mode === 'signup' && (
              <div>
                <label className={labelClass} htmlFor="auth-invite">Invite Code</label>
                <input
                  id="auth-invite"
                  type="text"
                  placeholder="NEO-XXXX-XXXX"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  disabled={isBusy}
                  className={`${inputClass} uppercase`}
                  required
                />
                <p className="text-[10px] font-mono text-white/30 mt-2 leading-relaxed">
                  Registration is by invitation. Ask the operator running this server for a code.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={isBusy}
                className="w-full bg-white text-black py-4 font-black uppercase tracking-tighter hover:bg-aero-yellow transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isBusy
                  ? 'Processing...'
                  : mode === 'signin'
                    ? 'Initialize System'
                    : 'Create Account'}
                {mode === 'signin' ? <LogIn size={18} /> : <UserPlus size={18} />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin');
                  resetMessages();
                  setPassword('');
                }}
                disabled={isBusy}
                className="w-full bg-transparent border border-white/20 text-white/60 py-4 font-black uppercase tracking-tighter hover:border-aero-yellow hover:text-aero-yellow transition-all disabled:opacity-50"
              >
                {mode === 'signin' ? 'Register with invite code' : 'Back to sign in'}
              </button>
            </div>
          </form>
        )}
      </div>
    </motion.div>
  );
}
