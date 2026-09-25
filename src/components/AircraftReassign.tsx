/**
 * The two ways to put a route on another aircraft:
 *
 *   - AircraftSwapPanel (aircraft page, "Swap"): every route of one aircraft
 *     goes to an idle aircraft at the same times.
 *   - RouteAircraftPicker (route page, "Change"): one route goes to any
 *     aircraft with room for it; the time is picked afterwards in the
 *     timetable editor.
 *
 * Both only display what lib/aircraftAssignment decides.
 */
import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, Check, ChevronRight, Info } from 'lucide-react';
import type { OwnedAircraft } from './MyFleetView';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { airportsMapAdjusted } from '../data/airportRegistry';
import {
  AssignmentCheck,
  AssignmentContext,
  RouteLike,
  RoutePatch,
  checkReassignment,
  idleAircraft,
  routesOf,
  seatCount,
  weeklyUtilisation
} from '../lib/aircraftAssignment';

interface SharedProps {
  fleet: OwnedAircraft[];
  routes: RouteLike[];
  airportManagement: AssignmentContext['airportManagement'];
  airlineCode?: string;
}

function useContextFor({ fleet, routes, airportManagement, airlineCode }: SharedProps): AssignmentContext {
  return useMemo(
    () => ({ fleet, routes, airports: airportsMapAdjusted, airportManagement, airlineCode }),
    [fleet, routes, airportManagement, airlineCode]
  );
}

/** What the check found: first what stops the move, then what changes with it. */
export function CheckDetails({ check }: { check: AssignmentCheck }) {
  return (
    <div className="flex flex-col gap-2">
      {check.issues.map((issue, i) => (
        <div key={`i${i}`} className="flex gap-2 items-start text-2xs font-mono text-aero-warn leading-snug">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          <span>{issue.message}</span>
        </div>
      ))}
      {check.notes.map((note, i) => (
        <div key={`n${i}`} className="flex gap-2 items-start text-2xs font-mono text-white/60 leading-snug">
          <Info size={12} className="shrink-0 mt-0.5 text-white/40" />
          <span>{note.message}</span>
        </div>
      ))}
    </div>
  );
}

function PlaneRow({
  plane,
  routes,
  verdict,
  selected,
  showBooked = true,
  onClick
}: {
  plane: OwnedAircraft;
  routes: RouteLike[];
  verdict: React.ReactNode;
  selected?: boolean;
  /** Idle aircraft are always 0% booked; the swap list leaves it out. */
  showBooked?: boolean;
  onClick?: () => void;
}) {
  const busyPct = Math.round(weeklyUtilisation(routes, plane.registration) * 100);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`w-full text-left px-3 py-2 border rounded-sm flex items-center gap-3 transition-colors ${
        selected ? 'border-aero-yellow bg-aero-yellow/10' : 'border-white/10 bg-black/30 hover:border-white/30'
      } disabled:cursor-default disabled:hover:border-white/10`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-white">{plane.registration}</span>
          <span className="text-2xs text-white/50 truncate">{plane.manufacturer} {plane.type}</span>
        </div>
        <div className="text-3xs font-mono uppercase tracking-widest text-white/40 mt-0.5 flex flex-wrap gap-x-3">
          <span>{plane.class}</span>
          <span>{seatCount(plane)} seats</span>
          <span>{plane.maxRange.toLocaleString('en-US')} km</span>
          <span>Hub {plane.hubId || 'none'}</span>
          {showBooked && <span>{busyPct}% of week booked</span>}
        </div>
      </div>
      <div className="shrink-0">{verdict}</div>
    </button>
  );
}

interface SwapProps extends SharedProps {
  plane: OwnedAircraft;
  onSwap: (patches: RoutePatch[], replacement: OwnedAircraft) => void;
  onBack: () => void;
}

/**
 * Lists every idle aircraft with the result of the full check, so the player
 * sees at once which ones can take over and why the others cannot.
 */
