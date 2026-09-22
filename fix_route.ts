import fs from 'fs';
let file = fs.readFileSync('src/components/RoutePlannerView.tsx', 'utf-8');

// 1. Remove `<p ... Set your ticket prices... </p>`
file = file.replace(/<p className="text-white\/40 text-xs mb-8">Set your ticket prices[^<]+<\/p>\s*/, '');

// 2. Add General Settings slider and remove 100% BE text & BE(75%) text, and add vertical tick.
const startIdx = file.indexOf('{classes.map(c => {');
const endIdxString = '</div>\n                     </div>\n                     <div className="flex gap-4">';
const endIdx = file.indexOf(endIdxString);

if (startIdx !== -1 && endIdx !== -1) {
    const replacement = `                           <div className="flex flex-col gap-4 bg-black/40 p-6 border border-white/5 group hover:border-white/20 transition-all mb-8 shadow-2xl relative overflow-hidden">
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
                                    min={Math.round(basePriceBE99)}
                                    max={Math.round(basePriceBE35)}
                                    value={ticketPrices['economy'] || Math.round(basePriceBE75)}
                                    onChange={(e) => {
                                       const val = parseInt(e.target.value);
                                       const newPrices = { ...ticketPrices };
                                       classes.forEach(c => {
                                          if (classSeatCount[c] > 0) {
                                             const multi = (c === 'premium' ? 1.6 : c === 'business' ? 3.0 : c === 'first' ? 5.0 : 1.0);
                                             newPrices[c] = Math.round(val * multi);
                                          }
                                       });
                                       setTicketPrices(newPrices);
                                    }}
                                    className="w-full h-2 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-aero-yellow [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg cursor-pointer"
                                 />
                                 <div 
                                    className="absolute top-4 bottom-0 w-[2px] bg-white pointer-events-none" 
                                    style={{ left: \`calc(\${((basePriceBE75 - basePriceBE99) / (basePriceBE35 - basePriceBE99)) * 100}%)\` }} 
                                 />
                                 <div className="flex justify-between mt-2 px-1">
                                    <span className="text-[10px] text-white/30 font-mono" title="Break-Even at 99% LF">\${Math.round(basePriceBE99)}</span>
                                    <span className="text-[10px] text-white/30 font-mono" title="Break-Even at 35% LF">\${Math.round(basePriceBE35)}</span>
                                 </div>
                              </div>
                           </div>

                           {classes.map(c => {
                             if (classSeatCount[c] <= 0) return null;
                             const currentPrice = ticketPrices[c] || 0;
                             const multiplier = (c === 'premium' ? 1.6 : c === 'business' ? 3.0 : c === 'first' ? 5.0 : 1.0);
                             
                             const breakEvenPrice = Math.round(basePriceBE75 * multiplier);
                             const minPossiblePrice = Math.round(basePriceBE99 * multiplier);
                             const maxPossiblePrice = Math.round(basePriceBE35 * multiplier);
                             
                             return (
                               <div key={c} className="flex flex-col gap-4 bg-black/40 p-6 border border-white/5 group hover:border-white/20 transition-all">
                                  <div className="flex justify-between items-center">
                                     <div className="flex flex-col">
                                        <span className="text-sm uppercase font-black tracking-widest text-aero-yellow">{c} Class</span>
                                        <span className="text-[10px] text-white/40 uppercase tracking-widest mt-1">{classSeatCount[c]} Seats</span>
                                     </div>
                                     <div className="flex flex-col items-end">
                                        <span className="text-2xl font-mono text-white font-bold">\${currentPrice}</span>
                                     </div>
                                  </div>
                                  
                                  <div className="relative pt-4">
                                     <input 
                                        type="range"
                                        min={minPossiblePrice}
                                        max={maxPossiblePrice}
                                        value={currentPrice}
                                        onChange={(e) => setTicketPrices(prev => ({ ...prev, [c]: parseInt(e.target.value) }))}
                                        className="w-full h-2 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-aero-yellow [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg cursor-pointer"
                                     />
                                     <div 
                                        className="absolute top-4 bottom-0 w-[2px] bg-white pointer-events-none" 
                                        style={{ left: \`calc(\${((breakEvenPrice - minPossiblePrice) / (maxPossiblePrice - minPossiblePrice)) * 100}%)\` }} 
                                     />
                                     <div className="flex justify-between mt-2 px-1">
                                        <span className="text-[10px] text-white/30 font-mono" title="Break-Even at 99% LF">\${minPossiblePrice}</span>
                                        <span className="text-[10px] text-white/30 font-mono" title="Break-Even at 35% LF">\${maxPossiblePrice}</span>
                                     </div>
                                  </div>
                               </div>
                             );
                           })}
`;
    const finalContent = file.substring(0, startIdx) + replacement + file.substring(endIdx);
    fs.writeFileSync('src/components/RoutePlannerView.tsx', finalContent);
    console.log('Replaced block');
} else {
    console.log('Could not find block borders.');
    console.log(startIdx, endIdx);
}
