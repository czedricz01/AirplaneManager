import { useCallback, useEffect, useState } from 'react';
import { useAccountScope } from './accountScope';
import { supabase } from './supabase';
import {
  deleteConfig,
  importLegacyConfigs,
  listConfigs,
  readLocalConfigs,
  saveConfig,
  type ConfigItem,
  type ConfigKind
} from './configStore';

/**
 * The player's saved configurations of one kind, kept with the account.
 *
 * The list is on screen at once from this browser's copy, then replaced by the
 * merged cloud list when the server answers. `save` and `remove` change the list
 * immediately and sync in the background; see configStore for what happens when
 * the connection fails.
 *
 * `legacyKey` is the unscoped localStorage key an older version kept the list
 * in. Its contents are taken over into the account once.
 */
export function useCloudConfigs<T extends ConfigItem>(kind: ConfigKind, legacyKey: string) {
  const scope = useAccountScope();
  const [items, setItems] = useState<T[]>(() => readLocalConfigs<T>(scope, kind));

  useEffect(() => {
    let cancelled = false;
    setItems(readLocalConfigs<T>(scope, kind));

    (async () => {
      try {
        await importLegacyConfigs(supabase, scope, kind, legacyKey);
        const { items: list } = await listConfigs<T>(supabase, scope, kind);
        if (!cancelled) setItems(list);
      } catch (e) {
        // A failed sync leaves the browser's own list on screen, which is correct.
        console.warn(`[configs] could not load ${kind}`, e);
      }
    })();

    return () => { cancelled = true; };
  }, [scope, kind, legacyKey]);

  const save = useCallback((item: T) => {
    setItems(prev => [...prev.filter(i => i.id !== item.id), item]);
    void saveConfig(supabase, scope, kind, item);
  }, [scope, kind]);

  const remove = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    void deleteConfig(supabase, scope, kind, id);
  }, [scope, kind]);

  return { items, save, remove };
}
