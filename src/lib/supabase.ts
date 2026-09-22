import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client, or null when the project is not configured.
 *
 * Both values are build-time constants baked into the bundle. That is fine and
 * intended: the anon key is a public identifier, not a secret. What protects the
 * data is Row Level Security in the database (see supabase/schema.sql) — every
 * policy is scoped to auth.uid(), so this key alone grants access to nothing.
 *
 * When the variables are missing the app still runs, with cloud features off and
 * savegames kept in this browser only.
 */
const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function normaliseUrl(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  // Accept a bare project ref as well as a full URL.
  if (!trimmed.includes('.')) return `https://${trimmed}.supabase.co`;
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

const url = normaliseUrl(rawUrl);
const key = anonKey?.trim() || null;

export const isCloudConfigured = Boolean(url && key);

export const supabase: SupabaseClient | null = isCloudConfigured
  ? createClient(url!, key!, {
      auth: {
        storageKey: 'neo-airlines-auth',
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

/** Turns a Supabase/Postgres error into something a player can act on. */
export function describeAuthError(error: { message?: string } | null | undefined): string {
  const raw = error?.message || '';

  if (/INVITE_CODE_REQUIRED/i.test(raw)) return 'An invite code is required to create an account.';
  if (/INVITE_CODE_INVALID/i.test(raw)) return 'That invite code does not exist.';
  if (/INVITE_CODE_EXPIRED/i.test(raw)) return 'That invite code has expired.';
  if (/INVITE_CODE_EXHAUSTED/i.test(raw)) return 'That invite code has already been used up.';

  if (/invalid login credentials/i.test(raw)) return 'Wrong email or password.';
  if (/email not confirmed/i.test(raw)) return 'Confirm your email address first — check your inbox.';
  if (/user already registered/i.test(raw)) return 'An account with that email already exists.';
  if (/password should be at least/i.test(raw)) return 'Password is too short — use at least 6 characters.';
  if (/failed to fetch|network/i.test(raw)) return 'Cannot reach the server. Check your connection.';

  return raw || 'Unknown error.';
}
