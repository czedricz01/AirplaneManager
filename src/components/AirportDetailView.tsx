import React, { useMemo } from 'react';
import { formatCurrency, formatNumber, yearOf } from '../lib/format';
import { Airport, getAirportStats } from '../data/airports';
import { X, Target, Lock, Crown, Anchor, Plus, Minus, Info, ArrowRightLeft } from 'lucide-react';
import type { AirportInfrastructure, SimulatedRoute } from '../lib/gameTypes';

import type { OwnedAircraft } from './MyFleetView';
import { InfoTooltip, GLOSSARY } from './InfoTooltip';

import { getAirportUpkeep, getSlotPurchaseCost, SLOT_CAPEX_LABEL, applyInfrastructureChange, getDeskSim, getManagementUnlockCost, getInfraAvailability } from '../lib/financeUtils';
import { getUsedWeeklySlots } from '../lib/scheduleUtils';
import { hubQuality, MIN_CONNECTION_MIN, MAX_CONNECTION_MIN, type HubTransferStats } from '../lib/transferUtils';

interface Props {
  airport: Airport;
  currentDateOffset: number;
  onClose: () => void;
  infrastructure: AirportInfrastructure;
  onBuyManagement: (level: number) => void;
  onUpdateInfrastructure: (infra: AirportInfrastructure) => void;
  /**
   * Takes a one-off cost out of the capital at once; a negative amount pays
   * money in. `label` names the line in the month's report.
   */
  onSubtractCapital: (amount: number, label?: string) => void;
  /**
   * Surfaces a refused or trimmed purchase. Every guard below used to `return`
   * without a word, so a click that bought nothing looked identical to a click
   * that worked.
   */
  onNotify?: (message: string) => void;
  capital: number;
  onManageRoutes: () => void;
  onStartRoute: (airportId: string, role: 'origin'|'destination') => void;
  fleet: OwnedAircraft[];
  routes?: SimulatedRoute[];
  onPerformGeneralCheck: (reg: string) => void;
  aiAirlines?: any[];
  /** Passengers changing planes here this month, from the network pricing. */
  transferHub?: HubTransferStats;
  /**
   * Why something cannot be built at the airline's current rank, or null when
   * it can: the second hub, management tier 3, the VIP lounge. `airport` is
   * set while the airport itself is closed at the rank: nothing can be built
   * or started here until the rank opens it.
   */
  gates?: { airport?: string | null; tier2?: string | null; tier3?: string | null; vipLounge?: string | null };
}

