const fs = require('fs');
const content = fs.readFileSync('src/components/RouteDetailView.tsx', 'utf-8');

const targetStart = `{/* Finances Box */}`;
const targetEnd = `Click to adjust pricing
            </div>
          </div>
        </div>
      </div>`;

const startIndex = content.indexOf(targetStart);
if (startIndex === -1) {
  console.log("Start not found");
  process.exit(1);
}

const endIndex = content.indexOf(targetEnd, startIndex);
if (endIndex === -1) {
  console.log("End not found");
  process.exit(1);
}

const before = content.slice(0, startIndex);
const after = content.slice(endIndex + targetEnd.length);

const replacement = `
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
                 <FinancialReport
                   title="Route Projection"
                   netProfit={financials.estWeeklyProfit}
                   totalRevenue={financials.estWeeklyRev}
                   expenses={[
                     {
                       id: 'opx',
                       label: 'Operating Expenses',
                       total: financials.estWeeklyCosts,
                       items: [
                         { label: \`Fuel (\${formatNumber(financials.costsBreakdown.fuelLiters)}L @ \$\${financials.costsBreakdown.fuelPriceL})\`, amount: financials.costsBreakdown.fuel },
                         { label: 'Crew & Ground Staff', amount: financials.costsBreakdown.crew },
                         { label: 'Catering & Cabin', amount: financials.costsBreakdown.catering },
                         { label: 'Infrastructure & Fees', amount: financials.costsBreakdown.infra }
                       ]
                     }
                   ]}
                   defaultOpen={false}
                 />
               )}
               <div className="border-t border-white/5 pt-4 mt-4">
                  <div className="flex flex-col items-center">
                     <span className="text-xl font-mono text-emerald-500 font-bold">
                       {assignedAircraft && actualCapacity > 0 ? Math.round(((financials?.paxPerWeek || 0) / (routeFlightLegs * actualCapacity)) * 100) : 0}%
                     </span>
                     <span className="text-[9px] text-white/30 uppercase tracking-widest font-black mt-1">Avg Load Factor</span>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
`;

// Also inject FinancialReport and formatNumber import if not present
let newContent = before + replacement + after;
if (!newContent.includes('FinancialReport')) {
  newContent = `import { FinancialReport } from './FinancialReport';\n` + newContent;
}
if (!newContent.includes('formatNumber')) {
  // It uses formatNumber, let's see if it's imported
  if (!newContent.includes('formatNumber')) {
    newContent = newContent.replace("import { formatCurrency", "import { formatCurrency, formatNumber");
  }
}

fs.writeFileSync('src/components/RouteDetailView.tsx', newContent);
console.log("Done route detail replacement.");
