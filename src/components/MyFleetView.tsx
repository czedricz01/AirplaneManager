import React, { useState, useMemo } from 'react';
import { Aircraft } from '../data/aircraft';
import { Search, ChevronDown, ChevronUp, LayoutGrid, List, Plane, Layers, Activity, MapPin, Wrench, ShieldAlert, Boxes, X, ChevronRight } from 'lucide-react';
import { AircraftDetailsModal } from './AircraftDetailsModal';
import { getPlaneSat } from '../lib/financeUtils';
import { InfoTooltip, GLOSSARY } from './InfoTooltip';
import { ConfigOutput } from './ConfigurePurchaseView';
import { AircraftImage } from './AircraftImage';

export interface OwnedAircraft extends Aircraft {
  registration: string;
  purchasedAt: number;
  conditionInterior: number;
  conditionGeneral: number;
  config: ConfigOutput;
  baseInteriorPop: number;
  popRating?: number; // Make optional to prevent ts errors
  baseAircraftId?: string; // Add baseAircraftId specifically since they created it as baseAircraftId in App.tsx
  generalChecksDone?: number;
  refitsDone?: number;
  hubId?: string; // Appointed hub for this aircraft
}

export interface RouteRef {
  id: string;
  origin: string;
  destination: string;
  schedule?: { length: number; flightNumOut?: number }[];
  aircraft: string;
}

type SortField = 'registration' | 'type' | 'maxRange' | 'efficiency' | 'popularity' | 'conditionInterior' | 'conditionGeneral' | 'status';
type SortDir = 'asc' | 'desc';
type GroupBy = 'family' | 'category' | 'manufacturer' | 'none';
type ViewMode = 'grid' | 'table' | 'models';

interface Props {
  fleet: OwnedAircraft[];
  routes?: any[];
  /** Months since 01/1960, so the details modal can show a real aircraft age. */
  currentDateOffset?: number;
  onRenovate: (plane: OwnedAircraft) => void;
  onSelectRoute?: (route: any) => void;
  onStartRoute?: (reg: string) => void;
  onSell?: (plane: OwnedAircraft) => void;
}

