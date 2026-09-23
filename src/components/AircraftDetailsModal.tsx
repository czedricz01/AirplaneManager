import React, { useState, useEffect } from 'react';
import { OwnedAircraft } from './MyFleetView';
import { Plane, Wrench, ShieldAlert } from 'lucide-react';
import { AircraftImage } from './AircraftImage';
import { getPlaneSat } from '../lib/financeUtils';
import { Modal } from './ui/Modal';
import { conditionTone, CONDITION_TEXT_CLASS, CONDITION_BAR_CLASS } from '../lib/theme';

interface Props {
  plane: OwnedAircraft;
  onClose: () => void;
  onRenovate: () => void;
  aircraftRoutes?: any[];
  onSelectRoute?: (route: any) => void;
  onStartRoute?: (reg: string) => void;
  onSell?: (plane: OwnedAircraft) => void;
  /** Months since 01/1960. Without it the age below cannot be computed. */
  currentDateOffset?: number;
}

export function AircraftDetailsModal({ plane, onClose, onRenovate, aircraftRoutes = [], onSelectRoute, onStartRoute, onSell, currentDateOffset }: Props) {
  // The same function the economy prices with (financeUtils.getPlaneSat). This
  // screen used to apply the interior condition to the interior score alone,
  // which produced a different number here than in the fleet list for the same
  // aircraft, and neither matched what the simulation actually used.
  const combinedPopularity = getPlaneSat(plane);
  const totalPax = plane.config.first + plane.config.business + plane.config.premium + plane.config.economy;

  // purchasedAt is an offset in months from 01/1960, like currentDateOffset.
  const ageMonths =
    typeof currentDateOffset === 'number' && typeof plane.purchasedAt === 'number'
      ? Math.max(0, currentDateOffset - plane.purchasedAt)
      : null;
  const ageLabel =
    ageMonths === null
      ? '--'
      : ageMonths < 1
        ? 'New'
        : ageMonths < 12
          ? `${ageMonths} mo`
          : `${Math.floor(ageMonths / 12)} y ${ageMonths % 12} mo`;

  const [imagesMap, setImagesMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/aircraft-images')
      .then(res => res.json())
      .then(data => setImagesMap(data))
      .catch(err => console.error("Error loading images in details modal:", err));
  }, []);

  const safeName = (plane.manufacturer + ' ' + plane.type).split('/').join('-').split('\\').join('-');

  return (
    <Modal open onClose={onClose} size="xl" title={plane.registration} icon={<Plane size={20} />}>
      <div className="flex flex-col gap-4">

            {/* Aircraft Blueprint Graphic */}
            <div className="w-full aspect-[3/2] h-auto max-h-[300px] rounded-sm border border-white/10 overflow-hidden relative group shrink-0 bg-black/40">
              <AircraftImage
                safeName={safeName}
                manufacturer={plane.manufacturer}
                type={plane.type}
                imagesMap={imagesMap}
                className="w-full h-full object-cover grayscale-[0.1] hover:grayscale-0 transition-all duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60 pointer-events-none"></div>
              <div className="absolute bottom-2 right-3 text-2xs font-mono text-white/30 uppercase tracking-widest bg-black/40 px-2 py-0.5 rounded-sm backdrop-blur-sm pointer-events-none">
                Visual Identification Verified
              </div>
            </div>

            {/* Summary */}
            <div className="flex gap-4">
               <div className="flex-1 flex flex-col gap-1">
                 <div className="text-2xs uppercase font-mono tracking-widest text-white/40 mb-1">Aircraft Model</div>
                 <div className="text-lg font-bold">{plane.manufacturer} {plane.type}</div>
                 <div className="text-xs uppercase tracking-widest text-white/50">{plane.class}</div>
               </div>
               
               <div className="flex flex-col items-end gap-1 font-mono text-xs">
                 <div className="text-2xs uppercase font-sans tracking-widest text-white/40 mb-1">Status</div>
                 {aircraftRoutes && aircraftRoutes.length > 0 ? (
                   <div className="text-white/80 border border-white/10 bg-white/5 px-2 py-0.5 rounded-sm uppercase tracking-wider">
                     Assigned ({aircraftRoutes.length} route{aircraftRoutes.length > 1 ? 's' : ''})
                   </div>
                 ) : (
                   <div className="text-aero-yellow border border-aero-yellow/20 bg-aero-yellow/10 px-2 py-0.5 rounded-sm uppercase tracking-wider">
                     Idle (No Route Assigned)
                   </div>
                 )}
               </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 bg-black/40 p-4 border border-white/5 rounded-sm">
              <div className="flex flex-col">
                <span className="text-3xs uppercase tracking-widest text-white/50 mb-1">Hub</span>
                <span className="font-mono">{plane.hubId || <span className="text-white/30 italic text-2xs">None</span>}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-3xs uppercase tracking-widest text-white/50 mb-1">Total Capacity</span>
                <span className="font-mono">{totalPax} pax</span>
              </div>
              <div className="flex flex-col">
                <span className="text-3xs uppercase tracking-widest text-white/50 mb-1">Max Range</span>
                <span className="font-mono">{plane.maxRange} km</span>
              </div>
              <div className="flex flex-col">
                <span className="text-3xs uppercase tracking-widest text-white/50 mb-1">Efficiency</span>
                <span className="font-mono">{plane.efficiency}/100</span>
              </div>
              <div className="flex flex-col">
                <span className="text-3xs uppercase tracking-widest text-white/50 mb-1">Age</span>
                <span className="font-mono">{ageLabel}</span>
              </div>
            </div>

            {/* Config & Condition */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold uppercase tracking-widest border-b border-white/10 pb-2 mb-2 text-white/80">Layout & Quality</h3>
                <div className="flex justify-between font-mono text-xs text-white/70">
                  <span>First</span> <span>{plane.config.first}</span>
                </div>
                <div className="flex justify-between font-mono text-xs text-white/70">
                  <span>Business</span> <span>{plane.config.business}</span>
                </div>
                <div className="flex justify-between font-mono text-xs text-white/70">
                  <span>Premium</span> <span>{plane.config.premium}</span>
                </div>
                <div className="flex justify-between font-mono text-xs text-white/70">
                  <span>Economy</span> <span>{plane.config.economy}</span>
                </div>
                
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5 font-mono text-xs">
                  <span className="text-2xs uppercase tracking-widest text-white/50">Overall Satisfaction</span>
                  <span className="text-aero-yellow">{combinedPopularity}/100</span>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <h3 className="text-sm font-bold uppercase tracking-widest border-b border-white/10 pb-2 mb-2 text-white/80 flex items-center justify-between">
                  <span>Maintenance</span>
                  {(plane.conditionInterior < 40 || plane.conditionGeneral < 40) && (
                    <span className="text-aero-yellow/60 text-2xs font-black uppercase tracking-wider animate-pulse flex items-center gap-1">
                      <ShieldAlert size={12} /> CRITICAL COND. (&lt;40%)
                    </span>
                  )}
                </h3>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-white/60">Interior Condition</span>
                    <span className={CONDITION_TEXT_CLASS[conditionTone(plane.conditionInterior)]}>
                      {Math.round(plane.conditionInterior)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-black rounded-full overflow-hidden">
                    <div
                      className={`h-full ${CONDITION_BAR_CLASS[conditionTone(plane.conditionInterior)]}`}
                      style={{ width: `${plane.conditionInterior}%`}}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-white/60">General Condition</span>
                    <span className={CONDITION_TEXT_CLASS[conditionTone(plane.conditionGeneral)]}>
                      {Math.round(plane.conditionGeneral)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-black rounded-full overflow-hidden">
                    <div
                      className={`h-full ${CONDITION_BAR_CLASS[conditionTone(plane.conditionGeneral)]}`}
                      style={{ width: `${plane.conditionGeneral}%`}}
                    />
                  </div>
                </div>

                <button 
                  onClick={onRenovate}
                  className={`mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-sm text-xs uppercase tracking-widest font-bold transition-all ${
                    plane.conditionInterior < 40 || plane.conditionGeneral < 40
                      ? 'bg-aero-warn hover:bg-aero-warn/80 text-black font-black shadow-lg shadow-aero-warn/40 animate-pulse'
                      : 'bg-white/5 hover:bg-white/10 border border-white/10 text-white'
                  }`}
                >
                  <Wrench size={14} />
                  {plane.conditionInterior < 40 || plane.conditionGeneral < 40 ? 'URGENT: Reconfigure / Renovate' : 'Reconfigure / Renovate'}
                </button>
              </div>

            </div>

            {/* Liquidation & Market Value */}
            {(() => {
              const baseValue = plane.basePrice || 10000000;
              const condGenFactor = (plane.conditionGeneral / 100) * 0.45;
              const condIntFactor = (plane.conditionInterior / 100) * 0.15;
              const residualFactor = 0.30;
              const factor = residualFactor + condGenFactor + condIntFactor;
              const salePrice = Math.round(baseValue * factor);
              const formatUSD = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

              return (
                <div className="bg-black/40 border border-white/5 p-4 rounded-sm flex flex-col sm:flex-row items-center justify-between gap-4 mt-2">
                  <div className="flex flex-col gap-1 w-full sm:w-auto">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-aero-yellow">Market Liquidation Value</h3>
                    <p className="text-2xs text-white/50 lowercase tracking-wide font-sans max-w-sm">
                      calculated dynamically from general airframe condition and passenger interior satisfaction. residual base value is guaranteed.
                    </p>
                  </div>
                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-left sm:text-right font-mono">
                      <div className="text-lg font-black text-white">{formatUSD(salePrice)}</div>
                      <div className="text-3xs uppercase text-white/30 tracking-widest">Est. Sell Price</div>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to sell ${plane.registration} for ${formatUSD(salePrice)}? This will permanently decommission all its scheduled flights.`)) {
                          onSell?.(plane);
                        }
                      }}
                      className="px-5 py-3 border border-aero-yellow/20 bg-black text-aero-yellow hover:bg-aero-yellow hover:text-black hover:border-aero-yellow transition-all duration-300 font-bold uppercase tracking-widest text-2xs whitespace-nowrap rounded-sm"
                    >
                      Sell Plane
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Assigned Routes */}
            <div className="mt-8 flex items-end justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest border-b border-white/10 pb-2 mb-4 text-white/80">Assigned Routes</h3>
                {aircraftRoutes.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {aircraftRoutes.map((r, i) => (
                      <button 
                        key={i}
                        onClick={() => {
                          onClose();
                          onSelectRoute?.(r);
                        }}
                        className="inline-flex items-center px-3 py-1.5 rounded-sm text-xs font-bold bg-white/5 text-white/80 border border-white/10 uppercase tracking-wider hover:bg-white/5 hover:text-white/80 transition-colors"
                      >
                        {r.schedule?.[0]?.flightNumOut ? 'NE' + r.schedule[0].flightNumOut : `${r.origin}-${r.destination}`}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="text-white/40 uppercase tracking-widest text-xs">No routes assigned</span>
                )}
              </div>
              <button
                onClick={() => onStartRoute?.(plane.registration)}
                className="px-3 py-3 bg-white/5 text-white font-black italic uppercase tracking-widest hover:bg-aero-yellow hover:text-black transition-all text-2xs border border-white/10 rounded-sm"
              >
                New Route +
              </button>
            </div>

      </div>
    </Modal>
  );
}
