import { clickOnKey } from '../lib/a11y';
import React, { useState, useMemo } from 'react';
import { Aircraft } from '../data/aircraft';
import { Search, ChevronDown, ChevronUp, LayoutGrid, List, Plane, Layers, MapPin, Wrench, ShieldAlert, Boxes, X, ChevronRight } from 'lucide-react';
import { AircraftDetailsModal } from './AircraftDetailsModal';
import { getPlaneSat } from '../lib/financeUtils';
import { InfoTooltip, GLOSSARY } from './InfoTooltip';
import type { ConfigOutput } from './ConfigurePurchaseView';
import { AircraftImage } from './AircraftImage';
import { ViewHeader } from './ui/ViewHeader';
import { StatTile } from './ui/StatTile';
import { conditionTone, CONDITION_TEXT_CLASS, CONDITION_BAR_CLASS } from '../lib/theme';
import type { AssignmentContext, RoutePatch } from '../lib/aircraftAssignment';

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
  /** Launch customer: the month the popularity bonus runs out; see preorders.ts. */
  launchBonusUntil?: number;
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
  airlineCode?: string;
  /** For the aircraft swap in the details modal. */
  airportManagement?: AssignmentContext['airportManagement'];
  onReassignRoutes?: (patches: RoutePatch[], note: string) => void;
}

/** KPI labels on phones: one line, cut short if need be, instead of wrapping onto two. */
const KPI_LABEL = 'short:mb-0.5';

