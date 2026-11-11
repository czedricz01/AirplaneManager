import { takeoverQuote } from '../lib/takeover';
import { SALE_TO_LIQUIDATION_MONTHS } from '../lib/aiSimulation';
import { Button } from './ui/Button';
import React, { useState, useMemo } from 'react';
import { formatCurrency, formatNumber, formatSignedCurrency } from '../lib/format';
import { useTapReveal } from './ui/useTapReveal';
import { aiMonthlySubsidy } from '../lib/aiSimulation';
import {
  Search,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Plane,
  Waypoints,
  Award,
  ArrowLeft,
  Activity,
  Shield,
  Coins,
  MapPin,
  PieChart
} from 'lucide-react';
import { ViewHeader } from './ui/ViewHeader';
import { Badge } from './ui/Badge';
import { PERSONALITY_META, type AiPersonality } from '../lib/theme';

export interface AiAirline {
  id: string;
  name: string;
  code: string;
  hub: string;
  capital: number;
  aiDifficulty: 'Easy' | 'Normal' | 'Hard';
  fleet: {
    id: string;
    manufacturer: string;
    family: string;
    type: string;
    class: 'regional' | 'narrowbody' | 'widebody';
    reg: string;
    maxRange?: number;
    capacity?: number;
    basePrice?: number;
    popularity?: number;
    efficiency?: number;
    cruiseSpeed?: number;
    purchasedAt?: number;
    conditionInterior?: number;
    conditionGeneral?: number;
    config?: { economy: number, premium: number, business: number, first: number };
    /** Month offset since which the aircraft has had no route. */
    idleSince?: number;
  }[];
  routes: {
    origin: string;
    destination: string;
    aircraftClass: 'regional' | 'narrowbody' | 'widebody';
    departures: number;
    monthlyProfit: number;
    distance?: number;
    durMin?: number;
    aircraftReg?: string;
    aircraft?: string;
    /** Month offset the route opened; absent on routes from older saves. */
    openedAt?: number;
    /** Smoothed monthly profit the airline judges the route by. */
    avgProfit?: number;
    /** Share of seats sold last month, 0 to 1. Absent until the route has flown. */
    loadFactor?: number;
    /**
     * Weekly departures before a crisis cut the schedule; the level the route
     * is rebuilt to when the crisis is over. Absent when nothing was cut.
     */
    fullDepartures?: number;
    /**
     * Fares cut by this share (0-0.2) to take passengers from the player on a
     * shared city pair; see simulateAiAirlinesTurn. Absent in normal times.
     */
    priceCut?: number;
  }[];
  monthlyProfitsHistory: number[];
  /** A second hub, opened once the airline is big enough; routes start from both. */
  secondHub?: string;
  /** Months in a row the airline has been in financial distress; 0 or absent when it is sound. */
  distressMonths?: number;
  /** The airline is in distress and can be taken over; it is wound up if nobody does. */
  forSale?: boolean;
  /** The month it was put up for sale. */
  forSaleSince?: number;
  personality?: 'flag' | 'lcc' | 'expansionist' | 'optimizer' | 'boutique';
  aggression?: number;
  /** A real-world carrier (true) or an invented one (false). */
  isReal?: boolean;
  /** #RRGGBB colour on the map. Assigned at founding, or when an older save loads. */
  color?: string;
}

interface Props {
  aiAirlines: AiAirline[];
  playerCapital: number;
  playerAirlineName: string;
  playerAirlineCode: string;
  playerHub: string;
  playerFleet?: any[];
  playerRoutes?: any[];
  /** The player's own closed months, oldest first. */
  playerProfitHistory?: number[];
  /** Last closed month's profit per player route id. */
  playerRouteProfits?: Record<string, number>;
  /** The player's brand colour, for the colour dot beside each airline. */
  playerColor?: string;
  /** The month shown, for the size of the rivals' subsidy. */
  currentDateOffset?: number;
  /** The player's rank, which decides whether a takeover is allowed. */
  rank?: number;
  /** Buys the rival with this id; the game checks the rank and the cash again. */
  onTakeover?: (aiId: string) => void;
}

type SortField = 'rank' | 'name' | 'capital' | 'fleet' | 'routes';

// Stable defaults, so a missing prop does not invalidate the memos on every render.
const NONE: any[] = [];

const dash = '-';
type SortDir = 'asc' | 'desc';

