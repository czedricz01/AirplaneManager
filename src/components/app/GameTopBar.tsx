/** The bar above the game: date, key figures, messages, map options, the game menu and the running world events. */
import type { EventChoice, EventRegion, HistoricalEvent } from '../../lib/eventSystem';
import type { GameSettings } from '../../lib/gameState';
import type { GameMessage, SimulatedRoute } from '../../lib/gameTypes';
import type { Edition } from '../../lib/newspaper';
import type { OwnedAircraft } from '../MyFleetView';
import React from 'react';
import { GameMenuOption, GameStat } from './AppChrome';
import { LITRES_PER_GALLON, formatCurrency, formatNumber } from '../../lib/format';
import { AlertTriangle, Bell, Newspaper, X } from 'lucide-react';
import { eventRegionLabel } from '../../lib/eventSystem';

export interface GameTopBarProps {
  capital: number;
  fleet: OwnedAircraft[];
  routes: SimulatedRoute[];
  reputation: number;
  globalDemandData: { value: number; trend: string; };
  fuelData: { price: number; trend: string; };
  formatDate: (offset: number) => string;
  currentDateOffset: number;
  messagesHover: { onPointerEnter: (e: React.PointerEvent) => void; onPointerLeave: (e: React.PointerEvent) => void; };
  setIsMessagesOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMessagesOpen: boolean;
  setMessages: React.Dispatch<React.SetStateAction<GameMessage[]>>;
  messages: GameMessage[];
  unreadMessagesCount: number;
  edition: Edition | null;
  setIsNewspaperOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedMessage: React.Dispatch<React.SetStateAction<GameMessage | null>>;
  mapSettingsHover: { onPointerEnter: (e: React.PointerEvent) => void; onPointerLeave: (e: React.PointerEvent) => void; };
  setIsMapSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMapSettingsOpen: boolean;
  showYourRoutes: boolean;
  setShowYourRoutes: React.Dispatch<React.SetStateAction<boolean>>;
  showRivalRoutes: boolean;
  setShowRivalRoutes: React.Dispatch<React.SetStateAction<boolean>>;
  showLiveTraffic: boolean;
  setShowLiveTraffic: React.Dispatch<React.SetStateAction<boolean>>;
  gameSettings: GameSettings;
  setGameSettings: React.Dispatch<React.SetStateAction<GameSettings>>;
  gameMenuHover: { onPointerEnter: (e: React.PointerEvent) => void; onPointerLeave: (e: React.PointerEvent) => void; };
  setIsGameMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isGameMenuOpen: boolean;
  setShowSaveMenu: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  fullscreen: { supported: boolean; active: boolean; toggle: () => void; };
  setShowExitSavePrompt: React.Dispatch<React.SetStateAction<boolean>>;
  activeWorldEvents: { monthsLeft: number; chosen: EventChoice | undefined; startOffset: number; duration: number; title: string; description: string; demandMultiplier: number; fuelMultiplier: number; choices?: EventChoice[]; regions?: EventRegion[]; }[];
  setPendingDecision: React.Dispatch<React.SetStateAction<HistoricalEvent | null>>;
}

