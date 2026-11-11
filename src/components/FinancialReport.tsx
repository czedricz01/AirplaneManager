import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatCurrency } from '../lib/format';

/** Text for a figure, respecting whether its section is a deduction or a net result. */
function signedAmount(variant: 'expense' | 'net' | undefined, value: number): string {
  if (variant !== 'net') return `-${formatCurrency(Math.abs(value))}`;
  return `${value >= 0 ? '+' : '-'}${formatCurrency(Math.abs(value))}`;
}

/** Colour for the same figure: deductions stay neutral, net results are signed. */
function signedClass(variant: 'expense' | 'net' | undefined, value: number): string {
  if (variant !== 'net') return 'text-ink';
  return value >= 0 ? 'text-good' : 'text-bad';
}

export interface FinancialItem {
  label: string;
  amount: number;
}

export interface FinancialCategory {
  id: string;
  label: string;
  total: number;
  items: FinancialItem[];
  /**
   * 'expense' (the default) renders every figure as a deduction with a leading
   * minus. 'net' renders signed figures instead, for a section whose rows are
   * already profits and losses — the route breakdown used to be forced through
   * the expense styling, so a route earning $80k was displayed as -$80,000.
   */
  variant?: 'expense' | 'net';
}

export interface FinancialReportProps {
  title: string;
  netProfit: number;
  totalRevenue?: number;
  revenues?: FinancialItem[];
  totalCosts?: number;
  expenses: FinancialCategory[];
  defaultOpen?: boolean;
}

export function FinancialReport({ title, netProfit, totalRevenue, revenues, totalCosts, expenses, defaultOpen = true }: FinancialReportProps) {
  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const [mainOpen, setMainOpen] = useState(defaultOpen);

  const toggleCategory = (id: string) => {
    setOpenCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  return (
    <div className="bg-ground/40 border border-line rounded-sm overflow-hidden flex flex-col text-xs">
      <button 
        onClick={() => setMainOpen(!mainOpen)}
        className="flex justify-between items-center p-3 bg-surface hover:bg-raised transition-colors border-b border-line"
      >
        <span className="font-semibold uppercase tracking-label text-muted">{title}</span>
        <div className="flex items-center gap-3">
           <span className={`font-semibold text-sm ${netProfit >= 0 ? "text-good" : "text-bad"}`}>
             {netProfit >= 0 ? "+" : ""}{formatCurrency(netProfit)}
           </span>
           <ChevronDown size={14} className={`text-muted transition-transform ${mainOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      <>
        {mainOpen && (
          <div
            className="overflow-hidden animate-appear"
          >
            <div className="p-3 flex flex-col gap-3">
               {/* Revenues Section */}
               {(totalRevenue !== undefined || revenues) && (
                 <div className="border border-line bg-surface rounded-sm">
                    <button 
                      onClick={() => toggleCategory('rev')}
                      className="w-full flex justify-between items-center p-2 hover:bg-raised transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-muted uppercase tracking-label md:tracking-label font-semibold text-left">Revenue</span>
                        <ChevronDown size={12} className={`text-muted transition-transform ${openCategories.includes('rev') ? 'rotate-180' : ''}`} />
                      </div>
                      <span className="text-ink font-mono">
                        +{formatCurrency(totalRevenue || (revenues?.reduce((a, b) => a + b.amount, 0) || 0))}
                      </span>
                    </button>
                    <>
                      {openCategories.includes('rev') && revenues && (
                        <div
                          className="overflow-hidden bg-ground/20 animate-appear"
                        >
                          <div className="p-2 flex flex-col gap-2 border-t border-line">
                            {revenues.map((r, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span className="text-muted">{r.label}</span>
                                <span className="text-ink">{formatCurrency(r.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                 </div>
               )}

               {/* Expenses Section */}
               {expenses.map(cat => (
                 <div key={cat.id} className="border border-line bg-surface rounded-sm">
                    <button
                      onClick={() => toggleCategory(cat.id)}
                      className="w-full flex justify-between items-center p-2 hover:bg-raised transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-muted uppercase tracking-label md:tracking-label font-semibold text-left">{cat.label}</span>
                        <ChevronDown size={12} className={`text-muted transition-transform ${openCategories.includes(cat.id) ? 'rotate-180' : ''}`} />
                      </div>
                      <span className={`font-semibold ${signedClass(cat.variant, cat.total)}`}>
                        {signedAmount(cat.variant, cat.total)}
                      </span>
                    </button>
                    <>
                      {openCategories.includes(cat.id) && cat.items.length > 0 && (
                        <div
                          className="overflow-hidden bg-ground/20 animate-appear"
                        >
                          <div className="p-2 flex flex-col gap-2 border-t border-line">
                            {cat.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between gap-4">
                                <span className="text-muted">{item.label}</span>
                                <span className={cat.variant === 'net' ? signedClass('net', item.amount) : 'text-ink'}>
                                  {cat.variant === 'net' ? signedAmount('net', item.amount) : formatCurrency(item.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                 </div>
               ))}
               
               {/* Total Costs Row if needed */}
               {totalCosts !== undefined && expenses.length === 0 && (
                 <div className="flex justify-between items-center p-2 bg-surface rounded-sm border border-line">
                   <span className="text-muted uppercase tracking-label md:tracking-label font-semibold text-left">Total Costs</span>
                   <span className="text-ink font-mono">-{formatCurrency(totalCosts)}</span>
                 </div>
               )}
            </div>
          </div>
        )}
      </>
    </div>
  );
}
