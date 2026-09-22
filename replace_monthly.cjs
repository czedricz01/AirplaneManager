const fs = require('fs');

const content = fs.readFileSync('src/App.tsx', 'utf-8');

const targetStart = `{view === 'monthly-overview' && (`;
const targetEnd = `</div>
              </motion.div>
            )}`;

const startIndex = content.indexOf(targetStart);
if (startIndex === -1) {
  console.log("Start not found");
  process.exit(1);
}

// Find the end by looking for {view === 'game' && (
const gameIndex = content.indexOf(`{view === 'game' && (`, startIndex);
if (gameIndex === -1) {
  console.log("End not found");
  process.exit(1);
}

const before = content.slice(0, startIndex);
const after = content.slice(gameIndex);

const newContent = before + `{view === 'monthly-overview' && (
              <motion.div
                key="monthly-overview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col items-center justify-center bg-aero-black relative p-12"
              >
                <div className="max-w-4xl w-full">
                  <div className="border-b border-white/10 pb-6 mb-12">
                    <span className="text-aero-yellow font-mono text-xs tracking-widest uppercase block mb-2">Operation: Execution</span>
                    <h2 className="text-5xl font-black italic uppercase tracking-tighter leading-none">Monthly <span className="text-aero-yellow">Report</span></h2>
                    <p className="text-white/60 font-mono mt-4 font-bold text-xl">{formatDate(currentDateOffset)} - {airlineName || 'Neo Airlines'} ({airlineCode || 'NX'})</p>
                  </div>
                  
                  <div className="mb-12 max-h-[60vh] overflow-y-auto custom-scrollbar pr-4">
                    {latestReport ? (
                      <FinancialReport
                         title="Monthly Financial Overview"
                         netProfit={latestReport.totalProfit}
                         totalRevenue={latestReport.routeRevenues}
                         expenses={[
                           {
                             id: 'routeCosts',
                             label: 'Route Operational Costs',
                             total: latestReport.routeCosts,
                             items: [
                               { label: \`Jet Fuel (\${formatNumber(latestReport.breakdown.fuelLiters || 0)} L @ \$\${(latestReport.breakdown.fuelPriceL || 0).toFixed(3)})\`, amount: latestReport.breakdown.fuel },
                               { label: 'In-Flight Catering & Amenities', amount: latestReport.breakdown.catering },
                               { label: 'Flight Crew & Ground Staff Salaries', amount: latestReport.breakdown.staff },
                               { label: 'Route Infrastructure (Slots & Pax Fees)', amount: latestReport.breakdown.routeInfra }
                             ]
                           },
                           {
                             id: 'airportCosts',
                             label: 'Airport & Hub Upkeep',
                             total: latestReport.airportUpkeep,
                             items: [
                               { label: 'Base Management & Slot Maintenance', amount: latestReport.breakdown.mgt },
                               { label: 'Check-in & Service Desk Operations', amount: latestReport.breakdown.desks }
                             ]
                           },
                           ...(latestReport.routes && latestReport.routes.length > 0 ? [{
                             id: 'routeBreakdown',
                             label: 'Route Breakdown',
                             total: 0,
                             items: latestReport.routes.map((r: any) => ({
                               label: \`\${r.name} (Rev: \${formatCurrency(r.revenue)}, Exp: \${formatCurrency(r.cost)})\`,
                               amount: -r.profit // Negating profit to show as an expense line or just displaying the value, but since it's an expense category we might want to make it special. Wait, I should add a custom category for it, or just use FinancialReport's flexible structure.
                             }))
                           }] : [])
                         ]}
                         defaultOpen={true}
                      />
                    ) : (
                      <div className="h-64 flex items-center justify-center text-white/40">
                        No financial data available for this month.
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <button 
                      onClick={() => setView('game')}
                      className="group flex items-center bg-aero-yellow text-black px-8 py-4 font-bold uppercase tracking-widest hover:bg-white transition-all w-full md:w-auto"
                    >
                      Continue
                      <ChevronRight size={20} className="ml-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            ` + after;

fs.writeFileSync('src/App.tsx', newContent);
console.log("Done");
