import React, { useMemo } from 'react';
import { Airport, getAirportStats } from '../data/airports';
import { X, Target, Lock, Crown, Anchor, Plus, Minus, Info } from 'lucide-react';
import { ManagementLevel, AirportInfrastructure } from '../App';

import { OwnedAircraft } from './MyFleetView';
import { InfoTooltip, GLOSSARY } from './InfoTooltip';
import { SimulatedRoute } from '../App';

import { getAirportUpkeep, getSlotPurchaseCost, applyInfrastructureChange } from '../lib/financeUtils';

interface Props {
  airport: Airport;
  currentDateOffset: number;
  onClose: () => void;
  infrastructure: AirportInfrastructure;
  onBuyManagement: (level: number) => void;
  onUpdateInfrastructure: (infra: AirportInfrastructure) => void;
  onSubtractCapital: (amount: number) => void;
  onAddPendingSlotBills?: (amount: number) => void;
  /**
   * Surfaces a refused or trimmed purchase. Every guard below used to `return`
   * without a word, so a click that bought nothing looked identical to a click
   * that worked.
   */
  onNotify?: (message: string) => void;
  pendingSlotBills?: number;
  capital: number;
  onManageRoutes: () => void;
  onStartRoute: (airportId: string, role: 'origin'|'destination') => void;
  fleet: OwnedAircraft[];
  routes?: SimulatedRoute[];
  onPerformGeneralCheck: (reg: string) => void;
  aiAirlines?: any[];
}

