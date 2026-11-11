import { monthlyOwnershipCost } from '../lib/fleetCosts';
import { useState, useEffect } from 'react';
import { formatCurrency, routeFlightNumber } from '../lib/format';
import type { OwnedAircraft } from './MyFleetView';
import { Plane, Wrench, ShieldAlert, ArrowLeftRight } from 'lucide-react';
import { AircraftImage } from './AircraftImage';
import { loadAircraftImagesMap } from '../lib/imageUtils';
import { getPlaneSat, getAircraftResaleValue } from '../lib/financeUtils';
import { getResaleBonus } from '../lib/economyContext';
import { Modal } from './ui/Modal';
import { conditionTone, CONDITION_TEXT_CLASS, CONDITION_BAR_CLASS } from '../lib/theme';
import { AircraftSwapPanel } from './AircraftReassign';
import type { AssignmentContext, RoutePatch } from '../lib/aircraftAssignment';

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
  /** Flight-number prefix for routes saved before they carried their own. */
  airlineCode?: string;
  /**
   * Everything the swap needs to check the other aircraft. Without
   * `onReassignRoutes` the Swap button is not offered.
   */
  fleet?: OwnedAircraft[];
  allRoutes?: any[];
  airportManagement?: AssignmentContext['airportManagement'];
  onReassignRoutes?: (patches: RoutePatch[], note: string) => void;
}

