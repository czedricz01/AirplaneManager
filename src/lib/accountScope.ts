import { createContext, useContext } from 'react';

/**
 * The signed-in player's user id, or null when playing without an account.
 *
 * App provides it once, so the screens deep in the tree that keep per-account
 * data (saved configurations) do not need it passed down through every level.
 */
export const AccountScopeContext = createContext<string | null>(null);

export const useAccountScope = () => useContext(AccountScopeContext);
