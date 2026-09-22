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

  if (/invalid login credentials/i.test(raw)) return 'Wrong email or password.';
  if (/email not confirmed/i.test(raw)) return 'This account is not confirmed yet. Ask the operator to confirm it.';
  if (/signups? not allowed|signup_disabled/i.test(raw)) {
    return 'Accounts are created by the operator — self-registration is switched off.';
  }
  if (/too many requests|rate limit/i.test(raw)) return 'Too many attempts. Wait a minute and try again.';
  if (/failed to fetch|network/i.test(raw)) return 'Cannot reach the server. Check your connection.';

  return raw || 'Unknown error.';
}

/**
 * Creates the player's profile row if it does not exist yet.
 *
 * Normally this would be a trigger on auth.users, but that table is owned by
 * supabase_auth_admin and postgres is not allowed to put triggers on it, so the
 * app does it on sign-in instead. The "create own profile" RLS policy restricts
 * the insert to the caller's own id, so this cannot write anyone else's row.
 */
export async function ensureProfile(
  userId: string,
  displayName: string
): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, display_name: displayName }, { onConflict: 'id', ignoreDuplicates: true });

  if (error) {
    // A missing profile row costs nothing at the moment — the display name also
    // lives in the auth user's metadata — so this must not block signing in.
    console.warn('[auth] could not create profile row', error);
  }
}
