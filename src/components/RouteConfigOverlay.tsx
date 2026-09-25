import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Utensils, Wifi, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Airport } from '../data/airports';
import type { OwnedAircraft } from './MyFleetView';
import { AirportInfrastructure } from '../App';
import { MEAL_DATA, EXTRAS_OPTIONS, SERVICE_OPTIONS } from '../data/catering';

import {
  getFlightTimeClass,
  getCateringOpt,
  getMultiOptionSum,
  seatWeightedSatisfaction,
  TIME_CLASS_SAT_MULTIPLIERS
} from '../lib/financeUtils';

interface RouteConfigOverlayProps {
  activeConfigClass: string;
  selectedAircraft: OwnedAircraft;
  selectedOrigin: Airport;
  selectedDest: Airport;
  airportManagement: Record<string, AirportInfrastructure>;
  classConfigs: Record<string, { catering: string[][], extras: string[], service: string[] }>;
  setClassConfigs: React.Dispatch<React.SetStateAction<Record<string, { catering: string[][], extras: string[], service: string[] }>>>;
  setActiveConfigClass: (className: string | null) => void;
  takeControl: Record<string, boolean>;
  setTakeControl: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  getFlightDurationMinutes: () => number;
  /**
   * Route satisfaction per cabin class, as the economy computes it
   * (getRouteClassSatisfaction). This overlay used to run its own formula with
   * an empty airport table, made-up airport ids and a fixed difficulty.
   */
  routeSat: Record<string, number>;
}