export function AirportDetailView({ 
  airport, 
  currentDateOffset, 
  onClose, 
  infrastructure,
  onBuyManagement,
  onUpdateInfrastructure,
  onSubtractCapital,
  onNotify,
  capital,
  onManageRoutes,
  onStartRoute,
  fleet,
  routes = [],
  onPerformGeneralCheck,
  aiAirlines = [],
  transferHub,
  gates
}: Props) {
  const [showCostBreakdown, setShowCostBreakdown] = React.useState(false);
  const [selectedAircraftForCheck, setSelectedAircraftForCheck] = React.useState<string>("");
  const [showMgmtModal, setShowMgmtModal] = React.useState(false);

  const level = airport.level;
  const currentYear = yearOf(currentDateOffset);
  
  const hubAutoUpgrade = infrastructure.level >= 2;
  // Same rules and prices as the route planner.
  const avail = getInfraAvailability(airport, currentYear);
  const unlockCost = (tier: number) => getManagementUnlockCost(level, tier);

  const handleStartRouteClick = () => {
    if (gates?.airport) {
      onNotify?.(gates.airport);
      return;
    }
    if (infrastructure.level === 0) {
      setShowMgmtModal(true);
    } else if (infrastructure.level === 1) {
      onStartRoute(airport.id, 'destination');
    } else {
      onStartRoute(airport.id, 'origin');
    }
  };

  const upkeepData = useMemo(() => {
    return getAirportUpkeep(airport, infrastructure, routes, fleet, currentYear);
  }, [airport, infrastructure, routes, fleet, currentYear]);

  const {
    slotCosts,
    standUpgradeCosts,
    deskCosts,
    deskCapacities,
    passengerData
  } = upkeepData;

  // Check-in load and its SAT effect exactly as the economy computes them. This
  // screen used its own formula (all seats both ways, a different penalty), so
  // it could show an overload the routes never paid for, and the reverse.
  const deskSim = useMemo(
    () => getDeskSim(airport.id, { [airport.id]: infrastructure }, routes, fleet),
    [airport.id, infrastructure, routes, fleet]
  );
  const deskLoad = deskSim.load;
  const satDeduction = deskSim.sat;
  const hasNoDesks = !infrastructure.desks.normal && !infrastructure.desks.self;
  const selfServiceOnly = !infrastructure.desks.normal && !!infrastructure.desks.self;

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
    const fleetByRegistration = new Map(fleet.map(f => [f.registration, f]));
    const used = (cls: string) => getUsedWeeklySlots(routes || [], fleetByRegistration, airport.id, cls);
    return { regional: used('regional'), narrowbody: used('narrowbody'), widebody: used('widebody') };
  }, [airport.id, routes, fleet]);

  const availableSlots = Math.max(0, totalSlots - usedSlots - aiSlotsUsed); 

    // We no longer calculate max aircraft string here since we use ICAO codes


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
      // Slots are paid for on the spot, like every other one-off cost. Selling
      // some back is a negative cost, which pays the refund in at once.
      if (result.cost > 0 && capital < result.cost) {
        onNotify?.(
          `${plural(result.actualAmount)} at ${airport.id} cost ${formatCurrency(result.cost)}, ` +
          `but you only have ${formatCurrency(capital)}. Nothing was bought.`
        );
        return;
      }
      onSubtractCapital(result.cost, SLOT_CAPEX_LABEL);
    }

    onUpdateInfrastructure(result.infra);
  };

  return (
    <div className="absolute inset-0 z-[2000] flex flex-col bg-ground overflow-hidden pointer-events-auto">

      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        {/* Phones: title above the buttons, and a smaller title. Sideways: one
            slim row without the eyebrow line. */}
        <div className="p-4 pb-4 bar:p-3 short:px-3 short:py-1.5 flex flex-col md:flex-row justify-between items-start short:items-center gap-3 short:gap-2 border-b border-line bg-raised/80">
          <div className="flex flex-col min-w-0">
            <h1 className="font-label text-3xl md:text-3xl bar:text-2xl short:text-2xl font-semibold text-ink flex flex-wrap items-center gap-x-4 short:gap-x-3 gap-y-1">
              {airport.name} <span className="text-accent font-normal not-italic opacity-50">[{airport.id}] <span className="text-2xl bar:text-lg short:text-lg ml-4 bar:ml-2 short:ml-2 font-semibold text-accent">L{airport.level}</span></span>
            </h1>
          </div>
          <div className="flex items-center gap-2 md:gap-4 short:gap-2 short:shrink-0">
            <button
              onClick={handleStartRouteClick}
              className="px-3 py-3 bar:py-2 short:py-1.5 bg-surface text-ink font-semibold uppercase tracking-label hover:bg-accent hover:text-on-accent transition-all text-xs border border-line"
            >
              New Route +
            </button>
            <button
              onClick={onManageRoutes}
              className="px-3 py-3 bar:py-2 short:py-1.5 bg-accent text-on-accent font-semibold uppercase tracking-label hover:bg-ink transition-all text-xs border border-transparent"
            >
              My Routes
            </button>
            <button 
              onClick={onClose}
              className="p-3 bar:p-2 short:p-1.5 bg-surface hover:bg-accent hover:text-on-accent transition-all border border-line"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Infobar */}
        {/* Wraps onto several lines on phones instead of running off the right edge. */}
        <div className="bg-surface border-b border-line py-2 short:py-1.5 px-4 bar:px-3 short:px-3 flex flex-wrap md:flex-nowrap short:flex-wrap justify-between short:justify-start items-center gap-x-4 gap-y-2 md:gap-2 short:gap-x-5 short:gap-y-1 uppercase tracking-label text-2xs">
          <Metric label="Level" value={`L${airport.level}`} highlight />
          <Metric label="Mgmt" value={
            infrastructure.level === 0 ? 'None' : 
            infrastructure.level === 1 ? 'Standard' :
            infrastructure.level === 2 ? 'Hub' : 'Owner'
          } />
          <Metric label="Business" value={formatNumber(getAirportStats(airport, currentYear).business)} />
          <Metric label="Tourism" value={formatNumber(getAirportStats(airport, currentYear).tourism)} />
          <Metric label="Weekly Seats" value={formatNumber(passengerData.total)} />
          <div className="flex flex-col relative group min-w-[100px]">
            <span className="text-muted text-2xs mb-0.5 flex items-center gap-1 cursor-pointer hover:text-ink transition-colors" onClick={() => setShowCostBreakdown(!showCostBreakdown)}>
              Weekly Costs <Info size={8} />
            </span>
            <span className="text-xs font-semibold text-accent">{formatCurrency(weeklyExpenses)}</span>
            
            {showCostBreakdown && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-raised border border-line p-4 z-50 rounded-sm normal-case">
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-line">
                  <span className="text-ink font-semibold text-xs uppercase tracking-label">Ops Breakdown</span>
                  <button onClick={() => setShowCostBreakdown(false)} className="text-muted hover:text-ink"><X size={12}/></button>
                </div>
                <div className="space-y-1 text-muted text-2xs">
                  {costBreakdown.slots.regional > 0 && <div className="flex justify-between"><span>Reg Slot Admin:</span> <span>{formatCurrency(costBreakdown.slots.regional)}</span></div>}
                  {costBreakdown.slots.narrowbody > 0 && <div className="flex justify-between"><span>NB Slot Admin:</span> <span>{formatCurrency(costBreakdown.slots.narrowbody)}</span></div>}
                  {costBreakdown.slots.widebody > 0 && <div className="flex justify-between"><span>WB Slot Admin:</span> <span>{formatCurrency(costBreakdown.slots.widebody)}</span></div>}
                  {costBreakdown.stands.regional > 0 && <div className="flex justify-between"><span>Reg Stands:</span> <span>{formatCurrency(costBreakdown.stands.regional)}</span></div>}
                  {costBreakdown.stands.narrowbody > 0 && <div className="flex justify-between"><span>NB Stands:</span> <span>{formatCurrency(costBreakdown.stands.narrowbody)}</span></div>}
                  {costBreakdown.stands.widebody > 0 && <div className="flex justify-between"><span>WB Stands:</span> <span>{formatCurrency(costBreakdown.stands.widebody)}</span></div>}
                  {costBreakdown.desks.normal > 0 && <div className="flex justify-between"><span>Check-in:</span> <span>{formatCurrency(costBreakdown.desks.normal)}</span></div>}
                  {costBreakdown.desks.self > 0 && <div className="flex justify-between"><span>Self-Check:</span> <span>{formatCurrency(costBreakdown.desks.self)}</span></div>}
                  {(costBreakdown.facilities.hangar > 0 || costBreakdown.facilities.vip > 0 || costBreakdown.facilities.catering > 0) && <div className="flex justify-between pt-2 border-t border-line"><span>Facilities:</span> <span>{formatCurrency(costBreakdown.facilities.hangar + costBreakdown.facilities.vip + costBreakdown.facilities.catering)}</span></div>}
                  <div className="flex justify-between pt-2 mt-2 border-t border-rule text-ink font-semibold"><span>Total/wk:</span> <span className="text-accent">{formatCurrency(weeklyExpenses)}</span></div>
                </div>
              </div>
            )}
          </div>
          <Metric label="Available Slots" info="slots" value={`${Math.max(0, totalSlots - usedSlots - aiSlotsUsed)} / ${totalSlots}`} color={aiSlotsUsed > 0 ? "text-accent" : "text-ink"} />
          <Metric label="Max ICAO Code" value={airport.maxIcaoCode} info="icaoCode" />
          {(() => {
             const hubBonus = infrastructure.level >= 2;
             const paxUnitFee = (hubBonus ? 0.475 : 0.5) + (level >= 5 ? 5 : level >= 3 ? 4 : 3);
             const minLandingFee = Math.floor((2000 + 100 * level) * 1.1 * (hubBonus ? 0.95 : 1));
             return (
               <>
                 <Metric label="Landing Fee (Reg, 100+ seats)" value={formatCurrency(minLandingFee)} />
                 <Metric label="Pax Handling Fee" value={`${formatCurrency(paxUnitFee)} / pax`} />
               </>
             );
          })()}
        </div>


        {/* Main Interface */}
        <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto overflow-x-hidden">
          {/* Left Column: Operations Dashboard */}
          <div className="flex flex-col gap-3">
            <div className="bg-raised border border-line p-4 flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-line pb-4">
                <div className="flex items-center gap-3">
                  <Target className="text-accent" size={20} />
                  <span className="text-sm font-semibold">Infrastructure Controls</span>
                </div>
                {infrastructure.level >= 1 ? (
                  <span className="text-2xs font-label font-semibold uppercase tracking-label text-good border border-good rounded-sm px-1.5 py-0.5">Systems online</span>
                ) : (
                  <span className="text-2xs bg-raised text-muted px-2 py-0.5 rounded-sm">Offline</span>
                )}
              </div>

              {infrastructure.level >= 1 ? (
                <div className="flex flex-col gap-4">
                  {/* SLOTS SECTION */}
                  <div className="space-y-4">
                    <SectionLabel icon={<Plus size={12}/>} label="Flight Slots" />
                    <div className="grid grid-cols-1 gap-2">
                        <InfaRow label="Regional" count={infrastructure.slots.regional} used={utilizedSlots.regional} showUtilBar={true} purchaseCost={getSlotPurchaseCost('regional')} cost={slotCosts.regional} onBuy={(n, isShift) => buyItem('slots', 'regional', n, isShift)} />
                        <InfaRow label="Narrowbody" count={infrastructure.slots.narrowbody} used={utilizedSlots.narrowbody} showUtilBar={true} purchaseCost={getSlotPurchaseCost('narrowbody')} cost={slotCosts.narrowbody} onBuy={(n, isShift) => buyItem('slots', 'narrowbody', n, isShift)} />
                       {avail.widebodySlots && (
                         <InfaRow label="Widebody" count={infrastructure.slots.widebody} used={utilizedSlots.widebody} showUtilBar={true} purchaseCost={getSlotPurchaseCost('widebody')} cost={slotCosts.widebody} onBuy={(n, isShift) => buyItem('slots', 'widebody', n, isShift)} />
                       )}
                    </div>
                  </div>

                  {/* STANDS SECTION */}
                  {avail.stands && (
                    <div className="space-y-4 pt-4 border-t border-line">
                      <div className="flex justify-between items-center">
                        <SectionLabel icon={<Anchor size={12} className="text-ink"/>} label="Gate/Stand Upgrades (up to +2 quality pts)" />
                        {hubAutoUpgrade ? (
                          <span className="text-2xs text-ink font-semibold uppercase tracking-label">Automatic Hub Upgrade Enabled</span>
                        ) : (
                          <button
                            onClick={() => {
                              onUpdateInfrastructure({
                                ...infrastructure,
                                autoBuyStands: !infrastructure.autoBuyStands
                              });
                            }}
                            className={`px-2 py-1 text-2xs font-semibold uppercase tracking-label border transition-all ${
                              infrastructure.autoBuyStands 
                                ? 'bg-accent text-on-accent border-accent' 
                                : 'bg-transparent text-muted border-line hover:border-rule'
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
                  <div className="space-y-4 pt-4 border-t border-line">
                    <div className="flex justify-between items-center">
                      <SectionLabel icon={<Info size={12} className="text-accent"/>} label="Passenger Processing" />
                      <div className={`text-2xs font-semibold px-2 py-0.5 rounded-sm ${satDeduction < 0 || (!infrastructure.desks.normal && !infrastructure.desks.self) ? 'bg-bad/10 text-bad' : 'bg-accent/10 text-accent'}`}>
                         SAT Impact: {hasNoDesks ? '-15 quality pts (No Desks)' : (satDeduction === 0 ? '0.0' : `${formatNumber(satDeduction, 1)}%${deskLoad > 80 ? ' (Load)' : ' (Self-check share)'}`)}{selfServiceOnly ? ' | Premium cabins -10 quality pts (no staffed desk)' : ''}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                       <InfaRow label="Standard Desk" count={infrastructure.desks.normal} cost={deskCosts.normal} onBuy={(n, isShift) => buyItem('desks', 'normal', n, isShift)} info={`Cap: ${deskCapacities.normal} pax/wk`} />
                       {avail.selfCheckIn && (
                         <InfaRow label="Self-Check-In" count={infrastructure.desks.self} cost={deskCosts.self} onBuy={(n, isShift) => buyItem('desks', 'self', n, isShift)} info={`Cap: ${deskCapacities.self} pax/wk | -1 SAT`} />
                       )}
                    </div>
                    <div className="mt-2 text-2xs text-muted space-y-1">
                       <div className="flex justify-between"><span>Weekly seats (check-in):</span> <span className="text-ink">{formatNumber(deskSim.myPax)} / {formatNumber(deskSim.cap)}</span></div>
                       <div className="flex justify-between"><span>Current Weekly Load:</span> <span className={deskLoad > 90 ? 'text-bad' : 'text-ink'}>{formatNumber(deskLoad, 1)}%</span></div>
                       <div className="w-full h-1 bg-surface rounded-full overflow-hidden">
                         <div className={`h-full transition-all ${deskLoad > 100 ? 'bg-bad' : deskLoad > 80 ? 'bg-accent' : 'bg-accent/20'}`} style={{ width: `${Math.min(100, deskLoad)}%` }}></div>
                       </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center justify-center text-center gap-3 border-2 border-dashed border-line">
                  <Lock size={48} className="text-muted" />
                  <div className="space-y-2">
                    <div className="text-xl font-semibold text-ink">Locked</div>
                    <div className="text-2xs text-muted uppercase tracking-label">Require Level 1 Management Permit: {formatCurrency(unlockCost(1))}</div>
                    {gates?.airport && (
                      <div className="text-2xs text-bad normal-case max-w-md mx-auto leading-relaxed">{gates.airport}</div>
                    )}
                  </div>
                  <button 
                    onClick={() => onBuyManagement(1)}
                    disabled={!!gates?.airport}
                    className="px-4 py-3 bg-accent text-on-accent font-semibold text-xs uppercase tracking-label hover:bg-ink transition-all disabled:bg-surface disabled:text-muted disabled:cursor-not-allowed"
                  >
                    {gates?.airport ? 'Locked: Rank' : 'Initiate Setup'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Strategic Expansion */}
          <div className="flex flex-col gap-3">
            <TransferHubCard stats={transferHub} quality={hubQuality(infrastructure)} />
            {infrastructure.level >= 2 ? (
              <div className="bg-surface border border-line p-4 flex flex-col gap-3">
                <div className="relative z-10 flex flex-col">
                  <div className="text-2xl font-semibold text-ink flex items-center gap-3">
                    <Anchor size={24} className="text-accent" />
                    Hub Operations
                  </div>
                </div>
                
                <div className="relative z-10 grid grid-cols-1 gap-4">
                  {/* Maintenance Hangar */}
                  <div className="bg-surface border border-line p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="text-ink font-semibold text-sm">Maintenance Hangar</div>
                        <div className="text-2xs text-muted mt-1 uppercase tracking-label w-64">Allows general checks at this hub</div>
                      </div>
                      {infrastructure.hubFacilities?.hangar ? (
                        <div className="text-2xs font-label font-semibold uppercase tracking-label text-good border border-good rounded-sm px-1.5 py-0.5">Active</div>
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
                          className="px-4 py-2 bg-accent text-on-accent font-semibold uppercase tracking-label text-2xs hover:bg-ink transition-all disabled:opacity-50"
                        >
                          Construct - {formatCurrency(250000)}
                        </button>
                      )}
                    </div>
                    {infrastructure.hubFacilities?.hangar && (
                      <div className="mt-4 border-t border-line pt-4 flex flex-col gap-2">
                        <div className="text-2xs text-muted uppercase tracking-label">
                          Perform General Check (200k)
                        </div>
                        <div className="flex gap-2">
                          <select 
                            className="flex-1 bg-ground/40 border border-line text-ink text-xs p-2 outline-none"
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
                            className="px-4 py-2 bg-accent text-on-accent font-semibold uppercase tracking-label text-2xs hover:bg-ink transition-all disabled:opacity-50"
                          >
                            Service
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* VIP Lounge */}
                  <div className="bg-surface border border-line p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-ink font-semibold text-sm">VIP Lounge</div>
                        <div className="text-2xs text-muted mt-1 uppercase tracking-label">+4 quality pts (Bus/First), +1 (PE)</div>
                        {gates?.vipLounge && !infrastructure.hubFacilities?.vipLounge && (
                          <div className="text-2xs text-bad mt-2 normal-case max-w-xs">{gates.vipLounge}</div>
                        )}
                      </div>
                      {infrastructure.hubFacilities?.vipLounge ? (
                        <div className="text-2xs font-label font-semibold uppercase tracking-label text-good border border-good rounded-sm px-1.5 py-0.5">Active</div>
                      ) : (
                        <button 
                          onClick={() => {
                            if (gates?.vipLounge) {
                              onNotify?.(gates.vipLounge);
                              return;
                            }
                            if (capital >= 1000000) {
                              onSubtractCapital(1000000);
                              onUpdateInfrastructure({
                                ...infrastructure,
                                hubFacilities: { ...infrastructure.hubFacilities, vipLounge: true }
                              });
                            }
                          }}
                          disabled={capital < 1000000 || !!gates?.vipLounge}
                          className="px-4 py-2 bg-accent text-on-accent font-semibold uppercase tracking-label text-2xs hover:bg-ink transition-all disabled:opacity-50"
                        >
                          {gates?.vipLounge ? 'Locked' : `Construct - ${formatCurrency(1000000)}`}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Catering Facility */}
                  <div className="bg-surface border border-line p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-ink font-semibold text-sm">Advanced Catering</div>
                        <div className="text-2xs text-muted mt-1 uppercase tracking-label">Enables high-end meal prep</div>
                      </div>
                      {infrastructure.hubFacilities?.catering ? (
                        <div className="text-2xs font-label font-semibold uppercase tracking-label text-good border border-good rounded-sm px-1.5 py-0.5">Active</div>
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
                          className="px-4 py-2 bg-accent text-on-accent font-semibold uppercase tracking-label text-2xs hover:bg-ink transition-all disabled:opacity-50"
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
                cost={unlockCost(2)}
                onUpgrade={() => onBuyManagement(2)}
                gate={gates?.tier2}
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
              cost={unlockCost(3)}
              onUpgrade={() => onBuyManagement(3)}
              gate={gates?.tier3}
              icon={<Crown size={24} />}
              features={[
                "Landing & desk fees 15% below standard",
                "Better connections (hub quality +0.05)",
                "Rivals cannot open new routes here",
                "Half of the rivals' landing fees paid to you"
              ]}
            />
          </div>
        </div>
      </div>

      {/* Management Required Modal */}
      {showMgmtModal && (
        <div className="fixed inset-0 z-[100] bg-ground/80 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" className="bg-raised p-4 border border-line max-w-md w-full relative z-[101]">
            <h3 className="font-label text-xl font-semibold text-ink mb-2">Management Required</h3>
            <p className="text-muted mb-4 text-sm">
              Level-1 management is required to create a route. Do you want to buy it now?
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  if (capital >= unlockCost(1)) {
                    onBuyManagement(1);
                    onStartRoute(airport.id, 'destination');
                    setShowMgmtModal(false);
                  }
                }}
                disabled={capital < unlockCost(1)}
                className="flex-1 px-4 bg-accent text-on-accent font-semibold uppercase text-2xs py-3 hover:bg-ink transition-colors disabled:opacity-50"
              >
                Yes, buy for {formatCurrency(unlockCost(1))}
              </button>
              <button 
                onClick={() => setShowMgmtModal(false)}
                className="flex-1 bg-surface text-ink border border-line font-semibold uppercase text-2xs py-3 hover:bg-raised transition-colors"
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
      <span className="text-2xs text-muted uppercase tracking-label mb-0.5 flex items-center">
        {label}
        {info && <InfoTooltip size={11} {...GLOSSARY[info]} />}
      </span>
      <span className={`text-xs font-semibold ${highlight ? 'text-accent' : color || 'text-ink'}`}>{value}</span>
    </div>
  );
}

/**
 * Passengers changing planes here: how many, where they go, and how good the
 * airport is as a place to connect. The quality is the factor the network
 * pricing applies (transferUtils' hubQuality), not a separate score.
 */
function TransferHubCard({ stats, quality }: { stats?: HubTransferStats; quality: number }) {
  const pax = stats?.pax ?? 0;
  return (
    <div className="bg-raised border border-line p-4 flex flex-col gap-3">
      <div className="flex justify-between items-center border-b border-line pb-3">
        <div className="flex items-center gap-3">
          <ArrowRightLeft className="text-accent" size={20} />
          <span className="text-sm font-semibold">Transfer Hub</span>
        </div>
        <InfoTooltip
          size={12}
          title="Hub quality"
          desc="How well passengers connect here: 40% base, +15% per management tier, +5% each for a VIP lounge and a catering facility, at most 100%. It scales how many connecting passengers your routes can sell."
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col">
          <span className="text-2xs text-muted uppercase tracking-label mb-0.5">Transfer pax / week</span>
          <span className="text-xl font-semibold text-accent">{formatNumber(pax)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-2xs text-muted uppercase tracking-label mb-0.5">Hub quality factor</span>
          <span className="text-xl font-semibold text-ink">{Math.round(quality * 100)}%</span>
        </div>
      </div>
      {pax > 0 && stats ? (
        <div className="flex flex-col gap-1 text-2xs">
          <span className="text-2xs text-muted uppercase tracking-label">Top connections</span>
          {stats.flows.slice(0, 5).map(f => (
            <div key={`${f.o}>${f.d}`} className="flex justify-between text-muted">
              <span>{f.o} → {f.hub} → {f.d}</span>
              <span className="text-ink">{formatNumber(f.pax)}/wk</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-2xs text-muted leading-relaxed">
          No passengers connect here yet. Two of your routes meeting at this airport sell connections when the
          change takes {MIN_CONNECTION_MIN} min to {MAX_CONNECTION_MIN / 60} h, the detour is under 60%,
          both flights have empty seats, and you do not already fly the city pair direct.
        </p>
      )}
    </div>
  );
}

function SectionLabel({ icon, label }: { icon: React.ReactNode, label: string }) {
  return (
    <div className="flex items-center gap-2 text-2xs uppercase tracking-label font-semibold text-muted">
      {icon}
      {label}
    </div>
  );
}

function InfaRow({ label, count, used = 0, cost, purchaseCost, onBuy, disabled, info, showUtilBar = false }: { label: string, count: number, used?: number, cost: number, purchaseCost?: number, onBuy: (n: number, isShift: boolean) => void, disabled?: boolean, info?: string, showUtilBar?: boolean }) {
  const utilPercent = count > 0 ? Math.round((used / count) * 100) : 0;
  return (
    <div className={`p-3 border transition-colors flex flex-col gap-2 ${disabled ? 'bg-surface border-line opacity-50' : 'bg-surface border-line hover:border-rule'}`}>
      <div className="flex items-center justify-between w-full">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-ink uppercase tracking-label">{label}</span>
          {info && <span className="text-2xs text-muted mt-0.5">{info}</span>}
          <span className="text-2xs text-accent mt-1 flex items-center">
            {purchaseCost !== undefined ? `${formatCurrency(purchaseCost)} CAPEX` : ''}
            {purchaseCost !== undefined && cost > 0 && " + "}
            {cost > 0 ? `${formatCurrency(cost)} / wk` : (!purchaseCost ? 'FREE / INCLUDED' : '')}
            <InfoTooltip size={11} {...GLOSSARY.capex} />
          </span>
        </div>
        <div className="flex items-center gap-4">
          {showUtilBar && (
            <div className="text-right flex flex-col items-end border-r border-line pr-4">
              <div className="text-2xs text-muted uppercase mb-0.5">Utilized</div>
              <div className="text-sm font-semibold text-ink">{used} <span className="text-2xs font-normal text-muted">/ {count}</span></div>
            </div>
          )}
          <div className="text-right">
            <div className="text-2xs text-muted uppercase mb-0.5">Stock</div>
            <div className="text-lg font-semibold text-ink">{count}</div>
          </div>
          <div className="flex gap-1" title={count > 0 && used > 0 ? `Cannot sell below current flight schedule use of ${used} slots.` : "Shift-Click to add or remove 10 units at once."}>
            <button 
              disabled={disabled || count <= 0 || (showUtilBar && count <= used)} 
              onClick={(e) => onBuy(-1, e.shiftKey)}
              className="w-10 h-10 flex items-center justify-center bg-ground/40 border border-line hover:border-accent disabled:opacity-30 transition-all text-ink"
            >
              <Minus size={14} />
            </button>
            <button 
              disabled={disabled} 
              onClick={(e) => onBuy(1, e.shiftKey)}
              className="w-10 h-10 flex items-center justify-center bg-accent text-on-accent font-semibold hover:bg-ink transition-all"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>
      {showUtilBar && count > 0 && (
        <div className="w-full flex flex-col gap-1 mt-1 border-t border-line pt-2">
          <div className="flex justify-between text-2xs uppercase tracking-label text-muted leading-none">
            <span>Slot Utilization</span>
            <span className={utilPercent > 90 ? 'text-accent font-semibold' : 'text-muted'}>{utilPercent}%</span>
          </div>
          <div className="w-full h-1 bg-ground/40 rounded-full overflow-hidden relative overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${utilPercent > 90 ? 'bg-accent' : 'bg-accent'}`} 
              style={{ width: `${Math.min(100, utilPercent)}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
}

function ManagementTierCard({ tier, activeTier, label, cost, onUpgrade, icon, features, gate }: { tier: number, activeTier: number, label: string, cost: number, onUpgrade: () => void, icon: React.ReactNode, features: string[], gate?: string | null }) {
  const isAcquired = activeTier >= tier;
  const isLocked = activeTier < tier - 1;

  return (
    <div className={`border p-4 transition-all flex flex-col gap-3 ${isAcquired ? 'bg-accent text-on-accent border-accent' : 'bg-raised border-line'}`}>
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <div className={`text-2xs font-semibold uppercase tracking-label ${isAcquired ? 'text-on-accent' : 'text-accent'}`}>T{tier} Management</div>
          <div className="text-2xl font-semibold">{label}</div>
        </div>
        <div className={isAcquired ? 'text-on-accent' : 'text-muted'}>{icon}</div>
      </div>

      <div className={`grid grid-cols-1 gap-2 ${isAcquired ? 'text-on-accent' : 'text-muted'}`}>
         {features.map((f, i) => (
           <div key={i} className="text-2xs flex gap-2 items-center uppercase tracking-label font-semibold">
             <div className={`w-1.5 h-1.5 rounded-full ${isAcquired ? 'bg-ground' : 'bg-raised'}`}></div>
             {f}
           </div>
         ))}
      </div>

      {!isAcquired && !isLocked && gate && (
        <div className="text-2xs text-bad leading-relaxed">{gate}</div>
      )}
      {!isAcquired && (
        <button 
          onClick={onUpgrade}
          disabled={isLocked || !!gate}
          className={`w-full py-4 font-semibold transition-all text-xs uppercase tracking-label ${isLocked || gate ? 'bg-surface text-muted cursor-not-allowed border border-line' : 'bg-accent text-on-accent hover:bg-ink'}`}
        >
          {isLocked ? 'LOCKED: PRE-REQUISITE REQ.' : gate ? 'LOCKED: RANK' : `ACQUIRE ACCESS - ${formatCurrency(cost)}`}
        </button>
      )}

      {isAcquired && (
        <div className="w-full py-4 border-2 border-ground text-center font-semibold text-xs uppercase tracking-label flex items-center justify-center gap-2">
           <Info size={14} /> ACTIVE PROTOCOL
        </div>
      )}
    </div>
  );
}
