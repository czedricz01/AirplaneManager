import React, { useState, useMemo } from 'react';
import { formatMoneyCompact, routeFlightNumber } from '../lib/format';
import { Search, ChevronDown, ChevronUp, Navigation } from 'lucide-react';
import { RouteDetailView } from './RouteDetailView';
import { getFlightTimeClass, type RouteOffer } from '../lib/financeUtils';
import { InfoTooltip, GLOSSARY } from './InfoTooltip';
import { AnimatePresence } from 'motion/react';
import type { OwnedAircraft } from './MyFleetView';
import { ViewHeader } from './ui/ViewHeader';
import { TableScrollContainer, Table, Thead, Th, Td } from './ui/Table';
import { Button } from './ui/Button';

interface SimulatedRoute {
  id: string;
  airline: string;
  origin: string;
  destination: string;
  distance: number;
  aircraft: string;
  airlineCode?: string;
  weeklyFlights: number;
  paxPerWeek: number;
  schedule?: any[];
  durMin?: number;
  ticketPrices?: Record<string, number>;
  activeTicketPrices?: Record<string, number>;
}

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
  onEditFinancials?: (routeId: string) => void;
  onUpdatePricing?: (routeId: string, pricing: Record<string, number>) => void;
  fuelPrice?: number;
  /** Reputation effect on demand, so the list matches the monthly report. */
  demandFactor?: number;
  rivalOffers?: RouteOffer[];
  airportManagement?: Record<string, any>;
  currentYear: number;
  currentMonth: number;
  difficulty: string;
  /** Flight-number prefix for routes saved before they carried their own. */
  airlineCode?: string;
}

