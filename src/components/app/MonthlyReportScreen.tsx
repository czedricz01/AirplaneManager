/** The screen after a month closes: the financial report, incidents and the way back to the game. */
import { ErrorBoundary } from '../ErrorBoundary';
import React from 'react';
import type { Edition } from '../../lib/newspaper';
import type { MonthlyReport, ViewState } from '../../lib/gameTypes';

const FinancialReport = React.lazy(() => import('../FinancialReport').then(m => ({ default: m.FinancialReport })));
import { LazyFallback } from '../ui/LazyFallback';
import { reportView } from '../../lib/modelReport';
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
  const view = React.useMemo(() => (latestReport ? reportView(latestReport) : null), [latestReport]);
  return (
    <>
              <div
                key="monthly-overview"
                className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-start bg-ground relative p-12 bar:p-3 short:p-3 animate-appear"
              >
                {/* Centred with auto margins, not justify-center, which cut the top
                    off whenever the report was taller than the screen. On phones
                    the whole page scrolls as one, rather than the report scrolling
                    inside it, and the buttons stay pinned to the bottom. */}
                <div className="max-w-4xl w-full my-auto" data-tour="monthly-report">
                  <div className="border-b border-line pb-6 mb-6 bar:pb-3 bar:mb-3 short:pb-2 short:mb-2">
                    <h2 className="font-label text-2xl short:text-xl font-semibold">Monthly report</h2>
                    {/* The report covers the month that just ended, not the one the clock
                        has already advanced to, so label it from the report itself. */}
                    <p className="text-muted font-mono mt-4 bar:mt-2 short:mt-1 font-semibold text-xl bar:text-sm short:text-sm">
                      {latestReport
                        ? `${latestReport.month.toString().padStart(2, '0')}/${latestReport.year}`
                        : formatDate(currentDateOffset)} - {airlineName || 'Neo Airlines'} ({airlineCode || 'NX'})
                    </p>
                  </div>
                  
                  <div className="mb-6 bar:mb-3 short:mb-3 max-h-[60vh] bar:max-h-none short:max-h-none overflow-y-auto bar:overflow-visible short:overflow-visible pr-4 bar:pr-0 short:pr-0">
                   <ErrorBoundary label="Monthly Report" onReset={() => setView('game')} resetLabel="Continue">
                    <React.Suspense fallback={<LazyFallback label="Monthly Report" />}>
                    {latestReport && view ? (
                      <>
                      {/* Costs by the model's items (docs/neubau 5.16) and the way from the profit to the cash
                          (8.2): one function builds both for this screen and the company view. */}
                      <FinancialReport
                         title="Monthly Financial Overview"
                         netProfit={latestReport.totalProfit}
                         totalRevenue={latestReport.routeRevenues}
                         revenues={view.revenues}
                         expenses={view.routes ? [...view.expenses, view.routes] : view.expenses}
                         defaultOpen={true}
                      />
                      <IncidentList incidents={latestReport.incidents} className="mt-4" />
                      {/* Operating profit and the change in the bank balance are different numbers whenever
                          anything was bought, sold or paid at the close. The lines say why. */}
                      <div className="mt-4">
                        <FinancialReport
                           title="Cash change this month"
                           netProfit={view.cash.total}
                           expenses={[view.cash]}
                           defaultOpen={true}
                        />
                      </div>
                      {view.credit && (
                        <p className={`mt-3 text-xs ${view.credit.state === 'overdrawn' ? 'text-bad' : view.credit.state === 'credit' ? 'text-ink' : 'text-muted'}`}>
                          {view.credit.text}
                        </p>
                      )}
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
              </div>
    </>
  );
}
