import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';
const formatCurrency = (val: number) => { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val); };

export interface FinancialItem {
  label: string;
  amount: number;
}

export interface FinancialCategory {
  id: string;
  label: string;
  total: number;
  items: FinancialItem[];
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
    <div className="bg-black/40 border border-white/10 rounded-sm overflow-hidden flex flex-col font-mono text-xs">
      <button 
        onClick={() => setMainOpen(!mainOpen)}
        className="flex justify-between items-center p-3 bg-white/5 hover:bg-white/10 transition-colors border-b border-white/5"
      >
        <span className="font-bold uppercase tracking-widest text-aero-yellow">{title}</span>
        <div className="flex items-center gap-3">
           <span className={`font-black text-sm ${netProfit >= 0 ? "text-aero-yellow" : "text-aero-yellow/60"}`}>
             {netProfit >= 0 ? "+" : ""}{formatCurrency(netProfit)}
           </span>
           <ChevronDown size={14} className={`text-white/40 transition-transform ${mainOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      <AnimatePresence>
        {mainOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 flex flex-col gap-3">
               {/* Revenues Section */}
               {(totalRevenue !== undefined || revenues) && (
                 <div className="border border-white/5 bg-white/5 rounded-sm">
                    <button 
                      onClick={() => toggleCategory('rev')}
                      className="w-full flex justify-between items-center p-2 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-white/60 uppercase tracking-widest font-bold">Revenue</span>
                        <ChevronDown size={12} className={`text-white/40 transition-transform ${openCategories.includes('rev') ? 'rotate-180' : ''}`} />
                      </div>
                      <span className="text-aero-yellow font-bold">
                        +{formatCurrency(totalRevenue || (revenues?.reduce((a, b) => a + b.amount, 0) || 0))}
                      </span>
                    </button>
                    <AnimatePresence>
                      {openCategories.includes('rev') && revenues && (
                        <motion.div 
                          initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                          className="overflow-hidden bg-black/20"
                        >
                          <div className="p-2 flex flex-col gap-2 border-t border-white/5">
                            {revenues.map((r, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span className="text-white/40">{r.label}</span>
                                <span className="text-white/80">{formatCurrency(r.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                 </div>
               )}

               {/* Expenses Section */}
               {expenses.map(cat => (
                 <div key={cat.id} className="border border-white/5 bg-white/5 rounded-sm">
                    <button 
                      onClick={() => toggleCategory(cat.id)}
                      className="w-full flex justify-between items-center p-2 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-white/60 uppercase tracking-widest font-bold">{cat.label}</span>
                        <ChevronDown size={12} className={`text-white/40 transition-transform ${openCategories.includes(cat.id) ? 'rotate-180' : ''}`} />
                      </div>
                      <span className="text-aero-yellow/60 font-bold">
                        -{formatCurrency(cat.total)}
                      </span>
                    </button>
                    <AnimatePresence>
                      {openCategories.includes(cat.id) && cat.items.length > 0 && (
                        <motion.div 
                          initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                          className="overflow-hidden bg-black/20"
                        >
                          <div className="p-2 flex flex-col gap-2 border-t border-white/5">
                            {cat.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span className="text-white/40">{item.label}</span>
                                <span className="text-white/80">{formatCurrency(item.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                 </div>
               ))}
               
               {/* Total Costs Row if needed */}
               {totalCosts !== undefined && expenses.length === 0 && (
                 <div className="flex justify-between items-center p-2 bg-white/5 rounded-sm border border-white/5">
                   <span className="text-white/60 uppercase tracking-widest font-bold">Total Costs</span>
                   <span className="text-aero-yellow/60 font-bold">-{formatCurrency(totalCosts)}</span>
                 </div>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
