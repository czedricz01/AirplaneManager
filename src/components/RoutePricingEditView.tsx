
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { DollarSign, Save, X, Info, AlertTriangle } from 'lucide-react';
import { Airport } from '../data/airports';

import { OwnedAircraft } from './MyFleetView';
import { calculateRouteFinancials } from '../lib/financeUtils';
import { FinancialReport } from './FinancialReport';

import { airportsMapAdjusted as airportsMap } from '../data/airportRegistry';

interface RoutePricingEditViewProps {
  route: any;
  aircraft: OwnedAircraft;
  fuelPrice: number;
  airportManagement?: Record<string, any>;
  currentYear: number;
  currentMonth: number;
  difficulty: string;
  onSave: (ticketPrices: Record<string, number>) => void;
  onClose: () => void;
  routes: any[];
  fleet: OwnedAircraft[];
}

export function RoutePricingEditView({ 
  route, aircraft, fuelPrice, airportManagement, currentYear, currentMonth, difficulty, onSave, onClose,
  routes, fleet
}: RoutePricingEditViewProps) {
  const [ticketPrices, setTicketPrices] = useState<Record<string, number>>(route.ticketPrices || {
    economy: 150,
    premium: 250,
    business: 600,
    first: 1200
  });

  const financials = calculateRouteFinancials(
    { ...route, ticketPrices },
    aircraft,
    fuelPrice,
    airportManagement || {},
    currentYear,
    currentMonth,
    difficulty,
    airportsMap,
    routes,
    fleet
  );

  const { estWeeklyRev, estWeeklyCosts, estWeeklyProfit, paxPerWeek, basePriceBE75, basePriceBE99, basePriceBE35 } = financials;
  const { fuel: weeklyFuelCost = 0, catering: weeklyCateringCost = 0, crew: weeklyStaffCost = 0, infra: weeklyInfraCost = 0 } = (financials.costsBreakdown || {}) as Record<string, number>;
  const fuelPricePerL = fuelPrice / 3.785;

  const adjustAllPricesByPercentage = (pct: number) => {
    setTicketPrices(prev => {
      const next = { ...prev };
      ['economy', 'premium', 'business', 'first'].forEach(cls => {
        const seats = aircraft.config?.[cls as keyof typeof aircraft.config] as number || 0;
        if (seats && seats > 0) {
          const current = prev[cls] || 150;
          let newVal = Math.round(current * (1 + pct));
          const multiplier = (cls === 'premium' ? 1.6 : cls === 'business' ? 3.0 : cls === 'first' ? 5.0 : 1.0);
          const breakEvenPrice = Math.round((basePriceBE75 || 100) * multiplier);
          const min = Math.round(breakEvenPrice * 0.5);
          const max = Math.round((basePriceBE35 || 300) * multiplier);
          newVal = Math.max(min, Math.min(max, newVal));
          next[cls] = newVal;
        }
      });
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#111] border border-white/20 w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden shadow-2xl"
      >
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40">
          <div className="flex items-center gap-3">
            <DollarSign className="text-aero-yellow" size={24} />
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-widest leading-none">Financials Tuning</h2>
              <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold">Adjust ticket prices for {route.origin} - {route.destination}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 text-white/50 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 p-4 rounded-sm flex flex-col gap-2.5">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                Quick Adjust All Classes
              </span>
              <div className="grid grid-cols-6 gap-2">
                {[-0.20, -0.10, -0.05, 0.05, 0.10, 0.20].map((pct) => {
                  const label = pct > 0 ? `+${Math.round(pct * 100)}%` : `${Math.round(pct * 100)}%`;
                  return (
                    <button
                      key={pct}
                      onClick={() => adjustAllPricesByPercentage(pct)}
                      className="py-2 bg-black border border-white/10 hover:border-aero-yellow/50 text-[10px] font-bold text-white/70 hover:text-aero-yellow transition-all"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-4 bg-black/40 p-4 border border-white/5 group hover:border-white/20 transition-all mb-4 shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-aero-yellow/10 to-transparent pointer-events-none" />
              <div className="flex justify-between items-center relative z-10">
                 <div className="flex flex-col">
                    <span className="text-sm uppercase font-black tracking-widest text-aero-yellow">General Settings</span>
                    <span className="text-[10px] text-white/40 uppercase tracking-widest mt-1">Adjust All Prices</span>
                 </div>
              </div>
              <div className="relative pt-4 z-10">
                 <input 
                    type="range"
                    min={Math.round(basePriceBE99 || 80)}
                    max={Math.round(basePriceBE35 || 300)}
                    value={ticketPrices['economy'] || Math.round(basePriceBE75 || 100)}
                    onChange={(e) => {
                       const val = parseInt(e.target.value);
                       const newPrices = { ...ticketPrices };
                       ['economy', 'premium', 'business', 'first'].forEach(c => {
                          const seats = aircraft.config?.[c as keyof typeof aircraft.config] as number || 0;
                          if (seats > 0) {
                             const multi = (c === 'premium' ? 1.6 : c === 'business' ? 3.0 : c === 'first' ? 5.0 : 1.0);
                             newPrices[c] = Math.round(val * multi);
                          }
                       });
                       setTicketPrices(newPrices);
                    }}
                    className="w-full h-2 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-aero-yellow [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg cursor-pointer relative z-10"
                 />
                 <div 
                     className="absolute top-[20px] h-4 w-1 bg-aero-yellow/70 pointer-events-none z-0 rounded-b-sm" 
                     style={{ left: `calc(${(((basePriceBE75||100) - (basePriceBE99||80)) / ((basePriceBE35||300) - (basePriceBE99||80))) * 100}% + ${8 - (((basePriceBE75||100) - (basePriceBE99||80)) / ((basePriceBE35||300) - (basePriceBE99||80))) * 16}px)`, transform: 'translateX(-50%)' }} 
                  />
                 <div className="flex justify-between mt-2 px-1">
                    <span className="text-[10px] text-white/40 font-mono">
                      ${Math.round(basePriceBE99 || 80)}<span className="text-white/25 ml-1">break-even at 99% full</span>
                    </span>
                    <span className="text-[10px] text-white/40 font-mono">
                      <span className="text-white/25 mr-1">break-even at 35% full</span>${Math.round(basePriceBE35 || 300)}
                    </span>
                 </div>
                 <p className="text-[10px] text-white/30 leading-relaxed mt-1">
                   The notch is break-even at 75% full, a realistic year-round average. Below it you
                   are betting on filling more seats than that; well above it passengers stop booking.
                 </p>
              </div>
            </div>

            {['economy', 'premium', 'business', 'first'].map(cls => {
              const seats = aircraft.config?.[cls as keyof typeof aircraft.config] as number;
              if (!seats || seats === 0) return null;
              return (
                <div key={cls} className="bg-black/40 border border-white/5 p-4 rounded-sm hover:border-white/20 transition-all flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-sm uppercase font-black tracking-widest text-aero-yellow">{cls} Class</span>
                      <span className="text-[10px] text-white/40 uppercase tracking-widest mt-1">{seats} Seats</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-2xl font-mono text-white font-bold">${ticketPrices[cls]}</span>
                      {financials.paxByClass && financials.paxByClass[cls] && (
                        <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest mt-1">
                          Load: {financials.paxByClass[cls].actual}/{financials.paxByClass[cls].max} ({Math.round(financials.paxByClass[cls].actual / financials.paxByClass[cls].max * 100)}%)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="relative pt-4">
                    {(() => {
                      const multiplier = (cls === 'premium' ? 1.6 : cls === 'business' ? 3.0 : cls === 'first' ? 5.0 : 1.0);
                      const breakEvenPrice = Math.round((basePriceBE75 || 100) * multiplier);
                      const minPossiblePrice = Math.round(breakEvenPrice * 0.5);
                      const maxPossiblePrice = Math.round((basePriceBE35 || 300) * multiplier);
                      
                      let leftPct = ((breakEvenPrice - minPossiblePrice) / (maxPossiblePrice - minPossiblePrice));
                      if (isNaN(leftPct) || !isFinite(leftPct)) leftPct = 0.5;

                      return (
                        <>
                          <input 
                            type="range"
                            min={minPossiblePrice}
                            max={maxPossiblePrice}
                            step="1"
                            value={ticketPrices[cls] || 150}
                            onChange={(e) => setTicketPrices(prev => ({ ...prev, [cls]: parseInt(e.target.value) }))}
                            className="w-full h-2 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-aero-yellow [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg cursor-pointer relative z-10"
                          />
                          <div 
                              className="absolute top-[20px] h-4 w-1 bg-aero-yellow/70 pointer-events-none z-0 rounded-b-sm" 
                              style={{ left: `calc(${leftPct * 100}% + ${8 - leftPct * 16}px)`, transform: 'translateX(-50%)' }} 
                          />
                          <div className="flex justify-between mt-2 px-1">
                             <span className="text-[10px] text-white/30 font-mono" title="Break-Even at 99% LF">${minPossiblePrice}</span>
                             <span className="text-[10px] text-white/30 font-mono" title="Break-Even at 35% LF">${maxPossiblePrice}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="space-y-6 flex flex-col">
            <div className="p-4 bg-white/5 border border-white/10 rounded-sm flex gap-4">
              <Info className="text-white/80 shrink-0 mt-1" size={18} />
              <div className="text-[10px] text-white/80/80 leading-relaxed font-bold uppercase tracking-tight space-y-2">
                <p><strong>Ticket revenue:</strong> Ticket revenue from the estimated passengers, which depends on the load factor.</p>
                <p><strong>Direct flight costs:</strong> Fuel, crew, catering and landing fees. These scale with the flights actually operated.</p>
              </div>
            </div>
            
            <div className="bg-black/60 border border-white/10 rounded-sm">
              <FinancialReport 
                 title="Weekly Financial Projection"
                 netProfit={estWeeklyProfit}
                 totalRevenue={estWeeklyRev}
                 expenses={[
                   {
                     id: 'opx',
                     label: 'Direct flight costs',
                     total: weeklyFuelCost + weeklyCateringCost + weeklyStaffCost + weeklyInfraCost,
                     items: [
                       { label: `Fuel (${fuelPricePerL.toFixed(2)}/L)`, amount: weeklyFuelCost },
                       { label: 'Catering & Cabin', amount: weeklyCateringCost },
                       { label: 'Crew Costs', amount: weeklyStaffCost },
                       { label: 'Landing & pax fees', amount: weeklyInfraCost }
                     ]
                   }
                 ]}
                 defaultOpen={true}
              />
            </div>
            
            {estWeeklyProfit < 0 && (
              <div className="p-4 bg-[#111] border border-white/20 flex gap-3 text-aero-yellow/60">
                 <AlertTriangle size={20} className="shrink-0" />
                 <div>
                   <span className="text-[10px] font-black uppercase tracking-widest block mb-1">Loss Warning</span>
                   <p className="text-[9px] font-bold uppercase leading-tight opacity-80">This route is currently projected to lose money. Adjust prices or reconsider aircraft type/schedule.</p>
                 </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-white/10 bg-black/60 flex justify-end gap-4">
          <button 
            onClick={onClose}
            className="px-4 py-3 bg-white/5 border border-white/10 text-white font-black uppercase text-xs tracking-widest hover:bg-white/10 transition-all"
          >
            Discard Changes
          </button>
          <button 
            onClick={() => onSave(ticketPrices)}
            className="bg-aero-yellow text-black font-black uppercase text-sm tracking-widest py-4 px-6 rounded-none hover:bg-white transition-all shadow-2xl flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={16} /> Save New Pricing
          </button>
        </div>
      </motion.div>
    </div>
  );
}
