import React, { useState, useMemo } from 'react';
import { 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Plus, 
  Plane, 
  Waypoints, 
  Award, 
  ArrowLeft,
  Activity,
  Shield,
  Coins,
  MapPin,
  Calendar,
  Briefcase,
  PieChart
} from 'lucide-react';
import { ViewHeader } from './ui/ViewHeader';
import { Badge } from './ui/Badge';
import { PERSONALITY_META } from '../lib/theme';

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
  }[];
  monthlyProfitsHistory: number[];
  personality?: 'flag' | 'lcc' | 'expansionist' | 'optimizer' | 'boutique';
  aggression?: number;
}

interface Props {
  aiAirlines: AiAirline[];
  playerCapital: number;
  playerFleetCount: number;
  playerRoutesCount: number;
  playerAirlineName: string;
  playerAirlineCode: string;
  playerHub: string;
  playerFleet?: any[];
  playerRoutes?: any[];
  /** The player's own closed months, oldest first. */
  playerProfitHistory?: number[];
}

type SortField = 'rank' | 'name' | 'capital' | 'fleet' | 'routes';
type SortDir = 'asc' | 'desc';

export function CompetitorsView({ 
  aiAirlines, 
  playerCapital, 
  playerFleetCount, 
  playerRoutesCount, 
  playerAirlineName, 
  playerAirlineCode, 
  playerHub,
  playerFleet = [],
  playerRoutes = [],
  playerProfitHistory = []
}: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>('capital');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedAirlineId, setSelectedAirlineId] = useState<string | null>(null);

  // Combine Player and AI Airlines to show a unified Leaderboard list
  const leaderboard = useMemo(() => {
    // Map player's actual owned fleet & routes if they correspond
    const pFleet = playerFleet.length > 0 
      ? playerFleet.map(f => ({
          id: f.id || 'unknown',
          manufacturer: f.manufacturer || 'Boeing',
          family: f.family || '727',
          type: f.type || '727-100',
          model: f.type || '727-100',
          class: (f.class || 'narrowbody').toLowerCase() as 'regional' | 'narrowbody' | 'widebody',
          reg: f.registration || 'NX-XXX',
          maxRange: f.maxRange || 5000,
          capacity: f.capacity || 131,
          basePrice: f.basePrice || 14000000,
          efficiency: f.efficiency || 50,
          popularity: f.popularity || 60,
          purchasedAt: f.purchasedAt || 0,
          conditionInterior: f.conditionInterior || 100,
          conditionGeneral: f.conditionGeneral || 100,
          config: f.config || { economy: 131, premium: 0, business: 0, first: 0 }
        }))
      : Array(playerFleetCount).fill(null).map((_, i) => ({
          id: 'starter',
          manufacturer: 'Boeing',
          family: '727',
          type: '727-100',
          model: '727-100',
          class: 'narrowbody' as const,
          reg: `${playerAirlineCode || 'NX'}-P${100 + i}`,
          maxRange: 5000,
          capacity: 131,
          basePrice: 14000000,
          conditionInterior: 100
        }));

    const pRoutes = playerRoutes.length > 0
      ? playerRoutes.map(r => ({
          origin: r.origin,
          destination: r.destination,
          aircraftClass: (r.aircraftClass || 'narrowbody').toLowerCase() as 'regional' | 'narrowbody' | 'widebody',
          departures: r.schedule?.length || r.departures || 10,
          monthlyProfit: r.monthlyProfit || 0,
          distance: r.distance || 1500,
          durMin: r.durMin || 130,
          aircraftReg: r.aircraft || ''
        }))
      : Array(playerRoutesCount).fill(null).map((_, i) => ({
          origin: playerHub || 'FRA',
          destination: 'ANY',
          aircraftClass: 'narrowbody' as const,
          departures: 10,
          monthlyProfit: 0,
          distance: 1500,
          durMin: 120,
          aircraftReg: 'NX-XXX'
        }));

    const list = [
      {
        id: 'player_airline',
        name: playerAirlineName || "Neo Airlines",
        code: playerAirlineCode || "NX",
        hub: playerHub || "FRA",
        capital: playerCapital,
        aiDifficulty: 'Player' as any,
        // The player has no AI strategy profile. Declaring the fields keeps this
        // entry the same shape as the AI ones, so the detail panel can read them
        // off the union and fall back to "Independent" / 5 on its own.
        personality: undefined as string | undefined,
        aggression: undefined as number | undefined,
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

    // Search filter
    let filtered = list;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(lower) || 
        item.code.toLowerCase().includes(lower) ||
        item.hub.toLowerCase().includes(lower)
      );
    }

    // Sort
    return filtered.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      switch(sortField) {
        case 'name':
          valA = a.name;
          valB = b.name;
          break;
        case 'capital':
          valA = a.capital;
          valB = b.capital;
          break;
        case 'fleet':
          valA = a.fleet.length;
          valB = b.fleet.length;
          break;
        case 'routes':
          valA = a.routes.length;
          valB = b.routes.length;
          break;
        default: // rank is based on capital
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
  }, [aiAirlines, playerCapital, playerFleetCount, playerRoutesCount, playerAirlineName, playerAirlineCode, playerHub, playerFleet, playerRoutes, playerProfitHistory, searchTerm, sortField, sortDir]);

  // Find currently selected airline details
  const selectedAirline = useMemo(() => {
    if (!selectedAirlineId) return null;
    const found = leaderboard.find(a => a.id === selectedAirlineId);
    if (!found) return null;

    // Calculate dynamic helper stats for selected competitor
    const regionalCount = found.fleet.filter(f => f.class === 'regional').length;
    const narrowbodyCount = found.fleet.filter(f => f.class === 'narrowbody').length;
    const widebodyCount = found.fleet.filter(f => f.class === 'widebody').length;
    
    // Virtual calculation of average monthly earnings
    // `found.routes` is a union of the player and AI route shapes, so the
    // accumulator has to be annotated for TypeScript to pick the numeric overload.
    const routeList: { departures: number; monthlyProfit: number }[] = found.routes;
    const totalWeeklyDepartures = routeList.reduce((sum, r) => sum + r.departures, 0);
    const averageEarnings = routeList.reduce((sum, r) => sum + r.monthlyProfit, 0);

    return {
      ...found,
      stats: {
        regionalCount,
        narrowbodyCount,
        widebodyCount,
        totalWeeklyDepartures,
        averageEarnings
      }
    };
  }, [selectedAirlineId, leaderboard]);

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
    return sortDir === 'asc' ? <ChevronUp size={12} className="inline ml-1 text-aero-yellow" /> : <ChevronDown size={12} className="inline ml-1 text-aero-yellow" />;
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="w-full h-full text-white/90 px-3 py-3 lg:px-4 lg:py-4 flex flex-col font-sans overflow-hidden relative">
      {selectedAirline ? (
        /* Immersive Individual Airline Detail Overview Dashboard */
        <div className="flex-1 flex flex-col overflow-hidden animate-fadeIn">
          {/* Header Action bar */}
          <div className="flex items-center justify-between border-b border-white/10 pb-5 mb-3 shrink-0">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSelectedAirlineId(null)}
                className="p-2.5 rounded-sm border border-white/10 bg-white/5 text-white/70 hover:text-aero-yellow hover:border-aero-yellow/50 transition-all flex items-center justify-center cursor-pointer"
                title="Back to Leaderboard"
                style={{ width: '44px', height: '44px' }}
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-mono uppercase font-black text-white leading-none tracking-wider">
                    {selectedAirline.name}
                  </h3>
                  <span className="text-xs font-mono font-bold text-aero-yellow border border-aero-yellow/30 bg-aero-yellow/5 px-2 py-0.5 rounded-sm uppercase">
                    IATA: {selectedAirline.code}
                  </span>
                </div>
                <p className="text-xs text-white/40 font-mono uppercase tracking-[0.15em] mt-1">
                  Corporate Overview & Strategic Air Intelligence
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 font-mono text-xs">
              <span className="text-white/30 lowercase">alliance status:</span>
              <span className={`px-2.5 py-1 text-2xs font-black uppercase tracking-widest rounded-sm ${
                selectedAirline.isPlayer 
                  ? 'bg-aero-yellow text-black' 
                  : 'bg-white/10 text-white border border-white/20'
              }`}>
                {selectedAirline.isPlayer ? 'PROTAGONIST' : 'RIVAL CARRIER'}
              </span>
            </div>
          </div>

          {/* Core Dashboard Workspace */}
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
            
            {/* Top Quick-Glance Bento Grid cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Capital valuation */}
              <div className="bg-white/[0.02] border border-white/5 p-5 rounded-sm relative overflow-hidden flex flex-col justify-between h-[115px]">
                <div className="flex justify-between items-start">
                  <span className="text-white/40 font-mono text-3xs uppercase tracking-[0.2em] font-black">Capital Reserves</span>
                  <Coins size={16} className="text-aero-yellow opacity-80" />
                </div>
                <div>
                  <div className="text-2xl font-mono font-black text-white">{formatCurrency(selectedAirline.capital)}</div>
                  <div className="text-2xs text-aero-yellow font-mono flex items-center gap-1 mt-1">
                    <TrendingUp size={10} /> Active Liquidity Index
                  </div>
                </div>
                <div className="absolute right-0 bottom-0 w-24 h-24 bg-aero-yellow/[0.01] rounded-full filter blur-xl pointer-events-none" />
              </div>

              {/* Card 2: Fleet capacity */}
              <div className="bg-white/[0.02] border border-white/5 p-5 rounded-sm relative overflow-hidden flex flex-col justify-between h-[115px]">
                <div className="flex justify-between items-start">
                  <span className="text-white/40 font-mono text-3xs uppercase tracking-[0.2em] font-black">Appraised Fleet</span>
                  <Plane size={16} className="text-aero-yellow opacity-80" />
                </div>
                <div>
                  <div className="text-2xl font-mono font-black text-white">
                    {selectedAirline.fleet.length} <span className="text-xs text-white/30 font-sans font-normal">Aircraft</span>
                  </div>
                  <div className="text-2xs text-white/50 font-mono mt-1">
                    {selectedAirline.stats.regionalCount} Reg | {selectedAirline.stats.narrowbodyCount} Nb | {selectedAirline.stats.widebodyCount} Wb
                  </div>
                </div>
              </div>

              {/* Card 3: Route network */}
              <div className="bg-white/[0.02] border border-white/5 p-5 rounded-sm relative overflow-hidden flex flex-col justify-between h-[115px]">
                <div className="flex justify-between items-start">
                  <span className="text-white/40 font-mono text-3xs uppercase tracking-[0.2em] font-black">Active Connections</span>
                  <Waypoints size={16} className="text-aero-yellow opacity-80" />
                </div>
                <div>
                  <div className="text-2xl font-mono font-black text-white">
                    {selectedAirline.routes.length} <span className="text-xs text-white/30 font-sans font-normal">Routes</span>
                  </div>
                  <div className="text-2xs text-white/50 font-mono mt-1">
                    {selectedAirline.stats.totalWeeklyDepartures} Departures per week
                  </div>
                </div>
              </div>

              {/* Card 4: Operating Hub & Level */}
              <div className="bg-white/[0.02] border border-white/5 p-5 rounded-sm relative overflow-hidden flex flex-col justify-between h-[115px]">
                <div className="flex justify-between items-start">
                  <span className="text-white/40 font-mono text-3xs uppercase tracking-[0.2em] font-black">Strategic Hub Base</span>
                  <MapPin size={16} className="text-aero-yellow opacity-80" />
                </div>
                <div>
                  <div className="text-2xl font-mono font-black text-aero-yellow">{selectedAirline.hub}</div>
                  <div className="text-2xs text-white/50 font-mono mt-1 flex items-center gap-1.5">
                    <Shield size={10} className="text-white/40" /> Operating Tier: {selectedAirline.isPlayer ? '1' : selectedAirline.aiDifficulty}
                  </div>
                </div>
              </div>
            </div>

            {/* In-depth Analytical Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              
              {/* Left Column (8-wide): Fleet List & Route details */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Visual Section: Strategic Connections list */}
                <div className="bg-white/[0.01] border border-white/5 rounded-sm p-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                    <h4 className="text-xs font-mono font-black text-aero-yellow uppercase tracking-[0.25em] flex items-center gap-2">
                      <Waypoints size={14} /> Global Route Intelligence Network
                    </h4>
                    <span className="text-2xs text-white/40 font-mono">
                      Hub Origin: <strong className="text-white">{selectedAirline.hub}</strong>
                    </span>
                  </div>

                  <div className="space-y-3 font-mono">
                    {selectedAirline.routes.length === 0 ? (
                      <div className="p-12 text-center bg-black/25 border border-white/5 rounded-sm text-white/30 uppercase tracking-widest text-xs">
                        This airline is restructuring its flight routes. No active routes currently scheduled.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {selectedAirline.routes.map((route, rIndex) => {
                          const routeDistance = route.distance || Math.floor(1200 + (rIndex * 480));
                          const routeDuration = route.durMin 
                            ? `${Math.floor(route.durMin / 60)}h ${route.durMin % 60}m`
                            : `${Math.floor(routeDistance / 800)}h ${Math.floor((routeDistance % 800) / 13)}m`;
                          const maxPaxDemand = Math.floor(750 + (route.departures * 115));
                          return (
                            <div key={rIndex} className="bg-black/35 border border-white/5 p-4 rounded-sm hover:border-white/10 transition-all flex flex-col justify-between">
                              <div>
                                <div className="flex justify-between items-start mb-2">
                                  <span className="font-sans font-bold text-base tracking-wide text-white flex items-center gap-2">
                                    {route.origin} <span className="text-aero-yellow font-black">↔</span> {route.destination}
                                  </span>
                                  <span className="px-2 py-0.5 bg-white/5 border border-white/10 text-3xs rounded-sm font-mono text-white/60 uppercase font-bold">
                                    {route.aircraftClass}
                                  </span>
                                </div>
                                <div className="text-2xs text-white/40 space-y-1 mt-3">
                                  <div className="flex justify-between">
                                    <span>Weekly Departures:</span>
                                    <strong className="text-white font-mono">{route.departures} flights</strong>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Sector Distance:</span>
                                    <strong className="text-white/85 font-mono">{routeDistance} km</strong>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Flight Duration:</span>
                                    <strong className="text-white/85 font-mono">{routeDuration}</strong>
                                  </div>
                                  {route.aircraftReg && (
                                    <div className="flex justify-between">
                                      <span>Assigned Airframe:</span>
                                      <strong className="text-aero-yellow font-mono">{route.aircraftReg}</strong>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="border-t border-white/5 pt-3 mt-4 flex justify-between items-center bg-white/[0.01] -mx-4 -mb-4 p-4 rounded-b-sm">
                                <span className="text-3xs uppercase tracking-wider text-white/30 font-semibold font-mono">Net Route Yield</span>
                                <span className="font-mono text-aero-yellow font-bold block text-sm">
                                  +{formatCurrency(route.monthlyProfit || selectedAirline.stats.averageEarnings / selectedAirline.routes.length || 380420)}/mo
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
                <div className="bg-white/[0.01] border border-white/5 rounded-sm p-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                    <h4 className="text-xs font-mono font-black text-aero-yellow uppercase tracking-[0.25em] flex items-center gap-2">
                      <Plane size={14} /> Strategic Aircraft Registry
                    </h4>
                    <span className="text-2xs text-white/40 font-mono">
                      Active Fleet Size: <strong className="text-white">{selectedAirline.fleet.length}</strong>
                    </span>
                  </div>

                  <div className="space-y-2 font-mono">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {selectedAirline.fleet.map((plane, pIdx) => {
                        const scoreSatisfaction = plane.conditionGeneral || (85 + (pIdx % 3) * 5);
                        return (
                          <div key={pIdx} className="bg-black/35 border border-white/5 p-4 rounded-sm flex flex-col justify-between font-sans">
                            <div>
                              <div className="flex justify-between items-start">
                                <div>
                                  <strong className="text-sm font-bold text-white/95 block leading-none">
                                    {plane.manufacturer || ''} {plane.model}
                                  </strong>
                                  <span className="font-mono text-3xs text-aero-yellow mt-1.5 inline-block uppercase tracking-wider">
                                    {plane.class} specs
                                  </span>
                                </div>
                                <span className="font-mono text-2xs text-aero-yellow bg-aero-yellow/10 px-2 py-0.5 border border-aero-yellow/20 rounded-sm font-bold uppercase tracking-wider">
                                  {plane.reg}
                                </span>
                              </div>

                              <div className="mt-4 space-y-1.5 font-mono text-2xs text-white/50 border-t border-white/5 pt-3">
                                <div className="flex justify-between">
                                  <span>Seats Capacity:</span>
                                  <strong className="text-white">{plane.capacity || '131'} paxs</strong>
                                </div>
                                <div className="flex justify-between">
                                  <span>Service Range:</span>
                                  <strong className="text-white">{plane.maxRange || '4500'} km</strong>
                                </div>
                                <div className="flex justify-between">
                                  <span>Efficiency Metric:</span>
                                  <strong className="text-aero-yellow">+{plane.efficiency || '50'}%</strong>
                                </div>
                                <div className="flex justify-between">
                                  <span>Value Appraisal:</span>
                                  <strong className="text-white/80">{formatCurrency(plane.basePrice || 14000000)}</strong>
                                </div>
                              </div>
                            </div>
                            <div className="mt-4 border-t border-white/5 pt-2.5 flex justify-between items-center text-2xs text-white/40 font-mono">
                              <span>Operating SAT status</span>
                              <span className="text-aero-yellow font-black">{scoreSatisfaction}%</span>
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
                <div className="bg-white/[0.01] border border-white/5 rounded-sm p-4">
                  <h4 className="text-xs font-mono font-black text-aero-yellow uppercase tracking-[0.25em] border-b border-white/10 pb-4 mb-5 flex items-center gap-2">
                    <PieChart size={14} /> Capacity Distribution
                  </h4>

                  {/* Dynamic Custom Bars in the exact Yellow and Anthracite colorway */}
                  <div className="space-y-4 font-mono text-xs">
                    <div>
                      <div className="flex justify-between text-2xs mb-1">
                        <span className="text-white/70">Widebody Transcontinental</span>
                        <strong className="text-white font-bold">{selectedAirline.stats.widebodyCount}</strong>
                      </div>
                      <div className="w-full bg-black/40 h-2 rounded-full border border-white/5 overflow-hidden">
                        <div 
                          className="bg-aero-yellow h-full transition-all duration-1000" 
                          style={{ width: `${selectedAirline.fleet.length > 0 ? (selectedAirline.stats.widebodyCount / selectedAirline.fleet.length) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-2xs mb-1">
                        <span className="text-white/70">Narrowbody Medium-Haul</span>
                        <strong className="text-white font-bold">{selectedAirline.stats.narrowbodyCount}</strong>
                      </div>
                      <div className="w-full bg-black/40 h-2 rounded-full border border-white/5 overflow-hidden">
                        <div 
                          className="bg-aero-yellow/80 h-full transition-all duration-1000" 
                          style={{ width: `${selectedAirline.fleet.length > 0 ? (selectedAirline.stats.narrowbodyCount / selectedAirline.fleet.length) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-2xs mb-1">
                        <span className="text-white/70">Regional Short-Haul</span>
                        <strong className="text-white font-bold">{selectedAirline.stats.regionalCount}</strong>
                      </div>
                      <div className="w-full bg-black/40 h-2 rounded-full border border-white/5 overflow-hidden">
                        <div 
                          className="bg-aero-yellow/30 h-full transition-all duration-1000" 
                          style={{ width: `${selectedAirline.fleet.length > 0 ? (selectedAirline.stats.regionalCount / selectedAirline.fleet.length) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quaterly simulated performance timeline overview */}
                <div className="bg-white/[0.01] border border-white/5 rounded-sm p-4">
                  <h4 className="text-xs font-mono font-black text-aero-yellow uppercase tracking-[0.25em] border-b border-white/10 pb-4 mb-4 flex items-center gap-2">
                    <Activity size={14} /> Yield & Profit Trends
                  </h4>

                  <div className="space-y-4 font-mono">
                    <div className="text-2xs text-white/40 mb-2 uppercase leading-snug">
                      Recent timeline of net monthly operation margins:
                    </div>
                    
                    {/* No invented placeholder series here: an airline that has
                        not closed a month yet simply says so. */}
                    {(selectedAirline.monthlyProfitsHistory || []).length === 0 ? (
                      <div className="h-28 flex items-center justify-center bg-black/25 border border-white/5 rounded-sm text-2xs uppercase tracking-widest text-white/30">
                        No month closed yet
                      </div>
                    ) : (
                    <div className="h-28 flex items-end justify-between gap-2.5 px-2 pt-4 bg-black/25 border border-white/5 rounded-sm">
                      {(selectedAirline.monthlyProfitsHistory || []).slice(-12).map((val, idx) => {
                        const shown = (selectedAirline.monthlyProfitsHistory || []).slice(-12);
                        const maxValue = Math.max(...shown.map(Math.abs), 1000000);
                        const progressHeight = Math.max(10, Math.min(100, (Math.abs(val) / maxValue) * 100));
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                            {/* Value tooltip */}
                            <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-black text-3xs px-1 rounded-sm pointer-events-none whitespace-nowrap z-10 font-black">
                              {formatCurrency(val)}
                            </div>
                            <div 
                              className={`w-full rounded-t-sm transition-all duration-500 hover:bg-aero-yellow cursor-pointer ${
                                val < 0 ? 'bg-aero-warn/70' : idx === shown.length - 1 ? 'bg-aero-yellow' : 'bg-white/15'
                              }`} 
                              style={{ height: `${progressHeight}%` }}
                            />
                            <span className="text-4xs text-white/30 font-mono mt-1 mt-1 font-black">M{idx+1}</span>
                          </div>
                        );
                      })}
                    </div>
                    )}

                    <div className="space-y-1 text-xs border-t border-white/5 pt-3">
                      <div className="flex justify-between text-2xs">
                        <span className="text-white/40">Performance Status:</span>
                        <span className="text-aero-yellow font-bold uppercase tracking-wide">Excellent / Capitalized</span>
                      </div>
                      <div className="flex justify-between text-2xs mt-1">
                        <span className="text-white/40">Market Share Score:</span>
                        <strong className="text-white font-bold">12.5%</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Threat assessment Intelligence Report */}
                <div className="bg-white/[0.01] border border-white/5 rounded-sm p-4 space-y-4">
                  <h4 className="text-xs font-mono font-black text-white uppercase tracking-[0.25em] border-b border-white/10 pb-4 flex items-center gap-2">
                    <Shield size={14} className="text-aero-yellow" /> Strategic Assessment
                  </h4>

                  {!selectedAirline.isPlayer && (
                    <div className="space-y-4 font-mono text-2xs border-b border-white/5 pb-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/5 p-2 rounded-sm border border-white/5 text-center">
                          <span className="text-white/40 text-3xs block uppercase tracking-wider mb-1">STRATEGY GROUP</span>
                          <strong className="text-aero-yellow uppercase text-xs">
                            {selectedAirline.personality ? PERSONALITY_META[selectedAirline.personality].description : 'Independent'}
                          </strong>
                        </div>
                        <div className="bg-white/5 p-2 rounded-sm border border-white/5 text-center">
                          <span className="text-white/40 text-3xs block uppercase tracking-wider mb-1">AGGRESSION RATING</span>
                          <strong className="text-aero-yellow/60 text-xs">
                            {selectedAirline.aggression || 5} / 10
                          </strong>
                        </div>
                      </div>

                      <div className="space-y-2 text-white/50 bg-black/25 p-3 rounded-sm border border-white/5 text-2xs">
                        <div className="flex justify-between">
                          <span>Seating Config Focus:</span>
                          <strong className="text-white">
                            {selectedAirline.personality === 'lcc' ? 'All-Economy Density' :
                             selectedAirline.personality === 'flag' ? 'Premium Triple-Class' :
                             selectedAirline.personality === 'boutique' ? 'Ultra Premium Boutique' :
                             selectedAirline.personality === 'optimizer' ? 'Balanced High-Yield' : 'Standard Economy-Favored'}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Ticket Pricing Strategy:</span>
                          <strong className="text-white">
                            {selectedAirline.personality === 'lcc' ? 'Hyper Discount / High Load' :
                             selectedAirline.personality === 'flag' ? 'Premium Surcharged (+5%)' :
                             selectedAirline.personality === 'boutique' ? 'Elite Surcharged (+25%)' :
                             selectedAirline.personality === 'optimizer' ? 'Algorithmic Clean Pricing' : 'Economy Discounted'}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Onboard Catering Level:</span>
                          <strong className="text-white">
                            {selectedAirline.personality === 'lcc' ? 'Buy Onboard (No cost)' :
                             selectedAirline.personality === 'flag' ? 'Hot Meals & Luxury Bar' :
                             selectedAirline.personality === 'boutique' ? 'Five-Star Fine Dining' :
                             selectedAirline.personality === 'optimizer' ? 'Standard Snacks & Drinks' : 'Cold Meals & Comfort'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}

                  <p className="text-xs leading-relaxed text-white/60 font-sans">
                    {selectedAirline.isPlayer ? (
                      "You are currently leading your airline with strong strategic and commercial options. Expand your fleets and optimize route frequency to outmaneuver active competitor airlines."
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
            eyebrow="Global Aviation Intelligence"
            title="Rival Airlines"
            right={
              <div className="relative w-full lg:w-80">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={16} className="text-white/40" />
                </div>
                <input
                  type="text"
                  className="w-full bg-black/40 border border-white/10 rounded-sm py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-aero-yellow text-aero-yellow font-mono transition-colors"
                  placeholder="Search airlines, codes, hubs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            }
          />

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 bg-black/20 border border-white/5 rounded-sm p-4 space-y-4">
            {/* Header Board columns */}
            <div className="hidden md:grid grid-cols-12 px-3 py-4 sticky top-0 z-10 bg-aero-panel-2 border-b border-aero-yellow/30 font-mono text-2xs uppercase tracking-widest text-aero-yellow/80 font-black">
              <div className="col-span-1 text-white/40 cursor-default">Rank</div>
              <div className="col-span-3 cursor-pointer select-none hover:text-aero-yellow" onClick={() => toggleSort('name')}>Airline {getSortIcon('name')}</div>
              <div className="col-span-2 text-center text-white/40 cursor-default">Hub Base</div>
              <div className="col-span-1 text-center text-white/40 cursor-default">Tier</div>
              <div className="col-span-2 text-right cursor-pointer select-none hover:text-aero-yellow" onClick={() => toggleSort('capital')}>Capital {getSortIcon('capital')}</div>
              <div className="col-span-1 text-right cursor-pointer select-none hover:text-aero-yellow" onClick={() => toggleSort('fleet')}>Fleet {getSortIcon('fleet')}</div>
              <div className="col-span-1 text-right cursor-pointer select-none hover:text-aero-yellow" onClick={() => toggleSort('routes')}>Routes {getSortIcon('routes')}</div>
              <div className="col-span-1 text-right text-white/40 cursor-default">Action</div>
            </div>

            {/* Board Listings */}
            <div className="divide-y divide-white/5">
              {leaderboard.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-white/30 font-mono uppercase tracking-widest text-xs">No competing airlines found matching query.</div>
                </div>
              ) : (
                leaderboard.map((airline, idx) => {
                  // Compute Rank based on original sorted index
                  const rank = idx + 1;
                  const lastProfit = airline.monthlyProfitsHistory && airline.monthlyProfitsHistory.length > 0
                    ? airline.monthlyProfitsHistory[airline.monthlyProfitsHistory.length - 1]
                    : 0;
                  
                  return (
                    <div 
                      key={airline.id} 
                      id={`rival-row-${airline.id}`}
                      className={`transition-all duration-200 cursor-pointer text-white/70 ${
                        airline.isPlayer
                          ? 'bg-aero-yellow/5 border-l-2 border-l-aero-yellow'
                          : 'hover:bg-white/5'
                      }`}
                      onClick={() => setSelectedAirlineId(airline.id)}
                    >
                      {/* Row Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-12 items-center px-3 py-4 gap-y-2 md:gap-y-0 text-sm">
                        {/* Rank */}
                        <div className="col-span-1 font-mono font-bold flex items-center gap-2">
                          <span className="text-white/30 text-xs md:hidden tracking-wider font-semibold">RANK</span>
                          <span className={`text-base font-black ${
                            rank === 1 ? 'text-aero-yellow scale-110 flex items-center' : rank === 2 ? 'text-white/80' : rank === 3 ? 'text-white/50' : 'text-white/30'
                          }`}>
                            #{rank}
                            {rank === 1 && <Award size={14} className="ml-1 inline animate-bounce" />}
                          </span>
                        </div>

                        {/* Name */}
                        <div className="col-span-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-sans font-bold text-white tracking-wide">{airline.name}</span>
                              {airline.isPlayer && (
                                <span className="px-2 py-0.5 bg-aero-yellow text-black text-3xs font-black uppercase tracking-widest rounded-sm">YOU</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
                              <span className="text-white/40">IATA: <span className="font-black text-aero-yellow">{airline.code}</span></span>
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
                          <div className="inline-block md:block font-mono text-xs text-white/65 bg-white/5 px-2 py-1 border border-white/5">
                            {airline.hub}
                          </div>
                        </div>

                        {/* AI Tier Difficulty badge */}
                        <div className="col-span-1 text-left md:text-center">
                          <span className={`px-2 py-0.5 text-3xs font-black uppercase tracking-wider rounded-sm font-mono inline-block ${
                            airline.isPlayer 
                              ? 'bg-white/10 text-white border border-white/30' 
                              : airline.aiDifficulty === 'Hard' 
                                ? 'bg-aero-panel text-aero-yellow/60 border border-white/20'
                                : airline.aiDifficulty === 'Normal' 
                                  ? 'bg-aero-yellow/10 text-aero-yellow border border-aero-yellow/20' 
                                  : 'bg-aero-yellow/10 text-aero-yellow border border-aero-yellow/25'
                          }`}>
                            {airline.isPlayer ? 'Player' : airline.aiDifficulty}
                          </span>
                        </div>

                        {/* Capital */}
                        <div className="col-span-2 text-left md:text-right font-mono font-bold text-white/95">
                          <span className="text-white/30 text-xs md:hidden pr-2 tracking-wider">CAPITAL</span>
                          {formatCurrency(airline.capital)}
                          {lastProfit !== 0 && (
                            <span className={`block text-3xs ${lastProfit >= 0 ? 'text-aero-yellow' : 'text-aero-yellow/60'} font-normal mt-0.5`}>
                              {lastProfit >= 0 ? <TrendingUp size={10} className="inline mr-1" /> : <TrendingDown size={10} className="inline mr-1" />}
                              {lastProfit >= 0 ? '+' : '-'}{formatCurrency(Math.abs(lastProfit))}
                            </span>
                          )}
                        </div>

                        {/* Fleet Size */}
                        <div className="col-span-1 text-left md:text-right font-mono">
                          <span className="text-white/30 text-xs md:hidden pr-2 tracking-wider">FLEET</span>
                          <span className="font-bold text-white/95">{airline.fleet.length}</span>
                        </div>

                        {/* Routes Size */}
                        <div className="col-span-1 text-left md:text-right font-mono">
                          <span className="text-white/30 text-xs md:hidden pr-2 tracking-wider">ROUTES</span>
                          <span className="font-bold text-white/95">{airline.routes.length}</span>
                        </div>

                        {/* Action Trigger button */}
                        <div className="col-span-1 text-right">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAirlineId(airline.id);
                            }}
                            className="px-3 py-2 border border-white/10 rounded-sm font-mono text-3xs uppercase tracking-widest text-white hover:text-black hover:bg-aero-yellow hover:border-aero-yellow transition-all flex items-center justify-center gap-1 w-full md:w-auto font-bold"
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