function RoutesViewImpl({ 
  routes, fleet, routeProfits, initialAirportFilter = "", onPlanRoute, onDeleteRoute, 
  externalSelectedRoute, onClearExternalSelectedRoute, onChangeAircraftRoute, 
  onEditSchedule, onEditCabinServices, onEditFinancials, onUpdatePricing, fuelPrice, airportManagement,
  currentYear, currentMonth, difficulty, demandFactor = 1, rivalOffers = [], airlineCode = ''
}: Props) {
  const [search, setSearch] = useState("");
  const [airportFilter, setAirportFilter] = useState(initialAirportFilter);
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
  }, [routes, routeProfits, search, sortField, sortDir, airportFilter]);

  const activeRoute = useMemo(() => {
    if (!selectedRoute) return null;
    return routes.find(r => r.id === selectedRoute.id) || selectedRoute;
  }, [selectedRoute, routes]);

  const fleetByRegistration = useMemo(() => new Map(fleet.map(f => [f.registration, f])), [fleet]);

  /** Weekly seat capacity for a route's assigned aircraft, or null with none assigned. */
  const getWeeklySeats = (route: SimulatedRoute): number | null => {
    const ac = fleetByRegistration.get(route.aircraft);
    if (!ac) return null;
    const configSeats = ac.config
      ? ((ac.config.economy || 0) + (ac.config.premium || 0) + (ac.config.business || 0) + (ac.config.first || 0))
      : 0;
    const capacity = configSeats > 0 ? configSeats : ((ac as any).capacity || 0);
    const legs = route.schedule
      ? route.schedule.reduce((acc: number, s: any) => acc + (s.isOneWay ? 1 : 2), 0)
      : route.weeklyFlights * 2;
    return capacity * legs;
  };

  const quickAdjustPrice = (route: SimulatedRoute, pct: number) => {
    if (!onUpdatePricing) return;
    const current = route.ticketPrices || {};
    const next = { ...current };
    (['economy', 'premium', 'business', 'first'] as const).forEach(cls => {
      if (current[cls]) next[cls] = Math.max(1, Math.round(current[cls] * (1 + pct)));
    });
    onUpdatePricing(route.id, next);
  };

  return (
    <div className="w-full h-full text-white/90 px-3 py-3 lg:px-4 lg:py-4 flex flex-col font-sans overflow-hidden relative">
      <ViewHeader
        title={
          <>
            ROUTES
            {onPlanRoute && (
              <Button variant="primary" size="md" onClick={onPlanRoute} className="ml-3">
                Plan New Route +
              </Button>
            )}
          </>
        }
        right={
          <div className="flex gap-4 items-center relative z-20">
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
        }
      />

      <TableScrollContainer>
        <Table>
          <Thead>
            <Th first sortable={false}>Flight No.</Th>
            <Th sortable onClick={() => toggleSort('origin')}>Origin {getSortIcon('origin')}</Th>
            <Th sortable onClick={() => toggleSort('destination')}>Destination {getSortIcon('destination')}</Th>
            <Th sortable onClick={() => toggleSort('distance')}>Distance {getSortIcon('distance')}</Th>
            <Th sortable onClick={() => toggleSort('durMin')}>Flight Time {getSortIcon('durMin')}</Th>
            <Th sortable={false}>Time-Class<InfoTooltip size={11} {...GLOSSARY.timeClass} /></Th>
            <Th sortable onClick={() => toggleSort('aircraft')}>Aircraft {getSortIcon('aircraft')}</Th>
            <Th sortable onClick={() => toggleSort('weeklyFlights')}>Weekly Flights {getSortIcon('weeklyFlights')}</Th>
            <Th sortable onClick={() => toggleSort('paxPerWeek')}>Pax / Week {getSortIcon('paxPerWeek')}</Th>
            <Th sortable={false}>Load %</Th>
            <Th sortable={false}>Quick Price</Th>
            <Th sortable className="pr-4 text-right" onClick={() => toggleSort('profit')}>Profit / Month {getSortIcon('profit')}</Th>
          </Thead>
          <tbody>
            {filteredAndSortedRoutes.length === 0 ? (
              <tr>
                 <td colSpan={12} className="text-center py-16 text-white/40 uppercase tracking-widest">
                   {routes.length === 0 ? (
                     <div className="flex flex-col items-center gap-2">
                       <span>No routes yet</span>
                       <span className="text-2xs normal-case tracking-normal text-white/30 font-mono">
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
                  <Td className="pl-4 font-bold text-white/90 tracking-widest hover:text-aero-yellow transition-colors underline decoration-white/20 underline-offset-4">{routeFlightNumber(route, airlineCode)}</Td>
                  <Td className="font-bold text-aero-yellow">{route.origin}</Td>
                  <Td className="font-bold text-aero-yellow">{route.destination}</Td>
                  <Td className="text-xs font-mono">{route.distance} km</Td>
                  <Td className="text-xs font-mono">{route.durMin ? `${Math.floor(route.durMin / 60)}h ${(route.durMin % 60).toString().padStart(2, '0')}m` : '-'}</Td>
                  <Td className="text-xs font-mono">{route.durMin ? <span className="border border-white/20 px-2 py-0.5 rounded-sm bg-white/5">Class {getFlightTimeClass(route.durMin)}</span> : '-'}</Td>
                  <Td>{route.aircraft}</Td>
                  <Td className="text-xs font-mono">{route.weeklyFlights}</Td>
                  <Td className="text-xs font-mono">{route.paxPerWeek}</Td>
                  <Td className="text-xs font-mono">
                    {(() => {
                      const weeklySeats = getWeeklySeats(route);
                      if (!weeklySeats || weeklySeats <= 0) return <span className="text-white/25">-</span>;
                      const lf = Math.round((route.paxPerWeek / weeklySeats) * 100);
                      return (
                        <span className={lf >= 85 ? 'text-aero-good' : lf >= 60 ? 'text-aero-yellow' : 'text-aero-warn'}>
                          {lf}%
                        </span>
                      );
                    })()}
                  </Td>
                  <Td className="text-xs font-mono" onClick={(e) => e.stopPropagation()}>
                    {onUpdatePricing && route.ticketPrices ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-white/50 font-bold">${route.ticketPrices.economy ?? '-'}</span>
                        <div className="flex gap-1">
                          {[-0.10, -0.05, 0.05, 0.10].map(pct => (
                            <button
                              key={pct}
                              onClick={() => quickAdjustPrice(route, pct)}
                              title={`${pct > 0 ? '+' : ''}${Math.round(pct * 100)}% on all classes`}
                              className="px-1.5 py-0.5 bg-black/40 border border-white/10 hover:border-aero-yellow/50 text-3xs font-bold text-white/60 hover:text-aero-yellow transition-all"
                            >
                              {pct > 0 ? '+' : ''}{Math.round(pct * 100)}%
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span className="text-white/25">-</span>
                    )}
                  </Td>
                  <Td className="pr-4 text-right text-xs font-mono">
                    {routeProfits && routeProfits[route.id] !== undefined ? (
                      <span className={routeProfits[route.id] >= 0 ? 'text-aero-good' : 'text-aero-warn'}>
                        {routeProfits[route.id] >= 0 ? '+' : ''}{formatMoneyCompact(routeProfits[route.id])}
                      </span>
                    ) : (
                      <span className="text-white/25" title="No closed month for this route yet">-</span>
                    )}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </TableScrollContainer>

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
            airlineCode={airlineCode}
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
            onEditFinancials={(id) => {
               if (onEditFinancials) {
                 onEditFinancials(id);
                 setSelectedRoute(null);
                 if (onClearExternalSelectedRoute) onClearExternalSelectedRoute();
               }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Memoised: this view stays mounted while App re-renders for unrelated state
 * (messages, dialogs, settings), and it only needs to redraw when its own
 * props change. App passes stable callbacks for exactly this reason.
 */
export const RoutesView = React.memo(RoutesViewImpl);