export function GameTopBar({
  capital, fleet, routes, reputation, globalDemandData, fuelData, formatDate, currentDateOffset, messagesHover, setIsMessagesOpen, isMessagesOpen, setMessages, messages, unreadMessagesCount, edition, setIsNewspaperOpen, setSelectedMessage, mapSettingsHover, setIsMapSettingsOpen, isMapSettingsOpen, showYourRoutes, setShowYourRoutes, showRivalRoutes, setShowRivalRoutes, showLiveTraffic, setShowLiveTraffic, gameSettings, setGameSettings, gameMenuHover, setIsGameMenuOpen, isGameMenuOpen, setShowSaveMenu, setIsSettingsOpen, fullscreen, setShowExitSavePrompt, activeWorldEvents, setPendingDecision
}: GameTopBarProps) {
  return (
    <>
                {/* Game Stats Bar. On upright phones it has two rows: date and
                    buttons on top, then the stats as a 3x2 grid so every figure
                    stays visible. The dropdowns below are anchored to this bar there
                    (their wrappers are only `relative` in the rail layout), so they
                    open below it at the right edge instead of running off the left
                    of the screen. Sideways phones keep one lower row, and the stats
                    scroll sideways when they do not all fit. */}
                <div className="rail:h-14 short:h-8 bg-aero-carbon border-b border-white/5 flex flex-col rail:flex-row rail:items-center rail:justify-between gap-1.5 rail:gap-0 short:gap-3 px-3 rail:px-4 short:px-2 py-1.5 rail:py-0 shrink-0 relative z-50">
                  <div className="order-last rail:order-none grid grid-cols-3 gap-x-2 gap-y-1.5 rail:flex rail:gap-5 rail:items-center short:gap-3 short:min-w-0 short:overflow-x-auto short:scrollbar-hidden">
                    <GameStat label="Capital" value={formatCurrency(capital)} />
                    <GameStat label="Fleet" value={fleet.length.toString()} />
                    <GameStat label="Routes" value={routes.length.toString()} />
                    <GameStat label="Reputation" value={`${Math.round(reputation)}`} />
                    <GameStat label="Global Demand" value={`${Math.round(globalDemandData.value * 100)}%`} trend={globalDemandData.trend} />
                    <GameStat label="Fuel" value={`$${formatNumber(fuelData.price / LITRES_PER_GALLON, 3)}`} trend={fuelData.trend} goodDirection="down" />
                  </div>
                  <div className="flex items-center gap-3 short:gap-2 short:shrink-0 rail:relative">
                    <div className="flex items-center gap-4 mr-auto rail:mr-0">
                      <div className="text-aero-yellow font-mono text-sm short:text-xs font-bold tracking-widest short:tracking-wider">{formatDate(currentDateOffset)}</div>
                    </div>

                    <div className="rail:relative" {...messagesHover}>
                       <button
                         onClick={() => {
                           setIsMessagesOpen(!isMessagesOpen);
                           if (!isMessagesOpen) {
                             setMessages(messages.map(m => ({ ...m, isRead: true })));
                           }
                         }}
                         aria-label={unreadMessagesCount > 0 ? `Messages, ${unreadMessagesCount} unread` : 'Messages'}
                         className={`flex items-center gap-2 px-3 py-1 border text-2xs uppercase font-bold tracking-widest transition-all rounded-sm ${unreadMessagesCount > 0 ? 'bg-aero-yellow text-black border-aero-yellow' : 'bg-white/5 text-white hover:bg-white/10 border-white/10'}`}
                       >
                         <Bell size={12} />
                         <span className="hidden sm:inline short:hidden">Messages</span>
                         {unreadMessagesCount > 0 && (
                           <span className="ml-1 bg-black text-aero-yellow px-1.5 py-0.5 text-4xs rounded-sm">{unreadMessagesCount}</span>
                         )}
                       </button>
                       
                       {isMessagesOpen && (
                         <div className="absolute top-full right-2 rail:right-0 mt-2 w-[min(20rem,calc(100vw-1rem))] bg-aero-panel border border-aero-yellow/20 shadow-2xl z-[3000] flex flex-col">
                           <div className="p-3 border-b border-white/10 flex justify-between items-center">
                             <span className="text-aero-yellow text-2xs uppercase tracking-widest font-bold">Communications</span>
                             <div className="flex items-center gap-2">
                               {edition && (
                                 <button
                                   type="button"
                                   onClick={() => { setIsMessagesOpen(false); setIsNewspaperOpen(true); }}
                                   className="flex items-center gap-1 px-2 py-0.5 border border-white/10 text-3xs uppercase tracking-widest font-bold text-white/60 hover:text-aero-yellow hover:border-aero-yellow/40 transition-colors"
                                   title={`Read The Aviation Times, ${edition.date}`}
                                 >
                                   <Newspaper size={11} /> Latest newspaper
                                 </button>
                               )}
                               <button onClick={() => setIsMessagesOpen(false)} className="text-white/40 hover:text-white" aria-label="Close messages"><X size={14}/></button>
                             </div>
                           </div>
                           <div className="max-h-64 overflow-y-auto no-scrollbar">
                             {messages.length === 0 ? (
                               <div className="p-4 text-center text-white/30 text-xs font-mono">No new messages</div>
                             ) : (
                               messages.map(msg => (
                                 <div 
                                   key={msg.id} 
                                   onClick={() => {
                                     setSelectedMessage(msg);
                                     setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isRead: true } : m));
                                   }}
                                   className="p-3 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors group flex flex-col gap-1 text-left"
                                 >
                                   <div className="text-3xs text-white/40 font-mono flex justify-between items-center w-full"><span>{msg.dateStr}</span><span className="text-3xs opacity-0 group-hover:opacity-100 text-aero-yellow font-bold uppercase transition-opacity">Read Dispatch</span></div>
                                   <div className={`text-xs ${msg.isRead ? 'text-white/60' : 'text-white font-semibold'} group-hover:text-aero-yellow transition-colors line-clamp-3`}>{msg.text}</div>
                                 </div>
                               ))
                             )}
                           </div>
                         </div>
                       )}
                    </div>
                    
                    <div className="rail:relative" {...mapSettingsHover}>
                      <button
                         onClick={() => setIsMapSettingsOpen(!isMapSettingsOpen)}
                         className="px-2 rail:px-3 py-1.5 rail:py-2 short:py-1 whitespace-nowrap border border-white/10 text-white/40 text-2xs font-black uppercase tracking-wider rail:tracking-widest hover:border-aero-yellow hover:text-white transition-all mr-1 rail:mr-2"
                      >
                        [ Map ]
                      </button>
                      {isMapSettingsOpen && (
                        <div className="absolute top-full rail:top-12 right-2 rail:right-0 mt-2 w-64 bg-aero-panel border border-aero-yellow/20 shadow-2xl flex flex-col z-[3000] p-4 gap-4">
                          <label className="flex items-center gap-3 text-xs uppercase font-bold tracking-widest text-aero-yellow cursor-pointer hover:bg-white/5 p-2 transition-colors">
                            <input type="checkbox" checked={showYourRoutes} onChange={(e) => setShowYourRoutes(e.target.checked)} className="accent-aero-yellow w-4 h-4 cursor-pointer" />
                            Your Routes
                          </label>
                          <label className="flex items-center gap-3 text-xs uppercase font-bold tracking-widest text-aero-yellow/60 cursor-pointer hover:bg-white/5 p-2 transition-colors">
                            <input type="checkbox" checked={showRivalRoutes} onChange={(e) => setShowRivalRoutes(e.target.checked)} className="accent-red-500 w-4 h-4 cursor-pointer" />
                            Rival Routes
                          </label>
                          <label className="flex items-center gap-3 text-xs uppercase font-bold tracking-widest text-white/80 cursor-pointer hover:bg-white/5 p-2 transition-colors">
                            <input type="checkbox" checked={showLiveTraffic} onChange={(e) => setShowLiveTraffic(e.target.checked)} className="accent-blue-400 w-4 h-4 cursor-pointer" />
                            Live Traffic
                          </label>
                          <label className="flex items-center gap-3 text-xs uppercase font-bold tracking-widest text-white/80 cursor-pointer hover:bg-white/5 p-2 transition-colors">
                            <input
                              type="checkbox"
                              checked={gameSettings.heatmap}
                              onChange={(e) => {
                                const heatmap = e.target.checked;
                                setGameSettings(prev => ({ ...prev, heatmap }));
                              }}
                              className="accent-emerald-500 w-4 h-4 cursor-pointer"
                            />
                            Profit Heatmap
                          </label>
                        </div>
                      )}
                    </div>

                    <div className="rail:relative" {...gameMenuHover}>
                      <button
                         onClick={() => setIsGameMenuOpen(!isGameMenuOpen)}
                         className="px-2 rail:px-3 py-1.5 rail:py-2 short:py-1 whitespace-nowrap border border-white/10 text-white/40 text-2xs font-black uppercase tracking-wider rail:tracking-widest hover:border-aero-yellow hover:text-white transition-all"
                      >
                        [ Menu ]
                      </button>
                      {isGameMenuOpen && (
                        <div className="absolute top-full rail:top-12 right-2 rail:right-0 mt-2 w-56 bg-aero-carbon border border-white/10 shadow-2xl flex flex-col z-[100] py-2">
                          <GameMenuOption label="Continue" onClick={() => setIsGameMenuOpen(false)} />
                          <GameMenuOption label="Save Game" onClick={() => { setShowSaveMenu(true); setIsGameMenuOpen(false); }} />
                          <GameMenuOption label="Settings" onClick={() => { setIsSettingsOpen(true); setIsGameMenuOpen(false); }} />
                          {fullscreen.supported && (
                            <GameMenuOption label={fullscreen.active ? 'Exit Full Screen' : 'Full Screen'} onClick={() => { fullscreen.toggle(); setIsGameMenuOpen(false); }} />
                          )}
                          <div className="h-px bg-white/10 my-2"></div>
                          <GameMenuOption label="Return to Main Menu" onClick={() => { setIsGameMenuOpen(false); setShowExitSavePrompt(true); }} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Active Events Banner. The banner itself already existed; what it
                    never said was how much longer the event runs, which is the one
                    thing a player needs in order to decide whether to ride it out. */}
                {activeWorldEvents.map((ev, i) => (
                   <div key={`idx-${i}`} className="bg-aero-warn/10 border-b border-aero-warn/40 text-white/80 px-4 py-2.5 flex items-center gap-4 z-40 shrink-0 shadow-2xl">
                      <AlertTriangle className="text-aero-warn shrink-0" size={16} />
                      <div className="flex-1 flex flex-col md:flex-row md:items-center gap-1 md:gap-4 min-w-0">
                         <span className="font-black uppercase tracking-widest text-aero-warn text-2xs shrink-0">{ev.title}</span>
                         <span className="text-2xs md:text-xs font-bold text-white/70 shrink-0 whitespace-nowrap">
                            {ev.monthsLeft} {ev.monthsLeft === 1 ? 'month' : 'months'} left
                         </span>
                         {ev.chosen && ev.chosen.cost > 0 && (
                            <span className="text-2xs font-mono font-bold text-aero-good shrink-0 whitespace-nowrap border border-aero-good/40 px-1.5 py-0.5">
                               {ev.chosen.label}
                            </span>
                         )}
                         {!ev.chosen && ev.choices && ev.choices.length > 0 && (
                            <button
                               type="button"
                               onClick={() => setPendingDecision(ev)}
                               className="text-2xs font-mono font-bold text-black bg-aero-yellow hover:bg-white shrink-0 whitespace-nowrap px-1.5 py-0.5 border-0 cursor-pointer transition-colors"
                            >
                               Decision pending
                            </button>
                         )}
                         <span className="text-2xs md:text-xs opacity-70 truncate font-mono">{ev.description}</span>
                         <span className="text-2xs md:text-xs font-bold text-aero-warn ml-auto whitespace-nowrap">
                            {/* What the player actually gets: bought relief softens the
                                event's demand hit (see eventReliefFactor). The banner
                                used to show the raw hit even after paying for relief. */}
                            {(() => {
                              const softens = ev.chosen?.softensDemand;
                              const effective = softens && ev.demandMultiplier < 1
                                ? ev.demandMultiplier + (1 - ev.demandMultiplier) * softens
                                : ev.demandMultiplier;
                              const pct = (m: number) => `${m >= 1 ? '+' : ''}${((m - 1) * 100).toFixed(0)}%`;
                              return `PAX${eventRegionLabel(ev) ? ` (${eventRegionLabel(ev)})` : ''}: ${pct(effective)}${effective !== ev.demandMultiplier ? ` (market ${pct(ev.demandMultiplier)})` : ''}${ev.regions?.length ? '' : ` | FUEL: ${pct(ev.fuelMultiplier)}`}`;
                            })()}
                         </span>
                      </div>
                   </div>
                ))}

    </>
  );
}
