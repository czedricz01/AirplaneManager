const fs = require('fs');
let content = fs.readFileSync('src/components/RoutePricingEditView.tsx', 'utf8');

content = content.replace(
  /\{\[\'economy\', \'premium\', \'business\', \'first\'\]\.map\(cls => \{.*?<div className="w-24 bg-black border border-white\/20 p-2 text-right">/s,
  `{['economy', 'premium', 'business', 'first'].map(cls => {
                const seats = aircraft.config?.[cls as keyof typeof aircraft.config];
                if (!seats || seats === 0) return null;
                return (
                  <div key={cls} className="bg-black/40 border border-white/5 p-4 rounded-sm hover:border-white/20 transition-all flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-sm uppercase font-black tracking-widest text-aero-yellow">{cls} Class</span>
                        <span className="text-[10px] text-white/40 uppercase tracking-widest mt-1">{seats} Seats</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-2xl font-mono text-white font-bold">\${ticketPrices[cls]}</span>
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
                        const be99 = Math.round((basePriceBE99 || 80) * multiplier);
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
                                className="absolute top-[20px] h-4 w-1 bg-white/10 pointer-events-none z-0 rounded-b-sm" 
                                style={{ left: \`calc(\${((breakEvenPrice - minPossiblePrice) / (maxPossiblePrice - minPossiblePrice)) * 100}% + \${8 - ((breakEvenPrice - minPossiblePrice) / (maxPossiblePrice - minPossiblePrice)) * 16}px)\`, transform: 'translateX(-50%)' }} 
                            />
                            <div className="flex justify-between mt-2 px-1">
                               <span className="text-[10px] text-white/30 font-mono" title="Break-Even at 99% LF">\${minPossiblePrice}</span>
                               <span className="text-[10px] text-white/30 font-mono" title="Break-Even at 35% LF">\${maxPossiblePrice}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
              <div className="hidden">`
);

fs.writeFileSync('src/components/RoutePricingEditView.tsx', content);