export function MyFleetView({ fleet, routes = [], currentDateOffset, onRenovate, onSelectRoute, onStartRoute, onSell }: Props) {
  const [search, setSearch] = useState("");
  const [filterAlertsOnly, setFilterAlertsOnly] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>('family');
  const [viewMode, setViewMode] = useState<ViewMode>('models');
  const [sortField, setSortField] = useState<SortField>('registration');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedPlane, setSelectedPlane] = useState<OwnedAircraft | null>(null);
  const [selectedModel, setSelectedModel] = useState<{
    modelKey: string;
    manufacturer: string;
    type: string;
    items: OwnedAircraft[];
  } | null>(null);

  const isAlertCondition = (p: OwnedAircraft) => p.conditionInterior < 40 || p.conditionGeneral < 40;

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
    return sortDir === 'asc' ? <ChevronUp size={12} className="inline ml-1 text-aero-yellow" /> : <ChevronDown size={12} className="inline ml-1 text-aero-yellow" />;
  };

  const routesByAircraft = useMemo(() => {
    const map: Record<string, any[]> = {};
    routes.forEach(r => {
      if (!map[r.aircraft]) map[r.aircraft] = [];
      map[r.aircraft].push(r);
    });
    return map;
  }, [routes]);

  const filteredAndSortedFleet = useMemo(() => {
    let result = [...fleet];
    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(p => 
        p.registration.toLowerCase().includes(lowerSearch) || 
        p.type.toLowerCase().includes(lowerSearch) || 
        p.manufacturer.toLowerCase().includes(lowerSearch) ||
        p.family.toLowerCase().includes(lowerSearch) ||
        (p.hubId && p.hubId.toLowerCase().includes(lowerSearch))
      );
    }

    if (filterAlertsOnly) {
      result = result.filter(isAlertCondition);
    }
    
    return result.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'popularity') {
         const popA = Math.round((a.popularity * 0.33) + (a.baseInteriorPop * (a.conditionInterior / 100) * 0.67));
         const popB = Math.round((b.popularity * 0.33) + (b.baseInteriorPop * (b.conditionInterior / 100) * 0.67));
         valA = popA;
         valB = popB;
      } else if (sortField === 'status') {
         valA = (routesByAircraft[a.registration] || []).length > 0 ? 1 : 0;
         valB = (routesByAircraft[b.registration] || []).length > 0 ? 1 : 0;
      }

      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [fleet, search, filterAlertsOnly, sortField, sortDir, routesByAircraft]);

  // Model-grouped summary calculation for "models" view mode
  const modelSummaries = useMemo(() => {
    const map: Record<string, {
      modelKey: string;
      manufacturer: string;
      type: string;
      family: string;
      maxRange: number;
      efficiency: number;
      items: OwnedAircraft[];
    }> = {};

    filteredAndSortedFleet.forEach(plane => {
      const key = `${plane.manufacturer} ${plane.type}`;
      if (!map[key]) {
        map[key] = {
          modelKey: key,
          manufacturer: plane.manufacturer,
          type: plane.type,
          family: plane.family,
          maxRange: plane.maxRange,
          efficiency: plane.efficiency,
          items: []
        };
      }
      map[key].items.push(plane);
    });

    return Object.values(map).map(group => {
      const count = group.items.length;
      let sumFirst = 0, sumBiz = 0, sumPrem = 0, sumEco = 0;
      let sumIntCond = 0, sumGenCond = 0, sumSat = 0;
      let activeRoutesCount = 0;
      let alertCount = 0;

      group.items.forEach(p => {
        sumFirst += p.config.first;
        sumBiz += p.config.business;
        sumPrem += p.config.premium;
        sumEco += p.config.economy;
        sumIntCond += p.conditionInterior;
        sumGenCond += p.conditionGeneral;

        if (isAlertCondition(p)) alertCount++;

        const genSat = Math.round((p.popularity * 0.33) + (p.baseInteriorPop * 0.67));
        const combSat = Math.round(genSat * (0.4 + 0.6 * (p.conditionInterior / 100)));
        sumSat += combSat;

        const planeRoutes = routesByAircraft[p.registration] || [];
        activeRoutesCount += planeRoutes.length;
      });

      return {
        ...group,
        count,
        avgFirst: Math.round(sumFirst / count),
        avgBusiness: Math.round(sumBiz / count),
        avgPremium: Math.round(sumPrem / count),
        avgEconomy: Math.round(sumEco / count),
        avgTotalPax: Math.round((sumFirst + sumBiz + sumPrem + sumEco) / count),
        avgInteriorCond: Math.round(sumIntCond / count),
        avgGeneralCond: Math.round(sumGenCond / count),
        avgSatisfaction: Math.round(sumSat / count),
        activeRoutesCount,
        alertCount
      };
    }).sort((a, b) => b.count - a.count);
  }, [filteredAndSortedFleet, routesByAircraft]);

  // Grouping logic for Grid / Table modes
  const groupedFleet = useMemo(() => {
    if (groupBy === 'none') {
      return [{ groupName: 'All Aircraft', items: filteredAndSortedFleet }];
    }

    const groupsMap: Record<string, OwnedAircraft[]> = {};
    filteredAndSortedFleet.forEach(plane => {
      let key = 'Other';
      if (groupBy === 'family') key = plane.family || plane.type || 'Other Family';
      // The field is `class` (aircraft.ts:14); `category` never existed, so
      // grouping by class put every aircraft in "Other Class".
      else if (groupBy === 'category') key = plane.class || 'Other Class';
      else if (groupBy === 'manufacturer') key = plane.manufacturer || 'Other Manufacturer';

      if (!groupsMap[key]) groupsMap[key] = [];
      groupsMap[key].push(plane);
    });

    return Object.keys(groupsMap).sort().map(groupName => ({
      groupName,
      items: groupsMap[groupName]
    }));
  }, [filteredAndSortedFleet, groupBy]);

  // Summary Metrics
  const summaryStats = useMemo(() => {
    const total = fleet.length;
    const activeCount = fleet.filter(p => (routesByAircraft[p.registration] || []).length > 0).length;
    const idleCount = total - activeCount;
    const alertsCount = fleet.filter(isAlertCondition).length;
    const avgIntCond = total > 0 ? Math.round(fleet.reduce((acc, p) => acc + p.conditionInterior, 0) / total) : 0;
    const avgGenCond = total > 0 ? Math.round(fleet.reduce((acc, p) => acc + p.conditionGeneral, 0) / total) : 0;

    return { total, activeCount, idleCount, alertsCount, avgIntCond, avgGenCond, modelCount: modelSummaries.length };
  }, [fleet, routesByAircraft, modelSummaries]);

  return (
    <div className="w-full h-full text-white/90 px-3 py-3 lg:px-4 lg:py-4 flex flex-col font-sans overflow-hidden relative">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 shrink-0">
        <div>
          <h2 className="text-2xl lg:text-3xl font-mono text-aero-yellow uppercase tracking-[0.3em] font-black drop-shadow-lg flex items-center gap-3">
            <Plane className="text-aero-yellow" size={28} />
            MY FLEET
          </h2>
          <p className="text-xs font-mono text-white/50 mt-1">
            Operational aircraft management & performance tracking
          </p>
        </div>

        {/* Toolbar & Controls */}
        <div className="flex flex-wrap items-center gap-2 lg:gap-3">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={15} className="text-white/40" />
            </div>
            <input
              type="text"
              className="w-full bg-black/50 border border-white/10 rounded-sm py-1.5 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-aero-yellow font-mono transition-colors placeholder:text-white/30"
              placeholder="Search reg, type, family..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Condition Alerts Filter Toggle */}
          <button
            onClick={() => setFilterAlertsOnly(!filterAlertsOnly)}
            className={`px-2.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider rounded-sm transition-all flex items-center gap-1.5 ${
              filterAlertsOnly
                ? 'bg-aero-warn text-black shadow-md shadow-aero-warn/40'
                : summaryStats.alertsCount > 0
                ? 'bg-[#111] border border-white/20 text-aero-yellow/60 hover:bg-[#111]'
                : 'bg-black/50 border border-white/10 text-white/50 hover:text-white'
            }`}
          >
            <ShieldAlert size={14} className={summaryStats.alertsCount > 0 ? 'text-aero-yellow/60 animate-pulse' : ''} />
            <span>Alerts (&lt;40%)</span>
            {summaryStats.alertsCount > 0 && (
              <span className="bg-aero-warn text-black text-[10px] px-1.5 py-0.2 rounded-full font-black">
                {summaryStats.alertsCount}
              </span>
            )}
          </button>

          {/* Grouping Selector (only relevant for grid/table) */}
          {viewMode !== 'models' && (
            <div className="flex items-center bg-black/60 border border-white/10 rounded-sm p-0.5 font-mono text-xs">
              <span className="px-2 text-[10px] text-white/40 uppercase tracking-wider font-bold hidden sm:inline flex items-center gap-1">
                <Layers size={12} /> Group:
              </span>
              {(['family', 'category', 'manufacturer', 'none'] as GroupBy[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setGroupBy(mode)}
                  className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-sm transition-all ${
                    groupBy === mode
                      ? 'bg-aero-yellow text-black shadow-md'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {mode === 'category' ? 'Class' : mode}
                </button>
              ))}
            </div>
          )}

          {/* View Mode Toggle (Grid | Table | Models) */}
          <div className="flex items-center bg-black/60 border border-white/10 rounded-sm p-0.5 font-mono">
            <button
              onClick={() => setViewMode('models')}
              title="Model Summary View"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-colors ${
                viewMode === 'models'
                  ? 'bg-aero-yellow text-black shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Boxes size={15} />
              <span>Models</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              title="Grid View"
              className={`p-1.5 rounded-sm transition-colors ${
                viewMode === 'grid'
                  ? 'bg-aero-yellow text-black'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              title="Table View"
              className={`p-1.5 rounded-sm transition-colors ${
                viewMode === 'table'
                  ? 'bg-aero-yellow text-black'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mb-4 shrink-0 font-mono">
        <div className="bg-black/40 border border-white/10 px-3 py-2 rounded-sm flex items-center justify-between">
          <span className="text-[10px] text-white/50 uppercase tracking-widest">Aircraft Types</span>
          <span className="text-sm font-bold text-aero-yellow">{summaryStats.modelCount}</span>
        </div>
        <div className="bg-black/40 border border-white/10 px-3 py-2 rounded-sm flex items-center justify-between">
          <span className="text-[10px] text-white/50 uppercase tracking-widest">Total Fleet</span>
          <span className="text-sm font-bold text-white">{summaryStats.total}</span>
        </div>
        <div className="bg-black/40 border border-white/10 px-3 py-2 rounded-sm flex items-center justify-between">
          <span className="text-[10px] text-white/50 uppercase tracking-widest">Active Routes</span>
          <span className="text-sm font-bold text-white/80">{summaryStats.activeCount} <span className="text-[10px] text-white/40">({summaryStats.idleCount} Idle)</span></span>
        </div>

        {/* Condition Alert KPI Card */}
        <div
          onClick={() => setFilterAlertsOnly(!filterAlertsOnly)}
          className={`px-3 py-2 rounded-sm flex items-center justify-between cursor-pointer transition-all ${
            summaryStats.alertsCount > 0
              ? filterAlertsOnly
                ? 'bg-[#111] border border-white/10 text-aero-yellow/60 ring-1 ring-red-500'
                : 'bg-[#111] border border-white/20 hover:border-white/10 text-aero-yellow/60'
              : 'bg-black/40 border border-white/10 text-white/50'
          }`}
        >
          <span className="text-[10px] uppercase tracking-widest flex items-center gap-1 font-bold">
            <ShieldAlert size={13} className={summaryStats.alertsCount > 0 ? 'text-aero-yellow/60 animate-pulse' : 'text-white/30'} />
            Alerts (&lt;40%)
          </span>
          <span className={`text-sm font-bold ${summaryStats.alertsCount > 0 ? 'text-aero-yellow/60' : 'text-white/50'}`}>
            {summaryStats.alertsCount}
          </span>
        </div>

        <div className="bg-black/40 border border-white/10 px-3 py-2 rounded-sm flex items-center justify-between">
          <span className="text-[10px] text-white/50 uppercase tracking-widest">Avg Int. Cond</span>
          <span className={`text-sm font-bold ${summaryStats.avgIntCond < 40 ? 'text-aero-yellow/60 font-black' : summaryStats.avgIntCond < 50 ? 'text-yellow-400' : 'text-aero-yellow'}`}>{summaryStats.avgIntCond}%</span>
        </div>
        <div className="bg-black/40 border border-white/10 px-3 py-2 rounded-sm flex items-center justify-between">
          <span className="text-[10px] text-white/50 uppercase tracking-widest">Avg Gen. Cond</span>
          <span className={`text-sm font-bold ${summaryStats.avgGenCond < 40 ? 'text-aero-yellow/60 font-black' : summaryStats.avgGenCond < 50 ? 'text-yellow-400' : 'text-aero-yellow'}`}>{summaryStats.avgGenCond}%</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 sm:pr-2 custom-scrollbar space-y-6">
        {fleet.length === 0 ? (
          <div className="bg-black/40 border border-white/10 rounded-sm p-12 text-center font-mono">
            <Plane size={48} className="mx-auto text-white/20 mb-4" />
            <h3 className="text-lg text-aero-yellow uppercase tracking-widest font-bold mb-2">No Aircraft in Fleet</h3>
            <p className="text-xs text-white/50 max-w-md mx-auto leading-relaxed">
              Your airline fleet is currently empty. Visit the aircraft market to purchase or lease your first aircraft and start building your route network.
            </p>
          </div>
        ) : filteredAndSortedFleet.length === 0 ? (
          <div className="bg-black/40 border border-white/10 rounded-sm p-12 text-center font-mono">
            <Search size={40} className="mx-auto text-white/20 mb-3" />
            <p className="text-sm text-white/50 uppercase tracking-wider">No aircraft match your current search query.</p>
          </div>
        ) : viewMode === 'models' ? (
          /* MODEL SUMMARY GRID MODE */
          <div className="space-y-4">
            <div className="text-xs font-mono text-white/50 uppercase tracking-widest flex items-center justify-between border-b border-white/10 pb-2">
              <span>Aircraft Models Overview ({modelSummaries.length} Models)</span>
              <span className="text-[11px] text-aero-yellow/80">Click a model to inspect individual planes</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {modelSummaries.map((m) => {
                const safeName = (m.manufacturer + ' ' + m.type).split('/').join('-').split('\\').join('-');
                const hasAlert = m.alertCount > 0;

                return (
                  <div
                    key={m.modelKey}
                    onClick={() => setSelectedModel({ modelKey: m.modelKey, manufacturer: m.manufacturer, type: m.type, items: m.items })}
                    className={`border rounded-sm overflow-hidden flex flex-col hover:border-aero-yellow transition-all duration-300 group cursor-pointer shadow-lg relative ${
                      hasAlert
                        ? 'bg-aero-warn/10 border-aero-warn/60 shadow-aero-warn/20'
                        : 'bg-[#0f0f0f] border-white/10 hover:shadow-aero-yellow/10'
                    }`}
                  >
                    {/* Aircraft Picture Box */}
                    <div className="relative w-full aspect-[16/10] bg-black/60 overflow-hidden border-b border-white/10">
                      <AircraftImage
                        safeName={safeName}
                        manufacturer={m.manufacturer}
                        type={m.type}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80 pointer-events-none" />

                      {/* Count Badge */}
                      <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-md border border-aero-yellow px-2.5 py-1 rounded-sm font-mono text-xs font-black text-aero-yellow tracking-widest flex items-center gap-1.5 shadow-md">
                        <Plane size={13} />
                        <span>{m.count} {m.count === 1 ? 'Plane' : 'Planes'}</span>
                      </div>

                      {/* Family / Class Badge */}
                      <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md border border-white/20 px-2 py-0.5 rounded-sm font-mono text-[10px] text-white/80 font-bold uppercase tracking-wider">
                        {m.family}
                      </div>

                      {/* Alert badge if any plane in model < 40% */}
                      {hasAlert && (
                        <div className="absolute bottom-2 right-2 bg-aero-warn text-black backdrop-blur-md px-2 py-0.5 rounded-sm font-mono text-[10px] font-black tracking-wider flex items-center gap-1 shadow-md animate-pulse">
                          <ShieldAlert size={12} />
                          <span>{m.alertCount} Alert{m.alertCount > 1 ? 's' : ''} (&lt;40%)</span>
                        </div>
                      )}
                    </div>

                    {/* Card Content Body */}
                    <div className="p-3.5 font-mono flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="text-[10px] text-aero-yellow/80 uppercase tracking-widest font-bold flex items-center justify-between">
                          <span>{m.manufacturer}</span>
                          {hasAlert && (
                            <span className="text-aero-yellow/60 text-[9px] font-black uppercase tracking-wider animate-pulse flex items-center gap-0.5">
                              <ShieldAlert size={10} /> Maintenance Required
                            </span>
                          )}
                        </div>
                        <div className="text-base font-bold text-white group-hover:text-aero-yellow transition-colors truncate">
                          {m.type}
                        </div>
                      </div>

                      {/* Aggregated Performance Specs */}
                      <div className="bg-black/50 p-2.5 rounded-sm border border-white/5 space-y-2 text-[11px]">
                        <div className="flex items-center justify-between text-white/60">
                          <span>Max Range:</span>
                          <span className="font-bold text-white">{m.maxRange} km</span>
                        </div>
                        <div className="flex items-center justify-between text-white/60">
                          <span>Avg PAX Config:</span>
                          <span className="font-bold text-aero-yellow">{m.avgTotalPax} Pax</span>
                        </div>
                        <div className="text-[10px] text-white/40 text-right font-mono">
                          ({m.avgFirst} F / {m.avgBusiness} C / {m.avgPremium} W / {m.avgEconomy} Y)
                        </div>

                        <div className="pt-1.5 border-t border-white/10 flex items-center justify-between text-white/60">
                          <span>Avg Satisfaction:</span>
                          <span className="font-bold text-aero-yellow">{m.avgSatisfaction}%</span>
                        </div>
                        <div className="flex items-center justify-between text-white/60">
                          <span>Active Routes:</span>
                          <span className="font-bold text-white/80">{m.activeRoutesCount} Active</span>
                        </div>
                      </div>

                      {/* Average Condition Indicators */}
                      <div className="space-y-1.5 text-[10px]">
                        <div className="flex items-center justify-between">
                          <span className="text-white/50">Avg Interior Cond.</span>
                          <span className={`font-bold ${m.avgInteriorCond < 40 ? 'text-aero-yellow/60 font-black animate-pulse' : m.avgInteriorCond < 50 ? 'text-yellow-400' : 'text-white'}`}>
                            {m.avgInteriorCond}%
                          </span>
                        </div>
                        <div className="h-1 bg-black rounded-full overflow-hidden">
                          <div
                            className={`h-full ${m.avgInteriorCond < 40 ? 'bg-aero-warn animate-pulse' : m.avgInteriorCond < 50 ? 'bg-yellow-400' : 'bg-aero-yellow/20'}`}
                            style={{ width: `${Math.max(0, Math.min(100, m.avgInteriorCond))}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between pt-0.5">
                          <span className="text-white/50">Avg General Cond.</span>
                          <span className={`font-bold ${m.avgGeneralCond < 40 ? 'text-aero-yellow/60 font-black animate-pulse' : m.avgGeneralCond < 50 ? 'text-yellow-400' : 'text-white'}`}>
                            {m.avgGeneralCond}%
                          </span>
                        </div>
                        <div className="h-1 bg-black rounded-full overflow-hidden">
                          <div
                            className={`h-full ${m.avgGeneralCond < 40 ? 'bg-aero-warn animate-pulse' : m.avgGeneralCond < 50 ? 'bg-yellow-400' : 'bg-white/10'}`}
                            style={{ width: `${Math.max(0, Math.min(100, m.avgGeneralCond))}%` }}
                          />
                        </div>
                      </div>

                      {/* Footer Action */}
                      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs font-bold text-aero-yellow group-hover:translate-x-1 transition-transform">
                        <span>Show {m.count} Aircraft &rarr;</span>
                        <ChevronRight size={16} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* GRID OR TABLE VIEW MODE WITH GROUPING */
          groupedFleet.map(({ groupName, items }) => (
            <div key={groupName} className="space-y-3">
              {/* Group Header */}
              <div className="flex items-center justify-between border-b border-aero-yellow/30 pb-2 pt-1 font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-aero-yellow">
                    {groupName}
                  </span>
                  <span className="bg-aero-yellow/10 border border-aero-yellow/30 text-aero-yellow text-[10px] px-2 py-0.5 rounded-sm font-bold">
                    {items.length} {items.length === 1 ? 'aircraft' : 'aircraft'}
                  </span>
                </div>
              </div>

              {/* GRID VIEW MODE */}
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                  {items.map((plane) => {
                    const safeName = (plane.manufacturer + ' ' + plane.type).split('/').join('-').split('\\').join('-');
                    const assignedRoutes = routesByAircraft[plane.registration] || [];
                    const combinedPlaneSat = getPlaneSat(plane);
                    const totalPax = plane.config.first + plane.config.business + plane.config.premium + plane.config.economy;
                    const critical = isAlertCondition(plane);

                    return (
                      <div
                        key={plane.registration}
                        onClick={() => setSelectedPlane(plane)}
                        className={`rounded-sm overflow-hidden flex flex-col hover:border-aero-yellow/60 transition-all duration-300 group cursor-pointer shadow-lg relative ${
                          critical
                            ? 'bg-aero-warn/10 border border-aero-warn/60 shadow-aero-warn/20 ring-1 ring-aero-warn/40'
                            : 'bg-[#0f0f0f] border border-white/10 hover:shadow-aero-yellow/10'
                        }`}
                      >
                        {/* Aircraft Image Box */}
                        <div className="relative w-full aspect-[16/10] bg-black/60 overflow-hidden border-b border-white/10">
                          <AircraftImage
                            safeName={safeName}
                            manufacturer={plane.manufacturer}
                            type={plane.type}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80 pointer-events-none" />

                          {/* Registration Badge */}
                          <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-md border border-aero-yellow/50 px-2 py-0.5 rounded-sm font-mono text-[11px] font-black text-aero-yellow tracking-widest">
                            {plane.registration}
                          </div>

                          {/* Critical Condition Warning Overlay */}
                          {critical ? (
                            <div className="absolute top-2 right-2 bg-aero-warn text-black backdrop-blur-md border border-aero-warn text-[10px] font-mono font-black px-2 py-0.5 rounded-sm uppercase tracking-wider flex items-center gap-1 shadow-md animate-pulse">
                              <ShieldAlert size={12} />
                              <span>Critical (&lt;40%)</span>
                            </div>
                          ) : (
                            /* Status Badge */
                            <div className="absolute top-2 right-2">
                              {assignedRoutes.length > 0 ? (
                                <span className="bg-white/5 backdrop-blur-md border border-white/10 text-white/80 text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider">
                                  {assignedRoutes.length} Route{assignedRoutes.length > 1 ? 's' : ''}
                                </span>
                              ) : (
                                <span className="bg-aero-yellow/10 backdrop-blur-md border border-aero-yellow/20 text-aero-yellow text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider">
                                  Idle
                                </span>
                              )}
                            </div>
                          )}

                          {/* Hub Overlay (bottom left of image) */}
                          {plane.hubId && (
                            <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm border border-white/20 px-1.5 py-0.5 rounded text-[10px] font-mono text-white/80">
                              <MapPin size={10} className="text-aero-yellow" />
                              <span>{plane.hubId}</span>
                            </div>
                          )}
                        </div>

                        {/* Card Info Body */}
                        <div className="p-3 font-mono flex-1 flex flex-col justify-between space-y-3">
                          <div>
                            <div className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
                              {plane.manufacturer}
                            </div>
                            <div className="text-sm font-bold text-white group-hover:text-aero-yellow transition-colors truncate">
                              {plane.type}
                            </div>
                          </div>

                          {/* Specs Grid */}
                          <div className="grid grid-cols-2 gap-2 text-[11px] bg-black/40 p-2 rounded-sm border border-white/5">
                            <div>
                              <span className="text-white/40 block text-[9px] uppercase tracking-wider">Range</span>
                              <span className="text-white font-bold">{plane.maxRange} km</span>
                            </div>
                            <div>
                              <span className="text-white/40 block text-[9px] uppercase tracking-wider">Capacity</span>
                              <span className="text-white font-bold">{totalPax} pax</span>
                            </div>
                            <div>
                              <span className="text-white/40 block text-[9px] uppercase tracking-wider">Satisfaction</span>
                              <span className="text-aero-yellow font-bold">{combinedPlaneSat}%</span>
                            </div>
                            <div>
                              <span className="text-white/40 block text-[9px] uppercase tracking-wider">Efficiency</span>
                              <span className="text-white/80 font-bold">{plane.efficiency}</span>
                            </div>
                          </div>

                          {/* Condition Indicator Bars */}
                          <div className="space-y-1.5 text-[10px]">
                            <div className="flex items-center justify-between">
                              <span className="text-white/50">Interior Cond.</span>
                              <span className={`font-bold ${plane.conditionInterior < 40 ? 'text-aero-yellow/60 font-black animate-pulse' : plane.conditionInterior < 50 ? 'text-yellow-400' : 'text-white'}`}>
                                {Math.round(plane.conditionInterior)}%
                              </span>
                            </div>
                            <div className="h-1 bg-black rounded-full overflow-hidden">
                              <div
                                className={`h-full ${plane.conditionInterior < 40 ? 'bg-aero-warn animate-pulse' : plane.conditionInterior < 50 ? 'bg-yellow-400' : 'bg-aero-yellow/20'}`}
                                style={{ width: `${Math.max(0, Math.min(100, plane.conditionInterior))}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between pt-0.5">
                              <span className="text-white/50">General Cond.</span>
                              <span className={`font-bold ${plane.conditionGeneral < 40 ? 'text-aero-yellow/60 font-black animate-pulse' : plane.conditionGeneral < 50 ? 'text-yellow-400' : 'text-white'}`}>
                                {Math.round(plane.conditionGeneral)}%
                              </span>
                            </div>
                            <div className="h-1 bg-black rounded-full overflow-hidden">
                              <div
                                className={`h-full ${plane.conditionGeneral < 40 ? 'bg-aero-warn animate-pulse' : plane.conditionGeneral < 50 ? 'bg-yellow-400' : 'bg-white/10'}`}
                                style={{ width: `${Math.max(0, Math.min(100, plane.conditionGeneral))}%` }}
                              />
                            </div>
                          </div>

                          {/* Quick Actions Footer */}
                          <div className="pt-1 flex items-center justify-between gap-2 border-t border-white/5">
                            <span className="text-[10px] text-white/40 uppercase tracking-widest group-hover:text-aero-yellow transition-colors font-bold">
                              View Details &rarr;
                            </span>
                            {critical ? (
                              <span className="text-aero-yellow/60 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider animate-pulse">
                                <ShieldAlert size={12} /> Maintenance Urgent
                              </span>
                            ) : (plane.conditionInterior < 50 || plane.conditionGeneral < 50) && (
                              <span className="text-yellow-400 flex items-center gap-1 text-[10px] font-bold">
                                <Wrench size={12} /> Service Soon
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* TABLE VIEW MODE */
                <div className="overflow-x-auto w-full bg-black/30 border border-white/10 rounded-sm">
                  <table className="w-full text-left font-mono text-xs border-collapse min-w-[1000px]">
                    <thead>
                      <tr className="border-b border-aero-yellow/30 text-aero-yellow/80 uppercase tracking-widest text-[10px] bg-[#141414]">
                        <th className="py-3 pl-3 w-16">Image</th>
                        <th className="py-3 pl-3 cursor-pointer hover:text-aero-yellow" onClick={() => toggleSort('registration')}>
                          Reg {getSortIcon('registration')}
                        </th>
                        <th className="py-3 cursor-pointer hover:text-aero-yellow" onClick={() => toggleSort('type')}>
                          Type {getSortIcon('type')}
                        </th>
                        <th className="py-3">Hub</th>
                        <th className="py-3 cursor-pointer hover:text-aero-yellow" onClick={() => toggleSort('maxRange')}>
                          Range {getSortIcon('maxRange')}
                        </th>
                        <th className="py-3">Pax Config</th>
                        <th className="py-3 cursor-pointer hover:text-aero-yellow" onClick={() => toggleSort('efficiency')}>
                          Eff.<InfoTooltip size={11} {...GLOSSARY.efficiency} /> {getSortIcon('efficiency')}
                        </th>
                        <th className="py-3 cursor-pointer hover:text-aero-yellow" onClick={() => toggleSort('popularity')}>
                          Comb. Sat<InfoTooltip size={11} {...GLOSSARY.sat} /> {getSortIcon('popularity')}
                        </th>
                        <th className="py-3 cursor-pointer hover:text-aero-yellow" onClick={() => toggleSort('conditionInterior')}>
                          Int. Cond<InfoTooltip size={11} {...GLOSSARY.conditionInterior} /> {getSortIcon('conditionInterior')}
                        </th>
                        <th className="py-3 cursor-pointer hover:text-aero-yellow" onClick={() => toggleSort('conditionGeneral')}>
                          Gen. Cond<InfoTooltip size={11} {...GLOSSARY.conditionGeneral} /> {getSortIcon('conditionGeneral')}
                        </th>
                        <th className="py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((plane) => {
                        const safeName = (plane.manufacturer + ' ' + plane.type).split('/').join('-').split('\\').join('-');
                        const combinedPlaneSat = getPlaneSat(plane);
                        const totalPax = plane.config.first + plane.config.business + plane.config.premium + plane.config.economy;
                        const assignedRoutes = routesByAircraft[plane.registration] || [];
                        const critical = isAlertCondition(plane);

                        return (
                          <tr
                            key={plane.registration}
                            onClick={() => setSelectedPlane(plane)}
                            className={`border-b transition-colors cursor-pointer ${
                              critical
                                ? 'bg-[#111] border-white/20 hover:bg-[#111] text-aero-yellow/60 font-medium'
                                : 'border-white/5 hover:bg-white/5 text-white/70'
                            }`}
                          >
                            <td className="py-2 pl-3">
                              <div className="w-12 h-8 rounded bg-black/60 border border-white/10 overflow-hidden relative">
                                <AircraftImage
                                  safeName={safeName}
                                  manufacturer={plane.manufacturer}
                                  type={plane.type}
                                  className="w-full h-full object-cover"
                                />
                                {critical && (
                                  <div className="absolute inset-0 bg-[#111] border border-white/10 animate-pulse pointer-events-none" />
                                )}
                              </div>
                            </td>
                            <td className="py-3 pl-3 font-bold tracking-wider">
                              <span className={critical ? 'text-aero-yellow/60 flex items-center gap-1 font-black' : 'text-aero-yellow'}>
                                {critical && <ShieldAlert size={13} className="animate-pulse" />}
                                {plane.registration}
                              </span>
                            </td>
                            <td className="py-3 text-white">{plane.manufacturer} {plane.type}</td>
                            <td className="py-3">{plane.hubId || <span className="text-white/30 italic text-[10px]">None</span>}</td>
                            <td className="py-3">{plane.maxRange} km</td>
                            <td className="py-3 whitespace-nowrap">
                              {totalPax} ({plane.config.first}/{plane.config.business}/{plane.config.premium}/{plane.config.economy})
                            </td>
                            <td className="py-3">{plane.efficiency}</td>
                            <td className="py-3 font-bold text-aero-yellow">{combinedPlaneSat}%</td>
                            <td className="py-3">
                              <span className={plane.conditionInterior < 40 ? 'text-aero-yellow/60 font-black animate-pulse flex items-center gap-0.5' : plane.conditionInterior < 50 ? 'text-yellow-400 font-bold' : ''}>
                                {Math.round(plane.conditionInterior)}%
                              </span>
                            </td>
                            <td className="py-3">
                              <span className={plane.conditionGeneral < 40 ? 'text-aero-yellow/60 font-black animate-pulse flex items-center gap-0.5' : plane.conditionGeneral < 50 ? 'text-yellow-400 font-bold' : ''}>
                                {Math.round(plane.conditionGeneral)}%
                              </span>
                            </td>
                            <td className="py-3">
                              {critical ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-[#1a1a1a] text-white uppercase tracking-wider shadow animate-pulse">
                                  <ShieldAlert size={10} /> Maintenance Urgent
                                </span>
                              ) : assignedRoutes.length > 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 text-white/80 border border-white/10 uppercase tracking-wider">
                                  {assignedRoutes.length} Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-aero-yellow/10 text-aero-yellow border border-aero-yellow/20 uppercase tracking-wider">
                                  Idle
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Model Aircraft List Modal */}
      {selectedModel && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-aero-yellow/40 rounded-sm max-w-4xl w-full max-h-[90vh] flex flex-col font-mono shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 bg-black/60 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-16 h-10 rounded bg-black border border-aero-yellow/30 overflow-hidden shrink-0">
                  <AircraftImage
                    safeName={(selectedModel.manufacturer + ' ' + selectedModel.type).split('/').join('-').split('\\').join('-')}
                    manufacturer={selectedModel.manufacturer}
                    type={selectedModel.type}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-aero-yellow uppercase tracking-widest">
                    {selectedModel.manufacturer} {selectedModel.type}
                  </h3>
                  <p className="text-xs text-white/50">
                    Showing all {selectedModel.items.length} owned aircraft of this model
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedModel(null)}
                className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body - List of Aircraft */}
            <div className="p-4 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedModel.items.map((plane) => {
                  const assignedRoutes = routesByAircraft[plane.registration] || [];
                  const combinedPlaneSat = getPlaneSat(plane);
                  const totalPax = plane.config.first + plane.config.business + plane.config.premium + plane.config.economy;
                  const critical = isAlertCondition(plane);

                  return (
                    <div
                      key={plane.registration}
                      onClick={() => setSelectedPlane(plane)}
                      className={`border rounded p-3 flex flex-col justify-between cursor-pointer transition-all group ${
                        critical
                          ? 'bg-[#111] border-white/20 hover:border-white/10'
                          : 'bg-black/50 border-white/10 hover:border-aero-yellow/60 hover:bg-white/5'
                      }`}
                    >
                      {critical && (
                        <div className="bg-[#111] border border-white/20 text-aero-yellow/60 text-[10px] font-bold px-2 py-1 rounded mb-2 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <ShieldAlert size={12} className="animate-pulse text-aero-yellow/60" />
                            CRITICAL CONDITION (&lt;40%)
                          </span>
                          <span className="uppercase text-[9px] font-black">Maintenance Urgent</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                        <div>
                          <span className={`text-sm font-bold tracking-widest block ${critical ? 'text-aero-yellow/60 font-black' : 'text-aero-yellow'}`}>
                            {plane.registration}
                          </span>
                          <span className="text-[10px] text-white/40">
                            Hub: {plane.hubId || 'Unassigned'}
                          </span>
                        </div>
                        {assignedRoutes.length > 0 ? (
                          <span className="bg-white/5 text-white/80 border border-white/10 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                            {assignedRoutes.length} Route{assignedRoutes.length > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="bg-aero-yellow/10 text-aero-yellow border border-aero-yellow/20 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                            Idle
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-white/70 mb-3">
                        <div>
                          <span className="text-white/40 block text-[9px]">PAX Config:</span>
                          <span>{totalPax} ({plane.config.first}/{plane.config.business}/{plane.config.premium}/{plane.config.economy})</span>
                        </div>
                        <div>
                          <span className="text-white/40 block text-[9px]">Satisfaction:</span>
                          <span className="font-bold text-aero-yellow">{combinedPlaneSat}%</span>
                        </div>
                        <div>
                          <span className="text-white/40 block text-[9px]">Interior Cond.:</span>
                          <span className={plane.conditionInterior < 40 ? 'text-aero-yellow/60 font-black animate-pulse' : plane.conditionInterior < 50 ? 'text-yellow-400 font-bold' : ''}>
                            {Math.round(plane.conditionInterior)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-white/40 block text-[9px]">General Cond.:</span>
                          <span className={plane.conditionGeneral < 40 ? 'text-aero-yellow/60 font-black animate-pulse' : plane.conditionGeneral < 50 ? 'text-yellow-400 font-bold' : ''}>
                            {Math.round(plane.conditionGeneral)}%
                          </span>
                        </div>
                      </div>

                      <div className="text-[10px] font-bold text-aero-yellow/80 group-hover:text-aero-yellow flex items-center justify-end gap-1 pt-2 border-t border-white/5">
                        <span>Inspect Aircraft</span>
                        <ChevronRight size={14} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-black/60 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setSelectedModel(null)}
                className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase px-4 py-2 rounded transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Aircraft Details Modal */}
      {selectedPlane && (
        <AircraftDetailsModal 
          plane={selectedPlane} 
          currentDateOffset={currentDateOffset}
          onClose={() => setSelectedPlane(null)} 
          onRenovate={() => {
            setSelectedPlane(null);
            onRenovate(selectedPlane);
          }}
          aircraftRoutes={routes.filter(r => r.aircraft === selectedPlane.registration)}
          onSelectRoute={onSelectRoute}
          onStartRoute={(reg) => {
            setSelectedPlane(null);
            onStartRoute?.(reg);
          }}
          onSell={(plane) => {
            setSelectedPlane(null);
            onSell?.(plane);
          }}
        />
      )}
    </div>
  );
}