export function AirportDetailView({ 
  airport, 
  currentDateOffset, 
  onClose, 
  infrastructure,
  onBuyManagement,
  onUpdateInfrastructure,
  onSubtractCapital,
  onAddPendingSlotBills,
  onNotify,
  pendingSlotBills = 0,
  capital,
  onManageRoutes,
  onStartRoute,
  fleet,
  routes = [],
  onPerformGeneralCheck,
  aiAirlines = []
}: Props) {
  const [showCostBreakdown, setShowCostBreakdown] = React.useState(false);
  const [selectedAircraftForCheck, setSelectedAircraftForCheck] = React.useState<string>("");
  const [showMgmtModal, setShowMgmtModal] = React.useState(false);

  const level = airport.level;
  const currentYear = 1960 + Math.floor(currentDateOffset / 12);
  
  const hubAutoUpgrade = infrastructure.level >= 2;

  const handleStartRouteClick = () => {
    if (infrastructure.level === 0) {
      setShowMgmtModal(true);
    } else if (infrastructure.level === 1) {
      onStartRoute(airport.id, 'destination');
    } else {
      onStartRoute(airport.id, 'origin');
    }
  };

  const upkeepData = useMemo(() => {
    return getAirportUpkeep(airport, infrastructure, routes, fleet);
  }, [airport, infrastructure, routes, fleet]);

  const {
    slotCosts,
    standUpgradeCosts,
    deskCosts,
    deskCapacities,
    passengerData,
    deskLoad,
    satDeduction
  } = upkeepData;

  const costBreakdown = upkeepData;
  const weeklyExpenses = costBreakdown.total;

  const totalSlots = level * 300;
  const usedSlots = infrastructure.slots.regional + infrastructure.slots.narrowbody + infrastructure.slots.widebody;
  
  const aiSlotsUsed = useMemo(() => {
    return aiAirlines.reduce((sum, aiItem) => {
      if (!aiItem.routes) return sum;
      return sum + aiItem.routes.reduce((routeSum: number, r: any) => {
        if (r.origin === airport.id || r.destination === airport.id) {
          return routeSum + (r.departures || 0);
        }
        return routeSum;
      }, 0);
    }, 0);
  }, [aiAirlines, airport.id]);

  const utilizedSlots = useMemo(() => {
    return {
      regional: (routes || []).reduce((acc, r) => {
        if (r.origin !== airport.id && r.destination !== airport.id) return acc;
        const rAc = fleet.find(f => f.registration === r.aircraft);
        if (!rAc || rAc.class.toLowerCase() !== 'regional') return acc;
        return acc + (r.schedule?.length || 0);
      }, 0),
      narrowbody: (routes || []).reduce((acc, r) => {
        if (r.origin !== airport.id && r.destination !== airport.id) return acc;
        const rAc = fleet.find(f => f.registration === r.aircraft);
        if (!rAc || rAc.class.toLowerCase() !== 'narrowbody') return acc;
        return acc + (r.schedule?.length || 0);
      }, 0),
      widebody: (routes || []).reduce((acc, r) => {
        if (r.origin !== airport.id && r.destination !== airport.id) return acc;
        const rAc = fleet.find(f => f.registration === r.aircraft);
        if (!rAc || rAc.class.toLowerCase() !== 'widebody') return acc;
        return acc + (r.schedule?.length || 0);
      }, 0),
    };
  }, [airport.id, routes, fleet]);

  const availableSlots = Math.max(0, totalSlots - usedSlots - aiSlotsUsed); 

    // We no longer calculate max aircraft string here since we use ICAO codes

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  // Only slots carry a one-off purchase price. Desks and stands are rented: their
  // cost shows up as weekly upkeep in getAirportUpkeep, never as an upfront charge.
  // The route planner used to bill their weekly rate as a one-off fee, so the same
  // desk cost money in one screen and nothing in the other.
  const buyItem = (type: 'slots' | 'desks' | 'stands', subType: string, amount: number, isShift?: boolean) => {
    const requestedAmount = amount * (isShift ? 10 : 1);
    const unit = type === 'slots' ? 'slot' : type === 'stands' ? 'stand' : 'desk';
    const plural = (n: number) => `${Math.abs(n)} ${unit}${Math.abs(n) === 1 ? '' : 's'}`;

    const result = applyInfrastructureChange({
      infra: infrastructure,
      type, subType,
      requestedAmount,
      hubAutoUpgrade,
      autoBuyStands: !!infrastructure.autoBuyStands,
      availableSlots,
      utilizedSlots: utilizedSlots[subType as 'regional' | 'narrowbody' | 'widebody'] || 0,
      costPerUnit: type === 'slots' ? getSlotPurchaseCost(subType) : 0,
    });

    if (result.actualAmount === 0) {
      if (requestedAmount > 0) {
        onNotify?.(
          type === 'stands'
            ? `${airport.id} has no spare ${subType} slots to put a stand on. Buy a slot first.`
            : `No ${subType} ${unit}s are available at ${airport.id} right now.`
        );
      } else if (requestedAmount < 0) {
        onNotify?.(`Those ${subType} ${unit}s at ${airport.id} are in use by your current schedule and cannot be sold.`);
      }
      return;
    }
    if (requestedAmount > 0 && result.actualAmount < requestedAmount) {
      onNotify?.(`Only ${plural(result.actualAmount)} of the ${plural(requestedAmount)} you asked for were available at ${airport.id}.`);
    }

    if (type === 'slots') {
      // Slot purchases are settled with the monthly report, the same way the route
      // planner books them, so the "Purchased Slots" line stays complete.
      if (result.cost > 0 && (capital - pendingSlotBills) < result.cost) {
        onNotify?.(
          `${plural(result.actualAmount)} at ${airport.id} cost ${formatCurrency(result.cost)}, ` +
          `but only ${formatCurrency(capital - pendingSlotBills)} is uncommitted. Nothing was bought.`
        );
        return;
      }
      if (onAddPendingSlotBills) onAddPendingSlotBills(result.cost);
      else onSubtractCapital(result.cost);
    }

    onUpdateInfrastructure(result.infra);
  };

  return (
    <div className="absolute inset-0 z-[2000] flex flex-col bg-aero-black overflow-hidden pointer-events-auto font-mono">
      <div className="absolute inset-0 z-0 opacity-20 grayscale grayscale-100">
        <img 
          src="https://images.unsplash.com/photo-1556388158-158ea5ccacbd?q=80&w=1600&auto=format&fit=crop" 
          className="w-full h-full object-cover" 
          alt="Airport"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-aero-black via-aero-black/90 to-transparent"></div>
      </div>

      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="p-4 pb-4 flex justify-between items-start border-b border-white/5 bg-aero-carbon/80 backdrop-blur-sm">
          <div className="flex flex-col">
            <div className="text-aero-yellow text-[10px] uppercase tracking-[0.4em] mb-2 font-black">Strategic Operations Console</div>
            <h1 className="text-5xl font-black italic uppercase tracking-tighter text-white flex items-center gap-4">
              {airport.name} <span className="text-aero-yellow font-normal not-italic opacity-50">[{airport.id}] <span className="text-[24px] ml-4 italic font-black uppercase text-aero-yellow tracking-widest">L{airport.level}</span></span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleStartRouteClick}
              className="px-3 py-3 bg-white/5 text-white font-black italic uppercase tracking-widest hover:bg-aero-yellow hover:text-black transition-all text-xs border border-white/10"
            >
              New Route +
            </button>
            <button
              onClick={onManageRoutes}
              className="px-3 py-3 bg-aero-yellow text-black font-black italic uppercase tracking-widest hover:bg-white transition-all text-xs border border-transparent"
            >
              My Routes
            </button>
            <button 
              onClick={onClose}
              className="p-3 bg-white/5 hover:bg-aero-yellow hover:text-black transition-all border border-white/10"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Infobar */}
        <div className="bg-[#050505] border-b border-white/10 py-2 px-4 flex justify-between items-center gap-2 uppercase tracking-widest text-[9px]">
          <Metric label="Level" value={`L${airport.level}`} highlight />
          <Metric label="Mgmt" value={
            infrastructure.level === 0 ? 'None' : 
            infrastructure.level === 1 ? 'Standard' :
            infrastructure.level === 2 ? 'Hub' : 'Owner'
          } />
          <Metric label="Business" value={getAirportStats(airport, currentYear).business.toLocaleString()} />
          <Metric label="Tourism" value={getAirportStats(airport, currentYear).tourism.toLocaleString()} />
          <Metric label="Weekly Pax" value={`${passengerData.total.toLocaleString()}`} />
          <div className="flex flex-col relative group min-w-[100px]">
            <span className="text-white/30 text-[8px] mb-0.5 flex items-center gap-1 cursor-pointer hover:text-white transition-colors" onClick={() => setShowCostBreakdown(!showCostBreakdown)}>
              Weekly Costs <Info size={8} />
            </span>
            <span className="text-xs font-black text-aero-yellow/60">{formatCurrency(weeklyExpenses)}</span>
            
            {showCostBreakdown && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-aero-carbon border border-white/10 shadow-2xl p-4 z-50 rounded-sm normal-case tracking-normal">
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-white/10">
                  <span className="text-white font-bold text-[11px] uppercase tracking-widest">Ops Breakdown</span>
                  <button onClick={() => setShowCostBreakdown(false)} className="text-white/40 hover:text-white"><X size={12}/></button>
                </div>
                <div className="space-y-1 text-white/70 text-[10px]">
                  {costBreakdown.slots.regional > 0 && <div className="flex justify-between"><span>Reg Slot Admin:</span> <span>{formatCurrency(costBreakdown.slots.regional)}</span></div>}
                  {costBreakdown.slots.narrowbody > 0 && <div className="flex justify-between"><span>NB Slot Admin:</span> <span>{formatCurrency(costBreakdown.slots.narrowbody)}</span></div>}
                  {costBreakdown.slots.widebody > 0 && <div className="flex justify-between"><span>WB Slot Admin:</span> <span>{formatCurrency(costBreakdown.slots.widebody)}</span></div>}
                  {costBreakdown.stands.regional > 0 && <div className="flex justify-between"><span>Reg Stands:</span> <span>{formatCurrency(costBreakdown.stands.regional)}</span></div>}
                  {costBreakdown.stands.narrowbody > 0 && <div className="flex justify-between"><span>NB Stands:</span> <span>{formatCurrency(costBreakdown.stands.narrowbody)}</span></div>}
                  {costBreakdown.stands.widebody > 0 && <div className="flex justify-between"><span>WB Stands:</span> <span>{formatCurrency(costBreakdown.stands.widebody)}</span></div>}
                  {costBreakdown.desks.normal > 0 && <div className="flex justify-between"><span>Check-in:</span> <span>{formatCurrency(costBreakdown.desks.normal)}</span></div>}
                  {costBreakdown.desks.self > 0 && <div className="flex justify-between"><span>Self-Check:</span> <span>{formatCurrency(costBreakdown.desks.self)}</span></div>}
                  {(costBreakdown.facilities.hangar > 0 || costBreakdown.facilities.vip > 0 || costBreakdown.facilities.catering > 0) && <div className="flex justify-between pt-2 border-t border-white/10"><span>Facilities:</span> <span>{formatCurrency(costBreakdown.facilities.hangar + costBreakdown.facilities.vip + costBreakdown.facilities.catering)}</span></div>}
                  <div className="flex justify-between pt-2 mt-2 border-t border-white/20 text-white font-bold"><span>Total/wk:</span> <span className="text-aero-yellow/60">{formatCurrency(weeklyExpenses)}</span></div>
                </div>
              </div>
            )}
          </div>
          <Metric label="Available Slots" info="slots" value={`${Math.max(0, totalSlots - usedSlots - aiSlotsUsed)} / ${totalSlots}`} color={aiSlotsUsed > 0 ? "text-aero-yellow" : "text-white"} />
          <Metric label="Max ICAO Code" value={airport.maxIcaoCode} info="icaoCode" />
          {(() => {
             const hubBonus = infrastructure.level >= 2;
             const paxUnitFee = (hubBonus ? 0.475 : 0.5) + (level >= 5 ? 5 : level >= 3 ? 4 : 3);
             const minLandingFee = Math.floor((2000 + 100 * level) * 1.1 * (hubBonus ? 0.95 : 1));
             return (
               <>
                 <Metric label="Landing Fee (Reg)" value={formatCurrency(minLandingFee)} />
                 <Metric label="Pax Handling Fee" value={`${formatCurrency(paxUnitFee)} / pax`} />
               </>
             );
          })()}
        </div>


        {/* Main Interface */}
        <div className="flex-1 p-4 grid grid-cols-2 gap-4 overflow-y-auto no-scrollbar">
          {/* Left Column: Operations Dashboard */}
          <div className="flex flex-col gap-3">
            <div className="bg-aero-carbon border border-white/10 p-4 flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <Target className="text-aero-yellow" size={20} />
                  <span className="text-sm font-black uppercase tracking-[0.2em]">Infrastructure Controls</span>
                </div>
                {infrastructure.level >= 1 ? (
                  <span className="text-[10px] bg-aero-yellow/20 text-black px-2 py-0.5 font-bold rounded-sm animate-pulse">SYSTEMS ONLINE</span>
                ) : (
                  <span className="text-[10px] bg-white/10 text-white/40 px-2 py-0.5 rounded-sm">OFFLINE</span>
                )}
              </div>

              {infrastructure.level >= 1 ? (
                <div className="flex flex-col gap-4">
                  {/* SLOTS SECTION */}
                  <div className="space-y-4">
                    <SectionLabel icon={<Plus size={12}/>} label="Flight Slots" />
                    <div className="grid grid-cols-1 gap-2">
                        <InfaRow label="Regional" count={infrastructure.slots.regional} used={utilizedSlots.regional} showUtilBar={true} purchaseCost={getSlotPurchaseCost('regional')} cost={250} onBuy={(n, isShift) => buyItem('slots', 'regional', n, isShift)} />
                        <InfaRow label="Narrowbody" count={infrastructure.slots.narrowbody} used={utilizedSlots.narrowbody} showUtilBar={true} purchaseCost={getSlotPurchaseCost('narrowbody')} cost={250} onBuy={(n, isShift) => buyItem('slots', 'narrowbody', n, isShift)} />
                       {level >= 3 && (
                         <InfaRow label="Widebody" count={infrastructure.slots.widebody} used={utilizedSlots.widebody} showUtilBar={true} purchaseCost={getSlotPurchaseCost('widebody')} cost={250} onBuy={(n, isShift) => buyItem('slots', 'widebody', n, isShift)} />
                       )}
                    </div>
                  </div>

                  {/* STANDS SECTION */}
                  {level >= 3 && (
                    <div className="space-y-4 pt-4 border-t border-white/5">
                      <div className="flex justify-between items-center">
                        <SectionLabel icon={<Anchor size={12} className="text-white/80"/>} label="Gate/Stand Upgrades (+2 SAT)" />
                        {hubAutoUpgrade ? (
                          <span className="text-[8px] text-white/80 font-black animate-pulse uppercase tracking-widest">Automatic Hub Upgrade Enabled</span>
                        ) : (
                          <button
                            onClick={() => {
                              onUpdateInfrastructure({
                                ...infrastructure,
                                autoBuyStands: !infrastructure.autoBuyStands
                              });
                            }}
                            className={`px-2 py-1 text-[8px] font-black uppercase tracking-widest border transition-all ${
                              infrastructure.autoBuyStands 
                                ? 'bg-aero-yellow text-black border-aero-yellow' 
                                : 'bg-transparent text-white/50 border-white/10 hover:border-white/30'
                            }`}
                          >
                            {infrastructure.autoBuyStands ? "Auto-Buy: ON" : "Auto-Buy: OFF"}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                         <InfaRow 
                           label="NB Gate Stand" 
                           count={hubAutoUpgrade ? infrastructure.slots.narrowbody : infrastructure.stands.narrowbody} 
                           cost={hubAutoUpgrade ? 0 : standUpgradeCosts.narrowbody} 
                           onBuy={(n, isShift) => buyItem('stands', 'narrowbody', n, isShift)}
                           disabled={hubAutoUpgrade} 
                         />
                         <InfaRow 
                           label="WB Gate Stand" 
                           count={hubAutoUpgrade ? infrastructure.slots.widebody : infrastructure.stands.widebody} 
                           cost={hubAutoUpgrade ? 0 : standUpgradeCosts.widebody} 
                           onBuy={(n, isShift) => buyItem('stands', 'widebody', n, isShift)}
                           disabled={hubAutoUpgrade} 
                         />
                      </div>
                    </div>
                  )}

                  {/* CHECK-IN SECTION */}
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <div className="flex justify-between items-center">
                      <SectionLabel icon={<Info size={12} className="text-aero-yellow"/>} label="Passenger Processing" />
                      <div className={`text-[10px] font-bold px-2 py-0.5 rounded-sm ${satDeduction < 0 || (!infrastructure.desks.normal && !infrastructure.desks.self) ? 'bg-[#111] text-aero-yellow/60' : 'bg-aero-yellow/10 text-aero-yellow'}`}>
                         SAT Impact: {(!infrastructure.desks.normal && !infrastructure.desks.self) ? '-15.0 to -25.0 (No Desks)' : (satDeduction === 0 ? '0.0' : `${satDeduction > 0 ? '+' : ''}${satDeduction.toFixed(1)} (Overload)`)}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                       <InfaRow label="Standard Desk" count={infrastructure.desks.normal} cost={deskCosts.normal} onBuy={(n, isShift) => buyItem('desks', 'normal', n, isShift)} info={`Cap: ${deskCapacities.normal} pax/wk`} />
                       {currentYear >= 1995 && (
                         <InfaRow label="Self-Check-In" count={infrastructure.desks.self} cost={deskCosts.self} onBuy={(n, isShift) => buyItem('desks', 'self', n, isShift)} info={`Cap: ${deskCapacities.self} pax/wk | -1 SAT`} />
                       )}
                    </div>
                    <div className="mt-2 text-[10px] text-white/30 space-y-1">
                       <div className="flex justify-between"><span>Current Weekly Load:</span> <span className={deskLoad > 90 ? 'text-aero-yellow/60' : 'text-white'}>{deskLoad.toFixed(1)}%</span></div>
                       <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                         <div className={`h-full transition-all ${deskLoad > 100 ? 'bg-[#1a1a1a]' : deskLoad > 80 ? 'bg-aero-yellow' : 'bg-aero-yellow/20'}`} style={{ width: `${Math.min(100, deskLoad)}%` }}></div>
                       </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center justify-center text-center gap-3 border-2 border-dashed border-white/5">
                  <Lock size={48} className="text-white/10" />
                  <div className="space-y-2">
                    <div className="text-xl font-black italic text-white uppercase tracking-widest">Access Protocol Locked</div>
                    <div className="text-[10px] text-white/40 uppercase tracking-widest">Require Level 1 Management Permit: {formatCurrency(level * 30000)}</div>
                  </div>
                  <button 
                    onClick={() => onBuyManagement(1)}
                    className="px-4 py-3 bg-white text-black font-black text-xs uppercase tracking-[0.2em] hover:bg-aero-yellow transition-all"
                  >
                    Initiate Setup
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Strategic Expansion */}
          <div className="flex flex-col gap-3">
            {infrastructure.level >= 2 ? (
              <div className="bg-aero-carbon border border-aero-yellow p-4 flex flex-col gap-3 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 text-aero-yellow/5">
                  <Anchor size={200} />
                </div>
                <div className="relative z-10 flex flex-col">
                  <div className="text-aero-yellow text-[10px] font-black uppercase tracking-[0.3em] mb-1">Active Protocol</div>
                  <div className="text-2xl font-black italic text-white uppercase tracking-widest flex items-center gap-3">
                    <Anchor size={24} className="text-aero-yellow" />
                    Hub Operations
                  </div>
                </div>
                
                <div className="relative z-10 grid grid-cols-1 gap-4">
                  {/* Maintenance Hangar */}
                  <div className="bg-white/5 border border-white/10 p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="text-white font-black uppercase tracking-widest text-sm">Maintenance Hangar</div>
                        <div className="text-[10px] text-white/50 mt-1 uppercase tracking-widest w-64">-0.2% GC loss per idle hr / Allows Gen. Check</div>
                      </div>
                      {infrastructure.hubFacilities?.hangar ? (
                        <div className="text-[10px] bg-aero-yellow/20 text-black px-2 py-1 font-bold rounded-sm animate-pulse">ACTIVE</div>
                      ) : (
                        <button 
                          onClick={() => {
                            if (capital >= 250000) {
                              onSubtractCapital(250000);
                              onUpdateInfrastructure({
                                ...infrastructure,
                                hubFacilities: { ...infrastructure.hubFacilities, hangar: true }
                              });
                            }
                          }}
                          disabled={capital < 250000}
                          className="px-4 py-2 bg-white text-black font-black uppercase tracking-widest text-[10px] hover:bg-aero-yellow transition-all disabled:opacity-50"
                        >
                          Construct - {formatCurrency(250000)}
                        </button>
                      )}
                    </div>
                    {infrastructure.hubFacilities?.hangar && (
                      <div className="mt-4 border-t border-white/10 pt-4 flex flex-col gap-2">
                        <div className="text-[10px] text-white/50 uppercase tracking-widest">
                          Perform General Check (200k)
                        </div>
                        <div className="flex gap-2">
                          <select 
                            className="flex-1 bg-black/40 border border-white/10 text-white text-xs p-2 outline-none font-mono"
                            value={selectedAircraftForCheck}
                            onChange={(e) => setSelectedAircraftForCheck(e.target.value)}
                          >
                            <option value="">-- Select Aircraft --</option>
                            {fleet.map(plane => {
                              const checks = plane.generalChecksDone || 0;
                              return (
                                <option key={plane.registration} value={plane.registration} disabled={checks >= 4}>
                                  {plane.registration} - {plane.type} (GC: {Math.floor(plane.conditionGeneral)}%, Checks: {checks}/4)
                                </option>
                              );
                            })}
                          </select>
                          <button 
                            disabled={!selectedAircraftForCheck || capital < 200000}
                            onClick={() => {
                              onPerformGeneralCheck(selectedAircraftForCheck);
                              setSelectedAircraftForCheck("");
                            }}
                            className="px-4 py-2 bg-aero-yellow text-black font-black uppercase tracking-widest text-[10px] hover:bg-white transition-all disabled:opacity-50"
                          >
                            Service
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* VIP Lounge */}
                  <div className="bg-white/5 border border-white/10 p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-white font-black uppercase tracking-widest text-sm">VIP Lounge</div>
                        <div className="text-[10px] text-white/50 mt-1 uppercase tracking-widest">+4 SAT (Bus/First), +1 SAT (PE)</div>
                      </div>
                      {infrastructure.hubFacilities?.vipLounge ? (
                        <div className="text-[10px] bg-aero-yellow/20 text-black px-2 py-1 font-bold rounded-sm animate-pulse">ACTIVE</div>
                      ) : (
                        <button 
                          onClick={() => {
                            if (capital >= 1000000) {
                              onSubtractCapital(1000000);
                              onUpdateInfrastructure({
                                ...infrastructure,
                                hubFacilities: { ...infrastructure.hubFacilities, vipLounge: true }
                              });
                            }
                          }}
                          disabled={capital < 1000000}
                          className="px-4 py-2 bg-white text-black font-black uppercase tracking-widest text-[10px] hover:bg-aero-yellow transition-all disabled:opacity-50"
                        >
                          Construct - {formatCurrency(1000000)}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Catering Facility */}
                  <div className="bg-white/5 border border-white/10 p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-white font-black uppercase tracking-widest text-sm">Advanced Catering</div>
                        <div className="text-[10px] text-white/50 mt-1 uppercase tracking-widest">Enables high-end meal prep</div>
                      </div>
                      {infrastructure.hubFacilities?.catering ? (
                        <div className="text-[10px] bg-aero-yellow/20 text-black px-2 py-1 font-bold rounded-sm animate-pulse">ACTIVE</div>
                      ) : (
                        <button 
                          onClick={() => {
                            if (capital >= 250000) {
                              onSubtractCapital(250000);
                              onUpdateInfrastructure({
                                ...infrastructure,
                                hubFacilities: { ...infrastructure.hubFacilities, catering: true }
                              });
                            }
                          }}
                          disabled={capital < 250000}
                          className="px-4 py-2 bg-white text-black font-black uppercase tracking-widest text-[10px] hover:bg-aero-yellow transition-all disabled:opacity-50"
                        >
                          Construct - {formatCurrency(250000)}
                        </button>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            ) : (
              <ManagementTierCard 
                tier={2} 
                activeTier={infrastructure.level} 
                label="Hub Operations" 
                cost={level * 750000} 
                onUpgrade={() => onBuyManagement(2)}
                icon={<Anchor size={24} />}
                features={[
                  "Advanced Slot Scheduling",
                  "Automatic Gate Stand Upgrades",
                  "Crew Station Housing",
                  "Secondary Maintenance Facility"
                ]}
              />
            )}
            <ManagementTierCard 
              tier={3} 
              activeTier={infrastructure.level} 
              label="Corporate Ownership" 
              cost={level * 500000000} 
              onUpgrade={() => onBuyManagement(3)}
              icon={<Crown size={24} />}
              features={[
                "Full Revenue Collection",
                "Terminal Branding Rights",
                "Infrastructure Resale",
                "Strategic Control"
              ]}
            />
          </div>
        </div>
      </div>

      {/* Management Required Modal */}
      {showMgmtModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] p-4 border border-white/10 max-w-md w-full relative z-[101]">
            <h3 className="text-xl font-black uppercase text-aero-yellow mb-2">Management Required</h3>
            <p className="text-white/70 mb-4 text-sm">
              Level-1 management is required to create a route. Do you want to buy it now?
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  if (capital >= airport.level * 30000) {
                    onBuyManagement(1);
                    onStartRoute(airport.id, 'destination');
                    setShowMgmtModal(false);
                  }
                }}
                disabled={capital < airport.level * 30000}
                className="flex-1 px-4 bg-aero-yellow text-black font-black uppercase text-[10px] py-3 hover:bg-white transition-colors disabled:opacity-50"
              >
                Yes, buy for {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(airport.level * 30000)}
              </button>
              <button 
                onClick={() => setShowMgmtModal(false)}
                className="flex-1 bg-white/5 text-white border border-white/10 font-bold uppercase text-[10px] py-3 hover:bg-white/10 transition-colors"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, highlight, color, info }: { label: string, value: string, highlight?: boolean, color?: string, info?: keyof typeof GLOSSARY }) {
  return (
    <div className="flex flex-col">
      <span className="text-[8px] text-white/30 uppercase tracking-[0.2em] mb-0.5 flex items-center">
        {label}
        {info && <InfoTooltip size={11} {...GLOSSARY[info]} />}
      </span>
      <span className={`text-xs font-black ${highlight ? 'text-aero-yellow' : color || 'text-white'}`}>{value}</span>
    </div>
  );
}

function SectionLabel({ icon, label }: { icon: React.ReactNode, label: string }) {
  return (
    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-black text-white/60">
      {icon}
      {label}
    </div>
  );
}

function InfaRow({ label, count, used = 0, cost, purchaseCost, onBuy, disabled, info, showUtilBar = false }: { label: string, count: number, used?: number, cost: number, purchaseCost?: number, onBuy: (n: number, isShift: boolean) => void, disabled?: boolean, info?: string, showUtilBar?: boolean }) {
  const utilPercent = count > 0 ? Math.round((used / count) * 100) : 0;
  return (
    <div className={`p-3 border transition-colors flex flex-col gap-2 ${disabled ? 'bg-white/[0.02] border-white/5 opacity-50' : 'bg-white/5 border-white/10 hover:border-white/20'}`}>
      <div className="flex items-center justify-between w-full">
        <div className="flex flex-col">
          <span className="text-[11px] font-bold text-white uppercase tracking-widest">{label}</span>
          {info && <span className="text-[9px] text-white/30 italic mt-0.5">{info}</span>}
          <span className="text-[8px] text-aero-yellow mt-1 flex items-center">
            {purchaseCost !== undefined ? `${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(purchaseCost)} CAPEX` : ''}
            {purchaseCost !== undefined && cost > 0 && " + "}
            {cost > 0 ? `${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cost)} / wk` : (!purchaseCost ? 'FREE / INCLUDED' : '')}
            <InfoTooltip size={11} {...GLOSSARY.capex} />
          </span>
        </div>
        <div className="flex items-center gap-4">
          {showUtilBar && (
            <div className="text-right flex flex-col items-end border-r border-white/10 pr-4">
              <div className="text-[8px] text-white/20 uppercase mb-0.5">Utilized</div>
              <div className="text-sm font-black text-white">{used} <span className="text-[9px] font-normal text-white/40">/ {count}</span></div>
            </div>
          )}
          <div className="text-right">
            <div className="text-[8px] text-white/20 uppercase mb-0.5">Stock</div>
            <div className="text-lg font-black text-white">{count}</div>
          </div>
          <div className="flex gap-1" title={count > 0 && used > 0 ? `Cannot sell below current flight schedule use of ${used} slots.` : "Shift-Click to add or remove 10 units at once."}>
            <button 
              disabled={disabled || count <= 0 || (showUtilBar && count <= used)} 
              onClick={(e) => onBuy(-1, e.shiftKey)}
              className="w-10 h-10 flex items-center justify-center bg-black/40 border border-white/5 hover:border-aero-yellow disabled:opacity-30 transition-all text-white/80"
            >
              <Minus size={14} />
            </button>
            <button 
              disabled={disabled} 
              onClick={(e) => onBuy(1, e.shiftKey)}
              className="w-10 h-10 flex items-center justify-center bg-white text-black font-black hover:bg-aero-yellow transition-all"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>
      {showUtilBar && count > 0 && (
        <div className="w-full flex flex-col gap-1 mt-1 border-t border-white/5 pt-2">
          <div className="flex justify-between text-[8px] uppercase tracking-widest text-white/30 leading-none">
            <span>Slot Utilization</span>
            <span className={utilPercent > 90 ? 'text-aero-yellow font-bold' : 'text-white/40'}>{utilPercent}%</span>
          </div>
          <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden relative overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${utilPercent > 90 ? 'bg-aero-yellow' : 'bg-aero-yellow'}`} 
              style={{ width: `${Math.min(100, utilPercent)}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
}

function ManagementTierCard({ tier, activeTier, label, cost, onUpgrade, icon, features }: { tier: number, activeTier: number, label: string, cost: number, onUpgrade: () => void, icon: React.ReactNode, features: string[] }) {
  const isAcquired = activeTier >= tier;
  const isLocked = activeTier < tier - 1;

  return (
    <div className={`border p-4 shadow-2xl transition-all flex flex-col gap-3 ${isAcquired ? 'bg-aero-yellow text-black border-aero-yellow' : 'bg-aero-carbon border-white/10'}`}>
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <div className={`text-[10px] font-black uppercase tracking-[0.4em] ${isAcquired ? 'text-black/60' : 'text-aero-yellow'}`}>T{tier} Management</div>
          <div className="text-2xl font-black uppercase italic tracking-tighter">{label}</div>
        </div>
        <div className={isAcquired ? 'text-black' : 'text-white/20'}>{icon}</div>
      </div>

      <div className={`grid grid-cols-1 gap-2 ${isAcquired ? 'text-black/80' : 'text-white/50'}`}>
         {features.map((f, i) => (
           <div key={i} className="text-[10px] flex gap-2 items-center uppercase tracking-widest font-black">
             <div className={`w-1.5 h-1.5 rounded-full ${isAcquired ? 'bg-black' : 'bg-white/20'}`}></div>
             {f}
           </div>
         ))}
      </div>

      {!isAcquired && (
        <button 
          onClick={onUpgrade}
          disabled={isLocked}
          className={`w-full py-4 font-black transition-all text-xs uppercase tracking-[0.3em] ${isLocked ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5' : 'bg-white text-black hover:bg-aero-yellow'}`}
        >
          {isLocked ? 'LOCKED: PRE-REQUISITE REQ.' : `ACQUIRE ACCESS - ${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cost)}`}
        </button>
      )}

      {isAcquired && (
        <div className="w-full py-4 border-2 border-black/20 text-center font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-2">
           <Info size={14} /> ACTIVE PROTOCOL
        </div>
      )}
    </div>
  );
}
