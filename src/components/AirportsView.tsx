import React, { useState, useMemo } from 'react';
import { Airport, airportsData, getAirportStats } from '../data/airports';
import { moreAirports } from '../data/more_airports';

const airportsMap = new Map<string, Airport>();
for (const a of airportsData) airportsMap.set(a.id, a as Airport);
for (const a of moreAirports) airportsMap.set(a.id, a as unknown as Airport);
const airports: Airport[] = Array.from(airportsMap.values());

import { Search, ChevronDown, ChevronUp } from 'lucide-react';

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
    
    return result.sort((a, b) => {
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

  return (
    <div className="w-full h-full text-white/90 px-3 py-3 lg:px-4 lg:py-4 flex flex-col font-sans overflow-hidden relative">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h2 className="text-3xl font-mono text-aero-yellow uppercase tracking-[0.3em] font-black drop-shadow-lg">
          AIRPORTS
        </h2>
        
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
      </div>

      <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar bg-black/20 border border-white/5 rounded-sm p-4">
        <table className="w-full text-left font-mono text-sm border-collapse">
          <thead>
            <tr className="border-b border-aero-yellow/30 text-aero-yellow/80 uppercase tracking-widest text-[10px]">
              <th className="py-4 pl-4 sticky top-0 bg-[#141414] z-10 cursor-pointer hover:text-aero-yellow" onClick={() => toggleSort('id')}>IATA {getSortIcon('id')}</th>
              <th className="py-4 sticky top-0 bg-[#141414] z-10 cursor-pointer hover:text-aero-yellow" onClick={() => toggleSort('name')}>Name {getSortIcon('name')}</th>
              <th className="py-4 sticky top-0 bg-[#141414] z-10 cursor-pointer hover:text-aero-yellow" onClick={() => toggleSort('level')}>Level {getSortIcon('level')}</th>
              <th className="py-4 sticky top-0 bg-[#141414] z-10 cursor-pointer hover:text-aero-yellow" onClick={() => toggleSort('maxIcaoCode')}>ICAO {getSortIcon('maxIcaoCode')}</th>
              <th className="py-4 sticky top-0 bg-[#141414] z-10 text-white/40 cursor-default">Slots (Avail/Total)</th>
              <th className="py-4 sticky top-0 bg-[#141414] z-10 cursor-pointer hover:text-aero-yellow" onClick={() => toggleSort('business')}>Business Demand {getSortIcon('business')}</th>
              <th className="py-4 sticky top-0 bg-[#141414] z-10 cursor-pointer hover:text-aero-yellow" onClick={() => toggleSort('tourism')}>Tourism Demand {getSortIcon('tourism')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedAirports.length === 0 ? (
              <tr>
                 <td colSpan={7} className="text-center py-16 text-white/40 uppercase tracking-widest">
                   No airports match your search.
                 </td>
               </tr>
            ) : (
              filteredAndSortedAirports.map((airport, idx) => {
                const businessDemand = getAirportStats(airport, currentYear).business;
                const tourismDemand = getAirportStats(airport, currentYear).tourism;
                const totalSlots = airport.level * 300;
                const infra = airportManagement[airport.id];
                const rentedSlots = infra ? (infra.slots.regional + infra.slots.narrowbody + infra.slots.widebody) : 0;
                
                const aiSlotsUsed = aiAirlines ? aiAirlines.reduce((sum, ai) => {
                  if (!ai.routes) return sum;
                  return sum + ai.routes.reduce((routeSum: number, r: any) => {
                    if (r.origin === airport.id || r.destination === airport.id) {
                      return routeSum + (r.departures || 0);
                    }
                    return routeSum;
                  }, 0);
                }, 0) : 0;

                const availableSlots = Math.max(0, totalSlots - rentedSlots - aiSlotsUsed);
                
                return (
                  <tr 
                    key={`${airport.id}-${idx}`} 
                    className="border-b border-white/5 hover:bg-white/5 transition-colors text-white/70 cursor-pointer"
                    onClick={() => onSelectAirport?.(airport)}
                  >
                    <td className="py-4 pl-4 font-bold text-aero-yellow tracking-widest">
                      {airport.id}
                    </td>
                    <td className="py-4">{airport.name}</td>
                    <td className="py-4 text-xs font-mono">{airport.level}</td>
                    <td className="py-4 text-xs font-mono font-bold">{airport.maxIcaoCode}</td>
                    <td className="py-4 text-xs font-mono">{availableSlots} <span className="text-white/30">/</span> {totalSlots}</td>
                    <td className="py-4 text-xs font-mono">{businessDemand}</td>
                    <td className="py-4 text-xs font-mono">{tourismDemand}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