export const RouteConfigOverlay: React.FC<RouteConfigOverlayProps> = ({
  activeConfigClass,
  selectedAircraft,
  selectedOrigin,
  selectedDest,
  airportManagement,
  classConfigs,
  setClassConfigs,
  setActiveConfigClass,
  takeControl,
  setTakeControl,
  getFlightDurationMinutes,
  routeSat
}) => {
  const [activeMealIndex, setActiveMealIndex] = useState(0);
  const [expandedMealCats, setExpandedMealCats] = useState<Record<string, boolean>>({
    Basic: false,
    Standard: false,
    Premium: false,
    Luxury: false
  });

  const duration = getFlightDurationMinutes();
  const timeClass = getFlightTimeClass(duration);
  const satMultiplier = TIME_CLASS_SAT_MULTIPLIERS[timeClass] || 1.0;

  // "general" has no seats of its own; it shows the seat-weighted route figure.
  const getRouteSatForClass = (className: string) =>
    className === 'general'
      ? seatWeightedSatisfaction(routeSat, selectedAircraft.config)
      : routeSat[className] ?? 0;

  /**
   * Writes one service field of "General" into every cabin class.
   *
   * This used to assign into the class objects in place after a shallow copy of
   * the outer record. Those objects are shared with React state -- in the cabin
   * editor they are the saved route's own classConfigs -- so "Take Control"
   * changed the route even when the editor was closed without saving.
   */
  const copyToCabinClasses = (next: Record<string, any>, field: 'catering' | 'extras' | 'service', value: any) => {
    ['economy', 'premium', 'business', 'first'].forEach(cl => {
      if (next[cl]) next[cl] = { ...next[cl], [field]: value };
    });
  };

  // Kept outside any state updater: updaters must be pure, and this one used to
  // dispatch a second state change from inside the first.
  const toggleTakeControl = (field: 'catering' | 'extras' | 'service') => {
    const enabling = !takeControl[field];
    setTakeControl({ ...takeControl, [field]: enabling });
    if (enabling) {
      setClassConfigs(prev => {
        const next = { ...prev };
        copyToCabinClasses(next, field, prev.general?.[field]);
        return next;
      });
    }
  };

  const hasAdvancedCateringHub = airportManagement[selectedOrigin.id]?.hubFacilities?.catering || airportManagement[selectedDest.id]?.hubFacilities?.catering;
  const hasPremiumGalley = selectedAircraft.config?.details?.hasPremiumCatering;
  const isUpgradeActive = !!(hasAdvancedCateringHub && hasPremiumGalley);

  return (
    <div className="absolute inset-0 bg-black z-[2000] flex flex-col animate-in slide-in-from-bottom duration-500 shadow-2xl overflow-hidden">
      {/* Upright phones: the Confirm button drops below the title. */}
      <div className="p-4 short:py-2 border-b border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white/[0.02]">
        <div className="flex items-center gap-4">
          <div onClick={() => setActiveConfigClass(null)} className="w-12 h-12 flex items-center justify-center border border-white/10 rounded-sm cursor-pointer hover:bg-white hover:text-black hover:border-white transition-all shadow-inner group">
            <ChevronRight className="rotate-180 group-hover:scale-125 transition-transform" />
          </div>
          <div className="flex flex-col">
            <h4 className="text-2xl md:text-4xl short:text-2xl font-black uppercase tracking-tighter text-white leading-none">
              Configure <span className="text-aero-yellow">{activeConfigClass === 'general' ? 'Global Standards' : activeConfigClass.toUpperCase()}</span>
            </h4>
            <div className="text-2xs text-white/40 uppercase font-bold tracking-[0.3em] mt-3 flex flex-wrap gap-x-6 items-baseline">
              {activeConfigClass === 'general' ? (
                <>
                  <div className="flex items-center gap-2 border-r border-white/10 pr-6">
                    <span>Flight Class: <span className="text-aero-yellow">{timeClass}</span></span>
                    <span className="text-3xs opacity-60">({Math.round(satMultiplier * 100)}% Multiplier)</span>
                  </div>
                  {['economy', 'premium', 'business', 'first'].map(c => {
                    const seats = selectedAircraft.config?.[c as keyof typeof selectedAircraft.config] as number || 0;
                    if (seats <= 0) return null;
                    return (
                      <span key={c} className="whitespace-nowrap">{c}: <span className="text-aero-yellow font-black text-xs">{Math.round(Math.max(0, getRouteSatForClass(c)))}%</span></span>
                    );
                  })}
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 border-r border-white/10 pr-6">
                    <span>Flight Class: <span className="text-aero-yellow">{timeClass}</span></span>
                    <span className="text-3xs opacity-60">({Math.round(satMultiplier * 100)}% Multiplier)</span>
                  </div>
                  <span>Product Selection & Tiering • <span className="text-aero-yellow text-sm font-black italic">Route SAT: {Math.round(Math.max(0, getRouteSatForClass(activeConfigClass)))}%</span></span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <button 
            onClick={() => setActiveConfigClass(null)} 
            className="w-full md:w-auto px-10 py-4 short:py-2.5 bg-white text-black font-black uppercase text-xs tracking-widest hover:bg-aero-yellow transition-all shadow-2xl active:scale-95"
          >
            Confirm & Apply
          </button>
        </div>
      </div>

      {/* Upright phones: the three columns one below the other, scrolling together. */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-3 gap-1 overflow-y-auto md:overflow-hidden bg-white/5">
        {/* Catering Column */}
        <div className={`flex-1 md:min-h-0 flex flex-col p-4 border-b md:border-b-0 md:border-r border-white/10 md:overflow-y-auto custom-scrollbar transition-all ${activeConfigClass !== 'general' && takeControl.catering ? 'bg-black/80 opacity-50 pointer-events-none grayscale' : 'bg-black/40'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-aero-yellow/10 flex items-center justify-center border border-aero-yellow/30">
                <Utensils className="text-aero-yellow" size={18} />
              </div>
              <span className="text-lg font-black uppercase tracking-tighter">Catering</span>
            </div>
            {activeConfigClass === 'general' && (
              <button 
                onClick={() => toggleTakeControl('catering')}
                className={`px-3 py-1 text-3xs font-black uppercase tracking-widest border transition-all ${takeControl.catering ? 'bg-aero-yellow border-aero-yellow text-black' : 'border-white/10 text-white/40 hover:text-white'}`}
              >
                Take Control
              </button>
            )}
          </div>

          <div className="space-y-4">
            {(!isUpgradeActive && selectedAircraft.class !== 'Regional' && selectedAircraft.class !== 'Narrowbody' && selectedAircraft.class !== 'Widebody') ? null : (
              <div className="p-3 bg-white/5 border border-white/10 text-2xs uppercase font-bold relative overflow-hidden group">
                <div className="flex flex-col gap-1 z-10 relative">
                  <span className="tracking-widest opacity-60">NEXT LEVEL CATERING:</span>
                  {isUpgradeActive ? (
                    <span className="text-aero-yellow">ACTIVE - Next tier unlocked</span>
                  ) : (
                    <span className="text-aero-yellow">
                      MISSING: {(!hasAdvancedCateringHub && !hasPremiumGalley) ? 'Hub Advanced Catering & Premium Aircraft Galley' : !hasAdvancedCateringHub ? 'Advanced Catering at a Hub' : 'Premium Catering Facility on Aircraft'}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex gap-2">
                {Array.from({ length: getFlightTimeClass(getFlightDurationMinutes()) <= 5 ? 1 : getFlightTimeClass(getFlightDurationMinutes()) <= 7 ? 2 : 3 }).map((_, idx) => {
                  const catArr = Array.isArray(classConfigs[activeConfigClass!].catering) ? classConfigs[activeConfigClass!].catering : [classConfigs[activeConfigClass!].catering as unknown as string[]];
                  return (
                    <button 
                      key={idx}
                      onClick={() => setActiveMealIndex(idx)}
                      className={`flex-1 flex flex-col items-center justify-center py-2 text-2xs font-black uppercase tracking-widest border transition-all overflow-hidden ${activeMealIndex === idx ? 'bg-aero-yellow text-black border-aero-yellow' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'}`}
                    >
                      Meal {idx + 1}
                      <div className="text-3xs mt-1 opacity-70 truncate w-full text-center px-1">
                        {getCateringOpt(catArr[idx] || ['none'], idx).label}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2">
                <button 
                  onClick={() => {
                    setClassConfigs(prev => {
                      const next = { ...prev };
                      const currentArr = [...next[activeConfigClass!].catering];
                      currentArr[activeMealIndex] = ['none'];
                      next[activeConfigClass!] = { ...next[activeConfigClass!], catering: currentArr };
                      if (activeConfigClass === 'general' && takeControl.catering) {
                        copyToCabinClasses(next, 'catering', currentArr);
                      }
                      return next;
                    });
                  }}
                  className={`w-full p-4 border transition-all text-left ${classConfigs[activeConfigClass!].catering[activeMealIndex]?.includes('none') ? 'bg-aero-yellow border-aero-yellow text-black' : 'border-white/10 text-white hover:border-white/40 hover:bg-white/5'}`}
                >
                  <span className="text-2xs font-black uppercase tracking-widest">None</span>
                </button>

                {(() => {
                  const baseAllowed = selectedAircraft.class === 'Regional' ? ['Basic'] : selectedAircraft.class === 'Narrowbody' ? ['Basic', 'Standard'] : ['Basic', 'Standard', 'Premium'];
                  const allowedCategories = [...baseAllowed];
                  if (isUpgradeActive) {
                    if (selectedAircraft.class === 'Regional') allowedCategories.push('Standard');
                    else if (selectedAircraft.class === 'Narrowbody') allowedCategories.push('Premium');
                    else allowedCategories.push('Luxury');
                  }

                  return Object.keys(MEAL_DATA).filter(cat => allowedCategories.includes(cat)).map(catName => (
                    <div key={catName} className="space-y-1">
                      <button 
                        onClick={() => setExpandedMealCats(prev => ({ ...prev, [catName]: !prev[catName] }))}
                        className="w-full p-3 bg-white/5 border border-white/10 flex justify-between items-center hover:bg-white/10 transition-all group"
                      >
                        <span className="text-2xs font-black uppercase tracking-widest text-white">{catName} Class</span>
                        <ChevronDown size={14} className={`text-white/20 group-hover:text-white transition-transform ${expandedMealCats[catName] ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {expandedMealCats[catName] && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden grid grid-cols-2 gap-1.5 pt-1.5">
                            {[...MEAL_DATA[catName]].sort((a,b) => a.cost - b.cost).map(meal => {
                              const mealIds = classConfigs[activeConfigClass!].catering[activeMealIndex] || [];
                              const isSelected = mealIds.includes(meal.id);
                              return (
                                <button 
                                  key={meal.id}
                                  onClick={() => {
                                    setClassConfigs(prev => {
                                      const next = { ...prev };
                                      let mIds = [...(next[activeConfigClass!].catering[activeMealIndex] || [])];
                                      if (mIds.includes(meal.id)) {
                                        mIds = mIds.filter(id => id !== meal.id);
                                        if (mIds.length === 0) mIds = ['none'];
                                      } else {
                                        mIds = mIds.filter(id => id !== 'none');
                                        mIds.push(meal.id);
                                      }
                                      const currentArr = [...next[activeConfigClass!].catering];
                                      currentArr[activeMealIndex] = mIds;
                                      next[activeConfigClass!] = { ...next[activeConfigClass!], catering: currentArr };
                                      if (activeConfigClass === 'general' && takeControl.catering) {
                                        copyToCabinClasses(next, 'catering', currentArr);
                                      }
                                      return next;
                                    });
                                  }}
                                  className={`flex flex-col justify-between p-2.5 border transition-all text-left h-full ${isSelected ? 'bg-aero-yellow border-aero-yellow text-black' : 'border-white/5 text-white/60 hover:bg-white/5'}`}
                                >
                                  <div className="mb-2">
                                    <span className="text-3xs font-black uppercase leading-tight line-clamp-2">{meal.label}</span>
                                    <span className="text-3xs opacity-60 block mt-0.5">${meal.cost.toFixed(2)}</span>
                                  </div>
                                  <span className="text-xs font-black italic mt-auto">+{Math.round(meal.sat * satMultiplier)} pts</span>
                                </button>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Extras Column */}
        <div className={`flex-1 md:min-h-0 flex flex-col p-4 border-b md:border-b-0 md:border-r border-white/10 md:overflow-y-auto custom-scrollbar transition-all ${activeConfigClass !== 'general' && takeControl.extras ? 'bg-black/80 opacity-50 pointer-events-none grayscale' : 'bg-black/40'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-aero-yellow/10 flex items-center justify-center border border-aero-yellow/30">
                <Wifi className="text-aero-yellow" size={18} />
              </div>
              <span className="text-lg font-black uppercase tracking-tighter">Extras</span>
            </div>
            {activeConfigClass === 'general' && (
              <button 
                onClick={() => toggleTakeControl('extras')}
                className={`px-3 py-1 text-3xs font-black uppercase tracking-widest border transition-all ${takeControl.extras ? 'bg-aero-yellow border-aero-yellow text-black' : 'border-white/10 text-white/40 hover:text-white'}`}
              >
                Take Control
              </button>
            )}
          </div>
          <div className="space-y-2">
            {Object.keys(EXTRAS_OPTIONS).sort((a,b) => EXTRAS_OPTIONS[a].cost - EXTRAS_OPTIONS[b].cost).map(optKey => {
              const opt = EXTRAS_OPTIONS[optKey];
              const isSelected = classConfigs[activeConfigClass!].extras.includes(optKey);
              const wifiCap = selectedAircraft.config?.details?.hasWifi;
              const galleyCap = selectedAircraft.config?.details?.hasPremiumCatering;
              
              const isWifiDisabled = opt.wifiRequired && !wifiCap;
              const isGalleyDisabled = opt.galleyRequired && !galleyCap;
              const isDisabled = isWifiDisabled || isGalleyDisabled;

              return (
                <button 
                  key={optKey}
                  disabled={isDisabled}
                  onClick={() => {
                    setClassConfigs(prev => {
                      const next = { ...prev };
                      let current = [...next[activeConfigClass!].extras];
                      if (optKey === 'none') { current = ['none']; }
                      else {
                        if (current.includes(optKey)) { current = current.filter(id => id !== optKey); if (current.length === 0) current = ['none']; }
                        else {
                          current = current.filter(id => id !== 'none');
                          // Tiered families (Wi-Fi, amenity kits, alcohol) are single-choice:
                          // picking a new tier replaces any other option from the same group.
                          const group = EXTRAS_OPTIONS[optKey].group;
                          if (group) current = current.filter(id => EXTRAS_OPTIONS[id]?.group !== group);
                          current.push(optKey);
                        }
                      }
                      next[activeConfigClass!] = { ...next[activeConfigClass!], extras: current };
                      if (activeConfigClass === 'general' && takeControl.extras) {
                        copyToCabinClasses(next, 'extras', current);
                      }
                      return next;
                    });
                  }}
                  className={`w-full py-2.5 px-3 flex justify-between items-center border transition-all text-left group ${isDisabled ? 'opacity-20 cursor-not-allowed grayscale' : isSelected ? 'bg-aero-yellow border-aero-yellow text-black' : 'border-white/10 text-white hover:border-white/40 hover:bg-white/5'}`}
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className={`text-2xs font-black uppercase tracking-widest mb-1 ${isSelected ? 'text-black/60' : 'text-white/40'}`}>{opt.label}</span>
                      {isWifiDisabled && <span className="text-3xs bg-aero-panel text-aero-yellow/60 px-1 py-0.5 rounded italic font-black font-mono">REQ. WIFI</span>}
                      {isGalleyDisabled && <span className="text-3xs bg-aero-panel text-aero-yellow/60 px-1 py-0.5 rounded italic font-black font-mono">REQ. PREM. GALLEY</span>}
                    </div>
                    <span className="text-xs font-bold font-mono">${opt.cost} / PAX</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`text-2xs font-black uppercase ${isSelected ? 'text-black/60' : 'text-white/40'}`}>SAT</span>
                    <span className="text-lg font-black italic">+{Math.round(opt.sat * satMultiplier)} pts</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Service Column */}
        <div className={`flex-1 md:min-h-0 flex flex-col p-4 md:overflow-y-auto custom-scrollbar transition-all ${activeConfigClass !== 'general' && takeControl.service ? 'bg-black/80 opacity-50 pointer-events-none grayscale' : 'bg-black/40'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-aero-yellow/10 flex items-center justify-center border border-aero-yellow/30">
                <Users className="text-aero-yellow" size={18} />
              </div>
              <span className="text-lg font-black uppercase tracking-tighter">Crew Services</span>
            </div>
            {activeConfigClass === 'general' && (
              <button 
                onClick={() => toggleTakeControl('service')}
                className={`px-3 py-1 text-3xs font-black uppercase tracking-widest border transition-all ${takeControl.service ? 'bg-aero-yellow border-aero-yellow text-black' : 'border-white/10 text-white/40 hover:text-white'}`}
              >
                Take Control
              </button>
            )}
          </div>
          <div className="space-y-2">
            {Object.keys(SERVICE_OPTIONS).sort((a,b) => SERVICE_OPTIONS[a].cost - SERVICE_OPTIONS[b].cost).map(optKey => {
              const opt = SERVICE_OPTIONS[optKey];
              const isSelected = classConfigs[activeConfigClass!].service.includes(optKey);
              return (
                <button 
                  key={optKey}
                  onClick={() => {
                    setClassConfigs(prev => {
                      const next = { ...prev };
                      let current = [...next[activeConfigClass!].service];
                      if (optKey === 'none') { current = ['none']; }
                      else {
                        if (current.includes(optKey)) { current = current.filter(id => id !== optKey); if (current.length === 0) current = ['none']; }
                        else { current = current.filter(id => id !== 'none'); current.push(optKey); }
                      }
                      next[activeConfigClass!] = { ...next[activeConfigClass!], service: current };
                      if (activeConfigClass === 'general' && takeControl.service) {
                        copyToCabinClasses(next, 'service', current);
                      }
                      return next;
                    });
                  }}
                  className={`w-full py-2.5 px-3 flex justify-between items-center border transition-all text-left group ${isSelected ? 'bg-aero-yellow border-aero-yellow text-black' : 'border-white/10 text-white hover:border-white/40 hover:bg-white/5'}`}
                >
                  <div className="flex flex-col">
                    <span className={`text-2xs font-black uppercase tracking-widest mb-1 ${isSelected ? 'text-black/60' : 'text-white/40'}`}>{opt.label}</span>
                    <span className="text-xs font-bold font-mono">${opt.cost} / PAX</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`text-2xs font-black uppercase ${isSelected ? 'text-black/60' : 'text-white/40'}`}>SAT</span>
                    <span className="text-lg font-black italic">+{Math.round(opt.sat * satMultiplier)} pts</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
