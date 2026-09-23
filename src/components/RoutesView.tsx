import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, Navigation } from 'lucide-react';
import { RouteDetailView } from './RouteDetailView';
import type { RouteOffer } from '../lib/financeUtils';
import { InfoTooltip, GLOSSARY } from './InfoTooltip';
import { AnimatePresence } from 'motion/react';
import { OwnedAircraft } from './MyFleetView';

interface SimulatedRoute {
  id: string;
  airline: string;
  origin: string;
  destination: string;
  distance: number;
  aircraft: string;
  weeklyFlights: number;
  paxPerWeek: number;
  schedule?: any[];
  durMin?: number;
  ticketPrices?: Record<string, number>;
  activeTicketPrices?: Record<string, number>;
}

const mockRoutes: SimulatedRoute[] = [];

/** Compact money for a table cell: $1.2M, $840K, -$45K. */
const formatMoney = (val: number) => {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${Math.round(abs)}`;
};

type SortField = 'origin' | 'destination' | 'distance' | 'aircraft' | 'weeklyFlights' | 'paxPerWeek' | 'durMin' | 'profit';
type SortDir = 'asc' | 'desc';

interface Props {
  routes: SimulatedRoute[];
  fleet: OwnedAircraft[];
  /**
   * Last closed month's profit per route id. Without it the route list showed
   * no money at all, so there was no way to tell a good route from a bad one
   * without opening each one in turn.
   */
  routeProfits?: Record<string, number>;
  initialAirportFilter?: string;
  onPlanRoute?: () => void;
  onDeleteRoute?: (id: string) => void;
  externalSelectedRoute?: SimulatedRoute | null;
  onClearExternalSelectedRoute?: () => void;
  onChangeAircraftRoute?: (route: any) => void;
  onEditSchedule?: (routeId: string) => void;
  onEditCabinServices?: (routeId: string) => void;
  onUpdatePricing?: (routeId: string, pricing: Record<string, number>) => void;
  fuelPrice?: number;
  /** Reputation effect on demand, so the list matches the monthly report. */
  demandFactor?: number;
  rivalOffers?: RouteOffer[];
  airportManagement?: Record<string, any>;
  currentYear: number;
  currentMonth: number;
  difficulty: string;
}

export function getFlightTimeClass(durMin: number): number {
  if (durMin < 60) return 1;
  if (durMin < 120) return 2;
  if (durMin < 180) return 3;
  if (durMin < 240) return 4;
  if (durMin < 360) return 5;
  if (durMin < 540) return 6;
  if (durMin < 720) return 7;
  return 8;
}

export function RoutesView({ 
  routes, fleet, routeProfits, initialAirportFilter = "", onPlanRoute, onDeleteRoute, 
  externalSelectedRoute, onClearExternalSelectedRoute, onChangeAircraftRoute, 
  onEditSchedule, onEditCabinServices, onUpdatePricing, fuelPrice, airportManagement,
  currentYear, currentMonth, difficulty, demandFactor = 1, rivalOffers = []
}: Props) {
  const [search, setSearch] = useState("");
  const [airportFilter, setAirportFilter] = useState(initialAirportFilter);
  const [airlineFilter, setAirlineFilter] = useState("All");
  const [sortField, setSortField] = useState<SortField>('origin');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedRoute, setSelectedRoute] = useState<SimulatedRoute | null>(null);

  React.useEffect(() => {
    if (externalSelectedRoute) {
      setSelectedRoute(externalSelectedRoute);
    }
  }, [externalSelectedRoute]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ChevronUp size={12} className="inline ml-1" /> : <ChevronDown size={12} className="inline ml-1" />;
  };

  const filteredAndSortedRoutes = useMemo(() => {
    let result = routes;
    
    if (airlineFilter !== "All") {
      result = result.filter(r => 
        airlineFilter === "Competitors" ? r.airline !== "My Airline" : r.airline === airlineFilter
      );
    }
    
    if (airportFilter) {
      const lowerAirport = airportFilter.toLowerCase();
      result = result.filter(r => 
        r.origin.toLowerCase() === lowerAirport || 
        r.destination.toLowerCase() === lowerAirport
      );
    }

    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(r => 
        r.origin.toLowerCase().includes(lowerSearch) ||
        r.destination.toLowerCase().includes(lowerSearch) ||
        r.aircraft.toLowerCase().includes(lowerSearch)
      );
    }
    
    // Copy first: with no filter active `result` is still the `routes` prop, so
    // sorting in place mutated App's state array and persisted that order.
    return [...result].sort((a, b) => {
      // Profit is not a field on the route, it comes from the last closed
      // month. Routes without one sort to the bottom rather than as zero.
      let valA: any = sortField === 'profit' ? (routeProfits?.[a.id] ?? -Infinity) : a[sortField];
      let valB: any = sortField === 'profit' ? (routeProfits?.[b.id] ?? -Infinity) : b[sortField];

      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [routes, routeProfits, search, sortField, sortDir, airlineFilter, airportFilter]);

  /** Distinct competitor airline names present in the route list. */
  const rivalNames = useMemo(
    () => [...new Set(routes.map(r => r.airline).filter(a => a && a !== 'My Airline'))].sort(),
    [routes]
  );

  const activeRoute = useMemo(() => {
    if (!selectedRoute) return null;
    return routes.find(r => r.id === selectedRoute.id) || selectedRoute;
  }, [selectedRoute, routes]);

  return (
    <div className="w-full h-full text-white/90 px-3 py-3 lg:px-4 lg:py-4 flex flex-col font-sans overflow-hidden relative">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-mono text-aero-yellow uppercase tracking-[0.3em] font-black drop-shadow-lg">
            ROUTES
          </h2>
          {onPlanRoute && (
            <button 
              onClick={onPlanRoute}
              className="bg-aero-yellow text-black font-black uppercase text-[10px] tracking-widest px-4 py-2 hover:bg-white transition-colors"
            >
              Plan New Route +
            </button>
          )}
        </div>
        
        <div className="flex gap-4 items-center relative z-20">
          <select 
            value={airlineFilter}
            onChange={(e) => setAirlineFilter(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-sm py-2 pl-4 pr-10 text-sm text-white focus:outline-none focus:border-aero-yellow/50 font-mono transition-colors appearance-none cursor-pointer"
          >
            <option value="My Airline">My Airline</option>
            <option value="All">All Airlines</option>
            <option value="Competitors">All Competitors</option>
            {/* Built from the routes actually present. The two hardcoded
                "Competitor A"/"Competitor B" entries matched no generated
                airline, so selecting either emptied the table. */}
            {rivalNames.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <div className="pointer-events-none -ml-8 text-white/50">
            <ChevronDown size={16} />
          </div>

          <div className="relative w-48">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Navigation size={16} className="text-white/40" />
            </div>
            <input
              type="text"
              className="w-full bg-black/40 border border-white/10 rounded-sm py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-aero-yellow/50 font-mono transition-colors uppercase"
              placeholder="Airport Filter (e.g. FRA)"
              value={airportFilter}
              onChange={(e) => setAirportFilter(e.target.value)}
              maxLength={3}
            />
          </div>

          <div className="relative w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={16} className="text-white/40" />
            </div>
            <input
              type="text"
              className="w-full bg-black/40 border border-white/10 rounded-sm py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-aero-yellow/50 font-mono transition-colors"
              placeholder="Search aircraft..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar bg-black/20 border border-white/5 rounded-sm p-4">
        <table className="w-full text-left font-mono text-sm border-collapse">
          <thead>
            <tr className="border-b border-aero-yellow/30 text-aero-yellow/80 uppercase tracking-widest text-[10px]">
              <th className="py-4 pl-4 sticky top-0 bg-[#141414] z-10">Flight No.</th>
              <th className="py-4 sticky top-0 bg-[#141414] z-10 cursor-pointer hover:text-aero-yellow" onClick={() => toggleSort('origin')}>Origin {getSortIcon('origin')}</th>
              <th className="py-4 sticky top-0 bg-[#141414] z-10 cursor-pointer hover:text-aero-yellow" onClick={() => toggleSort('destination')}>Destination {getSortIcon('destination')}</th>
              <th className="py-4 sticky top-0 bg-[#141414] z-10 cursor-pointer hover:text-aero-yellow" onClick={() => toggleSort('distance')}>Distance {getSortIcon('distance')}</th>
              <th className="py-4 sticky top-0 bg-[#141414] z-10 cursor-pointer hover:text-aero-yellow" onClick={() => toggleSort('durMin')}>Flight Time {getSortIcon('durMin')}</th>
              <th className="py-4 sticky top-0 bg-[#141414] z-10">Time-Class<InfoTooltip size={11} {...GLOSSARY.timeClass} /></th>
              <th className="py-4 sticky top-0 bg-[#141414] z-10 cursor-pointer hover:text-aero-yellow" onClick={() => toggleSort('aircraft')}>Aircraft {getSortIcon('aircraft')}</th>
              <th className="py-4 sticky top-0 bg-[#141414] z-10 cursor-pointer hover:text-aero-yellow" onClick={() => toggleSort('weeklyFlights')}>Weekly Flights {getSortIcon('weeklyFlights')}</th>
              <th className="py-4 sticky top-0 bg-[#141414] z-10 cursor-pointer hover:text-aero-yellow" onClick={() => toggleSort('paxPerWeek')}>Pax / Week {getSortIcon('paxPerWeek')}</th>
              <th className="py-4 pr-4 text-right sticky top-0 bg-[#141414] z-10 cursor-pointer hover:text-aero-yellow" onClick={() => toggleSort('profit')}>Profit / Month {getSortIcon('profit')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedRoutes.length === 0 ? (
              <tr>
                 <td colSpan={10} className="text-center py-16 text-white/40 uppercase tracking-widest">
                   {routes.length === 0 ? (
                     <div className="flex flex-col items-center gap-2">
                       <span>No routes yet</span>
                       <span className="text-[11px] normal-case tracking-normal text-white/30 font-mono">
                         Buy an aircraft, then plan your first route from your hub.
                       </span>
                     </div>
                   ) : 'No routes match this filter.'}
                 </td>
               </tr>
            ) : (
              filteredAndSortedRoutes.map((route, idx) => (
                <tr 
                  key={`${route.id}-${idx}`} 
                  onClick={() => setSelectedRoute(route)}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors text-white/70 cursor-pointer"
                >
                  <td className="py-4 pl-4 font-bold text-white/90 tracking-widest hover:text-aero-yellow transition-colors underline decoration-white/20 underline-offset-4">{route.schedule?.[0]?.flightNumOut ? 'NE' + route.schedule[0].flightNumOut : route.airline}</td>
                  <td className="py-4 font-bold text-aero-yellow">{route.origin}</td>
                  <td className="py-4 font-bold text-aero-yellow">{route.destination}</td>
                  <td className="py-4 text-xs font-mono">{route.distance} km</td>
                  <td className="py-4 text-xs font-mono">{route.durMin ? `${Math.floor(route.durMin / 60)}h ${(route.durMin % 60).toString().padStart(2, '0')}m` : '-'}</td>
                  <td className="py-4 text-xs font-mono">{route.durMin ? <span className="border border-white/20 px-2 py-0.5 rounded-sm bg-white/5">Class {getFlightTimeClass(route.durMin)}</span> : '-'}</td>
                  <td className="py-4">{route.aircraft}</td>
                  <td className="py-4 text-xs font-mono">{route.weeklyFlights}</td>
                  <td className="py-4 text-xs font-mono">{route.paxPerWeek}</td>
                  <td className="py-4 pr-4 text-right text-xs font-mono">
                    {routeProfits && routeProfits[route.id] !== undefined ? (
                      <span className={routeProfits[route.id] >= 0 ? 'text-aero-good' : 'text-aero-warn'}>
                        {routeProfits[route.id] >= 0 ? '+' : ''}{formatMoney(routeProfits[route.id])}
                      </span>
                    ) : (
                      <span className="text-white/25" title="No closed month for this route yet">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {activeRoute && (
          <RouteDetailView 
             routes={routes}
             route={activeRoute} 
             fleet={fleet}
            fuelPrice={fuelPrice}
            demandFactor={demandFactor}
            rivalOffers={rivalOffers}
            airportManagement={airportManagement}
            currentYear={currentYear}
            currentMonth={currentMonth}
            difficulty={difficulty}
            onClose={() => {
               setSelectedRoute(null);
               if (onClearExternalSelectedRoute) onClearExternalSelectedRoute();
            }} 
            onDelete={(id) => {
              if (onDeleteRoute) onDeleteRoute(id);
              setSelectedRoute(null);
              if (onClearExternalSelectedRoute) onClearExternalSelectedRoute();
            }} 
            onChangeAircraft={() => {
              if (onChangeAircraftRoute) {
                onChangeAircraftRoute(activeRoute);
                setSelectedRoute(null);
                if (onClearExternalSelectedRoute) onClearExternalSelectedRoute();
              }
            }}
            onEditSchedule={(id) => {
               if (onEditSchedule) {
                 onEditSchedule(id);
                 setSelectedRoute(null);
                 if (onClearExternalSelectedRoute) onClearExternalSelectedRoute();
               }
            }}
            onEditCabinServices={(id) => {
               if (onEditCabinServices) {
                 onEditCabinServices(id);
                 setSelectedRoute(null);
                 if (onClearExternalSelectedRoute) onClearExternalSelectedRoute();
               }
            }}
            onUpdatePricing={onUpdatePricing}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
