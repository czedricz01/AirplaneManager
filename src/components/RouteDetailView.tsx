import { clickOnKey } from '../lib/a11y';
import { FinancialReport } from "./FinancialReport";
import { Details } from './ui/Details';
import { formatCurrency, formatNumber, routeFlightNumber } from '../lib/format';
import { useState, useMemo } from 'react';
import { X, Clock, Coffee, DollarSign, Trash2, Settings, Info, AlertTriangle } from 'lucide-react';
import { Airport } from '../data/airports';

import { RouteOffer, marketKey } from '../lib/financeUtils';
import type { RouteCancellation } from '../lib/gameState';
import { routeForecast, type PlannerModel, type RouteMonth } from '../lib/modelRoute';
import type { TransferFlowView } from '../lib/modelNetwork';
import { PLAYER_ID } from '../lib/modelMonth';
import { CABIN_CLASSES, RAMP_MONTHS, SCALES } from '../model/constants';
import { routeSatisfactionDetail, type RouteSatisfactionDetail } from '../model/monthClose';
import { logWarn } from '../lib/debugLog';
import { loadColor } from './RoutesView';

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
  /** This month's figures from the model (docs/neubau 4.5c), the month close's own calculation. */
  month?: RouteMonth;
  /** Connecting passengers on this route by city pair this month (docs/neubau 4.7b), largest first. */
  transferFlows?: readonly TransferFlowView[];
  /** The game as the model sees it, for the satisfaction parts and the planner's forecast. */
  model: PlannerModel | null;
  rivalOffers?: RouteOffer[];
  /** Flights this route loses this month and why; the model's figures already leave them out. */
  cancellation?: RouteCancellation;
  airportManagement?: Record<string, any>;
  currentYear: number;
  currentMonth: number;
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
  route, routes, fleet, month, transferFlows, model, airportManagement,
  currentYear, currentMonth, rivalOffers = NO_RIVAL_OFFERS, cancellation,
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

  /** Satisfaction of every class with its parts (service delivered and expected), from the same inputs as the close. */
  const satisfaction = useMemo<RouteSatisfactionDetail | null>(() => {
    if (!model) return null;
    try {
      return routeSatisfactionDetail(model.state, PLAYER_ID, route.id);
    } catch (error) {
      logWarn('route', `No satisfaction for route ${route.id}`, error);
      return null;
    }
  }, [model, route.id]);

  /** The planner's main figure: weekly result after the ramp-up at the fares set, which apply from next month (4.12). */
  const plannerWeekly = useMemo<number | null>(() => {
    if (!model) return null;
    try {
      return routeForecast(model.state, { route, isNew: false, startMonth: model.startMonth })?.weeklyProfit ?? null;
    } catch (error) {
      logWarn('route', `No forecast for route ${route.id}`, error);
      return null;
    }
  }, [model, route]);

  const figures = month?.figures;
  const seatClasses = CABIN_CLASSES.filter(c => month?.classes[c]);
  const label = (c: string) => `${c[0].toUpperCase()}${c.slice(1)}`;
  const rampNote = month
    ? month.ageMonths < RAMP_MONTHS
      ? `Ramp-up: month ${month.ageMonths + 1} of ${RAMP_MONTHS}`
      : month.establishedBonus > 1
        ? `Established route bonus +${formatNumber((month.establishedBonus - 1) * 100, 1)}%`
        : null
    : null;

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
                <span className="text-2xl font-semibold text-accent">{month ? formatNumber(Math.round(month.passengers)) : '–'}</span>
                {rampNote && (
                  <span className="text-2xs font-mono text-accent mt-1">{rampNote}</span>
                )}
                {month && month.transferPassengers > 0 && (
                  <span className="text-2xs text-muted mt-1">
                    incl. {formatNumber(Math.round(month.transferPassengers))} transfer pax/wk ({formatCurrency(month.transferRevenue)})
                  </span>
                )}
                {month && month.transferPassengers > 0 && transferFlows && transferFlows.length > 0 && (
                  <div className="flex flex-col gap-0.5 text-2xs text-muted mt-1">
                    {transferFlows.slice(0, 5).map(f => (
                      <span key={`${f.o}>${f.hub}>${f.d}`} className="flex justify-between gap-3">
                        <span>{f.o} ↔ {f.hub} ↔ {f.d}</span>
                        <span className="text-ink">{formatNumber(Math.round(f.pax))}/wk</span>
                      </span>
                    ))}
                  </div>
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
                  {month && <span className="text-accent border border-accent/30 px-2 py-0.5 bg-accent/10 rounded-sm text-2xs">FLIGHT-TIME INDEX: {formatNumber(month.flightTimeIndex, 1)}</span>}
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
                  {/* Satisfaction from the model (docs/neubau 4.5c): 0 to 160 points, 100 = as passengers expect. */}
                  <div className="col-span-2 flex flex-col items-center justify-center py-2 bg-surface border border-line rounded-sm mb-2">
                     <span className="text-2xs text-muted uppercase font-semibold tracking-label mb-1">Route Satisfaction</span>
                     <span className="text-3xl font-semibold text-accent">{month ? formatNumber(month.satisfaction) : '–'}</span>
                  </div>
                  {seatClasses.map(cls => {
                    const sat = month!.classes[cls]!.satisfaction;
                    const detail = satisfaction?.classes[cls];
                    // Full class names, so the style build finds them.
                    const tone = sat >= SCALES.satisfaction.neutral ? { text: 'text-good', bar: 'bg-good' }
                      : sat >= 85 ? { text: 'text-accent', bar: 'bg-accent' }
                      : { text: 'text-bad', bar: 'bg-bad' };
                    return (
                    <div key={cls} className="col-span-2 flex flex-col p-3 bg-ground/40 border border-line rounded-sm relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-1 opacity-10">
                         <Coffee size={40} />
                       </div>
                       <div className="flex justify-between items-end mb-2 relative z-10">
                         <span className="text-2xs text-muted uppercase font-semibold tracking-label">{cls}</span>
                         <span className={`text-sm font-semibold ${tone.text}`}>{formatNumber(sat)}</span>
                       </div>

                       <div className="w-full bg-ground/60 h-2 rounded-full overflow-hidden mb-2 relative z-10 border border-line">
                          <div className={`h-full ${tone.bar} transition-all duration-1000 ease-out`} style={{ width: `${Math.min(100, (sat / SCALES.satisfaction.max) * 100)}%` }}></div>
                       </div>

                       <div className="flex justify-between text-2xs text-muted uppercase tracking-label relative z-10 mt-1">
                          <span className="flex flex-col">
                             <span className="text-muted text-2xs">Service expected</span>
                             <span className="font-mono text-ink">{detail ? `${formatNumber(detail.breakdown.expectedServicePoints, 1)} pts` : '–'}</span>
                          </span>
                          <span className="flex flex-col text-right">
                             <span className="text-muted text-2xs">Service delivered</span>
                             <span className="font-mono text-ink">{detail ? `${formatNumber(detail.service.total, 1)} pts` : '–'}</span>
                          </span>
                       </div>
                    </div>
                    );
                  })}
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
               {month && figures && (
                 <>
                   <div className="p-3 mb-4 bg-surface border border-line rounded-sm">
                     <Details summary={<span className="inline-flex items-center gap-2"><Info size={14} className="shrink-0" />What these figures mean</span>}>
                     <div className="text-2xs text-muted leading-relaxed space-y-1">
                       <p><strong className="text-ink">This month:</strong> the month close's own calculation, at this month's fares and without cancelled flights.</p>
                       <p><strong className="text-ink">Passenger costs:</strong> grow with each passenger: catering, check-in and handling fees, frequent flyer.</p>
                       <p><strong className="text-ink">Fixed costs:</strong> paid however many fly: fuel, crew, landing, slots and the aircraft's share.</p>
                     </div>
                     </Details>
                   </div>
                   <FinancialReport
                     title="This Month (Weekly)"
                     netProfit={figures.result}
                     totalRevenue={figures.revenue}
                     revenues={seatClasses
                       .map(cls => {
                         const cd = month.classes[cls]!;
                         const transfer = Math.round(cd.transferPassengers);
                         return {
                           label: `${label(cls)} — ${formatNumber(Math.round(cd.passengers))}/${formatNumber(Math.round(cd.seatsPerWeek))} pax${transfer ? ` + ${formatNumber(transfer)} transfer` : ''} @ ${formatCurrency(cd.fare)} (${Math.round(cd.loadFactor * 100)}% LF)`,
                           amount: cd.directRevenue
                         };
                       })
                       .concat(month.transferPassengers > 0 ? [{
                         label: `Connecting — ${formatNumber(Math.round(month.transferPassengers))} transfer pax (share of fare by distance)`,
                         amount: month.transferRevenue
                       }] : [])}
                     expenses={[
                       {
                         id: 'pax',
                         label: 'Passenger costs',
                         total: figures.passengerCost.total,
                         items: [
                           { label: 'Catering', amount: figures.passengerCost.catering },
                           { label: 'Check-in & handling fees', amount: figures.passengerCost.fees },
                           { label: 'Frequent flyer', amount: figures.passengerCost.ffp }
                         ]
                       },
                       {
                         id: 'fixed',
                         label: 'Fixed costs',
                         total: figures.fixed.total,
                         items: [
                           { label: 'Fuel', amount: figures.fixed.fuel },
                           { label: 'Crew', amount: figures.fixed.crew },
                           { label: 'Landing fees', amount: figures.fixed.landing },
                           { label: 'Slots', amount: figures.fixed.slotShare },
                           { label: 'Aircraft', amount: figures.fixed.aircraftShare }
                         ]
                       }
                     ]}
                     defaultOpen={true}
                   />
                   {plannerWeekly !== null && (
                     <div className="mt-3 flex justify-between gap-2 text-2xs uppercase tracking-label font-semibold" title="The route planner's main figure: expected weekly profit after the ramp-up, at the fares you set">
                       <span className="text-muted">From next month, after ramp-up</span>
                       <span className={`font-mono ${plannerWeekly >= 0 ? 'text-good' : 'text-bad'}`}>{plannerWeekly >= 0 ? '+' : '-'}{formatCurrency(Math.abs(plannerWeekly))} / wk</span>
                     </div>
                   )}
                   <div className="border-t border-line pt-4 mt-4 grid grid-cols-2 gap-2">
                     {seatClasses.map(cls => {
                         const cd = month.classes[cls]!;
                         const transfer = Math.round(cd.transferPassengers);
                         return (
                           <div key={cls} className="flex flex-col items-center bg-surface border border-line rounded-sm p-2">
                             <span className="text-2xs text-muted uppercase tracking-label font-semibold">{cls}</span>
                             <span className={`text-lg font-mono font-semibold ${loadColor(cd.loadFactor)}`}>{Math.round(cd.loadFactor * 100)}%</span>
                             <span className="text-2xs text-muted font-mono">{formatNumber(Math.round(cd.passengers))}{transfer ? `+${formatNumber(transfer)}` : ''}/{formatNumber(Math.round(cd.seatsPerWeek))} pax @ {formatCurrency(cd.fare)}</span>
                           </div>
                         );
                       })}
                   </div>
                 </>
               )}
               {!month && (
                 <div className="text-2xs text-muted uppercase tracking-label font-semibold py-6 text-center">No forecast for this route</div>
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
