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

/**
 * Reduces whatever was configured to the bare project origin.
 *
 * Supabase's API settings page lists the project URL next to the REST, Auth and
 * Storage endpoints, and copying the wrong line is easy. A value ending in
 * `/rest/v1` produces requests to `<project>/rest/v1/auth/v1/token`, which the
 * edge router answers with "Invalid path specified in request URL" — an error
 * that says nothing about the actual cause. Stripping the service path here
 * makes that mistake harmless instead of baffling.
 */
function normaliseUrl(value: string | undefined): string | null {
  if (!value) return null;

  let trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return null;

  // Accept a bare project ref as well as a full URL.
  if (!trimmed.includes('.') && !trimmed.includes('/')) {
    return `https://${trimmed}.supabase.co`;
  }
  if (!/^https?:\/\//i.test(trimmed)) trimmed = `https://${trimmed}`;

  // Drop a service path if one was copied along with the origin.
  trimmed = trimmed.replace(/\/(rest|auth|storage|realtime|functions|graphql)\/v\d+\/?$/i, '');

  try {
    // Anything left beyond the origin (a stray path, query or fragment) is not
    // part of a Supabase project URL either.
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
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
