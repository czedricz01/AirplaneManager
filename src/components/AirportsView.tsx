import React, { useState, useMemo } from 'react';
import { Airport, getAirportStats } from '../data/airports';
// One shared list. This module used to build its own, letting moreAirports
// overwrite core entries, so the eight duplicate ids showed a different level
// and demand here than in the planner -- and it skipped the era adjustment
// entirely, so the demand column disagreed with what routes actually earned.
import { airports } from '../data/airportRegistry';

import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import { ViewHeader } from './ui/ViewHeader';
import { TableScrollContainer, Table, Thead, Th, Td } from './ui/Table';

type SortField = 'id' | 'name' | 'business' | 'tourism' | 'level' | 'maxIcaoCode';
type SortDir = 'asc' | 'desc';

interface Props {
  currentYear: number;
  onSelectAirport?: (airport: Airport) => void;
  airportManagement: Record<string, import('../App').AirportInfrastructure>;
  aiAirlines?: any[];
}

export function AirportsView({ currentYear, onSelectAirport, airportManagement, aiAirlines }: Props) {
  const [search, setSearch] = useState("");
  const [icaoFilter, setIcaoFilter] = useState<string>("All");
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

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

  /**
   * Weekly AI departures per airport, built once.
   *
   * This used to be a reduce over every AI airline and every one of its routes,
   * inside the render of each of the 562 rows -- roughly 85,000 iterations per
   * render with six rivals, repeated on every parent state change.
   */
  /**
   * Row windowing.
   *
   * The table drew all 562 airports at once -- about 4,500 DOM nodes -- and did
   * it again on every parent state change. Only the rows near the viewport are
   * rendered now; spacer rows above and below keep the scrollbar honest. Row
   * height is fixed by the cell padding, so a constant is enough and no
   * measurement pass is needed.
   */
  const ROW_HEIGHT = 53;
  const OVERSCAN = 8;
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(800);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setViewportHeight(el.clientHeight || 800);
    measure();
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
    };
  }, []);

  const aiSlotsByAirport = useMemo(() => {
    const m = new Map<string, number>();
    for (const ai of aiAirlines || []) {
      for (const r of ai.routes || []) {
        const dep = r.departures || 0;
        if (!dep) continue;
        m.set(r.origin, (m.get(r.origin) || 0) + dep);
        // The old per-row scan matched a route once even if both ends were the
        // same airport, so keep that behaviour rather than double-counting.
        if (r.destination !== r.origin) {
          m.set(r.destination, (m.get(r.destination) || 0) + dep);
        }
      }
    }
    return m;
  }, [aiAirlines]);

  const filteredAndSortedAirports = useMemo(() => {
    let result = airports;
    
    if (icaoFilter !== "All") {
      result = result.filter(a => a.maxIcaoCode === icaoFilter);
    }
    
    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(a => 
        a.id.toLowerCase().includes(lowerSearch) || 
        a.name.toLowerCase().includes(lowerSearch)
      );
    }
    
    // Copy first: with no filter active `result` is the module-level airports
    // array, and sorting it in place destroyed the default order for the whole
    // session — including for every other view that reads it.
    return [...result].sort((a, b) => {
      let valA: any = a[sortField as keyof Airport];
      let valB: any = b[sortField as keyof Airport];

      if (sortField === 'business') {
         valA = getAirportStats(a, currentYear).business;
         valB = getAirportStats(b, currentYear).business;
      } else if (sortField === 'tourism') {
         valA = getAirportStats(a, currentYear).tourism;
         valB = getAirportStats(b, currentYear).tourism;
      }

      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [search, sortField, sortDir, currentYear]);

  const totalRows = filteredAndSortedAirports.length;
  const firstVisible = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const lastVisible = Math.min(
    totalRows,
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN
  );
  const visibleRows = filteredAndSortedAirports.slice(firstVisible, lastVisible);
  const padTop = firstVisible * ROW_HEIGHT;
  const padBottom = Math.max(0, (totalRows - lastVisible) * ROW_HEIGHT);

  return (
    <div className="w-full h-full text-white/90 px-3 py-3 lg:px-4 lg:py-4 flex flex-col font-sans overflow-hidden relative">
      <ViewHeader
        title="AIRPORTS"
        right={
          <div className="flex gap-4 items-center">
            <div className="relative w-40">
              <select
                value={icaoFilter}
                onChange={(e) => setIcaoFilter(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-sm py-2 pl-4 pr-8 text-sm text-white focus:outline-none focus:border-aero-yellow/50 font-mono transition-colors appearance-none cursor-pointer"
              >
                <option value="All">All ICAO</option>
                {['A', 'B', 'C', 'D', 'E', 'F'].map(cls => (
                  <option key={cls} value={cls}>Class {cls}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/40">
                <ChevronDown size={14} />
              </div>
            </div>
            <div className="relative w-72">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-white/40" />
              </div>
              <input
                type="text"
                className="w-full bg-black/40 border border-white/10 rounded-sm py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-aero-yellow/50 font-mono transition-colors"
                placeholder="Search IATA or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        }
      />

      <TableScrollContainer ref={scrollRef}>
        <Table>
          <Thead>
            <Th first sortable onClick={() => toggleSort('id')}>IATA {getSortIcon('id')}</Th>
            <Th sortable onClick={() => toggleSort('name')}>Name {getSortIcon('name')}</Th>
            <Th sortable onClick={() => toggleSort('level')}>Level {getSortIcon('level')}</Th>
            <Th sortable onClick={() => toggleSort('maxIcaoCode')}>ICAO {getSortIcon('maxIcaoCode')}</Th>
            <Th sortable={false}>Slots (Avail/Total)</Th>
            <Th sortable onClick={() => toggleSort('business')}>Business Demand {getSortIcon('business')}</Th>
            <Th sortable onClick={() => toggleSort('tourism')}>Tourism Demand {getSortIcon('tourism')}</Th>
          </Thead>
          <tbody>
            {filteredAndSortedAirports.length === 0 ? (
              <tr>
                 <td colSpan={7} className="text-center py-16 text-white/40 uppercase tracking-widest">
                   No airports match your search.
                 </td>
               </tr>
            ) : (
              <>
              {padTop > 0 && <tr style={{ height: padTop }} aria-hidden="true"><td colSpan={7} /></tr>}
              {visibleRows.map((airport, idx) => {
                const stats = getAirportStats(airport, currentYear);
                const businessDemand = stats.business;
                const tourismDemand = stats.tourism;
                const totalSlots = airport.level * 300;
                const infra = airportManagement[airport.id];
                const rentedSlots = infra ? (infra.slots.regional + infra.slots.narrowbody + infra.slots.widebody) : 0;

                const aiSlotsUsed = aiSlotsByAirport.get(airport.id) || 0;

                const availableSlots = Math.max(0, totalSlots - rentedSlots - aiSlotsUsed);

                return (
                  <tr
                    key={`${airport.id}-${firstVisible + idx}`}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors text-white/70 cursor-pointer"
                    onClick={() => onSelectAirport?.(airport)}
                  >
                    <Td className="pl-4 font-bold text-aero-yellow tracking-widest">
                      {airport.id}
                    </Td>
                    <Td>{airport.name}</Td>
                    <Td className="text-xs font-mono">{airport.level}</Td>
                    <Td className="text-xs font-mono font-bold">{airport.maxIcaoCode}</Td>
                    <Td className="text-xs font-mono">{availableSlots} <span className="text-white/30">/</span> {totalSlots}</Td>
                    <Td className="text-xs font-mono">{businessDemand}</Td>
                    <Td className="text-xs font-mono">{tourismDemand}</Td>
                  </tr>
                );
              })}
              {padBottom > 0 && <tr style={{ height: padBottom }} aria-hidden="true"><td colSpan={7} /></tr>}
              </>
            )}
          </tbody>
        </Table>
      </TableScrollContainer>
    </div>
  );
}