function MyFleetViewImpl({ fleet, routes = [], currentDateOffset, onRenovate, onSelectRoute, onStartRoute, onSell, airlineCode = '', airportManagement, onReassignRoutes }: Props) {
  const [search, setSearch] = useState("");
  const [filterAlertsOnly, setFilterAlertsOnly] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>('family');
  const [viewMode, setViewMode] = useState<ViewMode>('models');
  const [sortField, setSortField] = useState<SortField>('registration');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  // Held by registration: a stored copy of the aircraft went stale as soon as it
  // was renovated or aged a month while the details were open.
  const [selectedReg, setSelectedReg] = useState<string | null>(null);
  const selectedPlane = useMemo(
    () => (selectedReg ? fleet.find(p => p.registration === selectedReg) ?? null : null),
    [selectedReg, fleet]
  );
  const setSelectedPlane = (plane: OwnedAircraft | null) => setSelectedReg(plane ? plane.registration : null);
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
    return sortDir === 'asc' ? <ChevronUp size={12} className="inline ml-1 text-accent" /> : <ChevronDown size={12} className="inline ml-1 text-accent" />;
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
      // 'status' is not a field of the aircraft; it sorts as undefined, as it always has.
      const field = sortField as keyof OwnedAircraft;
      let valA: any = a[field];
      let valB: any = b[field];

      if (sortField === 'popularity') {
         // The figure the column shows and the economy uses, not a variant of it.
         valA = getPlaneSat(a);
         valB = getPlaneSat(b);
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

        sumSat += getPlaneSat(p);

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
    <div className="w-full h-full text-ink px-3 py-3 lg:px-4 lg:py-4 short:py-1.5 flex flex-col font-sans overflow-hidden relative">
      <ViewHeader
        icon={<Plane className="text-accent" size={28} />}
        title="My fleet"
        right={
          <div className="flex flex-wrap short:flex-nowrap short:min-w-0 items-center gap-2 lg:gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-40 short:min-w-24 sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={15} className="text-muted" />
              </div>
              <input
                type="text"
                className="w-full bg-ground/50 border border-line rounded-sm py-1.5 pl-9 pr-3 text-xs text-ink focus:outline-none focus:border-accent transition-colors placeholder:text-muted"
                placeholder="Search reg, type, family..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Condition Alerts Filter Toggle */}
            <button
              onClick={() => setFilterAlertsOnly(!filterAlertsOnly)}
              className={`px-2.5 py-1.5 text-xs font-label font-semibold uppercase tracking-label rounded-sm transition-all flex items-center gap-1.5 ${
                filterAlertsOnly
                  ? 'bg-bad text-on-accent'
                  : summaryStats.alertsCount > 0
                  ? 'bg-bad/10 border border-bad/50 text-bad hover:bg-bad/20'
                  : 'bg-ground/50 border border-line text-muted hover:text-ink'
              }`}
            >
              <ShieldAlert size={14} className={summaryStats.alertsCount > 0 ? 'text-bad' : ''} />
              <span className="short:hidden">Alerts (&lt;40%)</span>
              {summaryStats.alertsCount > 0 && (
                <span className="bg-bad text-on-accent text-2xs px-1.5 py-0.2 rounded-full font-semibold">
                  {summaryStats.alertsCount}
                </span>
              )}
            </button>

            {/* Grouping Selector (only relevant for grid/table) */}
            {viewMode !== 'models' && (
              <div className="flex items-center bg-ground/60 border border-line rounded-sm p-0.5 text-xs">
                <span className="px-2 text-2xs text-muted uppercase tracking-label font-semibold hidden sm:inline short:hidden flex items-center gap-1">
                  <Layers size={12} /> Group:
                </span>
                {(['family', 'category', 'manufacturer', 'none'] as GroupBy[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setGroupBy(mode)}
                    className={`px-2.5 short:px-1.5 py-1 text-2xs font-semibold uppercase tracking-label rounded-sm transition-all ${
                      groupBy === mode
                        ? 'bg-accent text-on-accent'
                        : 'text-muted hover:text-ink hover:bg-raised'
                    }`}
                  >
                    {mode === 'category' ? 'Class' : mode}
                  </button>
                ))}
              </div>
            )}

            {/* View Mode Toggle (Grid | Table | Models) */}
            <div className="flex items-center bg-ground/60 border border-line rounded-sm p-0.5">
              <button
                onClick={() => setViewMode('models')}
                title="Model Summary View"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-xs font-semibold uppercase tracking-label transition-colors ${
                  viewMode === 'models'
                    ? 'bg-accent text-on-accent'
                    : 'text-muted hover:text-ink hover:bg-raised'
                }`}
              >
                <Boxes size={15} />
                <span className="short:hidden">Models</span>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                title="Grid View"
                className={`p-1.5 rounded-sm transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-accent text-on-accent'
                    : 'text-muted hover:text-ink hover:bg-raised'
                }`}
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                title="Table View"
                className={`p-1.5 rounded-sm transition-colors ${
                  viewMode === 'table'
                    ? 'bg-accent text-on-accent'
                    : 'text-muted hover:text-ink hover:bg-raised'
                }`}
              >
                <List size={16} />
              </button>
            </div>
          </div>
        }
      />

      {/* Summary KPI Bar. On phones a slim strip (three a row upright, all six
          sideways) with one-line labels, so the aircraft below get the room. */}
      <div className="grid grid-cols-2 sm:grid-cols-6 bar:grid-cols-3 gap-2 bar:gap-1.5 short:gap-1.5 mb-4 bar:mb-2 short:mb-2 shrink-0">
        <div className="bg-surface border border-line px-3 py-2 bar:px-2 short:px-2 bar:py-1.5 short:py-1 rounded-sm">
          <StatTile size="sm" labelClassName={KPI_LABEL} label="Aircraft Types" value={summaryStats.modelCount} valueClassName="text-accent" />
        </div>
        <div className="bg-surface border border-line px-3 py-2 bar:px-2 short:px-2 bar:py-1.5 short:py-1 rounded-sm">
          <StatTile size="sm" labelClassName={KPI_LABEL} label="Total Fleet" value={summaryStats.total} />
        </div>
        <div className="bg-surface border border-line px-3 py-2 bar:px-2 short:px-2 bar:py-1.5 short:py-1 rounded-sm">
          <StatTile
            size="sm"
            labelClassName={KPI_LABEL}
            label="Active Aircraft"
            value={<>{summaryStats.activeCount} <span className="text-2xs text-muted">({summaryStats.idleCount} Idle)</span></>}
            valueClassName="text-ink"
          />
        </div>

        {/* Condition Alert KPI Card */}
        <div role="button" tabIndex={0} onKeyDown={clickOnKey}
          onClick={() => setFilterAlertsOnly(!filterAlertsOnly)}
          className={`px-3 py-2 bar:px-2 short:px-2 bar:py-1.5 short:py-1 rounded-sm cursor-pointer transition-all ${
            summaryStats.alertsCount > 0
              ? filterAlertsOnly
                ? 'bg-surface border border-line ring-1 ring-bad'
                : 'bg-surface border border-rule hover:border-line'
              : 'bg-surface border border-line'
          }`}
        >
          <StatTile
            size="sm"
            labelClassName={KPI_LABEL}
            label="Alerts (<40%)"
            value={summaryStats.alertsCount}
            valueClassName={summaryStats.alertsCount > 0 ? 'text-bad' : 'text-muted'}
          />
        </div>

        <div className="bg-surface border border-line px-3 py-2 bar:px-2 short:px-2 bar:py-1.5 short:py-1 rounded-sm">
          <StatTile
            size="sm"
            labelClassName={KPI_LABEL}
            label="Avg Int. Cond"
            value={`${summaryStats.avgIntCond}%`}
            valueClassName={CONDITION_TEXT_CLASS[conditionTone(summaryStats.avgIntCond)]}
          />
        </div>
        <div className="bg-surface border border-line px-3 py-2 bar:px-2 short:px-2 bar:py-1.5 short:py-1 rounded-sm">
          <StatTile
            size="sm"
            labelClassName={KPI_LABEL}
            label="Avg Gen. Cond"
            value={`${summaryStats.avgGenCond}%`}
            valueClassName={CONDITION_TEXT_CLASS[conditionTone(summaryStats.avgGenCond)]}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 sm:pr-2 space-y-6">
        {fleet.length === 0 ? (
          <div className="bg-ground/40 border border-line rounded-sm p-12 text-center">
            <Plane size={48} className="mx-auto text-muted mb-4" />
            <h3 className="font-label text-lg text-ink font-semibold mb-2">No Aircraft in Fleet</h3>
            <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
              Your airline fleet is currently empty. Visit the aircraft market to purchase your first aircraft and start building your route network.
            </p>
          </div>
        ) : filteredAndSortedFleet.length === 0 ? (
          <div className="bg-ground/40 border border-line rounded-sm p-12 text-center">
            <Search size={40} className="mx-auto text-muted mb-3" />
            <p className="text-sm text-muted">No aircraft match your current search query.</p>
          </div>
        ) : viewMode === 'models' ? (
          /* MODEL SUMMARY GRID MODE */
          <div className="space-y-4">
            <div className="text-xs font-label text-muted uppercase tracking-label flex items-center justify-between border-b border-line pb-2">
              <span>Aircraft Models Overview ({modelSummaries.length} Models)</span>
              <span className="text-2xs text-accent">Click a model to inspect individual planes</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {modelSummaries.map((m) => {
                const safeName = (m.manufacturer + ' ' + m.type).split('/').join('-').split('\\').join('-');
                const hasAlert = m.alertCount > 0;

                return (
                  <div
                    key={m.modelKey} role="button" tabIndex={0} onKeyDown={clickOnKey}
                    onClick={() => setSelectedModel({ modelKey: m.modelKey, manufacturer: m.manufacturer, type: m.type, items: m.items })}
                    className={`border rounded-sm overflow-hidden flex flex-col hover:border-accent transition-all duration-300 group cursor-pointer relative ${
                      hasAlert
                        ? 'bg-bad/10 border-bad/60'
                        : 'bg-surface border-line'
                    }`}
                  >
                    {/* Aircraft Picture Box */}
                    <div className="relative w-full aspect-[16/10] bg-ground/60 overflow-hidden border-b border-line">
                      <AircraftImage
                        safeName={safeName}
                        manufacturer={m.manufacturer}
                        type={m.type}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-ground via-transparent to-transparent opacity-80 pointer-events-none" />

                      {/* Count Badge */}
                      <div className="absolute top-2 left-2 bg-ground/80 border border-accent px-2.5 py-1 rounded-sm text-xs font-semibold text-accent flex items-center gap-1.5">
                        <Plane size={13} />
                        <span>{m.count} {m.count === 1 ? 'Plane' : 'Planes'}</span>
                      </div>

                      {/* Family / Class Badge */}
                      <div className="absolute top-2 right-2 bg-ground/70 border border-rule px-2 py-0.5 rounded-sm font-label text-2xs text-ink font-semibold uppercase tracking-label">
                        {m.family}
                      </div>

                      {/* Alert badge if any plane in model < 40% */}
                      {hasAlert && (
                        <div className="absolute bottom-2 right-2 bg-bad text-on-accent px-2 py-0.5 rounded-sm text-2xs font-semibold flex items-center gap-1">
                          <ShieldAlert size={12} />
                          <span>{m.alertCount} Alert{m.alertCount > 1 ? 's' : ''} (&lt;40%)</span>
                        </div>
                      )}
                    </div>

                    {/* Card Content Body */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="text-2xs text-muted uppercase tracking-label font-semibold flex items-center justify-between">
                          <span>{m.manufacturer}</span>
                          {hasAlert && (
                            <span className="text-bad text-2xs font-semibold uppercase tracking-label flex items-center gap-0.5">
                              <ShieldAlert size={10} /> Maintenance Required
                            </span>
                          )}
                        </div>
                        <div className="text-base font-semibold text-ink group-hover:text-accent transition-colors truncate">
                          {m.type}
                        </div>
                      </div>

                      {/* Aggregated Performance Specs */}
                      <div className="bg-ground/50 p-2.5 rounded-sm border border-line space-y-2 text-2xs">
                        <div className="flex items-center justify-between text-muted">
                          <span>Max Range:</span>
                          <span className="font-semibold text-ink">{m.maxRange} km</span>
                        </div>
                        <div className="flex items-center justify-between text-muted">
                          <span>Avg PAX Config:</span>
                          <span className="font-semibold text-accent">{m.avgTotalPax} Pax</span>
                        </div>
                        <div className="text-2xs text-muted text-right font-mono">
                          ({m.avgFirst} F / {m.avgBusiness} C / {m.avgPremium} W / {m.avgEconomy} Y)
                        </div>

                        <div className="pt-1.5 border-t border-line flex items-center justify-between text-muted">
                          <span>Avg Satisfaction:</span>
                          <span className="font-semibold text-accent">{m.avgSatisfaction}%</span>
                        </div>
                        <div className="flex items-center justify-between text-muted">
                          <span>Active Routes:</span>
                          <span className="font-semibold text-ink">{m.activeRoutesCount} Active</span>
                        </div>
                      </div>

                      {/* Average Condition Indicators */}
                      <div className="space-y-1.5 text-2xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted">Avg Interior Cond.</span>
                          <span className={CONDITION_TEXT_CLASS[conditionTone(m.avgInteriorCond)]}>
                            {m.avgInteriorCond}%
                          </span>
                        </div>
                        <div className="h-1 bg-ground rounded-full overflow-hidden">
                          <div
                            className={`h-full ${CONDITION_BAR_CLASS[conditionTone(m.avgInteriorCond)]}`}
                            style={{ width: `${Math.max(0, Math.min(100, m.avgInteriorCond))}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between pt-0.5">
                          <span className="text-muted">Avg General Cond.</span>
                          <span className={CONDITION_TEXT_CLASS[conditionTone(m.avgGeneralCond)]}>
                            {m.avgGeneralCond}%
                          </span>
                        </div>
                        <div className="h-1 bg-ground rounded-full overflow-hidden">
                          <div
                            className={`h-full ${CONDITION_BAR_CLASS[conditionTone(m.avgGeneralCond)]}`}
                            style={{ width: `${Math.max(0, Math.min(100, m.avgGeneralCond))}%` }}
                          />
                        </div>
                      </div>

                      {/* Footer Action */}
                      <div className="pt-2 border-t border-line flex items-center justify-between text-xs font-semibold text-accent group-hover:translate-x-1 transition-transform">
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
              <div className="flex items-center justify-between border-b border-accent/30 pb-2 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-label text-muted">
                    {groupName}
                  </span>
                  <span className="bg-accent/10 border border-accent/30 text-accent text-2xs px-2 py-0.5 rounded-sm font-semibold">
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
                        key={plane.registration} role="button" tabIndex={0} onKeyDown={clickOnKey}
                        onClick={() => setSelectedPlane(plane)}
                        className={`rounded-sm overflow-hidden flex flex-col hover:border-accent/60 transition-all duration-300 group cursor-pointer relative ${
                          critical
                            ? 'bg-bad/10 border border-bad/60 ring-1 ring-bad/40'
                            : 'bg-surface border border-line'
                        }`}
                      >
                        {/* Aircraft Image Box */}
                        <div className="relative w-full aspect-[16/10] bg-ground/60 overflow-hidden border-b border-line">
                          <AircraftImage
                            safeName={safeName}
                            manufacturer={plane.manufacturer}
                            type={plane.type}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-ground via-transparent to-transparent opacity-80 pointer-events-none" />

                          {/* Registration Badge */}
                          <div className="absolute top-2 left-2 bg-ground/80 border border-accent/50 px-2 py-0.5 rounded-sm text-2xs font-semibold text-accent">
                            {plane.registration}
                          </div>

                          {/* Critical Condition Warning Overlay */}
                          {critical ? (
                            <div className="absolute top-2 right-2 bg-bad text-on-accent border border-bad text-2xs font-label font-semibold px-2 py-0.5 rounded-sm uppercase tracking-label flex items-center gap-1">
                              <ShieldAlert size={12} />
                              <span>Critical (&lt;40%)</span>
                            </div>
                          ) : (
                            /* Status Badge */
                            <div className="absolute top-2 right-2">
                              {assignedRoutes.length > 0 ? (
                                <span className="bg-surface border border-line text-ink text-2xs font-label font-semibold px-2 py-0.5 rounded-sm uppercase tracking-label">
                                  {assignedRoutes.length} Route{assignedRoutes.length > 1 ? 's' : ''}
                                </span>
                              ) : (
                                <span className="bg-accent/10 border border-accent/20 text-muted text-2xs font-label font-semibold px-2 py-0.5 rounded-sm uppercase tracking-label">
                                  Idle
                                </span>
                              )}
                            </div>
                          )}

                          {/* Hub Overlay (bottom left of image) */}
                          {plane.hubId && (
                            <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-ground/70 border border-rule px-1.5 py-0.5 rounded-sm text-2xs text-ink">
                              <MapPin size={10} className="text-accent" />
                              <span>{plane.hubId}</span>
                            </div>
                          )}
                        </div>

                        {/* Card Info Body */}
                        <div className="p-3 flex-1 flex flex-col justify-between space-y-3">
                          <div>
                            <div className="text-2xs text-muted uppercase tracking-label font-semibold">
                              {plane.manufacturer}
                            </div>
                            <div className="text-sm font-semibold text-ink group-hover:text-accent transition-colors truncate">
                              {plane.type}
                            </div>
                          </div>

                          {/* Specs Grid */}
                          <div className="grid grid-cols-2 gap-2 text-2xs bg-ground/40 p-2 rounded-sm border border-line">
                            <div>
                              <span className="text-muted block text-2xs uppercase tracking-label">Range</span>
                              <span className="text-ink font-semibold">{plane.maxRange} km</span>
                            </div>
                            <div>
                              <span className="text-muted block text-2xs uppercase tracking-label">Capacity</span>
                              <span className="text-ink font-semibold">{totalPax} pax</span>
                            </div>
                            <div>
                              <span className="text-muted block text-2xs uppercase tracking-label">Satisfaction</span>
                              <span className="text-accent font-semibold">{combinedPlaneSat}%</span>
                            </div>
                            <div>
                              <span className="text-muted block text-2xs uppercase tracking-label">Efficiency</span>
                              <span className="text-ink font-semibold">{plane.efficiency}</span>
                            </div>
                          </div>

                          {/* Condition Indicator Bars */}
                          <div className="space-y-1.5 text-2xs">
                            <div className="flex items-center justify-between">
                              <span className="text-muted">Interior Cond.</span>
                              <span className={CONDITION_TEXT_CLASS[conditionTone(plane.conditionInterior)]}>
                                {Math.round(plane.conditionInterior)}%
                              </span>
                            </div>
                            <div className="h-1 bg-ground rounded-full overflow-hidden">
                              <div
                                className={`h-full ${CONDITION_BAR_CLASS[conditionTone(plane.conditionInterior)]}`}
                                style={{ width: `${Math.max(0, Math.min(100, plane.conditionInterior))}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between pt-0.5">
                              <span className="text-muted">General Cond.</span>
                              <span className={CONDITION_TEXT_CLASS[conditionTone(plane.conditionGeneral)]}>
                                {Math.round(plane.conditionGeneral)}%
                              </span>
                            </div>
                            <div className="h-1 bg-ground rounded-full overflow-hidden">
                              <div
                                className={`h-full ${CONDITION_BAR_CLASS[conditionTone(plane.conditionGeneral)]}`}
                                style={{ width: `${Math.max(0, Math.min(100, plane.conditionGeneral))}%` }}
                              />
                            </div>
                          </div>

                          {/* Quick Actions Footer */}
                          <div className="pt-1 flex items-center justify-between gap-2 border-t border-line">
                            <span className="text-2xs text-muted uppercase tracking-label group-hover:text-accent transition-colors font-semibold">
                              View Details &rarr;
                            </span>
                            {critical ? (
                              <span className="text-bad flex items-center gap-1 text-2xs font-semibold uppercase tracking-label">
                                <ShieldAlert size={12} /> Maintenance Urgent
                              </span>
                            ) : (plane.conditionInterior < 50 || plane.conditionGeneral < 50) && (
                              <span className="text-accent flex items-center gap-1 text-2xs font-semibold">
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
                <div className="overflow-x-auto w-full bg-ground/30 border border-line rounded-sm">
                  <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
                    <thead>
                      <tr className="border-b border-accent/30 text-muted uppercase tracking-label text-2xs bg-surface">
                        <th className="py-3 pl-3 w-16">Image</th>
                        <th className="py-3 pl-3 cursor-pointer hover:text-accent" tabIndex={0} onKeyDown={clickOnKey} onClick={() => toggleSort('registration')}>
                          Reg {getSortIcon('registration')}
                        </th>
                        <th className="py-3 cursor-pointer hover:text-accent" tabIndex={0} onKeyDown={clickOnKey} onClick={() => toggleSort('type')}>
                          Type {getSortIcon('type')}
                        </th>
                        <th className="py-3">Hub</th>
                        <th className="py-3 cursor-pointer hover:text-accent" tabIndex={0} onKeyDown={clickOnKey} onClick={() => toggleSort('maxRange')}>
                          Range {getSortIcon('maxRange')}
                        </th>
                        <th className="py-3">Pax Config</th>
                        <th className="py-3 cursor-pointer hover:text-accent" tabIndex={0} onKeyDown={clickOnKey} onClick={() => toggleSort('efficiency')}>
                          Eff.<InfoTooltip size={11} {...GLOSSARY.efficiency} /> {getSortIcon('efficiency')}
                        </th>
                        <th className="py-3 cursor-pointer hover:text-accent" tabIndex={0} onKeyDown={clickOnKey} onClick={() => toggleSort('popularity')}>
                          Comb. Sat<InfoTooltip size={11} {...GLOSSARY.sat} /> {getSortIcon('popularity')}
                        </th>
                        <th className="py-3 cursor-pointer hover:text-accent" tabIndex={0} onKeyDown={clickOnKey} onClick={() => toggleSort('conditionInterior')}>
                          Int. Cond<InfoTooltip size={11} {...GLOSSARY.conditionInterior} /> {getSortIcon('conditionInterior')}
                        </th>
                        <th className="py-3 cursor-pointer hover:text-accent" tabIndex={0} onKeyDown={clickOnKey} onClick={() => toggleSort('conditionGeneral')}>
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
                            key={plane.registration} tabIndex={0} onKeyDown={clickOnKey}
                            onClick={() => setSelectedPlane(plane)}
                            className={`border-b transition-colors cursor-pointer ${
                              critical
                                ? 'bg-bad/10 border-bad/40 hover:bg-bad/15 text-bad font-medium'
                                : 'border-line hover:bg-raised text-muted'
                            }`}
                          >
                            <td className="py-2 pl-3">
                              <div className="w-12 h-8 rounded-sm bg-ground/60 border border-line overflow-hidden relative">
                                <AircraftImage
                                  safeName={safeName}
                                  manufacturer={plane.manufacturer}
                                  type={plane.type}
                                  className="w-full h-full object-cover"
                                />
                                {critical && (
                                  <div className="absolute inset-0 bg-surface border border-line animate-pulse pointer-events-none" />
                                )}
                              </div>
                            </td>
                            <td className="py-3 pl-3 font-semibold">
                              <span className={critical ? 'text-bad flex items-center gap-1 font-semibold' : 'text-accent'}>
                                {critical && <ShieldAlert size={13} className="" />}
                                {plane.registration}
                              </span>
                            </td>
                            <td className="py-3 text-ink">{plane.manufacturer} {plane.type}</td>
                            <td className="py-3">{plane.hubId || <span className="text-muted text-2xs">None</span>}</td>
                            <td className="py-3">{plane.maxRange} km</td>
                            <td className="py-3 whitespace-nowrap">
                              {totalPax} ({plane.config.first}/{plane.config.business}/{plane.config.premium}/{plane.config.economy})
                            </td>
                            <td className="py-3">{plane.efficiency}</td>
                            <td className="py-3 font-semibold text-accent">{combinedPlaneSat}%</td>
                            <td className="py-3">
                              <span className={CONDITION_TEXT_CLASS[conditionTone(plane.conditionInterior)]}>
                                {Math.round(plane.conditionInterior)}%
                              </span>
                            </td>
                            <td className="py-3">
                              <span className={CONDITION_TEXT_CLASS[conditionTone(plane.conditionGeneral)]}>
                                {Math.round(plane.conditionGeneral)}%
                              </span>
                            </td>
                            <td className="py-3">
                              {critical ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-2xs font-semibold bg-raised text-ink uppercase tracking-label">
                                  <ShieldAlert size={10} /> Maintenance Urgent
                                </span>
                              ) : assignedRoutes.length > 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-2xs font-semibold bg-surface text-ink border border-line uppercase tracking-label">
                                  {assignedRoutes.length} Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-2xs font-semibold bg-accent/10 text-muted border border-accent/20 uppercase tracking-label">
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
        <div className="fixed inset-0 bg-ground/80 z-50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" className="bg-surface border border-accent/40 rounded-sm max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-appear fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 bg-ground/60 border-b border-line flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-16 h-10 rounded-sm bg-ground border border-accent/30 overflow-hidden shrink-0">
                  <AircraftImage
                    safeName={(selectedModel.manufacturer + ' ' + selectedModel.type).split('/').join('-').split('\\').join('-')}
                    manufacturer={selectedModel.manufacturer}
                    type={selectedModel.type}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="font-label text-lg font-semibold text-ink">
                    {selectedModel.manufacturer} {selectedModel.type}
                  </h3>
                  <p className="text-xs text-muted">
                    Showing all {selectedModel.items.length} owned aircraft of this model
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedModel(null)}
                className="p-1.5 text-muted hover:text-ink hover:bg-raised rounded-sm transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body - List of Aircraft */}
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedModel.items.map((plane) => {
                  const assignedRoutes = routesByAircraft[plane.registration] || [];
                  const combinedPlaneSat = getPlaneSat(plane);
                  const totalPax = plane.config.first + plane.config.business + plane.config.premium + plane.config.economy;
                  const critical = isAlertCondition(plane);

                  return (
                    <div
                      key={plane.registration} role="button" tabIndex={0} onKeyDown={clickOnKey}
                      onClick={() => setSelectedPlane(plane)}
                      className={`border rounded-sm p-3 flex flex-col justify-between cursor-pointer transition-all group ${
                        critical
                          ? 'bg-bad/10 border-bad/50 hover:border-bad'
                          : 'bg-ground/50 border-line hover:border-accent/60 hover:bg-raised'
                      }`}
                    >
                      {critical && (
                        <div className="bg-bad/10 border border-bad/40 text-bad text-2xs font-semibold px-2 py-1 rounded-sm mb-2 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <ShieldAlert size={12} className=" text-bad" />
                            CRITICAL CONDITION (&lt;40%)
                          </span>
                          <span className="uppercase text-2xs font-semibold">Maintenance Urgent</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between border-b border-line pb-2 mb-2">
                        <div>
                          <span className={`text-sm font-semibold block ${critical ? 'text-bad font-semibold' : 'text-accent'}`}>
                            {plane.registration}
                          </span>
                          <span className="text-2xs text-muted">
                            Hub: {plane.hubId || 'Unassigned'}
                          </span>
                        </div>
                        {assignedRoutes.length > 0 ? (
                          <span className="bg-surface text-ink border border-line text-2xs font-semibold px-2 py-0.5 rounded-sm uppercase">
                            {assignedRoutes.length} Route{assignedRoutes.length > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="bg-accent/10 text-muted border border-accent/20 text-2xs font-semibold px-2 py-0.5 rounded-sm uppercase">
                            Idle
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-muted mb-3">
                        <div>
                          <span className="text-muted block text-2xs">PAX Config:</span>
                          <span>{totalPax} ({plane.config.first}/{plane.config.business}/{plane.config.premium}/{plane.config.economy})</span>
                        </div>
                        <div>
                          <span className="text-muted block text-2xs">Satisfaction:</span>
                          <span className="font-semibold text-accent">{combinedPlaneSat}%</span>
                        </div>
                        <div>
                          <span className="text-muted block text-2xs">Interior Cond.:</span>
                          <span className={CONDITION_TEXT_CLASS[conditionTone(plane.conditionInterior)]}>
                            {Math.round(plane.conditionInterior)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-muted block text-2xs">General Cond.:</span>
                          <span className={CONDITION_TEXT_CLASS[conditionTone(plane.conditionGeneral)]}>
                            {Math.round(plane.conditionGeneral)}%
                          </span>
                        </div>
                      </div>

                      <div className="text-2xs font-semibold text-accent group-hover:text-accent flex items-center justify-end gap-1 pt-2 border-t border-line">
                        <span>Inspect Aircraft</span>
                        <ChevronRight size={14} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-ground/60 border-t border-line flex justify-end">
              <button
                onClick={() => setSelectedModel(null)}
                className="bg-raised hover:bg-raised text-ink font-semibold text-xs uppercase px-4 py-2 rounded-sm transition-colors"
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
          airlineCode={airlineCode}
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
          fleet={fleet}
          allRoutes={routes}
          airportManagement={airportManagement}
          onReassignRoutes={onReassignRoutes}
        />
      )}
    </div>
  );
}

/**
 * Memoised: this view stays mounted while App re-renders for unrelated state
 * (messages, dialogs, settings), and it only needs to redraw when its own
 * props change. App passes stable callbacks for exactly this reason.
 */
export const MyFleetView = React.memo(MyFleetViewImpl);