export function AircraftDetailsModal({
  plane, onClose, onRenovate, aircraftRoutes = [], onSelectRoute, onStartRoute, onSell, currentDateOffset, airlineCode = '',
  fleet = [], allRoutes = [], airportManagement = {}, onReassignRoutes
}: Props) {
  const [isSwapping, setIsSwapping] = useState(false);

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
    let active = true;
    loadAircraftImagesMap().then(map => { if (active) setImagesMap(map); });
    return () => { active = false; };
  }, []);

  const safeName = (plane.manufacturer + ' ' + plane.type).split('/').join('-').split('\\').join('-');

  if (isSwapping && onReassignRoutes) {
    return (
      <Modal open onClose={onClose} size="xl" title={`Swap ${plane.registration}`} icon={<ArrowLeftRight size={20} />}>
        <AircraftSwapPanel
          plane={plane}
          fleet={fleet}
          routes={allRoutes}
          airportManagement={airportManagement}
          airlineCode={airlineCode}
          onBack={() => setIsSwapping(false)}
          onSwap={(patches, replacement) => {
            onReassignRoutes(
              patches,
              `${replacement.registration} now flies the ${patches.length} route${patches.length === 1 ? '' : 's'} of ${plane.registration}`
            );
            setIsSwapping(false);
          }}
        />
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} size="xl" title={plane.registration} icon={<Plane size={20} />}>
      <div className="flex flex-col gap-4">

            {/* Aircraft Blueprint Graphic. Shorter on phones, where at full
                size it filled the screen before any figure. */}
            <div className="w-full aspect-[3/2] h-auto max-h-[300px] bar:max-h-[150px] short:max-h-[110px] rounded-sm border border-line overflow-hidden relative group shrink-0 bg-ground/40">
              <AircraftImage
                safeName={safeName}
                manufacturer={plane.manufacturer}
                type={plane.type}
                imagesMap={imagesMap}
                className="w-full h-full object-cover grayscale-[0.1] hover:grayscale-0 transition-all duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ground via-transparent to-transparent opacity-60 pointer-events-none"></div>
              <div className="absolute bottom-2 right-3 text-2xs font-label text-muted uppercase tracking-label bg-ground/40 px-2 py-0.5 rounded-sm pointer-events-none">
                Visual Identification Verified
              </div>
            </div>

            {/* Summary */}
            <div className="flex gap-4">
               <div className="flex-1 flex flex-col gap-1">
                 <div className="text-2xs uppercase font-label tracking-label text-muted mb-1">Aircraft Model</div>
                 <div className="text-lg font-semibold">{plane.manufacturer} {plane.type}</div>
                 <div className="text-xs uppercase tracking-label text-muted">{plane.class}</div>
               </div>
               
               <div className="flex flex-col items-end gap-1 font-mono text-xs">
                 <div className="text-2xs uppercase font-sans tracking-label text-muted mb-1">Status</div>
                 {aircraftRoutes && aircraftRoutes.length > 0 ? (
                   <div className="text-ink border border-line bg-surface px-2 py-0.5 rounded-sm uppercase tracking-label">
                     Assigned ({aircraftRoutes.length} route{aircraftRoutes.length > 1 ? 's' : ''})
                   </div>
                 ) : (
                   <div className="text-accent border border-accent/20 bg-accent/10 px-2 py-0.5 rounded-sm uppercase tracking-label">
                     Idle (No Route Assigned)
                   </div>
                 )}
               </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 bg-ground/40 p-4 border border-line rounded-sm">
              <div className="flex flex-col">
                <span className="text-2xs uppercase tracking-label text-muted mb-1">Hub</span>
                <span className="font-mono">{plane.hubId || <span className="text-muted text-2xs">None</span>}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xs uppercase tracking-label text-muted mb-1">Total Capacity</span>
                <span className="font-mono">{totalPax} pax</span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xs uppercase tracking-label text-muted mb-1">Max Range</span>
                <span className="font-mono">{plane.maxRange} km</span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xs uppercase tracking-label text-muted mb-1">Efficiency</span>
                <span className="font-mono">{plane.efficiency}/100</span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xs uppercase tracking-label text-muted mb-1">Age</span>
                <span className="font-mono">{ageLabel}</span>
              </div>
              {typeof currentDateOffset === 'number' && (
                <div className="flex flex-col col-span-2 sm:col-span-5">
                  <span className="text-2xs uppercase tracking-label text-muted mb-1">Insurance &amp; maintenance</span>
                  <span className="font-mono">
                    {formatCurrency(monthlyOwnershipCost(plane, currentDateOffset, aircraftRoutes.length > 0))} a month
                    {aircraftRoutes.length === 0 && <span className="text-bad"> (parked: half rate, still a cost)</span>}
                  </span>
                </div>
              )}
            </div>

            {/* Config & Condition */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold border-b border-line pb-2 mb-2 text-ink">Layout & Quality</h3>
                <div className="flex justify-between font-mono text-xs text-muted">
                  <span>First</span> <span>{plane.config.first}</span>
                </div>
                <div className="flex justify-between font-mono text-xs text-muted">
                  <span>Business</span> <span>{plane.config.business}</span>
                </div>
                <div className="flex justify-between font-mono text-xs text-muted">
                  <span>Premium</span> <span>{plane.config.premium}</span>
                </div>
                <div className="flex justify-between font-mono text-xs text-muted">
                  <span>Economy</span> <span>{plane.config.economy}</span>
                </div>
                
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-line font-mono text-xs">
                  <span className="text-2xs uppercase tracking-label text-muted">Overall Satisfaction</span>
                  <span className="text-accent">{combinedPopularity}/100</span>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <h3 className="text-sm font-semibold border-b border-line pb-2 mb-2 text-ink flex items-center justify-between">
                  <span>Maintenance</span>
                  {(plane.conditionInterior < 40 || plane.conditionGeneral < 40) && (
                    <span className="text-accent text-2xs font-semibold uppercase tracking-label animate-pulse flex items-center gap-1">
                      <ShieldAlert size={12} /> CRITICAL COND. (&lt;40%)
                    </span>
                  )}
                </h3>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted">Interior Condition</span>
                    <span className={CONDITION_TEXT_CLASS[conditionTone(plane.conditionInterior)]}>
                      {Math.round(plane.conditionInterior)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-ground rounded-full overflow-hidden">
                    <div
                      className={`h-full ${CONDITION_BAR_CLASS[conditionTone(plane.conditionInterior)]}`}
                      style={{ width: `${plane.conditionInterior}%`}}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted">General Condition</span>
                    <span className={CONDITION_TEXT_CLASS[conditionTone(plane.conditionGeneral)]}>
                      {Math.round(plane.conditionGeneral)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-ground rounded-full overflow-hidden">
                    <div
                      className={`h-full ${CONDITION_BAR_CLASS[conditionTone(plane.conditionGeneral)]}`}
                      style={{ width: `${plane.conditionGeneral}%`}}
                    />
                  </div>
                </div>

                <button 
                  onClick={onRenovate}
                  className={`mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-sm text-xs uppercase tracking-label font-semibold transition-all ${
                    plane.conditionInterior < 40 || plane.conditionGeneral < 40
                      ? 'bg-bad hover:bg-bad/80 text-on-accent font-semibold animate-pulse'
                      : 'bg-surface hover:bg-raised border border-line text-ink'
                  }`}
                >
                  <Wrench size={14} />
                  {plane.conditionInterior < 40 || plane.conditionGeneral < 40 ? 'URGENT: Reconfigure / Renovate' : 'Reconfigure / Renovate'}
                </button>
              </div>

            </div>

            {/* Liquidation & Market Value */}
            {(() => {
              // The amount the sale actually credits (App.handleSellAircraft).
              const salePrice = getAircraftResaleValue({ ...plane, ageYears: ageMonths === null ? undefined : ageMonths / 12, resaleBonus: getResaleBonus() });
              const formatUSD = formatCurrency;

              return (
                <div className="bg-ground/40 border border-line p-4 rounded-sm flex flex-col sm:flex-row items-center justify-between gap-4 mt-2">
                  <div className="flex flex-col gap-1 w-full sm:w-auto">
                    <h3 className="text-xs font-label font-semibold uppercase tracking-label text-accent">Market Liquidation Value</h3>
                    <p className="text-2xs text-muted lowercase font-sans max-w-sm">
                      calculated dynamically from general airframe condition, passenger interior satisfaction and age. residual base value is guaranteed.
                    </p>
                  </div>
                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-left sm:text-right font-mono">
                      <div className="text-lg font-semibold text-ink">{formatUSD(salePrice)}</div>
                      <div className="text-2xs uppercase text-muted tracking-label">Est. Sell Price</div>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to sell ${plane.registration} for ${formatUSD(salePrice)}? This will permanently decommission all its scheduled flights.`)) {
                          onSell?.(plane);
                        }
                      }}
                      className="px-5 py-3 border border-accent/20 bg-ground text-accent hover:bg-accent hover:text-on-accent hover:border-accent transition-all duration-300 font-semibold uppercase tracking-label text-2xs whitespace-nowrap rounded-sm"
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
                <h3 className="text-sm font-semibold border-b border-line pb-2 mb-4 text-ink">Assigned Routes</h3>
                {aircraftRoutes.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {aircraftRoutes.map((r) => (
                      <button 
                        key={r.id}
                        onClick={() => {
                          onClose();
                          onSelectRoute?.(r);
                        }}
                        className="inline-flex items-center px-3 py-1.5 rounded-sm text-xs font-semibold bg-surface text-ink border border-line uppercase tracking-label hover:bg-raised hover:text-ink transition-colors"
                      >
                        {r.schedule?.[0]?.flightNumOut && (
                          <span className="mr-2">{routeFlightNumber(r, airlineCode)}</span>
                        )}
                        <span className="text-accent">{r.origin}–{r.destination}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted uppercase tracking-label text-xs">No routes assigned</span>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                {onReassignRoutes && (
                  <button
                    onClick={() => setIsSwapping(true)}
                    disabled={aircraftRoutes.length === 0}
                    title={aircraftRoutes.length === 0 ? 'This aircraft flies no routes to hand over.' : 'Hand all routes of this aircraft to an idle one.'}
                    className="px-3 py-3 bg-surface text-ink font-semibold uppercase tracking-label hover:bg-accent hover:text-on-accent transition-all text-2xs border border-line rounded-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-raised disabled:hover:text-ink"
                  >
                    <ArrowLeftRight size={12} /> Swap
                  </button>
                )}
                <button
                  onClick={() => onStartRoute?.(plane.registration)}
                  className="px-3 py-3 bg-surface text-ink font-semibold uppercase tracking-label hover:bg-accent hover:text-on-accent transition-all text-2xs border border-line rounded-sm"
                >
                  New Route +
                </button>
              </div>
            </div>

      </div>
    </Modal>
  );
}
