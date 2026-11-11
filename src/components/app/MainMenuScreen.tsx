/** The main menu: resume, load, start, settings and the account line. */
import React from 'react';
import type { SaveMetadata } from '../../lib/cloudSaves';
import type { ViewState } from '../../lib/gameTypes';
import { motion } from 'motion/react';
import { Bird, LogOut, Maximize2, Minimize2 } from 'lucide-react';
import { ThemeMenuButton } from './AppChrome';

export interface MainMenuScreenProps {
  userId: string | null;
  cloudOnline: boolean;
  user: string | null;
  cloudStatusLabel: "Local only" | "Cloud synced" | "Offline - changes queued";
  fullscreen: { supported: boolean; active: boolean; toggle: () => void; };
  handleDisconnect: () => Promise<void>;
  legacySaveCount: number;
  handleImportLegacySaves: () => Promise<void>;
  isImportingLegacy: boolean;
  setLegacySaveCount: React.Dispatch<React.SetStateAction<number>>;
  saves: SaveMetadata[];
  handleLoadGame: (slotId: string) => Promise<void>;
  setAppAlert: React.Dispatch<React.SetStateAction<string | null>>;
  setShowLoadMenu: React.Dispatch<React.SetStateAction<boolean>>;
  setView: React.Dispatch<React.SetStateAction<ViewState>>;
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function MainMenuScreen({
  userId, cloudOnline, user, cloudStatusLabel, fullscreen, handleDisconnect, legacySaveCount, handleImportLegacySaves, isImportingLegacy, setLegacySaveCount, saves, handleLoadGame, setAppAlert, setShowLoadMenu, setView, setIsSettingsOpen
}: MainMenuScreenProps) {
  return (
    <>
              <motion.div
                key="main-menu"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-start p-4 pt-14 md:pt-4 short:pt-14 bg-ground relative"
              >
                {/* The menu card is centred with auto margins instead of
                    justify-center, which would push its top out of reach whenever it
                    is taller than the screen, as on phones; on those pt-14 keeps it
                    clear of this bar. */}
                <div className="absolute top-4 right-4 md:right-8 z-50 flex items-center gap-3 md:gap-4">
                  <div className="text-muted font-mono text-xs flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${userId ? (cloudOnline ? 'bg-accent animate-pulse' : 'bg-rule') : 'bg-raised'}`}></div>
                    {user || 'UNKNOWN_USER'}
                  </div>
                  <div className="hidden sm:block h-4 w-px bg-raised"></div>
                  <span className="hidden sm:inline text-muted font-label text-2xs uppercase tracking-label">{cloudStatusLabel}</span>
                  <div className="h-4 w-px bg-raised"></div>
                  {fullscreen.supported && (
                    <>
                      <button
                        type="button"
                        onClick={fullscreen.toggle}
                        aria-label={fullscreen.active ? 'Exit full screen' : 'Full screen'}
                        className="text-muted hover:text-ink font-label text-xs uppercase tracking-label flex items-center gap-2 transition-colors"
                      >
                        {fullscreen.active ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        <span className="hidden sm:inline">{fullscreen.active ? 'Exit full screen' : 'Full screen'}</span>
                      </button>
                      <div className="h-4 w-px bg-raised"></div>
                    </>
                  )}
                  <button 
                    onClick={handleDisconnect}
                    className="text-muted hover:text-ink font-label text-xs uppercase tracking-label flex items-center gap-2 transition-colors"
                  >
                    <LogOut size={14} /> Logout
                  </button>
                </div>
                {/* Background Decor */}
                <svg className="absolute inset-0 w-full h-full opacity-5 pointer-events-none" viewBox="0 0 800 400">
                  <path d="M150,100 Q200,80 250,120 T400,100 T550,150 T700,80" fill="none" stroke="#FACC15" strokeWidth="1" strokeDasharray="4" />
                  <circle cx="150" cy="100" r="3" fill="#FACC15" />
                  <circle cx="700" cy="80" r="3" fill="#FACC15" />
                </svg>

                {/* On a phone held sideways the logo and the menu sit side by side,
                    so the whole card fits the short screen without scrolling. */}
                <div className="w-full max-w-2xl short:max-w-3xl z-10 flex flex-col short:flex-row short:items-center gap-8 sm:gap-12 short:gap-8 border border-line bg-surface/30 rounded-sm p-5 sm:p-8 lg:p-14 short:p-5 my-auto">
                  <div className="space-y-4 short:space-y-2 short:shrink-0">
                    <Bird className="text-accent short:w-12 short:h-12" size={64} strokeWidth={2.5} />
                    <h1 className="text-3xl sm:text-3xl short:text-3xl tiny:text-3xl font-semibold leading-none">
                      <span className="text-accent">AM</span><br/>
                      <span className="text-ink">NEO</span>
                    </h1>
                    <p className="text-2xs font-normal text-muted pl-2">COMMAND INTERFACE v4.2</p>
                  </div>

                  {legacySaveCount > 0 && (
                    <div className="bg-accent/5 border border-accent/30 rounded-sm p-4 flex flex-col gap-3">
                      <div className="text-2xs font-label uppercase tracking-label text-accent font-semibold">
                        {legacySaveCount} savegame{legacySaveCount === 1 ? '' : 's'} found from before accounts existed
                      </div>
                      <p className="text-2xs font-mono text-muted leading-relaxed">
                        They are still stored in this browser. Import them into your account to
                        reach them from any device. The originals are left untouched.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={handleImportLegacySaves}
                          disabled={isImportingLegacy}
                          className="px-4 py-2 bg-accent text-on-accent font-semibold uppercase tracking-label text-2xs hover:bg-ink transition-colors disabled:opacity-50 rounded-sm"
                        >
                          {isImportingLegacy ? 'Importing...' : 'Import into my account'}
                        </button>
                        <button
                          onClick={() => setLegacySaveCount(0)}
                          className="px-4 py-2 border border-rule text-muted font-semibold uppercase tracking-label text-2xs hover:text-ink transition-colors rounded-sm"
                        >
                          Not now
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 short:gap-2 short:flex-1 short:min-w-0">
                    <ThemeMenuButton
                      index="01"
                      label="Resume Game"
                      onClick={() => {
                        if (saves.length > 0) {
                          const latest = [...saves].sort((a, b) => b.timestamp - a.timestamp)[0];
                          handleLoadGame(latest.id);
                        } else {
                          setAppAlert("No telemetry archives discovered to resume from.");
                        }
                      }}
                    />
                    <ThemeMenuButton
                      index="02"
                      label="Load Game"
                      onClick={() => setShowLoadMenu(true)}
                    />
                    <ThemeMenuButton
                      index="03"
                      label="Start Game"
                      onClick={() => setView('start-menu')}
                      primary
                    />
                    <ThemeMenuButton
                      index="04"
                      label="Settings"
                      onClick={() => setIsSettingsOpen(true)}
                    />

                  </div>
                </div>
              </motion.div>
    </>
  );
}
