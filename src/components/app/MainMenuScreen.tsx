/** The main menu: resume, load, start, settings and the account line. */
import { Button } from '../ui/Button';
import React from 'react';
import type { SaveMetadata } from '../../lib/cloudSaves';
import type { ViewState } from '../../lib/gameTypes';
import { LogOut, Maximize2, Minimize2 } from 'lucide-react';
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
              <div key="main-menu" className="flex-1 min-h-0 overflow-y-auto flex flex-col bg-ground animate-appear">
                {/* Who is signed in, and the ways out. */}
                <div className="flex items-center justify-end gap-2 px-4 py-2 border-b border-line">
                  <div className="mr-auto min-w-0 text-sm text-muted truncate">
                    <span className="text-ink">{user || 'Not signed in'}</span>
                    <span className="hidden sm:inline"> · {cloudStatusLabel}</span>
                    <span className="sr-only">{userId ? (cloudOnline ? ', online' : ', offline') : ''}</span>
                  </div>
                  {fullscreen.supported && (
                    <Button variant="ghost" onClick={fullscreen.toggle} icon={fullscreen.active ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                      aria-label={fullscreen.active ? 'Exit full screen' : 'Full screen'}>
                      <span className="hidden sm:inline">{fullscreen.active ? 'Exit full screen' : 'Full screen'}</span>
                    </Button>
                  )}
                  <Button variant="ghost" onClick={handleDisconnect} icon={<LogOut size={15} />}>Log out</Button>
                </div>

                {/* The menu: a column on the left, not a centred poster. On a phone
                    held sideways the title and the buttons sit side by side. */}
                <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-10 py-8 short:py-3 flex flex-col short:flex-row short:items-center gap-8 short:gap-10">
                  <div className="short:shrink-0">
                    <h1 className="font-label font-bold text-3xl leading-none uppercase tracking-label text-ink">Airline Manager Neo</h1>
                    <p className="mt-2 text-base text-muted max-w-[40ch]">Start in 1960 with a hub and a budget, and build a route network month by month.</p>
                  </div>

                  <div className="w-full max-w-sm flex flex-col gap-2">
                    {legacySaveCount > 0 && (
                      <div className="border border-rule bg-surface p-3 mb-2 flex flex-col gap-2">
                        <div className="text-sm font-medium text-ink">
                          {legacySaveCount} savegame{legacySaveCount === 1 ? '' : 's'} found from before accounts existed
                        </div>
                        <p className="text-xs text-muted">
                          They are still stored in this browser. Import them into your account to
                          reach them from any device. The originals are left untouched.
                        </p>
                        <div className="flex gap-2">
                          <Button variant="primary" size="sm" onClick={handleImportLegacySaves} disabled={isImportingLegacy}>
                            {isImportingLegacy ? 'Importing…' : 'Import into my account'}
                          </Button>
                          <Button size="sm" onClick={() => setLegacySaveCount(0)}>Not now</Button>
                        </div>
                      </div>
                    )}
                    <ThemeMenuButton
                      label="Resume game"
                      hint={saves.length > 0 ? 'Your latest savegame' : 'No savegame yet'}
                      primary={saves.length > 0}
                      onClick={() => {
                        if (saves.length > 0) {
                          const latest = [...saves].sort((a, b) => b.timestamp - a.timestamp)[0];
                          handleLoadGame(latest.id);
                        } else {
                          setAppAlert("There is no savegame to resume yet. Start a new game.");
                        }
                      }}
                    />
                    <ThemeMenuButton label="Load game" hint={`${saves.length} saved`} onClick={() => setShowLoadMenu(true)} />
                    <ThemeMenuButton label="New game" hint="Free play or a scenario" primary={saves.length === 0} onClick={() => setView('start-menu')} />
                    <ThemeMenuButton label="Settings" onClick={() => setIsSettingsOpen(true)} />
                  </div>
                </div>
              </div>
    </>
  );
}
