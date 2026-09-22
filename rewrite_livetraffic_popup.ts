import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'src', 'components', 'LiveTraffic.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

const popupRegex = /<Popup>([\s\S]*?)<\/Popup>/g;
const newPopup = `<Popup>
                    <div className="bg-[#1a1a1a] border-l-2 border-[#FACC15] p-3 rounded-none text-[10px] font-mono leading-relaxed text-white min-w-[260px] shadow-2xl select-none">
                      {/* Carrier & Callsign Banner */}
                      <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-2">
                        <span className="text-[#FACC15] font-black uppercase tracking-widest text-[9px] flex items-center gap-2">
                          {isRival ? r.airline || 'Rival Carrier' : 'Your Airline'}
                        </span>
                        <span className="bg-[#0f0f0f] border border-white/10 text-white text-[8px] px-2 py-0.5 uppercase tracking-wide font-bold">
                          FLIGHT {r.id.substring(0, 5)}
                        </span>
                      </div>

                      {/* Aircraft Info */}
                      <div className="mb-3 text-[11px] font-bold text-white tracking-wide">
                        {labelName} <span className="text-white/40 font-normal">({r.aircraftReg || "N/A"})</span>
                      </div>

                      {/* Route Info */}
                      <div className="flex items-center justify-between mb-3 bg-[#0f0f0f] p-2 border border-white/5">
                        <div className="flex flex-col items-start">
                          <span className="text-white/50 text-[8px] uppercase">From</span>
                          <span className="font-black text-lg text-white">{currentOrigin.id}</span>
                        </div>
                        <div className="flex-1 px-4 flex flex-col items-center relative">
                           <div className="w-full h-[1px] bg-white/20 absolute top-1/2 -translate-y-1/2"></div>
                           <div 
                              className="absolute h-[3px] w-[3px] bg-[#FACC15] rounded-full top-1/2 -translate-y-1/2 transition-all duration-1000" 
                              style={{ left: \`\${progress * 100}%\` }}
                           ></div>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-white/50 text-[8px] uppercase">To</span>
                          <span className="font-black text-lg text-white">{currentDest.id}</span>
                        </div>
                      </div>

                      {/* Flight Details Grid */}
                      <div className="grid grid-cols-2 gap-2 text-[9px] border-t border-white/5 pt-2">
                        <div className="flex flex-col">
                          <span className="text-white/40 uppercase">Status</span>
                          <span className="text-[#FACC15] uppercase">{isReturn ? 'Inbound' : 'Outbound'}</span>
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="text-white/40 uppercase">Progress</span>
                          <span className="text-white">{(progress * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-white/40 uppercase">Speed</span>
                          <span className="text-white">{planeInfo?.cruiseSpeed || 800} km/h</span>
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="text-white/40 uppercase">Class</span>
                          <span className="text-white">{planeClass.toUpperCase()}</span>
                        </div>
                      </div>
                    </div>
                  </Popup>`;

content = content.replace(popupRegex, newPopup);

fs.writeFileSync(filePath, content, 'utf-8');
