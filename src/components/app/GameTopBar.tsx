/** The bar above the game: date, key figures, messages, map options, the game menu and the running world events. */
import type { HistoricalEvent } from '../../lib/eventSystem';
import type { GameSettings } from '../../lib/gameState';
import type { GameMessage, SimulatedRoute } from '../../lib/gameTypes';
import type { Edition } from '../../lib/newspaper';
import type { OwnedAircraft } from '../MyFleetView';
import React from 'react';
import { GameMenuOption, GameStat } from './AppChrome';
import { Button } from '../ui/Button';
import { LITRES_PER_GALLON, formatCurrency, formatNumber } from '../../lib/format';
import { AlertTriangle, Bell, Newspaper, X } from 'lucide-react';
import { eventRegionLabel } from '../../lib/eventSystem';
import { eventEffect, type CreditStatus } from '../../lib/modelCompany';
import { isPaidChoice, type BandEvent } from '../../lib/modelEvents';
import { CREDIT_LIMIT_SHARE, CREDIT_RATE } from '../../model/constants';

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
  /** Running world events from the model (docs/neubau 4.7c, `eventBand`). */
  activeWorldEvents: BandEvent[];
  setPendingDecision: React.Dispatch<React.SetStateAction<HistoricalEvent | null>>;
  /** The credit line by the model (docs/neubau 8.14). */
  credit: CreditStatus;
  /** Titles of the events whose demand recovery the player bought (8.5). */
  recoveredEvents: readonly string[];
}

const signedPct = (m: number) => `${m >= 1 ? '+' : ''}${((m - 1) * 100).toFixed(0)}%`;

/** The warning under the bar while cash is below zero (8.14), texts from the model's constants. */
function creditText(credit: CreditStatus): string {
  if (credit.state === 'credit') {
    return `Interest ${formatNumber(CREDIT_RATE * 100)}% a year on the amount used. The credit line is ${formatNumber(CREDIT_LIMIT_SHARE * 100)}% of the fleet value; purchases need cash above zero.`;
  }
  const when = credit.closesToForcedSale === 1 ? 'at the next month close' : `in ${credit.closesToForcedSale} month closes`;
  return `Cash is below the credit line. If it still is at the month's end, the bank sells an aircraft ${when}; with no aircraft left the airline is bankrupt.`;
}

