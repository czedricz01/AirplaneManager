import { FinancialReport } from "./FinancialReport";
import React, { useState, useMemo } from 'react';
import { X, Plane, Clock, Coffee, DollarSign, Trash2, Settings, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { airportsData, Airport } from '../data/airports';
import { moreAirports } from '../data/more_airports';
import { MEAL_DATA, EXTRAS_OPTIONS, SERVICE_OPTIONS } from '../data/catering';
import { 
  getFlightTimeClass, 
  TIME_CLASS_SAT_MULTIPLIERS,
  getCateringOpt,
  getMultiOptionSum,
  calculateClassSatisfaction,
  calculateRouteFinancials
} from '../lib/financeUtils';

const airports = Array.from(new Map([...airportsData, ...moreAirports].map(a => [a.id, a as unknown as Airport])).values());

import { OwnedAircraft } from './MyFleetView';
import { AircraftDetailsModal } from './AircraftDetailsModal';

import { RoutePricingEditView } from './RoutePricingEditView';

interface RouteDetailViewProps {
  route: any; // We'll refine this type
  routes: any[];
  fleet?: OwnedAircraft[];
  fuelPrice?: number;
  airportManagement?: Record<string, any>;
  currentYear: number;
  currentMonth: number;
  difficulty: string;
  onClose: () => void;
  onDelete: (id: string) => void;
  onChangeAircraft?: () => void;
  onEditSchedule?: (routeId: string) => void;
  onEditCabinServices?: (routeId: string) => void;
  onUpdatePricing?: (routeId: string, pricing: Record<string, number>) => void;
}

const formatNumber = (num: number) => Math.round(num).toLocaleString();

export function RouteDetailView({ 
  route, routes, fleet, fuelPrice = 1.05, airportManagement, 
  currentYear, currentMonth, difficulty,
  onClose, onDelete, onChangeAircraft, onEditSchedule, onEditCabinServices, onUpdatePricing 
}: RouteDetailViewProps) {
  const flightNo = route.schedule?.[0]?.flightNumOut ? 'NE' + route.schedule[0].flightNumOut : route.airline;
  const [activeConfig, setActiveConfig] = useState<'timetable' | 'cabin' | 'finance' | null>(null);
  const [showPricingEdit, setShowPricingEdit] = useState(false);
  const [showAircraftDetails, setShowAircraftDetails] = useState(false);

  const assignedAircraft = fleet?.find(ac => ac.registration === route.aircraft);

  const airportsMap = useMemo(() => {
    const map = new Map<string, Airport>();
    [...airportsData, ...moreAirports].forEach(a => map.set(a.id, a as unknown as Airport));
    return map;
  }, []);

  const financials = useMemo(() => {
    if (!assignedAircraft) return null;
    return calculateRouteFinancials(
      route,
      assignedAircraft,
      fuelPrice,
      airportManagement || {},
      currentYear,
      currentMonth,
      difficulty,
      airportsMap,
      routes,
      fleet
    );
  }, [route, assignedAircraft, fuelPrice, airportManagement, currentYear, currentMonth, difficulty, airportsMap, routes, fleet]);

  const actualConfigSeats = assignedAircraft?.config 
    ? ((assignedAircraft.config.economy || 0) + (assignedAircraft.config.premium || 0) + (assignedAircraft.config.business || 0) + (assignedAircraft.config.first || 0)) 
    : 0;
  const actualCapacity = actualConfigSeats > 0 ? actualConfigSeats : (assignedAircraft?.capacity || 0);
  const routeFlightLegs = route.schedule ? route.schedule.reduce((acc: number, s: any) => acc + (s.isOneWay ? 1 : 2), 0) : route.weeklyFlights * 2;

  // Render dummy configuration window
  const renderConfigWindow = () => {
    if (!activeConfig) return null;

    let title = '';
    let content = null;

    if (activeConfig === 'timetable') {
      title = 'Timetable Configuration';
      content = <div className="text-white/50 text-sm">Timetable editor placeholder.</div>;
    } else if (activeConfig === 'finance') {
      title = 'Financial Details';
      content = <div className="text-white/50 text-sm">Detailed financial drill-down placeholder.</div>;
    }

    return (
      <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-[#1a1a1a] border border-white/20 p-4 w-full max-w-2xl"
        >
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-2xl font-mono text-white uppercase tracking-widest font-black flex items-center gap-3">
               <Settings className="text-aero-yellow" size={24} />
               {title}
            </h3>
            <button onClick={() => setActiveConfig(null)} className="text-white/50 hover:text-white transition-colors"><X size={24} /></button>
          </div>
          <div className="py-4 bg-black/40 border border-white/5 p-4 rounded-sm">
            {content}
          </div>
          <div className="mt-8 flex justify-end">
             <button onClick={() => setActiveConfig(null)} className="px-3 py-2 bg-aero-yellow text-black font-black uppercase text-xs tracking-widest hover:bg-white transition-colors">
               Save & Close
             </button>
          </div>
        </motion.div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="absolute inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col font-sans p-4 overflow-y-auto custom-scrollbar"
    >
      <div className="flex justify-between items-center mb-4 shrink-0">
        <h2 className="text-4xl font-mono text-aero-yellow uppercase tracking-[0.3em] font-black drop-shadow-lg flex items-center gap-4">
          Route Detail
          <span className="text-white/30 text-2xl">|</span>
          <span className="text-white">{flightNo}</span>
        </h2>
        <div className="flex items-center gap-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(route.id);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#111] hover:bg-[#1a1a1a] outline outline-1 outline-red-500/50 text-white transition-colors uppercase text-xs tracking-widest font-bold"
          >
            <Trash2 size={16} /> Delete Route
          </button>
          <button
            onClick={onClose}
            className="w-12 h-12 bg-black border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors text-white"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      <div className="flex flex-col flex-1 shrink-0 gap-3">
        {/* Top Third: Hub - Aircraft - Destination */}
        <div className="min-h-[280px] flex border border-white/10 bg-black/40 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-aero-yellow/5 to-transparent pointer-events-none"></div>
          <div className="flex-1 flex flex-col items-center justify-center border-r border-white/10 relative z-10">
            <span className="text-white/30 text-[10px] uppercase tracking-widest font-bold mb-4">Origin Hub</span>
            <span className="text-6xl font-black text-aero-yellow tracking-tighter drop-shadow-lg">{route.origin}</span>
            <span className="text-white/50 text-xs mt-2 uppercase tracking-widest font-bold">{airportsMap.get(route.origin)?.name || "Unknown Airport"}</span>
          </div>

          <div className="flex-1 flex flex-col justify-center px-12 relative overflow-hidden group border-r border-white/10 z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex flex-col">
                <span className="text-white/30 text-[10px] uppercase tracking-widest font-bold block mb-1">Assigned Aircraft</span>
                <span className="text-white/80 font-mono text-xl">{route.aircraft}</span>
              </div>
              <div className="text-right">
                <span className="text-white/30 text-[10px] uppercase tracking-widest font-bold block mb-1">Route Distance</span>
                <span className="text-white font-mono text-xl">{Math.round(route.distance || 0)} <span className="text-xs text-white/40">KM</span></span>
              </div>
            </div>

            <div className="flex gap-4 items-center bg-white/5 p-4 border border-white/10 rounded-sm">
              <div className="flex flex-col">
                <span className="text-white/30 text-[8px] uppercase tracking-widest font-bold mb-1">Weekly Pax</span>
                <span className="text-2xl font-black text-aero-yellow">{(route.paxPerWeek || 0).toLocaleString()}</span>
              </div>
              <div className="ml-auto">
                {assignedAircraft && (
                  <div className="flex flex-col text-[10px] uppercase tracking-widest text-right">
                    <span className="text-white/50">{assignedAircraft.manufacturer} {assignedAircraft.type}</span>
                    <span className="text-white/30">{assignedAircraft.class} • Cap: {actualCapacity}</span>
                    <div className="flex items-center justify-end gap-2 mt-1">
                        <button onClick={() => setShowAircraftDetails(true)} className="text-[9px] px-1.5 py-0.5 bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/10 font-bold">Details</button>
                        <button 
                          onClick={onChangeAircraft} 
                          className="text-[9px] px-1.5 py-0.5 bg-white/10 hover:bg-aero-yellow hover:text-black text-white font-bold transition-all border border-white/10"
                        >
                          Change
                        </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              {route.durMin && (
                <div className="flex items-center gap-3">
                  <span className="text-aero-yellow font-mono border border-aero-yellow/30 px-2 py-0.5 bg-aero-yellow/10 rounded-sm text-[10px]">TIME-CLASS: {route.durMin ? (route.durMin < 60 ? 1 : route.durMin < 120 ? 2 : route.durMin < 180 ? 3 : route.durMin < 240 ? 4 : route.durMin < 360 ? 5 : route.durMin < 540 ? 6 : route.durMin < 720 ? 7 : 8) : '-'}</span>
                  <span className="text-white/40 text-[10px] font-mono uppercase">
                      Flight Time: {Math.floor(route.durMin / 60)}h {(route.durMin % 60).toString().padStart(2, '0')}m
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center relative z-10">
            <span className="text-white/30 text-[10px] uppercase tracking-widest font-bold mb-4">Destination</span>
            <span className="text-6xl font-black text-aero-yellow tracking-tighter drop-shadow-lg">{route.destination}</span>
            <span className="text-white/50 text-xs mt-2 uppercase tracking-widest font-bold">{airportsMap.get(route.destination)?.name || "Unknown Airport"}</span>
          </div>
        </div>

        {/* Bottom Two Thirds: 3 Boxes */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {/* Timetable Box */}
          <div onClick={() => onEditSchedule && onEditSchedule(route.id)} className="border border-white/10 bg-black/40 flex flex-col hover:border-aero-yellow/50 hover:bg-aero-yellow/5 transition-colors cursor-pointer group relative overflow-hidden min-h-[400px] h-full">
            <div className="p-4 pb-4 border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <Clock className="text-aero-yellow" size={20} />
                <h3 className="text-lg font-bold text-white uppercase tracking-widest group-hover:text-aero-yellow transition-colors">Flightplan</h3>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[8px] text-white/30 uppercase tracking-widest font-black leading-none mb-1">Weekly Ops</span>
                <span className="text-lg font-black text-white leading-none">{route.weeklyFlights}</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
              {route.schedule && route.schedule.length > 0 ? (
                (() => {
                  const uniqueFlights = Object.values(route.schedule.reduce((acc: any, s: any) => {
                    const key = `${s.flightNumOut}-${s.flightNumIn}`;
                    if (!acc[key]) {
                      acc[key] = { ...s, days: [s.dayId] };
                    } else {
                      if (!acc[key].days.includes(s.dayId)) {
                        acc[key].days.push(s.dayId);
                      }
                    }
                    return acc;
                  }, {} as Record<string, any>)).sort((a: any, b: any) => {
                    const aTotal = (a.days[0]-1)*1440 + a.startHour * 60 + a.startMin;
                    const bTotal = (b.days[0]-1)*1440 + b.startHour * 60 + b.startMin;
                    return aTotal - bTotal;
                  });

                  const dayNamesShort = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
                  const formatTimeSpecial = (totalMins: number) => {
                    const h = Math.floor(((Math.round(totalMins) + 10080) % 1440) / 60);
                    const min = (Math.round(totalMins) + 10080) % 60;
                    return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
                  };

                  return uniqueFlights.map((s: any) => {
                    const base = s.startHour * 60 + s.startMin;
                    const dep1 = formatTimeSpecial(base + 30);
                    const arr1 = formatTimeSpecial(base + 30 + s.durMin);
                    const dep2 = formatTimeSpecial(base + 30 + s.durMin + s.turnoverMin);
                    const arr2 = formatTimeSpecial(base + 30 + s.durMin + s.turnoverMin + s.durMin);
                    const sortedDays = [...s.days].sort((a: number, b: number) => a - b);
                    const daysStr = sortedDays.map((d: number) => dayNamesShort[d - 1]).join(", ");
                    
                    return (
                      <div key={`${s.flightNumOut}-${s.days[0]}`} className="bg-white/5 border border-white/10 p-3 rounded-sm group-hover:border-aero-yellow/30 transition-all">
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col">
                            <div className="flex gap-2 items-center mb-1">
                               <span className="text-aero-yellow font-black text-sm italic tracking-tighter">{route.airlineCode}{s.flightNumOut}</span>
                               {!s.isOneWay && (
                                 <span className="text-white/40 font-mono text-[10px]">/ {route.airlineCode}{s.flightNumIn}</span>
                               )}
                            </div>
                            <div className="flex gap-1 flex-wrap">
                               {sortedDays.map(d => (
                                 <span key={d} className="text-[8px] bg-white/10 px-1 border border-white/10 font-bold">{dayNamesShort[d-1]}</span>
                               ))}
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                             <div className="flex items-center gap-2 justify-end">
                                <span className="text-[7px] uppercase font-bold text-white/30 tracking-widest">OUT:</span>
                                <span className="text-white font-mono text-[10px] font-bold">{dep1} - {arr1}</span>
                             </div>
                             {!s.isOneWay && (
                               <div className="flex items-center gap-2 justify-end">
                                  <span className="text-[7px] uppercase font-bold text-white/30 tracking-widest">IN:</span>
                                  <span className="text-white/60 font-mono text-[10px] font-bold">{dep2} - {arr2}</span>
                               </div>
                             )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()
              ) : (
                <div className="h-full flex items-center justify-center text-white/20 text-[10px] uppercase font-bold italic">
                  No flights scheduled
                </div>
              )}
            </div>

            <div className="p-4 bg-black/40 border-t border-white/10 text-center uppercase tracking-widest text-[9px] font-black text-white/40 group-hover:text-aero-yellow transition-colors shrink-0">
              Click to edit schedule
            </div>
          </div>

          {/* Cabin Services Box */}
          <div onClick={() => onEditCabinServices?.(route.id)} className="border border-white/10 bg-black/40 flex flex-col hover:border-aero-yellow/50 hover:bg-aero-yellow/5 transition-colors cursor-pointer group p-4 relative overflow-hidden">
             <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <Coffee className="text-aero-yellow" size={24} />
                <h3 className="text-lg font-bold text-white uppercase tracking-widest group-hover:text-aero-yellow transition-colors">Cabin Services</h3>
              </div>
              <Settings size={16} className="text-white/20 group-hover:text-aero-yellow transition-colors" />
            </div>
            <div className="flex-1 flex flex-col">
               <div className="grid grid-cols-2 gap-4 mb-4 overflow-y-auto custom-scrollbar pr-2 max-h-[300px]">
                  {(() => {
                    const classes = ['economy', 'premium', 'business', 'first'];
                    let totalSat = 0;
                    let count = 0;

                    const classSats = classes.filter(cls => {
                      const seats = assignedAircraft?.config?.[cls as keyof typeof assignedAircraft.config] as number;
                      return seats !== undefined && seats > 0;
                    }).map(cls => {
                      let sat = financials?.routeSat?.[cls] ?? 0;
                      
                      if (sat > 0) {
                        totalSat += sat;
                        count++;
                      }
                      return { name: cls, sat };
                    });

                    const avgSat = count > 0 ? totalSat / count : 0;

                    return (
                      <>
                        <div className="col-span-2 flex flex-col items-center justify-center py-2 bg-white/5 border border-white/10 rounded-sm mb-2">
                           <span className="text-[8px] text-white/30 uppercase font-black tracking-widest mb-1">Route Satisfaction</span>
                           <span className="text-3xl font-black text-aero-yellow italic tracking-tighter">{avgSat.toFixed(0)}%</span>
                        </div>
                        {classSats.map(cs => {
                          const satDetails = route.satisfactionDetails?.[cs.name];
                          const expectation = satDetails?.expectationTarget || 0;
                          const reality = satDetails?.providedQuality || 0;
                          
                          let barColor = 'bg-[#1a1a1a] shadow-2xl';
                          let textColor = 'text-aero-yellow/60';
                          if (cs.sat >= 100) { barColor = 'bg-aero-yellow shadow-2xl'; textColor = 'text-aero-yellow'; }
                          else if (cs.sat >= 85) { barColor = 'bg-lime-400 shadow-2xl'; textColor = 'text-lime-400'; }
                          else if (cs.sat >= 60) { barColor = 'bg-yellow-500 shadow-2xl'; textColor = 'text-yellow-400'; }
                          else if (cs.sat >= 40) { barColor = 'bg-orange-500 shadow-2xl'; textColor = 'text-orange-400'; }

                          return (
                          <div key={cs.name} className="col-span-2 flex flex-col p-3 bg-black/40 border border-white/5 rounded-sm relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-1 opacity-10">
                               <Coffee size={40} />
                             </div>
                             <div className="flex justify-between items-end mb-2 relative z-10">
                               <span className="text-[10px] text-white/60 uppercase font-bold tracking-widest">{cs.name}</span>
                               <span className={`text-sm font-black ${textColor} drop-shadow-md`}>{cs.sat.toFixed(0)}%</span>
                             </div>
                             
                             <div className="w-full bg-black/60 h-2 rounded-full overflow-hidden mb-2 relative z-10 border border-white/5">
                                <div className={`h-full ${barColor} transition-all duration-1000 ease-out`} style={{ width: `${Math.min(100, cs.sat)}%` }}></div>
                             </div>

                             <div className="flex justify-between text-[8px] text-white/40 uppercase tracking-widest relative z-10 mt-1">
                                <span className="flex flex-col">
                                   <span className="text-white/30 text-[7px]">Expectation</span>
                                   <span className="font-mono text-white/80">{expectation}</span>
                                </span>
                                <span className="flex flex-col text-right">
                                   <span className="text-white/30 text-[7px]">Reality</span>
                                   <span className="font-mono text-white/80">{reality}</span>
                                </span>
                             </div>
                          </div>
                          );
                        })}
                      </>
                    );
                  })()}
               </div>
               <div className="mt-auto text-center">
                  <span className="text-white/30 text-[9px] uppercase tracking-widest font-bold">Configured Cabin Services</span>
               </div>
            </div>
          </div>

          
          {/* Finances Box */}
          <div className="border border-white/10 bg-black/40 flex flex-col transition-colors group relative overflow-hidden">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10 p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="text-aero-yellow" size={20} />
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">Financials</h3>
              </div>
              <Settings onClick={() => setShowPricingEdit(true)} size={16} className="text-white/20 hover:text-aero-yellow transition-colors cursor-pointer" title="Adjust Pricing" />
            </div>
            <div className="flex-1 flex flex-col p-4 pt-0">
               {financials && (
                 <>
                   <div className="p-3 mb-4 bg-white/5 border border-white/10 rounded-sm flex gap-3">
                     <Info className="text-white/80 shrink-0 mt-0.5" size={14} />
                     <div className="text-[9px] text-white/80/80 leading-relaxed font-bold uppercase tracking-tight space-y-1">
                       <p><strong>Flugumsatz:</strong> Ticket revenue for this route, at the estimated load factor.</p>
                       <p><strong>Direkte Flugausgaben:</strong> Variable costs that scale with each flight: fuel, crew, landing fees and catering.</p>
                     </div>
                   </div>
                   <FinancialReport
                     title="Route Projection (Weekly)"
                     netProfit={financials.estWeeklyProfit}
                     totalRevenue={financials.estWeeklyRev}
                     expenses={[
                       {
                         id: 'opx',
                         label: 'Direkte Flugausgaben',
                         total: financials.estWeeklyCosts,
                         items: [
                           { label: `Sprit (${formatNumber(financials.costsBreakdown.fuelLiters)}L @ ${financials.costsBreakdown.fuelPriceL})`, amount: financials.costsBreakdown.fuel },
                           { label: 'Crew & Ground Staff', amount: financials.costsBreakdown.crew },
                           { label: 'Catering & Cabin', amount: financials.costsBreakdown.catering },
                           { label: 'Landegebühren & Pax Fees', amount: financials.costsBreakdown.infra }
                         ]
                       }
                     ]}
                     defaultOpen={true}
                   />
                 </>
               )}
               <div className="border-t border-white/5 pt-4 mt-4">
                  <div className="flex flex-col items-center">
                     <span className="text-xl font-mono text-aero-yellow font-bold">
                       {assignedAircraft && actualCapacity > 0 ? Math.round(((financials?.paxPerWeek || 0) / (routeFlightLegs * actualCapacity)) * 100) : 0}%
                     </span>
                     <span className="text-[9px] text-white/30 uppercase tracking-widest font-black mt-1">Avg Load Factor</span>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      
      <AnimatePresence>
         {activeConfig && renderConfigWindow()}
         {showPricingEdit && assignedAircraft && (
           <RoutePricingEditView 
             route={route}
             routes={routes}
             fleet={fleet}
             aircraft={assignedAircraft}
             fuelPrice={fuelPrice}
             airportManagement={airportManagement}
             currentYear={currentYear}
             currentMonth={currentMonth}
             difficulty={difficulty}
             onSave={(pricing) => {
               if (onUpdatePricing) onUpdatePricing(route.id, pricing);
               setShowPricingEdit(false);
             }}
             onClose={() => setShowPricingEdit(false)}
           />
         )}
         {showAircraftDetails && assignedAircraft && (
           <AircraftDetailsModal 
             plane={assignedAircraft}
             currentDateOffset={(currentYear - 1960) * 12 + (currentMonth - 1)}
             onClose={() => setShowAircraftDetails(false)}
             onRenovate={() => {}} 
             aircraftRoutes={[route]} 
           />
         )}
      </AnimatePresence>
    </motion.div>
  );
}
