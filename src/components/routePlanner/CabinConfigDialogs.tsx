import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Save, Download, ChevronRight } from 'lucide-react';
import { usePlanner } from './RoutePlannerContext';
import { readJson, writeJson } from '../../lib/safeStorage';

interface SavedCabinConfig {
  id: string;
  name: string;
  configs: Record<string, any>;
}

const STORAGE_KEY = 'aero_cabin_configs';

/**
 * Save and load named cabin configurations.
 *
 * This is the first block lifted out of RoutePlannerView, and the point of the
 * exercise: it takes **no props**. Before the state container it would have
 * needed forty bindings from the component body -- the cabin configuration, the
 * two modal flags, the name field and every setter for them.
 *
 * Everything it reads now comes from usePlanner(); the list of saved presets is
 * local because nothing else in the wizard uses it.
 */
export function CabinConfigDialogs() {
  const { selection, dispatch, ui, setUi } = usePlanner();
  const { classConfigs } = selection;
  const { showConfigSaveModal, showConfigLoadModal, newConfigName } = ui;

  const [savedCabinConfigs, setSavedCabinConfigs] = useState<SavedCabinConfig[]>([]);

  const setShowConfigSaveModal = (v: boolean) => setUi('showConfigSaveModal', v);
  const setShowConfigLoadModal = (v: boolean) => setUi('showConfigLoadModal', v);
  const setNewConfigName = (v: string) => setUi('newConfigName', v);

  useEffect(() => {
    const saved = readJson<SavedCabinConfig[]>(STORAGE_KEY, []);
    if (saved.length) setSavedCabinConfigs(saved);
  }, []);

  const persist = (next: SavedCabinConfig[]) => {
    setSavedCabinConfigs(next);
    writeJson(STORAGE_KEY, next);
  };

  const saveCabinConfig = () => {
    if (!newConfigName.trim()) return;
    persist([
      ...savedCabinConfigs,
      {
        id: Math.random().toString(36).substring(2, 11),
        name: newConfigName.trim(),
        configs: { ...classConfigs }
      }
    ]);
    setNewConfigName('');
    setShowConfigSaveModal(false);
  };

  const deleteSavedConfig = (id: string) => {
    persist(savedCabinConfigs.filter(c => c.id !== id));
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
      <AnimatePresence>
        {showConfigSaveModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          >
            <motion.div 
              role="dialog"
              aria-modal="true"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-aero-panel-2 border border-white/10 p-4 rounded-sm shadow-2xl"
            >
              <h3 className="text-xl font-black uppercase tracking-widest text-aero-yellow mb-3">Save Configuration</h3>
              <div className="space-y-6">
                <div>
                  <label className="text-2xs uppercase font-bold text-white/40 tracking-widest block mb-2">Configuration Name</label>
                  <input 
                    type="text" 
                    value={newConfigName}
                    onChange={(e) => setNewConfigName(e.target.value)}
                    className="w-full bg-black border border-white/10 p-4 text-white font-mono focus:border-aero-yellow outline-none transition-all"
                    placeholder="e.g. Premium Short-Haul"
                    autoFocus
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setShowConfigSaveModal(false)}
                    className="flex-1 py-4 border border-white/10 text-white/50 uppercase text-2xs font-black tracking-widest hover:text-white hover:bg-white/5 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={saveCabinConfig}
                    className="flex-1 py-4 bg-aero-yellow text-black uppercase text-2xs font-black tracking-widest hover:bg-white transition-all"
                  >
                    Save
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showConfigLoadModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          >
            <motion.div 
              role="dialog"
              aria-modal="true"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-2xl bg-aero-panel-2 border border-white/10 p-4 rounded-sm shadow-2xl max-h-[80vh] flex flex-col"
            >
               <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xl font-black uppercase tracking-widest text-aero-yellow">Load Configuration</h3>
                  <button onClick={() => setShowConfigLoadModal(false)} className="text-white/40 hover:text-white transition-colors">
                     <Plus size={24} className="rotate-45" />
                  </button>
               </div>
               
               <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
                  {savedCabinConfigs.length === 0 ? (
                     <div className="py-12 text-center text-white/20 uppercase text-xs font-black tracking-widest italic">
                        No saved configurations found.
                     </div>
                  ) : (
                     savedCabinConfigs.map(cfg => (
                        <div key={cfg.id} className="group flex items-center gap-2">
                           <button 
                              onClick={() => loadCabinConfig(cfg)}
                              className="flex-1 flex justify-between items-center bg-white/5 border border-white/10 p-4 hover:bg-white/10 hover:border-aero-yellow transition-all text-left"
                           >
                              <span className="text-sm font-black uppercase tracking-widest text-white">{cfg.name}</span>
                              <div className="flex items-center gap-4 text-2xs text-white/40 uppercase font-bold">
                                 <span>{Object.keys(cfg.configs).filter(k => k !== 'general').length} Classes</span>
                                 <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                           </button>
                           <button 
                              onClick={() => deleteSavedConfig(cfg.id)}
                              className="w-12 h-14 flex items-center justify-center bg-aero-panel border border-white/20 text-aero-yellow/60 hover:bg-aero-panel-2 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                           >
                              <Plus size={20} className="rotate-45" />
                           </button>
                        </div>
                     ))
                  )}
               </div>
               
               <button 
                  onClick={() => setShowConfigLoadModal(false)}
                  className="mt-6 w-full py-4 border border-white/10 text-white/50 uppercase text-2xs font-black tracking-widest hover:text-white hover:bg-white/5 transition-all text-center"
               >
                  Close
               </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
