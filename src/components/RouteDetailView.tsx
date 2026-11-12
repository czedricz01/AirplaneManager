import { clickOnKey } from '../lib/a11y';
import { maturityNote } from '../lib/routeMaturity';
import { FinancialReport } from "./FinancialReport";
import { formatCurrency, formatNumber, routeFlightNumber } from '../lib/format';
import { useState, useMemo } from 'react';
import { X, Clock, Coffee, DollarSign, Trash2, Settings, Info, AlertTriangle } from 'lucide-react';
import { Airport } from '../data/airports';

import {
  getFlightTimeClass,
  calculateRouteFinancials,
  seatWeightedSatisfaction,
  RouteOffer,
  marketKey,
} from '../lib/financeUtils';
import { NEUTRAL_PLAYER_MODIFIERS, type PlayerModifiers, type RouteCancellation } from '../lib/gameState';
import type { RouteTransfer } from '../lib/transferUtils';

import { airportsMapAdjusted } from '../data/airportRegistry';

import type { OwnedAircraft } from './MyFleetView';
import { AircraftDetailsModal } from './AircraftDetailsModal';
import { RouteAircraftPicker } from './AircraftReassign';

// A stable default, so a missing prop does not invalidate the memos on every render.
const NO_RIVAL_OFFERS: RouteOffer[] = [];

interface RouteDetailViewProps {
  route: any; // We'll refine this type
  routes: any[];
  fleet?: OwnedAircraft[];
  fuelPrice?: number;
  /** The player-only effects on the economy, so the detail matches the monthly report. */
  playerMods?: PlayerModifiers;
  rivalOffers?: RouteOffer[];
  /**
   * This route's connecting passengers, for the breakdown. The figures
   * themselves come from `playerMods.transfer` through the engine.
   */
  transfer?: RouteTransfer;
  /** Flights this route loses this month and why; the engine already leaves them out through playerMods. */
  cancellation?: RouteCancellation;
  airportManagement?: Record<string, any>;
  currentYear: number;
  currentMonth: number;
  difficulty: string;
  onClose: () => void;
  onDelete: (id: string) => void;
  /** "Change": the player picked `registration`; the new time slot is chosen next. */
  onReassignAircraft?: (routeId: string, registration: string) => void;
  onEditSchedule?: (routeId: string) => void;
  onEditCabinServices?: (routeId: string) => void;
  onEditFinancials?: (routeId: string) => void;
  airlineCode?: string;
}