export function AircraftSwapPanel(props: SwapProps) {
  const { plane, fleet, routes, onSwap, onBack } = props;
  const ctx = useContextFor(props);
  const moving = useMemo(() => routesOf(routes, plane.registration), [routes, plane.registration]);

  const candidates = useMemo(() => {
    const list = idleAircraft(fleet, routes, plane.registration).map(p => ({
      plane: p,
      check: checkReassignment(moving, p, ctx)
    }));
    // Aircraft that fit first, then the ones with the fewest problems.
    return list.sort((a, b) => a.check.issues.length - b.check.issues.length);
  }, [fleet, routes, plane.registration, moving, ctx]);

  const [selectedReg, setSelectedReg] = useState<string | null>(null);
  const selected = candidates.find(c => c.plane.registration === selectedReg) || null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-2xs text-white/60 leading-relaxed">
        Pick an idle aircraft to take over all {moving.length} route{moving.length === 1 ? '' : 's'} of{' '}
        <span className="font-mono text-white">{plane.registration}</span>. The flights keep their times;
        leg time and turnaround follow the new aircraft. {plane.registration} is idle afterwards.
      </p>

      {candidates.length === 0 ? (
        <div className="p-4 border border-white/10 bg-black/30 text-2xs text-white/50 uppercase tracking-widest text-center">
          No idle aircraft. Every other aircraft in your fleet already flies a route.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {candidates.map(({ plane: p, check }) => (
            <React.Fragment key={p.registration}>
              <PlaneRow
                plane={p}
                routes={routes}
                showBooked={false}
                selected={p.registration === selectedReg}
                onClick={() => setSelectedReg(p.registration === selectedReg ? null : p.registration)}
                verdict={
                  check.ok
                    ? <Badge tone="good"><Check size={10} /> Fits</Badge>
                    : <Badge tone="warn">{check.issues.length} problem{check.issues.length === 1 ? '' : 's'}</Badge>
                }
              />
              {p.registration === selectedReg && (
                <div className="ml-3 pl-3 border-l border-white/10 flex flex-col gap-3 py-1">
                  {check.issues.length === 0 && check.notes.length === 0 ? (
                    <div className="text-2xs font-mono text-aero-good">No problems found.</div>
                  ) : (
                    <CheckDetails check={check} />
                  )}
                  {check.ok ? (
                    <Button
                      variant="primary"
                      icon={<ArrowLeftRight size={12} />}
                      onClick={() => onSwap(check.patches, p)}
                      className="self-start"
                    >
                      Swap to {p.registration}
                    </Button>
                  ) : (
                    <div className="text-3xs font-mono uppercase tracking-widest text-white/40">
                      {p.registration} cannot take over these routes.
                    </div>
                  )}
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      <Button variant="ghost" onClick={onBack} className="self-start">Back</Button>
    </div>
  );
}

interface PickerProps extends SharedProps {
  route: RouteLike;
  onPick: (registration: string) => void;
  onClose: () => void;
}

/**
 * The route page's "Change": every other aircraft that can fly this route
 * and still has room for all of its flights somewhere in its week.
 */
export function RouteAircraftPicker(props: PickerProps) {
  const { route, fleet, routes, onPick, onClose } = props;
  const ctx = useContextFor(props);

  const { suitable, unsuitable } = useMemo(() => {
    const checked = fleet
      .filter(p => p.registration !== route.aircraft)
      .map(p => ({ plane: p, check: checkReassignment([route], p, ctx, { allowShift: true }) }));
    return {
      // Least booked first: they leave the most choice of times.
      suitable: checked
        .filter(c => c.check.ok)
        .sort((a, b) => weeklyUtilisation(routes, a.plane.registration) - weeklyUtilisation(routes, b.plane.registration)),
      unsuitable: checked.filter(c => !c.check.ok)
    };
  }, [fleet, route, routes, ctx]);

  const [showUnsuitable, setShowUnsuitable] = useState(false);

  return (
    <Modal open onClose={onClose} size="xl" title="Change Aircraft" icon={<ArrowLeftRight size={18} />}>
      <div className="flex flex-col gap-3">
        <p className="text-2xs text-white/60 leading-relaxed">
          Aircraft that can fly {route.origin}-{route.destination}, are based at {route.origin} or have no hub yet,
          and have room for all {route.schedule?.length || 0} weekly flights. After picking one you choose the
          new time slot in its timetable.
        </p>

        {suitable.length === 0 ? (
          <div className="p-4 border border-white/10 bg-black/30 text-2xs text-white/50 uppercase tracking-widest text-center">
            No aircraft in your fleet can take this route.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {suitable.map(({ plane, check }) => (
              <PlaneRow
                key={plane.registration}
                plane={plane}
                routes={routes}
                onClick={() => onPick(plane.registration)}
                verdict={
                  <span className="flex items-center gap-2">
                    {check.notes.length > 0 && (
                      <span className="text-3xs font-mono text-white/40" title={check.notes.map(n => n.message).join('\n')}>
                        {check.notes.length} note{check.notes.length === 1 ? '' : 's'}
                      </span>
                    )}
                    <Badge tone="good">Choose time <ChevronRight size={10} /></Badge>
                  </span>
                }
              />
            ))}
          </div>
        )}

        {unsuitable.length > 0 && (
          <div className="flex flex-col gap-2 mt-2">
            <button
              type="button"
              onClick={() => setShowUnsuitable(v => !v)}
              className="self-start text-3xs font-mono uppercase tracking-widest text-white/40 hover:text-white"
            >
              {showUnsuitable ? 'Hide' : 'Show'} {unsuitable.length} aircraft that cannot take it
            </button>
            {showUnsuitable && unsuitable.map(({ plane, check }) => (
              <div key={plane.registration} className="opacity-70 flex flex-col gap-1">
                <PlaneRow plane={plane} routes={routes} verdict={<Badge tone="warn">Not possible</Badge>} />
                <div className="ml-3 pl-3 border-l border-white/10">
                  <CheckDetails check={{ ...check, notes: [] }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