function CompetitorsViewImpl({ 
  aiAirlines, 
  playerCapital, 
  playerAirlineName, 
  playerAirlineCode, 
  playerHub,
  playerFleet = NONE,
  playerRoutes = NONE,
  playerProfitHistory = NONE,
  playerRouteProfits,
  playerColor,
  currentDateOffset = 0,
  rank = 0,
  onTakeover
}: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>('capital');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedAirlineId, setSelectedAirlineId] = useState<string | null>(null);
  // The profit bar last tapped on a touch screen, whose value is shown for a moment.
  const [tappedBar, onBarTap] = useTapReveal<number>();

  // Player and AI airlines in one list. Only real figures: where the game has no
  // number for something, the screen shows "-" rather than a made-up value.
  const allAirlines = useMemo(() => {
    const fleetByRegistration = new Map<string, any>(playerFleet.map(f => [f.registration, f]));
    const pFleet = playerFleet.map(f => {
      const seats = f.config ? (f.config.economy || 0) + (f.config.premium || 0) + (f.config.business || 0) + (f.config.first || 0) : 0;
      return {
        id: f.id,
        manufacturer: f.manufacturer,
        family: f.family,
        type: f.type,
        model: f.type,
        class: String(f.class || '').toLowerCase() as 'regional' | 'narrowbody' | 'widebody',
        reg: f.registration,
        maxRange: f.maxRange as number | undefined,
        capacity: (seats || f.capacity) as number | undefined,
        basePrice: f.basePrice as number | undefined,
        efficiency: f.efficiency as number | undefined,
        conditionGeneral: f.conditionGeneral as number | undefined
      };
    });

    const pRoutes = playerRoutes.map(r => ({
      origin: r.origin,
      destination: r.destination,
      // The class of the aircraft actually flying it; this was "narrowbody" for
      // every player route, and the profit was always 0.
      aircraftClass: String(fleetByRegistration.get(r.aircraft)?.class || '').toLowerCase() as 'regional' | 'narrowbody' | 'widebody',
      departures: r.schedule?.length || 0,
      monthlyProfit: playerRouteProfits?.[r.id] as number | undefined,
      distance: r.distance as number | undefined,
      durMin: r.durMin as number | undefined,
      aircraftReg: r.aircraft || ''
    }));

    return [
      {
        id: 'player_airline',
        name: playerAirlineName || "Neo Airlines",
        code: playerAirlineCode || "NX",
        hub: playerHub || "FRA",
        color: playerColor,
        capital: playerCapital,
        aiDifficulty: 'Player' as any,
        // The player has no AI strategy profile. Declaring the fields keeps this
        // entry the same shape as the AI ones, so the detail panel can read them
        // off the union and fall back to "Independent" / 5 on its own.
        personality: undefined as AiPersonality | undefined,
        aggression: undefined as number | undefined,
        secondHub: undefined as string | undefined,
        forSale: undefined as boolean | undefined,
        forSaleSince: undefined as number | undefined,
        fleet: pFleet,
        routes: pRoutes,
        isPlayer: true,
        // The player's real closed months. This used to be three numbers
        // derived from current capital, so the chart moved with the bank
        // balance and never showed an actual loss.
        monthlyProfitsHistory: playerProfitHistory
      },
      ...aiAirlines.map(ai => ({
        ...ai,
        fleet: ai.fleet.map((f: any) => ({
          ...f,
          model: f.type || f.model,
          class: f.class.toLowerCase() as 'regional' | 'narrowbody' | 'widebody'
        })),
        routes: ai.routes.map((r: any) => ({
          ...r,
          aircraftClass: r.aircraftClass.toLowerCase() as 'regional' | 'narrowbody' | 'widebody'
        })),
        isPlayer: false
      }))
    ];
  }, [aiAirlines, playerCapital, playerAirlineName, playerAirlineCode, playerHub, playerFleet, playerRoutes, playerRouteProfits, playerProfitHistory, playerColor]);

  // Rank by capital over everyone. It used to be the row index after sorting
  // and searching, so sorting by name or typing in the search box re-ranked.
  const rankById = useMemo(() => {
    const byCapital = [...allAirlines].sort((a, b) => b.capital - a.capital);
    return new Map(byCapital.map((a, i) => [a.id, i + 1]));
  }, [allAirlines]);

  // Weekly departures of everyone, for a market share that is actually computed.
  const totalMarketDepartures = useMemo(
    () => allAirlines.reduce((sum, a) => sum + (a.routes as { departures: number }[]).reduce((s, r) => s + (r.departures || 0), 0), 0),
    [allAirlines]
  );

  const leaderboard = useMemo(() => {
    let filtered = allAirlines;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(lower) ||
        item.code.toLowerCase().includes(lower) ||
        item.hub.toLowerCase().includes(lower)
      );
    }

    return [...filtered].sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      switch(sortField) {
        case 'name':
          valA = a.name;
          valB = b.name;
          break;
        case 'fleet':
          valA = a.fleet.length;
          valB = b.fleet.length;
          break;
        case 'routes':
          valA = a.routes.length;
          valB = b.routes.length;
          break;
        default: // capital, and rank, which is based on capital
          valA = a.capital;
          valB = b.capital;
          break;
      }

      if (typeof valA === 'string') {
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return sortDir === 'asc' ? valA - valB : valB - valA;
      }
    });
  }, [allAirlines, searchTerm, sortField, sortDir]);

  // Find currently selected airline details
  const selectedAirline = useMemo(() => {
    if (!selectedAirlineId) return null;
    const found = allAirlines.find(a => a.id === selectedAirlineId);
    if (!found) return null;

    const regionalCount = found.fleet.filter(f => f.class === 'regional').length;
    const narrowbodyCount = found.fleet.filter(f => f.class === 'narrowbody').length;
    const widebodyCount = found.fleet.filter(f => f.class === 'widebody').length;

    // `found.routes` is a union of the player and AI route shapes, so the
    // accumulator has to be annotated for TypeScript to pick the numeric overload.
    const routeList: { departures: number }[] = found.routes;
    const totalWeeklyDepartures = routeList.reduce((sum, r) => sum + (r.departures || 0), 0);
    const history = found.monthlyProfitsHistory || [];

    return {
      ...found,
      stats: {
        regionalCount,
        narrowbodyCount,
        widebodyCount,
        totalWeeklyDepartures,
        marketShare: totalMarketDepartures > 0 ? totalWeeklyDepartures / totalMarketDepartures : 0,
        lastProfit: history.length > 0 ? history[history.length - 1] : null
      }
    };
  }, [selectedAirlineId, allAirlines, totalMarketDepartures]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ChevronUp size={12} className="inline ml-1 text-accent" /> : <ChevronDown size={12} className="inline ml-1 text-accent" />;
  };


  return (
    <div className="w-full h-full text-ink px-3 py-3 lg:px-4 lg:py-4 short:py-1.5 flex flex-col font-sans overflow-hidden relative">
      {selectedAirline ? (
        /* Immersive Individual Airline Detail Overview Dashboard */
        <div className="flex-1 flex flex-col overflow-hidden animate-fadeIn">
          {/* Header Action bar */}
          {/* Phones: the subtitle and the alliance badge step aside, the name
              gets the width. */}
          <div className="flex items-center justify-between border-b border-line pb-5 bar:pb-3 short:pb-2 mb-3 short:mb-2 shrink-0 gap-3">
            <div className="flex items-center gap-4 bar:gap-3 min-w-0">
              <button 
                onClick={() => setSelectedAirlineId(null)}
                className="p-2.5 rounded-sm border border-line bg-surface text-muted hover:text-accent hover:border-accent/50 transition-all flex items-center justify-center cursor-pointer"
                title="Back to Leaderboard"
                style={{ width: '44px', height: '44px' }}
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  {selectedAirline.color && (
                    <span
                      className="inline-block w-3.5 h-3.5 rounded-full shrink-0 border border-ground"
                      style={{ backgroundColor: selectedAirline.color }}
                      title="Map colour"
                    />
                  )}
                  <h3 className="text-2xl bar:text-lg short:text-lg font-mono font-semibold text-ink leading-none">
                    {selectedAirline.name}
                  </h3>
                  <span className="text-xs font-label font-semibold text-accent border border-accent/30 bg-accent/5 px-2 py-0.5 rounded-sm uppercase">
                    IATA: {selectedAirline.code}
                  </span>
                </div>
                <p className="text-xs text-muted font-label uppercase tracking-label mt-1 bar:hidden short:hidden">
                  Corporate Overview & Strategic Air Intelligence
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 font-mono text-xs bar:hidden short:shrink-0">
              <span className="text-white/30 lowercase short:hidden">alliance status:</span>
              <span className={`px-2.5 py-1 text-2xs font-semibold uppercase tracking-label rounded-sm ${
                selectedAirline.isPlayer 
                  ? 'bg-accent text-on-accent' 
                  : 'bg-raised text-ink border border-rule'
              }`}>
                {selectedAirline.isPlayer ? 'PROTAGONIST' : 'RIVAL CARRIER'}
              </span>
            </div>
          </div>

          {/* Core Dashboard Workspace */}
          <div className="flex-1 overflow-y-auto pr-2 space-y-6 bar:space-y-3 short:space-y-3">
            
            {/* Top Quick-Glance Bento Grid cards. Phones: two a row upright, all
                four in one row sideways, each only as tall as its content. */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 bar:grid-cols-2 short:grid-cols-4 gap-4 bar:gap-2 short:gap-2">
              {/* Card 1: Capital valuation */}
              <div className="bg-surface border border-line p-5 bar:p-3 short:p-2.5 rounded-sm relative overflow-hidden flex flex-col justify-between bar:gap-1.5 short:gap-1 h-[115px] bar:h-auto short:h-auto">
                <div className="flex justify-between items-start">
                  <span className="text-muted font-label text-2xs uppercase tracking-label font-semibold">Capital Reserves</span>
                  <Coins size={16} className="text-accent opacity-80" />
                </div>
                <div>
                  <div className="text-2xl bar:text-lg short:text-lg font-mono font-semibold text-ink">{formatCurrency(selectedAirline.capital)}</div>
                  <div className="text-2xs text-accent font-mono flex items-center gap-1 mt-1">
                    <TrendingUp size={10} /> Active Liquidity Index
                  </div>
                </div>
                <div className="absolute right-0 bottom-0 w-24 h-24 bg-accent/[0.01] rounded-full filter pointer-events-none" />
              </div>

              {/* Card 2: Fleet capacity */}
              <div className="bg-surface border border-line p-5 bar:p-3 short:p-2.5 rounded-sm relative overflow-hidden flex flex-col justify-between bar:gap-1.5 short:gap-1 h-[115px] bar:h-auto short:h-auto">
                <div className="flex justify-between items-start">
                  <span className="text-muted font-label text-2xs uppercase tracking-label font-semibold">Appraised Fleet</span>
                  <Plane size={16} className="text-accent opacity-80" />
                </div>
                <div>
                  <div className="text-2xl bar:text-lg short:text-lg font-mono font-semibold text-ink">
                    {selectedAirline.fleet.length} <span className="text-xs text-muted font-sans font-normal">Aircraft</span>
                  </div>
                  <div className="text-2xs text-muted font-mono mt-1">
                    {selectedAirline.stats.regionalCount} Reg | {selectedAirline.stats.narrowbodyCount} Nb | {selectedAirline.stats.widebodyCount} Wb
                  </div>
                </div>
              </div>

              {/* Card 3: Route network */}
              <div className="bg-surface border border-line p-5 bar:p-3 short:p-2.5 rounded-sm relative overflow-hidden flex flex-col justify-between bar:gap-1.5 short:gap-1 h-[115px] bar:h-auto short:h-auto">
                <div className="flex justify-between items-start">
                  <span className="text-muted font-label text-2xs uppercase tracking-label font-semibold">Active Connections</span>
                  <Waypoints size={16} className="text-accent opacity-80" />
                </div>
                <div>
                  <div className="text-2xl bar:text-lg short:text-lg font-mono font-semibold text-ink">
                    {selectedAirline.routes.length} <span className="text-xs text-muted font-sans font-normal">Routes</span>
                  </div>
                  <div className="text-2xs text-muted font-mono mt-1">
                    {selectedAirline.stats.totalWeeklyDepartures} Departures per week
                  </div>
                </div>
              </div>

              {/* Card 4: Operating Hub & Level */}
              <div className="bg-surface border border-line p-5 bar:p-3 short:p-2.5 rounded-sm relative overflow-hidden flex flex-col justify-between bar:gap-1.5 short:gap-1 h-[115px] bar:h-auto short:h-auto">
                <div className="flex justify-between items-start">
                  <span className="text-muted font-label text-2xs uppercase tracking-label font-semibold">Strategic Hub Base</span>
                  <MapPin size={16} className="text-accent opacity-80" />
                </div>
                <div>
                  <div className="text-2xl bar:text-lg short:text-lg font-mono font-semibold text-accent">
                    {selectedAirline.hub}
                    {!selectedAirline.isPlayer && selectedAirline.secondHub && <span className="text-base text-muted"> + {selectedAirline.secondHub}</span>}
                  </div>
                  <div className="text-2xs text-muted font-mono mt-1 flex items-center gap-1.5">
                    <Shield size={10} className="text-muted" /> Operating Tier: {selectedAirline.isPlayer ? 'Player' : selectedAirline.aiDifficulty}
                  </div>
                </div>
              </div>
            </div>

            {!selectedAirline.isPlayer && (selectedAirline.forSale || onTakeover) && (() => {
              const quote = takeoverQuote(selectedAirline as any, rank);
              const forSale = !!selectedAirline.forSale;
              const affordable = playerCapital >= quote.price;
              const monthsLeft = forSale && selectedAirline.forSaleSince !== undefined
                ? Math.max(0, SALE_TO_LIQUIDATION_MONTHS - (currentDateOffset - selectedAirline.forSaleSince))
                : null;
              return (
                <div className={`border p-4 rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${forSale ? 'border-accent/40 bg-accent/5' : 'border-line bg-surface'}`}>
                  <div className="font-mono text-2xs leading-relaxed max-w-xl">
                    <div className={`font-semibold uppercase tracking-label text-xs mb-1 ${forSale ? 'text-accent' : 'text-muted'}`}>
                      {forSale ? 'For sale: insolvent' : 'Takeover bid'}
                    </div>
                    <div className="text-muted">
                      {forSale
                        ? `Wound up in ${monthsLeft} month${monthsLeft === 1 ? '' : 's'} if nobody buys it. `
                        : 'A healthy airline costs two and a half times as much. '}
                      You get its {quote.aircraft} aircraft and its slots at {selectedAirline.hub}; its {quote.routes} route{quote.routes === 1 ? ' is' : 's are'} not
                      taken over, and the competitor is gone.
                    </div>
                    {quote.blocked && <div className="text-bad mt-1">{quote.blocked}</div>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="font-mono text-lg font-semibold">{formatCurrency(quote.price)}</span>
                    <Button
                      variant="primary"
                      disabled={!onTakeover || !!quote.blocked || !affordable}
                      onClick={() => onTakeover?.(selectedAirline.id)}
                    >
                      {affordable || quote.blocked ? 'Take over' : 'Not enough cash'}
                    </Button>
                  </div>
                </div>
              );
            })()}

            {/* In-depth Analytical Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              
              {/* Left Column (8-wide): Fleet List & Route details */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Visual Section: Strategic Connections list */}
                <div className="bg-surface border border-line rounded-sm p-4">
                  <div className="flex items-center justify-between border-b border-line pb-4 mb-4">
                    <h4 className="text-xs font-label font-semibold text-accent uppercase tracking-label flex items-center gap-2">
                      <Waypoints size={14} /> Global Route Intelligence Network
                    </h4>
                    <span className="text-2xs text-muted font-mono">
                      Hub Origin: <strong className="text-ink">{selectedAirline.hub}</strong>
                    </span>
                  </div>

                  <div className="space-y-3 font-mono">
                    {selectedAirline.routes.length === 0 ? (
                      <div className="p-12 text-center bg-ground/25 border border-line rounded-sm text-muted uppercase tracking-label text-xs">
                        This airline is restructuring its flight routes. No active routes currently scheduled.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {selectedAirline.routes.map((route, rIndex) => {
                          const routeDistance = route.distance ? `${formatNumber(route.distance)} km` : dash;
                          const routeDuration = route.durMin
                            ? `${Math.floor(route.durMin / 60)}h ${(route.durMin % 60).toString().padStart(2, '0')}m`
                            : dash;
                          const profit = route.monthlyProfit;
                          return (
                            <div key={rIndex} className="bg-ground/35 border border-line p-4 rounded-sm hover:border-line transition-all flex flex-col justify-between">
                              <div>
                                <div className="flex justify-between items-start mb-2">
                                  <span className="font-sans font-semibold text-base text-ink flex items-center gap-2">
                                    {route.origin} <span className="text-accent font-semibold">↔</span> {route.destination}
                                  </span>
                                  <span className="px-2 py-0.5 bg-surface border border-line text-2xs rounded-sm font-label text-muted uppercase font-semibold">
                                    {route.aircraftClass || dash}
                                  </span>
                                </div>
                                <div className="text-2xs text-muted space-y-1 mt-3">
                                  <div className="flex justify-between">
                                    <span>Weekly Departures:</span>
                                    <strong className="text-ink font-mono">{route.departures} flights</strong>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Sector Distance:</span>
                                    <strong className="text-ink font-mono">{routeDistance}</strong>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Flight Duration:</span>
                                    <strong className="text-ink font-mono">{routeDuration}</strong>
                                  </div>
                                  {route.aircraftReg && (
                                    <div className="flex justify-between">
                                      <span>Assigned Airframe:</span>
                                      <strong className="text-accent font-mono">{route.aircraftReg}</strong>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="border-t border-line pt-3 mt-4 flex justify-between items-center bg-surface -mx-4 -mb-4 p-4 rounded-b-sm">
                                <span className="text-2xs uppercase tracking-label text-muted font-semibold font-label">Last month</span>
                                {/* The real result, with its sign. A missing one used to
                                    become an average or a fixed $380,420, always as a gain. */}
                                <span className={`font-mono font-semibold block text-sm ${profit === undefined || !Number.isFinite(profit) ? 'text-muted' : profit >= 0 ? 'text-good' : 'text-bad'}`}>
                                  {profit === undefined || !Number.isFinite(profit) ? dash : `${formatSignedCurrency(profit)}/mo`}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Aircraft Fleet registry details */}
                <div className="bg-surface border border-line rounded-sm p-4">
                  <div className="flex items-center justify-between border-b border-line pb-4 mb-4">
                    <h4 className="text-xs font-label font-semibold text-accent uppercase tracking-label flex items-center gap-2">
                      <Plane size={14} /> Strategic Aircraft Registry
                    </h4>
                    <span className="text-2xs text-muted font-mono">
                      Active Fleet Size: <strong className="text-ink">{selectedAirline.fleet.length}</strong>
                    </span>
                  </div>

                  <div className="space-y-2 font-mono">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {selectedAirline.fleet.map((plane, pIdx) => {
                        const airframe = Number.isFinite(plane.conditionGeneral) ? Math.round(plane.conditionGeneral as number) : null;
                        return (
                          <div key={pIdx} className="bg-ground/35 border border-line p-4 rounded-sm flex flex-col justify-between font-sans">
                            <div>
                              <div className="flex justify-between items-start">
                                <div>
                                  <strong className="text-sm font-semibold text-ink block leading-none">
                                    {plane.manufacturer || ''} {plane.model}
                                  </strong>
                                  <span className="font-label text-2xs text-accent mt-1.5 inline-block uppercase tracking-label">
                                    {plane.class} specs
                                  </span>
                                </div>
                                <span className="font-label text-2xs text-accent bg-accent/10 px-2 py-0.5 border border-accent/20 rounded-sm font-semibold uppercase tracking-label">
                                  {plane.reg}
                                </span>
                              </div>

                              <div className="mt-4 space-y-1.5 font-mono text-2xs text-muted border-t border-line pt-3">
                                <div className="flex justify-between">
                                  <span>Seats Capacity:</span>
                                  <strong className="text-ink">{plane.capacity ? `${plane.capacity} seats` : dash}</strong>
                                </div>
                                <div className="flex justify-between">
                                  <span>Service Range:</span>
                                  <strong className="text-ink">{plane.maxRange ? `${formatNumber(plane.maxRange)} km` : dash}</strong>
                                </div>
                                <div className="flex justify-between">
                                  <span>Fuel efficiency:</span>
                                  <strong className="text-accent">{plane.efficiency !== undefined ? `${plane.efficiency} / 100` : dash}</strong>
                                </div>
                                <div className="flex justify-between">
                                  <span>Value Appraisal:</span>
                                  <strong className="text-ink">{plane.basePrice ? formatCurrency(plane.basePrice) : dash}</strong>
                                </div>
                              </div>
                            </div>
                            <div className="mt-4 border-t border-line pt-2.5 flex justify-between items-center text-2xs text-muted font-mono">
                              <span>Airframe condition</span>
                              <span className={`font-semibold ${airframe === null ? 'text-muted' : airframe < 40 ? 'text-bad' : 'text-accent'}`}>{airframe === null ? dash : `${airframe}%`}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column (4-wide): Financial intelligence, trend charts and fleet distribution */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Fleet Class Market distribution */}
                <div className="bg-surface border border-line rounded-sm p-4">
                  <h4 className="text-xs font-label font-semibold text-accent uppercase tracking-label border-b border-line pb-4 mb-5 flex items-center gap-2">
                    <PieChart size={14} /> Capacity Distribution
                  </h4>

                  {/* Dynamic Custom Bars in the exact Yellow and Anthracite colorway */}
                  <div className="space-y-4 font-mono text-xs">
                    <div>
                      <div className="flex justify-between text-2xs mb-1">
                        <span className="text-muted">Widebody Transcontinental</span>
                        <strong className="text-ink font-semibold">{selectedAirline.stats.widebodyCount}</strong>
                      </div>
                      <div className="w-full bg-ground/40 h-2 rounded-full border border-line overflow-hidden">
                        <div 
                          className="bg-accent h-full transition-all duration-1000" 
                          style={{ width: `${selectedAirline.fleet.length > 0 ? (selectedAirline.stats.widebodyCount / selectedAirline.fleet.length) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-2xs mb-1">
                        <span className="text-muted">Narrowbody Medium-Haul</span>
                        <strong className="text-ink font-semibold">{selectedAirline.stats.narrowbodyCount}</strong>
                      </div>
                      <div className="w-full bg-ground/40 h-2 rounded-full border border-line overflow-hidden">
                        <div 
                          className="bg-accent/80 h-full transition-all duration-1000" 
                          style={{ width: `${selectedAirline.fleet.length > 0 ? (selectedAirline.stats.narrowbodyCount / selectedAirline.fleet.length) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-2xs mb-1">
                        <span className="text-muted">Regional Short-Haul</span>
                        <strong className="text-ink font-semibold">{selectedAirline.stats.regionalCount}</strong>
                      </div>
                      <div className="w-full bg-ground/40 h-2 rounded-full border border-line overflow-hidden">
                        <div 
                          className="bg-accent/30 h-full transition-all duration-1000" 
                          style={{ width: `${selectedAirline.fleet.length > 0 ? (selectedAirline.stats.regionalCount / selectedAirline.fleet.length) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quaterly simulated performance timeline overview */}
                <div className="bg-surface border border-line rounded-sm p-4">
                  <h4 className="text-xs font-label font-semibold text-accent uppercase tracking-label border-b border-line pb-4 mb-4 flex items-center gap-2">
                    <Activity size={14} /> Yield & Profit Trends
                  </h4>

                  <div className="space-y-4 font-mono">
                    <div className="text-2xs text-muted mb-2 uppercase leading-snug">
                      Recent timeline of net monthly operation margins:
                    </div>
                    
                    {/* No invented placeholder series here: an airline that has
                        not closed a month yet simply says so. */}
                    {(selectedAirline.monthlyProfitsHistory || []).length === 0 ? (
                      <div className="h-28 flex items-center justify-center bg-ground/25 border border-line rounded-sm text-2xs uppercase tracking-label text-muted">
                        No month closed yet
                      </div>
                    ) : (
                    <div className="h-28 flex items-end justify-between gap-2.5 px-2 pt-4 bg-ground/25 border border-line rounded-sm">
                      {(selectedAirline.monthlyProfitsHistory || []).slice(-12).map((val, idx) => {
                        const shown = (selectedAirline.monthlyProfitsHistory || []).slice(-12);
                        const maxValue = Math.max(...shown.map(Math.abs), 1000000);
                        const progressHeight = Math.max(10, Math.min(100, (Math.abs(val) / maxValue) * 100));
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end" onPointerUp={onBarTap(idx)}>
                            {/* Value tooltip: on hover, or after a tap on a touch screen. */}
                            <div className={`absolute bottom-full mb-1 ${tappedBar === idx ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity bg-ink text-on-accent text-2xs px-1 rounded-sm pointer-events-none whitespace-nowrap z-10 font-semibold`}>
                              {formatCurrency(val)}
                            </div>
                            <div 
                              className={`w-full rounded-t-sm transition-all duration-500 hover:bg-accent cursor-pointer ${
                                val < 0 ? 'bg-bad/70' : idx === shown.length - 1 ? 'bg-accent' : 'bg-raised'
                              }`} 
                              style={{ height: `${progressHeight}%` }}
                            />
                            <span className="text-2xs text-muted font-mono mt-1 mt-1 font-semibold">M{idx+1}</span>
                          </div>
                        );
                      })}
                    </div>
                    )}

                    {!selectedAirline.isPlayer && (
                      <div className="text-2xs text-muted uppercase leading-snug">
                        AI results include a fixed operating subsidy of {formatCurrency(aiMonthlySubsidy(currentDateOffset))} per month.
                      </div>
                    )}

                    <div className="space-y-1 text-xs border-t border-line pt-3">
                      <div className="flex justify-between text-2xs">
                        <span className="text-muted">Last month:</span>
                        {selectedAirline.stats.lastProfit === null ? (
                          <span className="text-muted font-semibold uppercase tracking-label">No month closed yet</span>
                        ) : (
                          <span className={`font-semibold uppercase tracking-label ${selectedAirline.stats.lastProfit >= 0 ? 'text-good' : 'text-bad'}`}>
                            {selectedAirline.stats.lastProfit >= 0 ? 'Profitable' : 'Loss-making'} ({formatSignedCurrency(selectedAirline.stats.lastProfit)})
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between text-2xs mt-1">
                        <span className="text-muted">Share of weekly departures:</span>
                        <strong className="text-ink font-semibold">{formatNumber(selectedAirline.stats.marketShare * 100, 1)}%</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Threat assessment Intelligence Report */}
                <div className="bg-surface border border-line rounded-sm p-4 space-y-4">
                  <h4 className="text-xs font-label font-semibold text-ink uppercase tracking-label border-b border-line pb-4 flex items-center gap-2">
                    <Shield size={14} className="text-accent" /> Strategic Assessment
                  </h4>

                  {!selectedAirline.isPlayer && (
                    <div className="space-y-4 font-mono text-2xs border-b border-line pb-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-surface p-2 rounded-sm border border-line text-center">
                          <span className="text-muted text-2xs block uppercase tracking-label mb-1">STRATEGY GROUP</span>
                          <strong className="text-accent uppercase text-xs">
                            {selectedAirline.personality ? PERSONALITY_META[selectedAirline.personality].description : 'Independent'}
                          </strong>
                        </div>
                        <div className="bg-surface p-2 rounded-sm border border-line text-center">
                          <span className="text-muted text-2xs block uppercase tracking-label mb-1">AGGRESSION RATING</span>
                          <strong className="text-accent text-xs">
                            {selectedAirline.aggression || 5} / 10
                          </strong>
                        </div>
                      </div>

                      <div className="space-y-2 text-muted bg-ground/25 p-3 rounded-sm border border-line text-2xs">
                        <div className="flex justify-between">
                          <span>Seating Config Focus:</span>
                          <strong className="text-ink">
                            {selectedAirline.personality === 'lcc' ? 'All-Economy Density' :
                             selectedAirline.personality === 'flag' ? 'Premium Triple-Class' :
                             selectedAirline.personality === 'boutique' ? 'Ultra Premium Boutique' :
                             selectedAirline.personality === 'optimizer' ? 'Balanced High-Yield' : 'Standard Economy-Favored'}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Ticket Pricing Strategy:</span>
                          <strong className="text-ink">
                            {selectedAirline.personality === 'lcc' ? 'Hyper Discount / High Load' :
                             selectedAirline.personality === 'flag' ? 'Premium Surcharged (+5%)' :
                             selectedAirline.personality === 'boutique' ? 'Elite Surcharged (+25%)' :
                             selectedAirline.personality === 'optimizer' ? 'Algorithmic Clean Pricing' : 'Economy Discounted'}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Onboard Catering Level:</span>
                          <strong className="text-ink">
                            {selectedAirline.personality === 'lcc' ? 'Buy Onboard (No cost)' :
                             selectedAirline.personality === 'flag' ? 'Hot Meals & Luxury Bar' :
                             selectedAirline.personality === 'boutique' ? 'Five-Star Fine Dining' :
                             selectedAirline.personality === 'optimizer' ? 'Standard Snacks & Drinks' : 'Cold Meals & Comfort'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}

                  <p className="text-xs leading-relaxed text-muted font-sans">
                    {selectedAirline.isPlayer ? (
                      `Your airline ranks #${rankById.get(selectedAirline.id) ?? '-'} of ${allAirlines.length} by capital. Expand your fleet and optimise route frequency to outmanoeuvre the competition.`
                    ) : selectedAirline.personality === 'flag' ? (
                      `CARRIER ANALYSIS: ${selectedAirline.name} is a prestige-focused premium flag carrier operating high-status connections directly from their primary hub at ${selectedAirline.hub}. They prioritize luxury cabin configurations, high-end fine dining, and deluxe pricing structures.`
                    ) : selectedAirline.personality === 'lcc' ? (
                      `CARRIER ANALYSIS: ${selectedAirline.name} is an aggressive budget carrier operating dense, high-frequency short-haul networks. They configure aircraft to maximize seat volume, charge deeply discounted ticket prices, and skip free catering to dominate passenger market volume.`
                    ) : selectedAirline.personality === 'expansionist' ? (
                      `CARRIER ANALYSIS: ${selectedAirline.name} is a high-growth expansionist rival. They open new routes rapidly, operating high flight frequencies and keeping ticket prices low to build quick regional slot monopolies.`
                    ) : selectedAirline.personality === 'optimizer' ? (
                      `CARRIER ANALYSIS: ${selectedAirline.name} is a highly calculated operator focusing on cost-efficiency. They structure routes carefully and prioritize fuel efficiency metrics to guarantee pristine financial margins.`
                    ) : (
                      `CARRIER ANALYSIS: ${selectedAirline.name} is a boutique/premium airline dedicated to high-margin transcontinental luxury passages, holding rare, ultra-premium class configurations to serve high-worth elite segments.`
                    )}
                  </p>
                </div>

              </div>

            </div>

          </div>
        </div>
      ) : (
        /* The Global Competitor Leaderboard Board Main Screen */
        <React.Fragment>
          <ViewHeader
            title="Rival Airlines"
            right={
              <div className="relative w-full lg:w-80">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={16} className="text-muted" />
                </div>
                <input
                  type="text"
                  className="w-full bg-ground/40 border border-line rounded-sm py-2.5 pl-10 pr-4 text-sm text-ink focus:outline-none focus:border-accent text-accent font-mono transition-colors"
                  placeholder="Search airlines, codes, hubs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            }
          />

          <div className="flex-1 overflow-y-auto pr-2 bg-ground/20 border border-line rounded-sm p-4 space-y-4">
            {/* Header Board columns */}
            <div className="hidden md:grid grid-cols-12 px-3 py-4 sticky top-0 z-10 bg-raised border-b border-accent/30 font-label text-2xs uppercase tracking-label text-accent font-semibold">
              <div className="col-span-1 text-muted cursor-default">Rank</div>
              <div className="col-span-3 cursor-pointer select-none hover:text-accent" onClick={() => toggleSort('name')}>Airline {getSortIcon('name')}</div>
              <div className="col-span-2 text-center text-muted cursor-default">Hub Base</div>
              <div className="col-span-1 text-center text-muted cursor-default">Tier</div>
              <div className="col-span-2 text-right cursor-pointer select-none hover:text-accent" onClick={() => toggleSort('capital')}>Capital {getSortIcon('capital')}</div>
              <div className="col-span-1 text-right cursor-pointer select-none hover:text-accent" onClick={() => toggleSort('fleet')}>Fleet {getSortIcon('fleet')}</div>
              <div className="col-span-1 text-right cursor-pointer select-none hover:text-accent" onClick={() => toggleSort('routes')}>Routes {getSortIcon('routes')}</div>
              <div className="col-span-1 text-right text-muted cursor-default">Action</div>
            </div>

            {/* Board Listings */}
            <div className="divide-y divide-line">
              {leaderboard.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-muted font-label uppercase tracking-label text-xs">No competing airlines found matching query.</div>
                </div>
              ) : (
                leaderboard.map((airline) => {
                  const rank = rankById.get(airline.id) ?? 0;
                  const lastProfit = airline.monthlyProfitsHistory && airline.monthlyProfitsHistory.length > 0
                    ? airline.monthlyProfitsHistory[airline.monthlyProfitsHistory.length - 1]
                    : 0;
                  
                  return (
                    <div 
                      key={airline.id} 
                      id={`rival-row-${airline.id}`}
                      className={`transition-all duration-200 cursor-pointer text-muted ${
                        airline.isPlayer
                          ? 'bg-accent/5 border-l-2 border-l-accent'
                          : 'hover:bg-raised'
                      }`}
                      onClick={() => setSelectedAirlineId(airline.id)}
                    >
                      {/* Row Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-12 items-center px-3 py-4 gap-y-2 md:gap-y-0 text-sm">
                        {/* Rank */}
                        <div className="col-span-1 font-mono font-semibold flex items-center gap-2">
                          <span className="text-muted text-xs md:hidden font-semibold">RANK</span>
                          <span className={`text-base font-semibold ${
                            rank === 1 ? 'text-accent scale-110 flex items-center' : rank === 2 ? 'text-ink' : rank === 3 ? 'text-muted' : 'text-muted'
                          }`}>
                            #{rank}
                            {rank === 1 && <Award size={14} className="ml-1 inline animate-bounce" />}
                          </span>
                        </div>

                        {/* Name */}
                        <div className="col-span-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {airline.color && (
                                <span
                                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0 border border-ground"
                                  style={{ backgroundColor: airline.color }}
                                  title="Map colour"
                                />
                              )}
                              <span className="font-sans font-semibold text-ink">{airline.name}</span>
                              {!airline.isPlayer && (airline as { forSale?: boolean }).forSale && (
                                <span className="ml-2 text-2xs font-label font-semibold uppercase tracking-label text-accent border border-accent/40 px-1 py-0.5 rounded-sm">For sale</span>
                              )}
                              {airline.isPlayer && (
                                <span className="px-2 py-0.5 bg-accent text-on-accent text-2xs font-semibold uppercase tracking-label rounded-sm">YOU</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
                              <span className="text-muted">IATA: <span className="font-semibold text-accent">{airline.code}</span></span>
                              {!airline.isPlayer && airline.personality && (
                                <Badge tone={PERSONALITY_META[airline.personality].tone}>
                                  {PERSONALITY_META[airline.personality].label}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Hub Base */}
                        <div className="col-span-2 text-left md:text-center">
                          <div className="inline-block md:block font-mono text-xs text-muted bg-surface px-2 py-1 border border-line">
                            {airline.hub}
                          </div>
                        </div>

                        {/* AI Tier Difficulty badge */}
                        <div className="col-span-1 text-left md:text-center">
                          <span className={`px-2 py-0.5 text-2xs font-semibold uppercase tracking-label rounded-sm font-label inline-block ${
                            airline.isPlayer 
                              ? 'bg-raised text-ink border border-rule' 
                              : airline.aiDifficulty === 'Hard' 
                                ? 'bg-surface text-accent border border-rule'
                                : airline.aiDifficulty === 'Normal' 
                                  ? 'bg-accent/10 text-accent border border-accent/20' 
                                  : 'bg-accent/10 text-accent border border-accent/25'
                          }`}>
                            {airline.isPlayer ? 'Player' : airline.aiDifficulty}
                          </span>
                        </div>

                        {/* Capital */}
                        <div className="col-span-2 text-left md:text-right font-mono font-semibold text-ink">
                          <span className="text-muted text-xs md:hidden pr-2">CAPITAL</span>
                          {formatCurrency(airline.capital)}
                          {lastProfit !== 0 && (
                            <span className={`block text-2xs ${lastProfit >= 0 ? 'text-good' : 'text-bad'} font-normal mt-0.5`}>
                              {lastProfit >= 0 ? <TrendingUp size={10} className="inline mr-1" /> : <TrendingDown size={10} className="inline mr-1" />}
                              {lastProfit >= 0 ? '+' : '-'}{formatCurrency(Math.abs(lastProfit))}
                            </span>
                          )}
                        </div>

                        {/* Fleet Size */}
                        <div className="col-span-1 text-left md:text-right font-mono">
                          <span className="text-muted text-xs md:hidden pr-2">FLEET</span>
                          <span className="font-semibold text-ink">{airline.fleet.length}</span>
                        </div>

                        {/* Routes Size */}
                        <div className="col-span-1 text-left md:text-right font-mono">
                          <span className="text-muted text-xs md:hidden pr-2">ROUTES</span>
                          <span className="font-semibold text-ink">{airline.routes.length}</span>
                        </div>

                        {/* Action Trigger button */}
                        <div className="col-span-1 text-right">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAirlineId(airline.id);
                            }}
                            className="px-3 py-2 border border-line rounded-sm font-label text-2xs uppercase tracking-label text-ink hover:text-on-accent hover:bg-accent hover:border-accent transition-all flex items-center justify-center gap-1 w-full md:w-auto font-semibold"
                          >
                            Inspect
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

/**
 * Memoised: this view stays mounted while App re-renders for unrelated state
 * (messages, dialogs, settings), and it only needs to redraw when its own
 * props change. App passes stable callbacks for exactly this reason.
 */
export const CompetitorsView = React.memo(CompetitorsViewImpl);
