import React, { useState } from 'react';
import { Search, Info } from 'lucide-react';
import { FinancialReport } from './FinancialReport';
const formatCurrency = (val: number) => { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val); };

interface Props {
  capital: number;
  latestReport: any;
}

export function MyCompanyView({ capital, latestReport }: Props) {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="w-full h-full text-white/90 px-3 py-3 lg:px-4 lg:py-4 flex flex-col font-sans overflow-hidden relative">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h2 className="text-3xl font-mono text-aero-yellow uppercase tracking-[0.3em] font-black drop-shadow-lg">
          MY COMPANY
        </h2>
      </div>
      
      <div className="flex-1 overflow-auto pr-4 custom-scrollbar">
         <div className="grid grid-cols-1 gap-3 max-w-4xl mx-auto">
            <div className="bg-black/40 border border-white/10 p-4 rounded-sm">
               <span className="text-[10px] uppercase tracking-widest text-white/40 font-black mb-2 block">Available Capital</span>
               <span className="text-4xl font-mono font-bold text-aero-yellow">{formatCurrency(capital)}</span>
            </div>

            <div className="p-4 bg-white/5 border border-white/10 rounded-sm flex gap-4">
              <Info className="text-white/80 shrink-0 mt-1" size={18} />
              <div className="text-[10px] text-white/80/80 leading-relaxed font-bold uppercase tracking-tight space-y-2">
                <p><strong>Flugumsatz (Ticketeinnahmen):</strong> Income generated from passengers flying on your active routes.</p>
                <p><strong>Direkte Flugausgaben:</strong> Variable costs that scale with flights, including Fuel, Crew, Landing Fees, and Catering.</p>
                <p><strong>Monatliche Fixkosten:</strong> Recurring real estate upkeep for rented Check-in Desks, Lounges, and Stands at airports.</p>
                <p><strong>Einmalinvestitionen:</strong> Capex for purchasing new Aircraft or permanent Landing Slots.</p>
              </div>
            </div>

            {latestReport ? (
              <FinancialReport
                 title="Latest Monthly Report"
                 netProfit={latestReport.totalProfit}
                 totalRevenue={latestReport.routeRevenues}
                 expenses={[
                   {
                     id: 'routeCosts',
                     label: 'Direkte Flugausgaben',
                     total: latestReport.routeCosts,
                     items: [
                       { label: 'Sprit (Fuel)', amount: latestReport.breakdown.fuel },
                       { label: 'Catering', amount: latestReport.breakdown.catering },
                       { label: 'Crew (Flight & Ground)', amount: latestReport.breakdown.staff },
                       { label: 'Landegebühren', amount: latestReport.breakdown.landingFees },
                       { label: 'Pax Handling & Check-in', amount: latestReport.breakdown.paxFees }
                     ]
                   },
                   {
                     id: 'airportCosts',
                     label: 'Monatliche Fixkosten',
                     total: latestReport.airportUpkeep,
                     items: [
                       { label: 'Stands & Desks Upkeep', amount: latestReport.breakdown.mgt },
                       { label: 'Service Desk Operations', amount: latestReport.breakdown.desks }
                     ]
                   },
                   {
                     id: 'capex',
                     label: 'Einmalinvestitionen (Capex)',
                     total: latestReport.breakdown.purchasedSlots || 0,
                     items: [
                       { label: 'Permanent Slots', amount: latestReport.breakdown.purchasedSlots || 0 }
                     ]
                   }
                 ]}
              />
            ) : (
              <div className="h-48 border border-white/5 bg-black/20 flex items-center justify-center text-white/40 uppercase tracking-widest text-xs font-bold">
                 No financial report generated yet.
              </div>
            )}
         </div>
      </div>
    </div>
  );
}
