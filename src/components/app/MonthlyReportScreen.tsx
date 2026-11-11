/** The screen after a month closes: the financial report, incidents and the way back to the game. */
import { motion } from 'motion/react';
import { ErrorBoundary } from '../ErrorBoundary';
import React from 'react';
import type { Edition } from '../../lib/newspaper';
import type { MonthlyReport, ViewState } from '../../lib/gameTypes';

const FinancialReport = React.lazy(() => import('../FinancialReport').then(m => ({ default: m.FinancialReport })));
import { LazyFallback } from '../ui/LazyFallback';
import { formatCurrency, formatNumber } from '../../lib/format';
import { ReportIncident } from '../../lib/gameState';
import { IncidentList } from '../IncidentList';
import { ChevronRight, Newspaper } from 'lucide-react';

export interface MonthlyReportScreenProps {
  latestReport: MonthlyReport | null;
  formatDate: (offset: number) => string;
  currentDateOffset: number;
  airlineName: string;
  airlineCode: string;
  setView: React.Dispatch<React.SetStateAction<ViewState>>;
  edition: Edition | null;
  setIsNewspaperOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function MonthlyReportScreen({
  latestReport, formatDate, currentDateOffset, airlineName, airlineCode, setView, edition, setIsNewspaperOpen
}: MonthlyReportScreenProps) {
  return (
    <>
              <motion.div
                key="monthly-overview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-start bg-ground relative p-12 bar:p-3 short:p-3"
              >
                {/* Centred with auto margins, not justify-center, which cut the top
                    off whenever the report was taller than the screen. On phones
                    the whole page scrolls as one, rather than the report scrolling
                    inside it, and the buttons stay pinned to the bottom. */}
                <div className="max-w-4xl w-full my-auto" data-tour="monthly-report">
                  <div className="border-b border-line pb-6 mb-6 bar:pb-3 bar:mb-3 short:pb-2 short:mb-2">
                    <span className="text-accent font-label text-xs tracking-label uppercase block mb-2 short:hidden">Operation: Execution</span>
                    <h2 className="text-3xl bar:text-3xl short:text-2xl font-semibold leading-none">Monthly <span className="text-accent">Report</span></h2>
                    {/* The report covers the month that just ended, not the one the clock
                        has already advanced to, so label it from the report itself. */}
                    <p className="text-muted font-mono mt-4 bar:mt-2 short:mt-1 font-semibold text-xl bar:text-sm short:text-sm">
                      {latestReport
                        ? `${latestReport.month.toString().padStart(2, '0')}/${latestReport.year}`
                        : formatDate(currentDateOffset)} - {airlineName || 'Neo Airlines'} ({airlineCode || 'NX'})
                    </p>
                  </div>
                  
                  <div className="mb-6 bar:mb-3 short:mb-3 max-h-[60vh] bar:max-h-none short:max-h-none overflow-y-auto bar:overflow-visible short:overflow-visible pr-4 bar:pr-0 short:pr-0">
                   <ErrorBoundary label="Monthly Report" onReset={() => setView('game')} resetLabel="CONTINUE">
                    <React.Suspense fallback={<LazyFallback label="Monthly Report" />}>
                    {latestReport ? (
                      <>
                      <FinancialReport
                         title="Monthly Financial Overview"
                         netProfit={latestReport.totalProfit}
                         totalRevenue={latestReport.routeRevenues}
                         revenues={(latestReport.routes || []).map(r => ({
                           label: `${r.name}${(r.capacity ?? 0) > 0 ? ` (${Math.round(((r.paxPerWeek ?? 0) / (r.capacity ?? 1)) * 100)}% LF)` : ''}${(r.transferPax ?? 0) > 0 ? ` incl. ${formatNumber(r.transferPax ?? 0)} transfer pax/wk` : ''}`,
                           amount: r.revenue
                         }))}
                         expenses={[
                           {
                             id: 'routeCosts',
                             label: 'Route Operational Costs',
                             total: latestReport.routeCosts,
                             items: [
                               { label: `Jet Fuel (${formatNumber(latestReport.breakdown.fuelLiters || 0)} L @ $${(latestReport.breakdown.fuelPriceL || 0).toFixed(3)})`, amount: latestReport.breakdown.fuel },
                               { label: 'In-Flight Catering & Amenities', amount: latestReport.breakdown.catering },
                               { label: 'Flight Crew & Ground Staff Salaries', amount: latestReport.breakdown.staff },
                               { label: 'Landing & passenger fees', amount: latestReport.breakdown.routeInfra }
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
                           // Insurance and maintenance of every aircraft, flying or parked.
                           ...((latestReport.breakdown.fleetOwnership || 0) > 0 ? [{
                             id: 'fleetOwnership',
                             label: 'Aircraft Ownership',
                             total: latestReport.breakdown.fleetOwnership,
                             items: [
                               { label: 'Insurance & maintenance programme', amount: latestReport.breakdown.fleetOwnership - (latestReport.breakdown.fleetParked || 0) },
                               ...((latestReport.breakdown.fleetParked || 0) > 0
                                 ? [{ label: `Parked aircraft (${latestReport.breakdown.fleetParkedCount || 0}): storage & insurance`, amount: latestReport.breakdown.fleetParked }]
                                 : [])
                             ]
                           }] : []),
                           // What the rivals landing at an airport owned outright pay the airline.
                           ...((latestReport.breakdown.hubIncome || 0) > 0 ? [{
                             id: 'hubIncome',
                             label: 'Airport Ownership Income',
                             variant: 'net' as const,
                             total: latestReport.breakdown.hubIncome,
                             items: latestReport.hubIncomeItems || []
                           }] : []),
                           // Only in months with campaigns or the frequent-flyer
                           // programme running; older reports have no such line.
                           ...((latestReport.breakdown.marketing || 0) > 0 ? [{
                             id: 'marketing',
                             label: 'Marketing & Loyalty',
                             total: latestReport.breakdown.marketing,
                             items: latestReport.marketingItems || [
                               { label: 'Advertising campaigns', amount: latestReport.breakdown.marketingCampaigns || 0 },
                               { label: 'Frequent flyer programme', amount: latestReport.breakdown.ffp || 0 }
                             ]
                           }] : []),
                           // Only in months with a charter (older reports: also repair bills).
                           ...((latestReport.breakdown.incidents || 0) > 0 ? [{
                             id: 'incidents',
                             label: 'Incident repairs & charters',
                             total: latestReport.breakdown.incidents,
                             items: (latestReport.incidents || [])
                               .filter((i: ReportIncident) => (i.cost || 0) > 0)
                               .map((i: ReportIncident) => ({ label: i.title, amount: i.cost || 0 }))
                           }] : []),
                           // Only in reports closed before slots were paid for on the
                           // spot: they were billed into that month's result then.
                           // Slots bought since are a capex item ('Airport Slots').
                           // Signed: selling slots back refunds money.
                           ...((latestReport.breakdown.purchasedSlots || 0) !== 0 ? [{
                             id: 'slots',
                             label: 'Slot purchases & refunds',
                             variant: 'net' as const,
                             total: -latestReport.breakdown.purchasedSlots,
                             items: [{
                               label: latestReport.breakdown.purchasedSlots > 0 ? 'Slot rights bought this month' : 'Slot rights sold back this month',
                               amount: -latestReport.breakdown.purchasedSlots
                             }]
                           }] : []),
                           // These left the bank account but are not part of the
                           // operating profit above — without them the profit and
                           // the change in capital never reconcile.
                           // Signed as well: aircraft sales come in here.
                           ...((latestReport.capexItems || []).some(i => i.amount !== 0) ? [{
                             id: 'capex',
                             label: 'One-off investments & sales (below the line)',
                             variant: 'net' as const,
                             total: -(latestReport.capex || 0),
                             items: (latestReport.capexItems || [])
                               .filter(i => i.amount !== 0)
                               .map(i => ({ label: i.label, amount: -i.amount }))
                           }] : []),
                           ...(latestReport.routes && latestReport.routes.length > 0 ? [{
                             id: 'routeBreakdown',
                             label: 'Route Breakdown',
                             // Profits and losses per route, not deductions — see
                             // the 'net' variant in FinancialReport.
                             variant: 'net' as const,
                             total: latestReport.routes.reduce((sum, r) => sum + r.profit, 0),
                             items: latestReport.routes.map(r => ({
                               label: `${r.name} (Rev: ${formatCurrency(r.revenue)}, Exp: ${formatCurrency(r.cost)})`,
                               amount: r.profit
                             }))
                           }] : [])
                         ]}
                         defaultOpen={true}
                      />
                      <IncidentList incidents={latestReport.incidents} className="mt-4" />
                      {/* Operating profit and the change in the bank balance are
                          different numbers whenever anything was bought. Stating
                          both, next to each other, is what makes the report add up. */}
                      <div className="mt-4 flex items-center justify-between border border-line bg-ground/30 px-4 py-3 font-mono text-xs">
                        <span className="uppercase tracking-label text-muted font-semibold">Cash change this month</span>
                        <span className={(latestReport.cashChange ?? latestReport.totalProfit) >= 0 ? 'text-good font-semibold' : 'text-bad font-semibold'}>
                          {(latestReport.cashChange ?? latestReport.totalProfit) >= 0 ? '+' : ''}
                          {formatCurrency(latestReport.cashChange ?? latestReport.totalProfit)}
                        </span>
                      </div>
                      </>
                    ) : (
                      <div className="h-64 flex items-center justify-center text-muted">
                        No financial data available for this month.
                      </div>
                    )}
                    </React.Suspense>
                   </ErrorBoundary>
                  </div>

                  <div className="flex flex-col-reverse md:flex-row justify-end gap-3 bar:flex-row bar:gap-2 short:gap-2 bar:sticky short:sticky bar:bottom-0 short:bottom-0 bar:bg-ground short:bg-ground bar:py-2 short:py-2 bar:border-t short:border-t border-line">
                    {edition && (
                      <button
                        type="button"
                        onClick={() => setIsNewspaperOpen(true)}
                        className="flex items-center justify-center gap-2 border border-line text-muted px-4 py-4 bar:py-2.5 short:py-2 bar:px-3 bar:text-xs short:text-xs font-semibold uppercase tracking-label hover:border-accent hover:text-ink transition-all w-full md:w-auto"
                      >
                        <Newspaper size={18} /> Read the newspaper
                      </button>
                    )}
                    <button 
                      onClick={() => setView('game')}
                      className="group flex items-center justify-center md:justify-start bg-accent text-on-accent px-4 py-4 bar:py-2.5 short:py-2 font-semibold uppercase tracking-label hover:bg-ink transition-all w-full md:w-auto bar:flex-1 short:w-auto"
                    >
                      Continue
                      <ChevronRight size={20} className="ml-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </motion.div>
    </>
  );
}