export function RouteDetailView({
  route, routes, fleet, fuelPrice = 1.05, airportManagement,
  currentYear, currentMonth, difficulty, playerMods = NEUTRAL_PLAYER_MODIFIERS, rivalOffers = NO_RIVAL_OFFERS, transfer, cancellation,
  onClose, onDelete, onReassignAircraft, onEditSchedule, onEditCabinServices, onEditFinancials,
  airlineCode = ''
}: RouteDetailViewProps) {
  const codePrefix = route.airlineCode || airlineCode;
  const flightNo = routeFlightNumber(route, airlineCode);
  const [showAircraftDetails, setShowAircraftDetails] = useState(false);
  const [isPickingAircraft, setIsPickingAircraft] = useState(false);
  // Deleting a route cannot be undone, so the first click only arms the button.
  const [confirmDelete, setConfirmDelete] = useState(false);

  const assignedAircraft = fleet?.find(ac => ac.registration === route.aircraft);

  const airportsMap = useMemo(() => {
    const map = new Map<string, Airport>();
    airportsMapAdjusted.forEach((a, id) => map.set(id, a));
    return map;
  }, []);

  /**
   * Who else flies this city pair. Without this the player would watch revenue
   * fall on a route they had not touched, with nothing on screen to explain it.
   */
  const competitors = useMemo(() => {
    const key = marketKey(route.origin, route.destination);
    const fromRivals = rivalOffers
      .filter(o => marketKey(o.origin, o.destination) === key && o.departures > 0)
      .map(o => ({ name: o.airline || 'Rival airline', departures: o.departures }));
    const fromOwn = (routes || [])
      .filter(r => r.id !== route.id && marketKey(r.origin, r.destination) === key)
      .map(r => ({ name: `Your own ${r.origin}-${r.destination}`, departures: r.schedule?.length || 0 }))
      .filter(r => r.departures > 0);
    return [...fromRivals, ...fromOwn];
  }, [rivalOffers, routes, route.id, route.origin, route.destination]);

  const financials = useMemo(() => {
    if (!assignedAircraft) return null;
    return calculateRouteFinancials(
      route,
      assignedAircraft,
      fuelPrice,
      airportManagement || {},
      currentYear,
      currentMonth,
      difficulty,
      airportsMap,
      routes,
      fleet,
      false,
      playerMods.demandFactor,
      rivalOffers,
      playerMods
    );
  }, [route, assignedAircraft, fuelPrice, airportManagement, currentYear, currentMonth, difficulty, airportsMap, routes, fleet, playerMods, rivalOffers]);

  const actualConfigSeats = assignedAircraft?.config 
    ? ((assignedAircraft.config.economy || 0) + (assignedAircraft.config.premium || 0) + (assignedAircraft.config.business || 0) + (assignedAircraft.config.first || 0)) 
    : 0;
  const actualCapacity = actualConfigSeats > 0 ? actualConfigSeats : (assignedAircraft?.capacity || 0);

  return (
    <div
      className="absolute inset-0 z-50 bg-ground/95 flex flex-col font-sans p-4 bar:p-3 short:p-2.5 overflow-y-auto animate-appear"
    >
      {/* Upright phones: smaller title, buttons below it. Sideways: one slim row. */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bar:gap-2 mb-4 bar:mb-3 short:mb-2 shrink-0">
        <h2 className="font-label text-2xl md:text-3xl bar:text-xl short:text-lg text-ink font-semibold flex flex-wrap items-center gap-x-4 bar:gap-x-3">
          Route Detail
          <span className="text-muted text-2xl bar:text-xl short:text-lg">|</span>
          <span className="text-ink">{flightNo}</span>
        </h2>
        <div className="flex items-center gap-4 bar:gap-2 short:gap-2">
          {confirmDelete && (
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-4 py-2 border border-rule text-muted hover:text-ink hover:bg-raised transition-colors uppercase text-xs tracking-label font-semibold"
            >
              Keep Route
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }
              onDelete(route.id);
            }}
            className={`flex items-center justify-center gap-2 px-4 py-2 outline outline-1 transition-colors uppercase text-xs tracking-label font-semibold ${
              confirmDelete ? 'bg-bad text-on-accent outline-bad' : 'bg-surface hover:bg-raised outline-bad/50 text-ink'
            }`}
          >
            <Trash2 size={16} /> {confirmDelete ? 'Confirm: Delete Route' : 'Delete Route'}
          </button>
          <button
            onClick={onClose}
            className="w-12 h-12 bar:w-9 bar:h-9 short:w-8 short:h-8 bg-ground border border-rule flex items-center justify-center hover:bg-raised transition-colors text-ink"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      <div className="flex flex-col flex-1 shrink-0 gap-3">
        {cancellation && cancellation.share > 0 && (
          <div className="flex items-center gap-3 border border-bad/40 bg-bad/10 px-4 py-2 rounded-sm text-xs">
            <AlertTriangle size={16} className="text-bad shrink-0" />
            <span>
              <span className="text-bad font-semibold uppercase tracking-label">
                {Math.round(cancellation.share * 100)}% of flights cancelled this month:
              </span>{' '}
              <span className="text-muted">{cancellation.reasons.join(', ')}</span>
              <span className="text-muted"> · the figures below already leave them out</span>
            </span>
          </div>
        )}
        {/* Top Third: Hub - Aircraft - Destination */}
        {/* Origin, route and destination side by side, as on the desktop but
            without its 280px minimum on a phone held sideways. Upright phones
            put origin and destination next to each other on top and the route
            below (flex-wrap plus order); each block takes its own height
            (flex-none), or the middle one gets clipped. */}
        <div className="min-h-[280px] bar:min-h-0 short:min-h-0 shrink-0 md:shrink flex flex-row flex-wrap md:flex-nowrap border border-line bg-ground/40 relative overflow-hidden">
          <div className="order-1 md:order-none w-1/2 md:w-auto flex-none md:flex-1 flex flex-col items-center justify-center py-3 md:py-0 short:py-2 border-r border-line relative z-10">
            <span className="text-muted text-2xs uppercase tracking-label font-semibold mb-4 bar:mb-1 short:mb-1">Origin Hub</span>
            <span className="text-3xl bar:text-3xl short:text-3xl font-semibold text-accent">{route.origin}</span>
            <span className="text-muted text-xs mt-2 bar:mt-1 short:mt-1 uppercase tracking-label font-semibold text-center">{airportsMap.get(route.origin)?.name || "Unknown Airport"}</span>
          </div>

          <div className="order-3 md:order-none w-full md:w-auto flex-none md:flex-1 flex flex-col justify-center px-4 md:px-12 short:px-3 py-4 md:py-0 bar:py-3 short:py-2 relative overflow-hidden group border-t md:border-t-0 md:border-r border-line z-10">
            <div className="flex items-center justify-between mb-4 bar:mb-3 short:mb-2">
              <div className="flex flex-col">
                <span className="text-muted text-2xs uppercase tracking-label font-semibold block mb-1">Assigned Aircraft</span>
                <span className="text-ink font-mono text-xl">{route.aircraft}</span>
              </div>
              <div className="text-right">
                <span className="text-muted text-2xs uppercase tracking-label font-semibold block mb-1">Route Distance</span>
                <span className="text-ink font-mono text-xl">{Math.round(route.distance || 0)} <span className="text-xs text-muted">KM</span></span>
              </div>
            </div>

            {competitors.length > 0 && (
              <div className="bg-bad/5 p-3 border border-bad/30 rounded-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-bad text-2xs uppercase tracking-label font-semibold">
                    Competing on this route
                  </span>
                  <span className="text-2xs text-muted">
                    passengers are shared
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                  {competitors.map((c, i) => (
                    <span key={i} className="text-2xs font-mono text-muted">
                      {c.name} <span className="text-muted">{c.departures}x / week</span>
                    </span>
                  ))}
                  <span className="text-2xs font-mono text-muted">
                    you {route.schedule?.length || 0}x / week
                  </span>
                </div>
                <p className="text-2xs text-muted mt-2 leading-relaxed">
                  Your share of this market grows with frequency, a lower fare and higher
                  satisfaction. Fare matters most.
                </p>
              </div>
            )}

            <div className="flex gap-4 items-center bg-surface p-4 bar:p-3 short:p-2 border border-line rounded-sm">
              <div className="flex flex-col">
                <span className="text-muted text-2xs uppercase tracking-label font-semibold mb-1">Weekly Pax</span>
                <span className="text-2xl font-semibold text-accent">{formatNumber(financials?.paxPerWeek ?? route.paxPerWeek ?? 0)}</span>
                {maturityNote(playerMods.maturity?.[route.id]) && (
                  <span className="text-2xs font-mono text-accent mt-1">{maturityNote(playerMods.maturity?.[route.id])}</span>
                )}
                {(financials?.transferPax ?? 0) > 0 && (
                  <span className="text-2xs text-muted mt-1">
                    incl. {formatNumber(financials!.transferPax)} transfer pax/wk ({formatCurrency(financials!.transferRev)})
                  </span>
                )}
                {(financials?.transferPax ?? 0) > 0 && transfer && transfer.flows.length > 0 && (
                  <span className="text-2xs font-mono text-muted mt-0.5">
                    {transfer.flows.slice(0, 3).map(f => `${f.o}→${f.hub}→${f.d} ${formatNumber(f.pax)}`).join(' · ')}
                  </span>
                )}
              </div>
              <div className="ml-auto">
                {assignedAircraft && (
                  <div className="flex flex-col text-2xs uppercase tracking-label text-right">
                    <span className="text-muted">{assignedAircraft.manufacturer} {assignedAircraft.type}</span>
                    <span className="text-muted">{assignedAircraft.class} • Cap: {actualCapacity}</span>
                    <div className="flex items-center justify-end gap-2 mt-1">
                        <button onClick={() => setShowAircraftDetails(true)} className="text-2xs px-1.5 py-0.5 bg-raised hover:bg-raised text-ink transition-colors border border-line font-semibold">Details</button>
                        <button 
                          onClick={() => setIsPickingAircraft(true)}
                          disabled={!onReassignAircraft}
                          className="text-2xs px-1.5 py-0.5 bg-raised hover:bg-accent hover:text-on-accent text-ink font-semibold transition-all border border-line"
                        >
                          Change
                        </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 bar:mt-3 short:mt-2 flex items-center justify-between">
              {route.durMin && (
                <div className="flex items-center gap-3">
                  <span className="text-accent border border-accent/30 px-2 py-0.5 bg-accent/10 rounded-sm text-2xs">TIME-CLASS: {getFlightTimeClass(route.durMin)}</span>
                  <span className="text-muted text-2xs font-label uppercase">
                      Flight Time: {Math.floor(route.durMin / 60)}h {(route.durMin % 60).toString().padStart(2, '0')}m
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="order-2 md:order-none w-1/2 md:w-auto flex-none md:flex-1 flex flex-col items-center justify-center py-3 md:py-0 short:py-2 relative z-10">
            <span className="text-muted text-2xs uppercase tracking-label font-semibold mb-4 bar:mb-1 short:mb-1">Destination</span>
            <span className="text-3xl bar:text-3xl short:text-3xl font-semibold text-accent">{route.destination}</span>
            <span className="text-muted text-xs mt-2 bar:mt-1 short:mt-1 uppercase tracking-label font-semibold text-center">{airportsMap.get(route.destination)?.name || "Unknown Airport"}</span>
          </div>
        </div>

        {/* Bottom Two Thirds: 3 Boxes */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {/* Timetable Box */}
          <div role="button" tabIndex={0} aria-label="Edit the timetable" onKeyDown={clickOnKey} onClick={() => onEditSchedule && onEditSchedule(route.id)} className="border border-line bg-ground/40 flex flex-col hover:border-accent/50 hover:bg-accent/5 transition-colors cursor-pointer group relative overflow-hidden min-h-[400px] bar:min-h-[240px] short:min-h-[200px] h-full">
            <div className="p-4 pb-4 border-b border-line flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <Clock className="text-accent" size={20} />
                <h3 className="font-label text-lg font-semibold text-ink group-hover:text-accent transition-colors">Flightplan</h3>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-2xs text-muted uppercase tracking-label font-semibold leading-none mb-1">Weekly Ops</span>
                <span className="text-lg font-semibold text-ink leading-none">{route.weeklyFlights}</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {route.schedule && route.schedule.length > 0 ? (
                (() => {
                  const uniqueFlights = Object.values(route.schedule.reduce((acc: any, s: any) => {
                    const key = `${s.flightNumOut}-${s.flightNumIn}`;
                    if (!acc[key]) {
                      acc[key] = { ...s, days: [s.dayId] };
                    } else {
                      if (!acc[key].days.includes(s.dayId)) {
                        acc[key].days.push(s.dayId);
                      }
                    }
                    return acc;
                  }, {} as Record<string, any>)).sort((a: any, b: any) => {
                    const aTotal = (a.days[0]-1)*1440 + a.startHour * 60 + a.startMin;
                    const bTotal = (b.days[0]-1)*1440 + b.startHour * 60 + b.startMin;
                    return aTotal - bTotal;
                  });

                  const dayNamesShort = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
                  const formatTimeSpecial = (totalMins: number) => {
                    const h = Math.floor(((Math.round(totalMins) + 10080) % 1440) / 60);
                    const min = (Math.round(totalMins) + 10080) % 60;
                    return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
                  };

                  return uniqueFlights.map((s: any) => {
                    const base = s.startHour * 60 + s.startMin;
                    const dep1 = formatTimeSpecial(base + 30);
                    const arr1 = formatTimeSpecial(base + 30 + s.durMin);
                    const dep2 = formatTimeSpecial(base + 30 + s.durMin + s.turnoverMin);
                    const arr2 = formatTimeSpecial(base + 30 + s.durMin + s.turnoverMin + s.durMin);
                    const sortedDays = [...s.days].sort((a: number, b: number) => a - b);
                    
                    return (
                      <div key={`${s.flightNumOut}-${s.days[0]}`} className="bg-surface border border-line p-3 rounded-sm group-hover:border-accent/30 transition-all">
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col">
                            <div className="flex gap-2 items-center mb-1">
                               <span className="text-accent font-semibold text-sm">{codePrefix}{s.flightNumOut}</span>
                               {!s.isOneWay && (
                                 <span className="text-muted font-mono text-2xs">/ {codePrefix}{s.flightNumIn}</span>
                               )}
                            </div>
                            <div className="flex gap-1 flex-wrap">
                               {sortedDays.map(d => (
                                 <span key={d} className="text-2xs bg-raised px-1 border border-line font-semibold">{dayNamesShort[d-1]}</span>
                               ))}
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                             <div className="flex items-center gap-2 justify-end">
                                <span className="text-2xs uppercase font-semibold text-muted tracking-label">OUT:</span>
                                <span className="text-ink font-mono text-2xs font-semibold">{dep1} - {arr1}</span>
                             </div>
                             {!s.isOneWay && (
                               <div className="flex items-center gap-2 justify-end">
                                  <span className="text-2xs uppercase font-semibold text-muted tracking-label">IN:</span>
                                  <span className="text-muted font-mono text-2xs font-semibold">{dep2} - {arr2}</span>
                               </div>
                             )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()
              ) : (
                <div className="h-full flex items-center justify-center text-muted text-2xs uppercase font-semibold">
                  No flights scheduled
                </div>
              )}
            </div>

            <div className="p-4 bg-ground/40 border-t border-line text-center uppercase tracking-label text-2xs font-semibold text-muted group-hover:text-accent transition-colors shrink-0">
              Click to edit schedule
            </div>
          </div>

          {/* Cabin Services Box */}
          <div role="button" tabIndex={0} aria-label="Edit cabin services" onKeyDown={clickOnKey} onClick={() => onEditCabinServices?.(route.id)} className="border border-line bg-ground/40 flex flex-col hover:border-accent/50 hover:bg-accent/5 transition-colors cursor-pointer group p-4 relative overflow-hidden">
             <div className="flex items-center justify-between mb-4 pb-4 border-b border-line">
              <div className="flex items-center gap-3">
                <Coffee className="text-accent" size={24} />
                <h3 className="font-label text-lg font-semibold text-ink group-hover:text-accent transition-colors">Cabin Services</h3>
              </div>
              <Settings size={16} className="text-muted group-hover:text-accent transition-colors" />
            </div>
            <div className="flex-1 flex flex-col">
               <div className="grid grid-cols-2 gap-4 mb-4 overflow-y-auto pr-2 max-h-[300px]">
                  {(() => {
                    const classes = ['economy', 'premium', 'business', 'first'];
                    const classSats = classes.filter(cls => {
                      const seats = assignedAircraft?.config?.[cls as keyof typeof assignedAircraft.config] as number;
                      return seats !== undefined && seats > 0;
                    }).map(cls => ({ name: cls, sat: financials?.routeSat?.[cls] ?? 0 }));

                    // Seat-weighted, like the planner and the economy. The plain mean
                    // over classes above 0% hid a failing cabin and over-weighted a
                    // handful of first-class seats.
                    const avgSat = financials ? seatWeightedSatisfaction(financials.routeSat, assignedAircraft?.config) : 0;

                    return (
                      <>
                        <div className="col-span-2 flex flex-col items-center justify-center py-2 bg-surface border border-line rounded-sm mb-2">
                           <span className="text-2xs text-muted uppercase font-semibold tracking-label mb-1">Route Satisfaction</span>
                           <span className="text-3xl font-semibold text-accent">{avgSat.toFixed(0)}%</span>
                        </div>
                        {classSats.map(cs => {
                          // Live, like the percentage beside it; the copy stored on the route went stale.
                          const satDetails = financials?.satisfactionDetails?.[cs.name];
                          const expectation = satDetails?.serviceExpected || 0;
                          const reality = Math.round(satDetails?.serviceDelivered || 0);
                          
                          // The worst band is the most visible, not the darkest.
                          let barColor = 'bg-bad';
                          let textColor = 'text-bad';
                          if (cs.sat >= 100) { barColor = 'bg-accent'; textColor = 'text-accent'; }
                          else if (cs.sat >= 85) { barColor = 'bg-lime-400'; textColor = 'text-lime-400'; }
                          else if (cs.sat >= 60) { barColor = 'bg-accent'; textColor = 'text-accent'; }
                          else if (cs.sat >= 40) { barColor = 'bg-accent'; textColor = 'text-accent'; }

                          return (
                          <div key={cs.name} className="col-span-2 flex flex-col p-3 bg-ground/40 border border-line rounded-sm relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-1 opacity-10">
                               <Coffee size={40} />
                             </div>
                             <div className="flex justify-between items-end mb-2 relative z-10">
                               <span className="text-2xs text-muted uppercase font-semibold tracking-label">{cs.name}</span>
                               <span className={`text-sm font-semibold ${textColor}`}>{cs.sat.toFixed(0)}%</span>
                             </div>
                             
                             <div className="w-full bg-ground/60 h-2 rounded-full overflow-hidden mb-2 relative z-10 border border-line">
                                <div className={`h-full ${barColor} transition-all duration-1000 ease-out`} style={{ width: `${Math.min(100, cs.sat)}%` }}></div>
                             </div>

                             <div className="flex justify-between text-2xs text-muted uppercase tracking-label relative z-10 mt-1">
                                <span className="flex flex-col">
                                   <span className="text-muted text-2xs">Service expected</span>
                                   <span className="font-mono text-ink">{expectation}</span>
                                </span>
                                <span className="flex flex-col text-right">
                                   <span className="text-muted text-2xs">Service served</span>
                                   <span className="font-mono text-ink">{reality}</span>
                                </span>
                             </div>
                          </div>
                          );
                        })}
                      </>
                    );
                  })()}
               </div>
               <div className="mt-auto text-center">
                  <span className="text-muted text-2xs uppercase tracking-label font-semibold">Configured Cabin Services</span>
               </div>
            </div>
          </div>

          
          {/* Finances Box */}
          <div role="button" tabIndex={0} aria-label="Edit fares" onKeyDown={clickOnKey} onClick={() => onEditFinancials?.(route.id)} className="border border-line bg-ground/40 flex flex-col hover:border-accent/50 hover:bg-accent/5 transition-colors cursor-pointer group relative overflow-hidden">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-line p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="text-accent" size={20} />
                <h3 className="font-label text-sm font-semibold text-ink group-hover:text-accent transition-colors">Financials</h3>
              </div>
              <Settings size={16} className="text-muted group-hover:text-accent transition-colors" />
            </div>
            <div className="flex-1 flex flex-col p-4 pt-0">
               {financials && (
                 <>
                   <div className="p-3 mb-4 bg-surface border border-line rounded-sm flex gap-3">
                     <Info className="text-ink shrink-0 mt-0.5" size={14} />
                     <div className="text-2xs text-ink leading-relaxed font-semibold uppercase space-y-1">
                       <p><strong>Ticket revenue:</strong> Ticket revenue for this route, at the estimated load factor.</p>
                       <p><strong>Direct flight costs:</strong> Variable costs that scale with each flight: fuel, crew, landing fees and catering.</p>
                     </div>
                   </div>
                   <FinancialReport
                     title="Route Projection (Weekly)"
                     netProfit={financials.estWeeklyProfit}
                     totalRevenue={financials.estWeeklyRev}
                     revenues={(['economy', 'premium', 'business', 'first'] as const)
                       .filter(cls => (financials.paxByClass?.[cls]?.max ?? 0) > 0)
                       .map(cls => {
                         const cd = financials.paxByClass[cls];
                         const price = (route.activeTicketPrices || route.ticketPrices || {})[cls] || 0;
                         // Connecting passengers sit in their own cabin: they count in its load
                         // factor, but earn their own fare on the line below.
                         const lf = cd.max > 0 ? Math.round(((cd.actual + (cd.transfer || 0)) / cd.max) * 100) : 0;
                         return {
                           label: `${cls[0].toUpperCase()}${cls.slice(1)} — ${cd.actual}/${cd.max} pax${cd.transfer ? ` + ${cd.transfer} transfer` : ''} @ $${price} (${lf}% LF)`,
                           amount: cd.actual * price
                         };
                       })
                       .concat(financials.transferPax > 0 ? [{
                         label: `Connecting — ${formatNumber(financials.transferPax)} transfer pax (${(['economy', 'premium', 'business', 'first'] as const)
                           .filter(cls => (financials.paxByClass?.[cls]?.transfer ?? 0) > 0)
                           .map(cls => `${formatNumber(financials.paxByClass[cls].transfer!)} ${cls}`)
                           .join(', ')}; share of fare by distance)`,
                         amount: financials.transferRev
                       }] : [])}
                     expenses={[
                       {
                         id: 'opx',
                         label: 'Direct flight costs',
                         total: financials.estWeeklyCosts,
                         items: [
                           { label: `Fuel (${formatNumber(financials.costsBreakdown.fuelLiters)} L @ $${formatNumber(financials.costsBreakdown.fuelPriceL, 3)}/L)`, amount: financials.costsBreakdown.fuel },
                           { label: 'Crew & Ground Staff', amount: financials.costsBreakdown.crew },
                           { label: 'Catering & Cabin', amount: financials.costsBreakdown.catering },
                           { label: 'Landing & pax fees', amount: financials.costsBreakdown.infra }
                         ]
                       }
                     ]}
                     defaultOpen={true}
                   />
                   <div className="border-t border-line pt-4 mt-4 grid grid-cols-2 gap-2">
                     {(['economy', 'premium', 'business', 'first'] as const)
                       .filter(cls => (financials.paxByClass?.[cls]?.max ?? 0) > 0)
                       .map(cls => {
                         const cd = financials.paxByClass[cls];
                         const lf = cd.max > 0 ? Math.round(((cd.actual + (cd.transfer || 0)) / cd.max) * 100) : 0;
                         const price = (route.activeTicketPrices || route.ticketPrices || {})[cls] || 0;
                         return (
                           <div key={cls} className="flex flex-col items-center bg-surface border border-line rounded-sm p-2">
                             <span className="text-2xs text-muted uppercase tracking-label font-semibold">{cls}</span>
                             <span className={`text-lg font-mono font-semibold ${lf >= 85 ? 'text-good' : lf >= 60 ? 'text-accent' : 'text-bad'}`}>{lf}%</span>
                             <span className="text-2xs text-muted font-mono">{cd.actual}{cd.transfer ? `+${cd.transfer}` : ''}/{cd.max} pax @ ${price}</span>
                           </div>
                         );
                       })}
                   </div>
                 </>
               )}
            </div>
            <div className="p-4 bg-ground/40 border-t border-line text-center uppercase tracking-label text-2xs font-semibold text-muted group-hover:text-accent transition-colors shrink-0">
              Click to adjust pricing
            </div>
          </div>
        </div>
      </div>


      <>
         {showAircraftDetails && assignedAircraft && (
           <AircraftDetailsModal 
             plane={assignedAircraft}
             currentDateOffset={(currentYear - 1960) * 12 + (currentMonth - 1)}
             onClose={() => setShowAircraftDetails(false)}
             onRenovate={() => {}} 
             aircraftRoutes={[route]}
             airlineCode={codePrefix}
           />
         )}
      </>
      {isPickingAircraft && onReassignAircraft && (
        <RouteAircraftPicker
          route={route}
          fleet={fleet || []}
          routes={routes}
          airportManagement={airportManagement || {}}
          airlineCode={airlineCode}
          onClose={() => setIsPickingAircraft(false)}
          onPick={(registration) => {
            setIsPickingAircraft(false);
            onReassignAircraft(route.id, registration);
          }}
        />
      )}
    </div>
  );
}
