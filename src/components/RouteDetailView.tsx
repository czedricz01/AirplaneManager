import { FinancialReport } from "./FinancialReport";
import { formatCurrency, formatNumber, routeFlightNumber } from '../lib/format';
import React, { useState, useMemo } from 'react';
import { X, Clock, Coffee, DollarSign, Trash2, Settings, Info, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Airport } from '../data/airports';

import { MEAL_DATA, EXTRAS_OPTIONS, SERVICE_OPTIONS } from '../data/catering';
import {
  getFlightTimeClass,
  calculateRouteFinancials,
  seatWeightedSatisfaction,
  RouteOffer,
  marketKey,
} from '../lib/financeUtils';
import { NEUTRAL_PLAYER_MODIFIERS, type PlayerModifiers, type RouteCancellation } from '../lib/gameState';
import type { RouteTransfer } from '../lib/transferUtils';

import { airports, airportsMapAdjusted } from '../data/airportRegistry';

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
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="absolute inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col font-sans p-4 overflow-y-auto custom-scrollbar"
    >
      {/* Upright phones: smaller title, buttons below it. */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4 shrink-0">
        <h2 className="text-2xl md:text-4xl short:text-2xl font-mono text-aero-yellow uppercase tracking-[0.3em] font-black drop-shadow-lg flex flex-wrap items-center gap-x-4">
          Route Detail
          <span className="text-white/30 text-2xl">|</span>
          <span className="text-white">{flightNo}</span>
        </h2>
        <div className="flex items-center gap-4">
          {confirmDelete && (
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-4 py-2 border border-white/20 text-white/60 hover:text-white hover:bg-white/10 transition-colors uppercase text-xs tracking-widest font-bold"
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
            className={`flex items-center justify-center gap-2 px-4 py-2 outline outline-1 transition-colors uppercase text-xs tracking-widest font-bold ${
              confirmDelete ? 'bg-aero-warn text-black outline-aero-warn' : 'bg-aero-panel hover:bg-aero-carbon outline-red-500/50 text-white'
            }`}
          >
            <Trash2 size={16} /> {confirmDelete ? 'Confirm: Delete Route' : 'Delete Route'}
          </button>
          <button
            onClick={onClose}
            className="w-12 h-12 bg-black border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors text-white"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      <div className="flex flex-col flex-1 shrink-0 gap-3">
        {cancellation && cancellation.share > 0 && (
          <div className="flex items-center gap-3 border border-aero-warn/40 bg-aero-warn/10 px-4 py-2 rounded-sm font-mono text-xs">
            <AlertTriangle size={16} className="text-aero-warn shrink-0" />
            <span>
              <span className="text-aero-warn font-black uppercase tracking-widest">
                {Math.round(cancellation.share * 100)}% of flights cancelled this month:
              </span>{' '}
              <span className="text-white/70">{cancellation.reasons.join(', ')}</span>
              <span className="text-white/40"> · the figures below already leave them out</span>
            </span>
          </div>
        )}
        {/* Top Third: Hub - Aircraft - Destination */}
        {/* Origin, route and destination side by side; stacked on upright phones,
            where each block takes its own height (flex-none), or the middle one
            gets clipped. */}
        <div className="min-h-[280px] shrink-0 md:shrink flex flex-col md:flex-row border border-white/10 bg-black/40 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-aero-yellow/5 to-transparent pointer-events-none"></div>
          <div className="flex-none md:flex-1 flex flex-col items-center justify-center py-4 md:py-0 border-b md:border-b-0 md:border-r border-white/10 relative z-10">
            <span className="text-white/30 text-2xs uppercase tracking-widest font-bold mb-4">Origin Hub</span>
            <span className="text-6xl font-black text-aero-yellow tracking-tighter drop-shadow-lg">{route.origin}</span>
            <span className="text-white/50 text-xs mt-2 uppercase tracking-widest font-bold">{airportsMap.get(route.origin)?.name || "Unknown Airport"}</span>
          </div>

          <div className="flex-none md:flex-1 flex flex-col justify-center px-4 md:px-12 py-4 md:py-0 relative overflow-hidden group border-b md:border-b-0 md:border-r border-white/10 z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex flex-col">
                <span className="text-white/30 text-2xs uppercase tracking-widest font-bold block mb-1">Assigned Aircraft</span>
                <span className="text-white/80 font-mono text-xl">{route.aircraft}</span>
              </div>
              <div className="text-right">
                <span className="text-white/30 text-2xs uppercase tracking-widest font-bold block mb-1">Route Distance</span>
                <span className="text-white font-mono text-xl">{Math.round(route.distance || 0)} <span className="text-xs text-white/40">KM</span></span>
              </div>
            </div>

            {competitors.length > 0 && (
              <div className="bg-aero-warn/5 p-3 border border-aero-warn/30 rounded-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-aero-warn text-3xs uppercase tracking-widest font-black">
                    Competing on this route
                  </span>
                  <span className="text-3xs font-mono text-white/40">
                    passengers are shared
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                  {competitors.map((c, i) => (
                    <span key={i} className="text-2xs font-mono text-white/70">
                      {c.name} <span className="text-white/40">{c.departures}x / week</span>
                    </span>
                  ))}
                  <span className="text-2xs font-mono text-white/40">
                    you {route.schedule?.length || 0}x / week
                  </span>
                </div>
                <p className="text-3xs font-mono text-white/35 mt-2 leading-relaxed">
                  Your share of this market grows with frequency, a lower fare and higher
                  satisfaction. Fare matters most.
                </p>
              </div>
            )}

            <div className="flex gap-4 items-center bg-white/5 p-4 border border-white/10 rounded-sm">
              <div className="flex flex-col">
                <span className="text-white/30 text-3xs uppercase tracking-widest font-bold mb-1">Weekly Pax</span>
                <span className="text-2xl font-black text-aero-yellow">{formatNumber(financials?.paxPerWeek ?? route.paxPerWeek ?? 0)}</span>
                {(financials?.transferPax ?? 0) > 0 && (
                  <span className="text-3xs font-mono text-white/50 mt-1">
                    incl. {formatNumber(financials!.transferPax)} transfer pax/wk ({formatCurrency(financials!.transferRev)})
                  </span>
                )}
                {(financials?.transferPax ?? 0) > 0 && transfer && transfer.flows.length > 0 && (
                  <span className="text-3xs font-mono text-white/35 mt-0.5">
                    {transfer.flows.slice(0, 3).map(f => `${f.o}→${f.hub}→${f.d} ${formatNumber(f.pax)}`).join(' · ')}
                  </span>
                )}
              </div>
              <div className="ml-auto">
                {assignedAircraft && (
                  <div className="flex flex-col text-2xs uppercase tracking-widest text-right">
                    <span className="text-white/50">{assignedAircraft.manufacturer} {assignedAircraft.type}</span>
                    <span className="text-white/30">{assignedAircraft.class} • Cap: {actualCapacity}</span>
                    <div className="flex items-center justify-end gap-2 mt-1">
                        <button onClick={() => setShowAircraftDetails(true)} className="text-3xs px-1.5 py-0.5 bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/10 font-bold">Details</button>
                        <button 
                          onClick={() => setIsPickingAircraft(true)}
                          disabled={!onReassignAircraft}
                          className="text-3xs px-1.5 py-0.5 bg-white/10 hover:bg-aero-yellow hover:text-black text-white font-bold transition-all border border-white/10"
                        >
                          Change
                        </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              {route.durMin && (
                <div className="flex items-center gap-3">
                  <span className="text-aero-yellow font-mono border border-aero-yellow/30 px-2 py-0.5 bg-aero-yellow/10 rounded-sm text-2xs">TIME-CLASS: {getFlightTimeClass(route.durMin)}</span>
                  <span className="text-white/40 text-2xs font-mono uppercase">
                      Flight Time: {Math.floor(route.durMin / 60)}h {(route.durMin % 60).toString().padStart(2, '0')}m
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-none md:flex-1 flex flex-col items-center justify-center py-4 md:py-0 relative z-10">
            <span className="text-white/30 text-2xs uppercase tracking-widest font-bold mb-4">Destination</span>
            <span className="text-6xl font-black text-aero-yellow tracking-tighter drop-shadow-lg">{route.destination}</span>
            <span className="text-white/50 text-xs mt-2 uppercase tracking-widest font-bold">{airportsMap.get(route.destination)?.name || "Unknown Airport"}</span>
          </div>
        </div>

        {/* Bottom Two Thirds: 3 Boxes */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {/* Timetable Box */}
          <div onClick={() => onEditSchedule && onEditSchedule(route.id)} className="border border-white/10 bg-black/40 flex flex-col hover:border-aero-yellow/50 hover:bg-aero-yellow/5 transition-colors cursor-pointer group relative overflow-hidden min-h-[400px] h-full">
            <div className="p-4 pb-4 border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <Clock className="text-aero-yellow" size={20} />
                <h3 className="text-lg font-bold text-white uppercase tracking-widest group-hover:text-aero-yellow transition-colors">Flightplan</h3>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-3xs text-white/30 uppercase tracking-widest font-black leading-none mb-1">Weekly Ops</span>
                <span className="text-lg font-black text-white leading-none">{route.weeklyFlights}</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
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
                    const daysStr = sortedDays.map((d: number) => dayNamesShort[d - 1]).join(", ");
                    
                    return (
                      <div key={`${s.flightNumOut}-${s.days[0]}`} className="bg-white/5 border border-white/10 p-3 rounded-sm group-hover:border-aero-yellow/30 transition-all">
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col">
                            <div className="flex gap-2 items-center mb-1">
                               <span className="text-aero-yellow font-black text-sm italic tracking-tighter">{codePrefix}{s.flightNumOut}</span>
                               {!s.isOneWay && (
                                 <span className="text-white/40 font-mono text-2xs">/ {codePrefix}{s.flightNumIn}</span>
                               )}
                            </div>
                            <div className="flex gap-1 flex-wrap">
                               {sortedDays.map(d => (
                                 <span key={d} className="text-3xs bg-white/10 px-1 border border-white/10 font-bold">{dayNamesShort[d-1]}</span>
                               ))}
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                             <div className="flex items-center gap-2 justify-end">
                                <span className="text-3xs uppercase font-bold text-white/30 tracking-widest">OUT:</span>
                                <span className="text-white font-mono text-2xs font-bold">{dep1} - {arr1}</span>
                             </div>
                             {!s.isOneWay && (
                               <div className="flex items-center gap-2 justify-end">
                                  <span className="text-3xs uppercase font-bold text-white/30 tracking-widest">IN:</span>
                                  <span className="text-white/60 font-mono text-2xs font-bold">{dep2} - {arr2}</span>
                               </div>
                             )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()
              ) : (
                <div className="h-full flex items-center justify-center text-white/20 text-2xs uppercase font-bold italic">
                  No flights scheduled
                </div>
              )}
            </div>

            <div className="p-4 bg-black/40 border-t border-white/10 text-center uppercase tracking-widest text-3xs font-black text-white/40 group-hover:text-aero-yellow transition-colors shrink-0">
              Click to edit schedule
            </div>
          </div>

          {/* Cabin Services Box */}
          <div onClick={() => onEditCabinServices?.(route.id)} className="border border-white/10 bg-black/40 flex flex-col hover:border-aero-yellow/50 hover:bg-aero-yellow/5 transition-colors cursor-pointer group p-4 relative overflow-hidden">
             <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <Coffee className="text-aero-yellow" size={24} />
                <h3 className="text-lg font-bold text-white uppercase tracking-widest group-hover:text-aero-yellow transition-colors">Cabin Services</h3>
              </div>
              <Settings size={16} className="text-white/20 group-hover:text-aero-yellow transition-colors" />
            </div>
            <div className="flex-1 flex flex-col">
               <div className="grid grid-cols-2 gap-4 mb-4 overflow-y-auto custom-scrollbar pr-2 max-h-[300px]">
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
                        <div className="col-span-2 flex flex-col items-center justify-center py-2 bg-white/5 border border-white/10 rounded-sm mb-2">
                           <span className="text-3xs text-white/30 uppercase font-black tracking-widest mb-1">Route Satisfaction</span>
                           <span className="text-3xl font-black text-aero-yellow italic tracking-tighter">{avgSat.toFixed(0)}%</span>
                        </div>
                        {classSats.map(cs => {
                          // Live, like the percentage beside it; the copy stored on the route went stale.
                          const satDetails = financials?.satisfactionDetails?.[cs.name];
                          const expectation = satDetails?.expectationTarget || 0;
                          const reality = satDetails?.providedQuality || 0;
                          
                          // The worst band is the most visible, not the darkest.
                          let barColor = 'bg-aero-warn shadow-2xl';
                          let textColor = 'text-aero-warn';
                          if (cs.sat >= 100) { barColor = 'bg-aero-yellow shadow-2xl'; textColor = 'text-aero-yellow'; }
                          else if (cs.sat >= 85) { barColor = 'bg-lime-400 shadow-2xl'; textColor = 'text-lime-400'; }
                          else if (cs.sat >= 60) { barColor = 'bg-yellow-500 shadow-2xl'; textColor = 'text-yellow-400'; }
                          else if (cs.sat >= 40) { barColor = 'bg-orange-500 shadow-2xl'; textColor = 'text-orange-400'; }

                          return (
                          <div key={cs.name} className="col-span-2 flex flex-col p-3 bg-black/40 border border-white/5 rounded-sm relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-1 opacity-10">
                               <Coffee size={40} />
                             </div>
                             <div className="flex justify-between items-end mb-2 relative z-10">
                               <span className="text-2xs text-white/60 uppercase font-bold tracking-widest">{cs.name}</span>
                               <span className={`text-sm font-black ${textColor} drop-shadow-md`}>{cs.sat.toFixed(0)}%</span>
                             </div>
                             
                             <div className="w-full bg-black/60 h-2 rounded-full overflow-hidden mb-2 relative z-10 border border-white/5">
                                <div className={`h-full ${barColor} transition-all duration-1000 ease-out`} style={{ width: `${Math.min(100, cs.sat)}%` }}></div>
                             </div>

                             <div className="flex justify-between text-3xs text-white/40 uppercase tracking-widest relative z-10 mt-1">
                                <span className="flex flex-col">
                                   <span className="text-white/30 text-3xs">Expectation</span>
                                   <span className="font-mono text-white/80">{expectation}</span>
                                </span>
                                <span className="flex flex-col text-right">
                                   <span className="text-white/30 text-3xs">Reality</span>
                                   <span className="font-mono text-white/80">{reality}</span>
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
                  <span className="text-white/30 text-3xs uppercase tracking-widest font-bold">Configured Cabin Services</span>
               </div>
            </div>
          </div>

          
          {/* Finances Box */}
          <div onClick={() => onEditFinancials?.(route.id)} className="border border-white/10 bg-black/40 flex flex-col hover:border-aero-yellow/50 hover:bg-aero-yellow/5 transition-colors cursor-pointer group relative overflow-hidden">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10 p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="text-aero-yellow" size={20} />
                <h3 className="text-sm font-bold text-white uppercase tracking-widest group-hover:text-aero-yellow transition-colors">Financials</h3>
              </div>
              <Settings size={16} className="text-white/20 group-hover:text-aero-yellow transition-colors" />
            </div>
            <div className="flex-1 flex flex-col p-4 pt-0">
               {financials && (
                 <>
                   <div className="p-3 mb-4 bg-white/5 border border-white/10 rounded-sm flex gap-3">
                     <Info className="text-white/80 shrink-0 mt-0.5" size={14} />
                     <div className="text-3xs text-white/80/80 leading-relaxed font-bold uppercase tracking-tight space-y-1">
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
                         const lf = cd.max > 0 ? Math.round((cd.actual / cd.max) * 100) : 0;
                         return {
                           label: `${cls[0].toUpperCase()}${cls.slice(1)} — ${cd.actual}/${cd.max} pax @ $${price} (${lf}% LF)`,
                           amount: cd.actual * price
                         };
                       })
                       .concat(financials.transferPax > 0 ? [{
                         label: `Connecting — ${formatNumber(financials.transferPax)} transfer pax (share of fare by distance)`,
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
                   <div className="border-t border-white/5 pt-4 mt-4 grid grid-cols-2 gap-2">
                     {(['economy', 'premium', 'business', 'first'] as const)
                       .filter(cls => (financials.paxByClass?.[cls]?.max ?? 0) > 0)
                       .map(cls => {
                         const cd = financials.paxByClass[cls];
                         const lf = cd.max > 0 ? Math.round((cd.actual / cd.max) * 100) : 0;
                         const price = (route.activeTicketPrices || route.ticketPrices || {})[cls] || 0;
                         return (
                           <div key={cls} className="flex flex-col items-center bg-white/5 border border-white/10 rounded-sm p-2">
                             <span className="text-3xs text-white/30 uppercase tracking-widest font-black">{cls}</span>
                             <span className={`text-lg font-mono font-bold ${lf >= 85 ? 'text-aero-good' : lf >= 60 ? 'text-aero-yellow' : 'text-aero-warn'}`}>{lf}%</span>
                             <span className="text-3xs text-white/30 font-mono">{cd.actual}/{cd.max} pax @ ${price}</span>
                           </div>
                         );
                       })}
                   </div>
                 </>
               )}
            </div>
            <div className="p-4 bg-black/40 border-t border-white/10 text-center uppercase tracking-widest text-3xs font-black text-white/40 group-hover:text-aero-yellow transition-colors shrink-0">
              Click to adjust pricing
            </div>
          </div>
        </div>
      </div>


      <AnimatePresence>
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
      </AnimatePresence>
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
    </motion.div>
  );
}