export function GameTopBar({
  capital, fleet, routes, reputation, globalDemandData, fuelData, formatDate, currentDateOffset, messagesHover, setIsMessagesOpen, isMessagesOpen, setMessages, messages, unreadMessagesCount, edition, setIsNewspaperOpen, setSelectedMessage, mapSettingsHover, setIsMapSettingsOpen, isMapSettingsOpen, showYourRoutes, setShowYourRoutes, showRivalRoutes, setShowRivalRoutes, showLiveTraffic, setShowLiveTraffic, gameSettings, setGameSettings, gameMenuHover, setIsGameMenuOpen, isGameMenuOpen, setShowSaveMenu, setIsSettingsOpen, fullscreen, setShowExitSavePrompt, activeWorldEvents, setPendingDecision, credit, recoveredEvents
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
                <div className="bg-ground border-b border-line flex flex-col rail:flex-row rail:items-stretch rail:justify-between short:h-10 shrink-0 relative z-50">
                  <div className="order-last rail:order-none grid grid-cols-3 border-t border-line rail:border-t-0 rail:flex rail:items-stretch short:min-w-0 short:overflow-x-auto short:scrollbar-hidden [&>*]:border-r [&>*]:border-line bar:[&>*:nth-child(3n)]:border-r-0 bar:[&>*:nth-child(-n+3)]:border-b">
                    <GameStat label="Capital" value={formatCurrency(capital)} />
                    <GameStat label="Fleet" value={fleet.length.toString()} />
                    <GameStat label="Routes" value={routes.length.toString()} />
                    <GameStat label="Reputation" value={`${Math.round(reputation)}`} />
                    <GameStat label="Demand" value={`${Math.round(globalDemandData.value * 100)}%`} trend={globalDemandData.trend} />
                    <GameStat label="Fuel" value={`$${formatNumber(fuelData.price / LITRES_PER_GALLON, 3)}`} trend={fuelData.trend} goodDirection="down" />
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rail:py-0 short:shrink-0 rail:relative">
                    <div className="flex items-center gap-4 mr-auto rail:mr-0">
                      <div className="text-accent font-mono text-base short:text-sm font-medium rail:mr-2" title="Current month">{formatDate(currentDateOffset)}</div>
                    </div>

                    <div className="rail:relative" {...messagesHover}>
                       <Button
                         variant={unreadMessagesCount > 0 ? 'primary' : 'secondary'}
                         onClick={() => {
                           setIsMessagesOpen(!isMessagesOpen);
                           if (!isMessagesOpen) {
                             setMessages(messages.map(m => ({ ...m, isRead: true })));
                           }
                         }}
                         aria-expanded={isMessagesOpen}
                         aria-label={unreadMessagesCount > 0 ? `Messages, ${unreadMessagesCount} unread` : 'Messages'}
                         icon={<Bell size={15} />}
                       >
                         <span className="hidden sm:inline short:hidden">Messages</span>
                         {unreadMessagesCount > 0 && <span className="font-mono">{unreadMessagesCount}</span>}
                       </Button>
                       
                       {isMessagesOpen && (
                         <div className="absolute top-full right-2 rail:right-0 mt-2 w-[min(22rem,calc(100vw-1rem))] bg-surface border border-rule shadow-pop rounded-sm z-[3000] flex flex-col animate-appear">
                           <div className="p-3 border-b border-line flex justify-between items-center">
                             <span className="font-label text-ink text-base font-semibold">Messages</span>
                             <div className="flex items-center gap-2">
                               {edition && (
                                 <button
                                   type="button"
                                   onClick={() => { setIsMessagesOpen(false); setIsNewspaperOpen(true); }}
                                   className="flex items-center gap-1.5 px-2 min-h-8 bar:min-h-11 border border-rule rounded-sm text-xs text-ink hover:bg-raised transition-colors"
                                   title={`Read The Aviation Times, ${edition.date}`}
                                 >
                                   <Newspaper size={11} /> Latest newspaper
                                 </button>
                               )}
                               <button onClick={() => setIsMessagesOpen(false)} className="size-8 bar:size-11 inline-flex items-center justify-center text-muted hover:text-ink hover:bg-raised rounded-sm" aria-label="Close messages"><X size={16}/></button>
                             </div>
                           </div>
                           <div className="max-h-80 overflow-y-auto">
                             {messages.length === 0 ? (
                               <div className="p-4 text-center text-muted text-sm">No messages</div>
                             ) : (
                               messages.map(msg => (
                                 <button
                                   type="button"
                                   key={msg.id}
                                   onClick={() => {
                                     setSelectedMessage(msg);
                                     setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isRead: true } : m));
                                   }}
                                   className="w-full p-3 border-b border-line hover:bg-raised cursor-pointer transition-colors flex flex-col gap-1 text-left"
                                 >
                                   <span className="text-xs text-muted font-mono">{msg.dateStr}</span>
                                   <span className={`text-sm ${msg.isRead ? 'text-muted' : 'text-ink font-medium'} line-clamp-3`}>{msg.text}</span>
                                 </button>
                               ))
                             )}
                           </div>
                         </div>
                       )}
                    </div>
                    
                    <div className="rail:relative" {...mapSettingsHover}>
                      <Button onClick={() => setIsMapSettingsOpen(!isMapSettingsOpen)} aria-expanded={isMapSettingsOpen} aria-label="Map options">Map</Button>
                      {isMapSettingsOpen && (
                        <div className="absolute top-full right-2 rail:right-0 mt-2 w-64 bg-surface border border-rule shadow-pop rounded-sm flex flex-col z-[3000] p-2 animate-appear">
                          <label className="flex items-center gap-3 text-sm text-ink cursor-pointer hover:bg-raised px-2 min-h-10 bar:min-h-11 rounded-sm transition-colors">
                            <input type="checkbox" checked={showYourRoutes} onChange={(e) => setShowYourRoutes(e.target.checked)} className="accent-accent w-4 h-4 cursor-pointer" />
                            Your routes
                          </label>
                          <label className="flex items-center gap-3 text-sm text-ink cursor-pointer hover:bg-raised px-2 min-h-10 bar:min-h-11 rounded-sm transition-colors">
                            <input type="checkbox" checked={showRivalRoutes} onChange={(e) => setShowRivalRoutes(e.target.checked)} className="accent-accent w-4 h-4 cursor-pointer" />
                            Rival routes
                          </label>
                          <label className="flex items-center gap-3 text-sm text-ink cursor-pointer hover:bg-raised px-2 min-h-10 bar:min-h-11 rounded-sm transition-colors">
                            <input type="checkbox" checked={showLiveTraffic} onChange={(e) => setShowLiveTraffic(e.target.checked)} className="accent-accent w-4 h-4 cursor-pointer" />
                            Live traffic
                          </label>
                          <label className="flex items-center gap-3 text-sm text-ink cursor-pointer hover:bg-raised px-2 min-h-10 bar:min-h-11 rounded-sm transition-colors">
                            <input
                              type="checkbox"
                              checked={gameSettings.heatmap}
                              onChange={(e) => {
                                const heatmap = e.target.checked;
                                setGameSettings(prev => ({ ...prev, heatmap }));
                              }}
                              className="accent-accent w-4 h-4 cursor-pointer"
                            />
                            Profit heatmap
                          </label>
                        </div>
                      )}
                    </div>

                    <div className="rail:relative" {...gameMenuHover}>
                      <Button onClick={() => setIsGameMenuOpen(!isGameMenuOpen)} aria-expanded={isGameMenuOpen} aria-label="Menu">Menu</Button>
                      {isGameMenuOpen && (
                        <div className="absolute top-full right-2 rail:right-0 mt-2 w-56 bg-surface border border-rule shadow-pop rounded-sm flex flex-col z-[3000] py-1 animate-appear">
                          <GameMenuOption label="Continue" onClick={() => setIsGameMenuOpen(false)} />
                          <GameMenuOption label="Save game" onClick={() => { setShowSaveMenu(true); setIsGameMenuOpen(false); }} />
                          <GameMenuOption label="Settings" onClick={() => { setIsSettingsOpen(true); setIsGameMenuOpen(false); }} />
                          {fullscreen.supported && (
                            <GameMenuOption label={fullscreen.active ? 'Exit full screen' : 'Full screen'} onClick={() => { fullscreen.toggle(); setIsGameMenuOpen(false); }} />
                          )}
                          <div className="h-px bg-line my-1"></div>
                          <GameMenuOption label="Return to main menu" onClick={() => { setIsGameMenuOpen(false); setShowExitSavePrompt(true); }} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* The credit line while cash is below zero (docs/neubau 8.14): how much is used and, when overdrawn,
                    how many closes are left before the bank sells an aircraft. */}
                {credit.state !== 'healthy' && (
                  <div className={`bg-surface border-b border-line border-l-[3px] ${credit.state === 'overdrawn' ? 'border-l-bad' : 'border-l-accent'} text-ink px-3.5 py-2 flex items-center gap-3 z-40 shrink-0`}>
                    <AlertTriangle className={`${credit.state === 'overdrawn' ? 'text-bad' : 'text-accent'} shrink-0`} size={16} />
                    <div className="flex-1 flex flex-col md:flex-row md:items-center gap-1 md:gap-4 min-w-0">
                      <span className={`font-label font-semibold text-sm shrink-0 ${credit.state === 'overdrawn' ? 'text-bad' : ''}`}>
                        {credit.state === 'overdrawn' ? 'Overdrawn' : 'Credit used'}
                      </span>
                      <span className="text-xs font-mono shrink-0 whitespace-nowrap">{formatCurrency(credit.used)} of {formatCurrency(credit.limit)}</span>
                      <span className="text-xs text-muted">{creditText(credit)}</span>
                    </div>
                  </div>
                )}

                {/* Active Events Banner. The banner itself already existed; what it
                    never said was how much longer the event runs, which is the one
                    thing a player needs in order to decide whether to ride it out. */}
                {activeWorldEvents.map((ev, i) => (
                   <div key={`idx-${i}`} className="bg-surface border-b border-line border-l-[3px] border-l-bad text-ink px-3.5 py-2 flex items-center gap-3 z-40 shrink-0">
                      <AlertTriangle className="text-bad shrink-0" size={16} />
                      <div className="flex-1 flex flex-col md:flex-row md:items-center gap-1 md:gap-4 min-w-0">
                         <span className="font-label font-semibold text-bad text-sm shrink-0">{ev.title}</span>
                         <span className="text-xs text-muted shrink-0 whitespace-nowrap">
                            {ev.monthsLeft} {ev.monthsLeft === 1 ? 'month' : 'months'} left
                         </span>
                         {ev.chosen && isPaidChoice(ev.chosen) && (
                            <span className="text-xs text-good shrink-0 whitespace-nowrap border border-good rounded-sm px-1.5 py-0.5">
                               {ev.chosen.label}
                            </span>
                         )}
                         {!ev.chosen && ev.choices && ev.choices.length > 0 && (
                            <button
                               type="button"
                               onClick={() => setPendingDecision(ev)}
                               className="text-xs font-semibold text-on-accent bg-accent hover:bg-ink shrink-0 whitespace-nowrap px-2 min-h-7 bar:min-h-11 rounded-sm border-0 cursor-pointer transition-colors"
                            >
                               Decision pending
                            </button>
                         )}
                         <span className="text-xs text-muted truncate">{ev.description}</span>
                         <span className="text-xs font-mono text-bad md:ml-auto whitespace-nowrap">
                            {/* What the player actually gets, by the model (docs/neubau 8.5): a bought demand
                                recovery softens the event's hit on the player's passengers. Fuel is not shown
                                here: the model has no event factor on fuel (E8), the price is in the Fuel figure. */}
                            {(() => {
                              const effect = eventEffect(ev.title, ev.demandMultiplier, recoveredEvents);
                              return `PAX${eventRegionLabel(ev) ? ` (${eventRegionLabel(ev)})` : ''}: ${signedPct(effect.player)}${effect.player !== effect.market ? ` (market ${signedPct(effect.market)})` : ''}`;
                            })()}
                         </span>
                      </div>
                   </div>
                ))}

    </>
  );
}
