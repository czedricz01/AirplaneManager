import { useEffect, useState } from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import { usePlanner } from './RoutePlannerContext';
import { useCloudConfigs } from '../../lib/useCloudConfigs';
import type { ConfigItem } from '../../lib/configStore';
import { OverwritePicker } from '../ui/OverwritePicker';

interface SavedCabinConfig extends ConfigItem {
  configs: Record<string, any>;
}

/** Where versions before accounts kept the list; taken over into the account once. */
const LEGACY_STORAGE_KEY = 'aero_cabin_configs';

/**
 * Save and load named cabin configurations.
 *
 * This is the first block lifted out of RoutePlannerView, and the point of the
 * exercise: it takes **no props**. Before the state container it would have
 * needed forty bindings from the component body -- the cabin configuration, the
 * two modal flags, the name field and every setter for them.
 *
 * Everything it reads now comes from usePlanner(). The list of saved presets is
 * kept with the account, so they follow the player to another device; nothing
 * else in the wizard uses it.
 */
export function CabinConfigDialogs() {
  const { selection, dispatch, ui, setUi } = usePlanner();
  const { classConfigs } = selection;
  const { showConfigSaveModal, showConfigLoadModal, newConfigName } = ui;

  const { items: savedCabinConfigs, save, remove } = useCloudConfigs<SavedCabinConfig>('cabin_config', LEGACY_STORAGE_KEY);

  // The save the next save replaces; null stores a new one. Reset whenever the dialog closes.
  const [overwriteId, setOverwriteId] = useState<string | null>(null);
  useEffect(() => { if (!showConfigSaveModal) setOverwriteId(null); }, [showConfigSaveModal]);

  const setShowConfigSaveModal = (v: boolean) => setUi('showConfigSaveModal', v);
  const setShowConfigLoadModal = (v: boolean) => setUi('showConfigLoadModal', v);
  const setNewConfigName = (v: string) => setUi('newConfigName', v);

  const saveCabinConfig = () => {
    if (!newConfigName.trim()) return;
    save({
      // Saving under an existing id replaces that configuration (see saveConfig).
      id: overwriteId ?? Math.random().toString(36).substring(2, 11),
      name: newConfigName.trim(),
      configs: { ...classConfigs }
    });
    setNewConfigName('');
    setShowConfigSaveModal(false);
  };

  const deleteSavedConfig = (id: string) => {
    remove(id);
  };

  const loadCabinConfig = (config: SavedCabinConfig) => {
    const next = { ...classConfigs };
    for (const cls of ['economy', 'premium', 'business', 'first', 'general']) {
      next[cls] = config.configs[cls] || { catering: [['none']], extras: ['none'], service: ['none'] };
    }
    dispatch({ type: 'setClassConfigs', classConfigs: next });
    setShowConfigLoadModal(false);
  };

  return (
    <>
      <>
        {showConfigSaveModal && (
          <div
            className="fixed inset-0 z-[3000] flex items-center justify-center bg-ground/90 p-4 animate-appear"
          >
            <div 
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md bg-raised border border-line p-4 rounded-sm animate-appear"
            >
              <h3 className="text-xl font-semibold text-accent mb-3">Save Configuration</h3>
              <div className="space-y-6">
                <OverwritePicker
                  items={savedCabinConfigs}
                  value={overwriteId}
                  onChange={item => {
                    setOverwriteId(item?.id ?? null);
                    if (item) setNewConfigName(item.name);
                  }}
                />
                <div>
                  <label className="text-2xs uppercase font-semibold text-muted tracking-label block mb-2">Configuration Name</label>
                  <input 
                    type="text" 
                    value={newConfigName}
                    onChange={(e) => setNewConfigName(e.target.value)}
                    className="w-full bg-ground border border-line p-4 text-ink focus:border-accent outline-none transition-all"
                    placeholder="e.g. Premium Short-Haul"
                    autoFocus
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setShowConfigSaveModal(false)}
                    className="flex-1 py-4 border border-line text-muted uppercase text-2xs font-semibold tracking-label hover:text-ink hover:bg-raised transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={saveCabinConfig}
                    className="flex-1 py-4 bg-accent text-on-accent uppercase text-2xs font-semibold tracking-label hover:bg-ink transition-all"
                  >
                    {overwriteId ? 'Overwrite' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>

      <>
        {showConfigLoadModal && (
          <div
            className="fixed inset-0 z-[3000] flex items-center justify-center bg-ground/90 p-4 animate-appear"
          >
            <div 
              role="dialog"
              aria-modal="true"
              className="w-full max-w-2xl bg-raised border border-line p-4 rounded-sm max-h-[80vh] flex flex-col animate-appear"
            >
               <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xl font-semibold text-accent">Load Configuration</h3>
                  <button onClick={() => setShowConfigLoadModal(false)} className="text-muted hover:text-ink transition-colors">
                     <Plus size={24} className="rotate-45" />
                  </button>
               </div>
               
               <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                  {savedCabinConfigs.length === 0 ? (
                     <div className="py-12 text-center text-muted uppercase text-xs font-semibold tracking-label">
                        No saved configurations found.
                     </div>
                  ) : (
                     savedCabinConfigs.map(cfg => (
                        <div key={cfg.id} className="group flex items-center gap-2">
                           <button 
                              onClick={() => loadCabinConfig(cfg)}
                              className="flex-1 flex justify-between items-center bg-surface border border-line p-4 hover:bg-raised hover:border-accent transition-all text-left"
                           >
                              <span className="text-sm font-semibold text-ink">{cfg.name}</span>
                              <div className="flex items-center gap-4 text-2xs text-muted uppercase font-semibold">
                                 <span>{Object.keys(cfg.configs).filter(k => k !== 'general').length} Classes</span>
                                 <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                           </button>
                           <button 
                              onClick={() => deleteSavedConfig(cfg.id)}
                              className="w-12 h-14 flex items-center justify-center bg-surface border border-rule text-accent hover:bg-raised hover:text-ink transition-all opacity-0 group-hover:opacity-100"
                           >
                              <Plus size={20} className="rotate-45" />
                           </button>
                        </div>
                     ))
                  )}
               </div>
               
               <button 
                  onClick={() => setShowConfigLoadModal(false)}
                  className="mt-6 w-full py-4 border border-line text-muted uppercase text-2xs font-semibold tracking-label hover:text-ink hover:bg-raised transition-all text-center"
               >
                  Close
               </button>
            </div>
          </div>
        )}
      </>
    </>
  );
}
