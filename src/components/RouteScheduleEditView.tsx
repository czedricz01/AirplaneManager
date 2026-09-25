import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Clock, 
  Calendar, 
  ChevronRight, 
  ChevronLeft, 
  Plus, 
  Minus, 
  Check, 
  Info,
  Save,
  Trash2,
  AlertCircle,
  ArrowLeftRight
} from 'lucide-react';
import { Airport } from '../data/airports';
import {
  BOARDING_MIN,
  DAY_MIN,
  WEEK_MIN,
  blockMinutes,
  checkOverlap,
  findCommonRunStart,
  findDayRunStart,
  getTurnoverMinutes,
  getUsedWeeklySlots,
  maxFlightStarts,
  minuteToTripStart,
  occupiedIntervals,
  tripInterval,
  tripStartMinute
} from '../lib/scheduleUtils';
import { getFlightDurationMinutes } from '../lib/financeUtils';
import { formatWeekMinute, openShiftWindows, shiftTrips, timetablePeriod } from '../lib/aircraftAssignment';
import type { OwnedAircraft } from './MyFleetView';
import { SimulatedRoute, AirportInfrastructure } from '../App';

export type ScheduledTrip = { 
  id: string;
  groupId?: string;
  isGroupLead?: boolean;
  flightNumOut: string;
  flightNumIn: string;
  dayId: number;
  startHour: number;
  startMin: number;
  durMin: number;
  turnoverMin: number;
  isOneWay?: boolean;
};

interface RouteScheduleEditViewProps {
  route: SimulatedRoute;
  aircraft: OwnedAircraft;
  allAirports: Airport[];
  allRoutes: SimulatedRoute[];
  /** For the slot count: slots are rented per aircraft class. */
  fleet: OwnedAircraft[];
  airportManagement: Record<string, AirportInfrastructure>;
  airlineCode: string;
  /**
   * The route is moving to `aircraft` from this registration (the route
   * page's "Change"). The editor then offers the aircraft's free time slots
   * and saves only a timetable that fits.
   */
  reassignFrom?: string;
  onSave: (updatedRoute: SimulatedRoute) => void;
  onClose: () => void;
}

const referenceTrip = <T extends { isGroupLead?: boolean }>(trips: T[]): T | undefined =>
  trips.find(s => s.isGroupLead) || trips[0];

const RouteScheduleEditView: React.FC<RouteScheduleEditViewProps> = ({
  route,
  aircraft,
  allAirports,
  allRoutes,
  fleet,
  airportManagement,
  airlineCode,
  reassignFrom,
  onSave,
  onClose
}) => {
  const isReassign = !!reassignFrom;
  const airportsMap = React.useMemo(() => {
    const m = new Map<string, Airport>();
    allAirports.forEach(a => m.set(a.id, a));
    return m;
  }, [allAirports]);

  const selectedOrigin = airportsMap.get(route.origin);
  const selectedDest = airportsMap.get(route.destination);
  
  // Schedule state
  const [schedule, setSchedule] = useState<ScheduledTrip[]>(() => {
    return (route.schedule || []).map(s => ({
      ...s,
      startHour: Number(s.startHour) || 0,
      startMin: Number(s.startMin) || 0,
      dayId: Number(s.dayId) || 1,
      durMin: Number(s.durMin) || 0,
      turnoverMin: Number(s.turnoverMin) || 0
    }));
  });
  // The clock follows this trip; the shift below moves every trip by the same
  // amount. It must be the same trip the clock starts from, or opening the
  // editor would already shift the timetable.
  const [flightHour, setFlightHour] = useState<number>(() => {
    const val = Number(referenceTrip(route.schedule || [])?.startHour ?? 12);
    return isNaN(val) ? 12 : val;
  });
  const [flightMinute, setFlightMinute] = useState<number>(() => {
    const val = Number(referenceTrip(route.schedule || [])?.startMin ?? 0);
    return isNaN(val) ? 0 : val;
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [validationMsg, setValidationMsg] = useState<string | null>(null);

  // `startHour/startMin` is the start of the block, as everywhere else: the
  // clock shows it directly and takeoff is BOARDING_MIN later. This editor
  // used to read it as the takeoff time, so it drew every flight half an hour
  // earlier than the planner, the route details and the live map.
  const blockStartMin = Number(flightHour) * 60 + Number(flightMinute);
  const displayH = Math.floor(blockStartMin / 60) % 24;
  const displayM = blockStartMin % 60;
  const takeoffMin = (blockStartMin + BOARDING_MIN) % DAY_MIN;
  const fmtClock = (m: number) => `${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`;

  const updateFromDisplay = (newH: number, newM: number) => {
    const h = Number(newH);
    const m = Number(newM);
    if (isNaN(h) || isNaN(m)) return;
    setFlightHour(h);
    setFlightMinute(m);
  };

  // The other routes this aircraft flies; they cannot move from here.
  const occupied = useMemo(
    () => occupiedIntervals(allRoutes, aircraft.registration, route.id),
    [allRoutes, aircraft.registration, route.id]
  );
  const conflictsWithOtherRoutes = (trips: ScheduledTrip[]) =>
    trips.some(trip => {
      const own = tripInterval(trip);
      return occupied.some(occ => checkOverlap(own.start, own.end, occ.start, occ.end));
    });

  // Where the whole timetable could move to on this aircraft. Only offered
  // when the route is changing aircraft: there the player has to find a gap
  // in someone else's week.
  const freeWindows = useMemo(
    () => (isReassign && schedule.length > 0 ? openShiftWindows(schedule, occupied) : []),
    [isReassign, schedule, occupied]
  );
  const hasConflict = useMemo(() => conflictsWithOtherRoutes(schedule), [schedule, occupied]);
  const leadStart = schedule.length > 0 ? tripStartMinute(referenceTrip(schedule)!) : 0;
  const moveBy = (delta: number) => {
    const next = shiftTrips(schedule, delta);
    if (conflictsWithOtherRoutes(next)) return;
    setSchedule(next);
    const lead = referenceTrip(next);
    if (lead) {
      setFlightHour(lead.startHour);
      setFlightMinute(lead.startMin);
    }
    setValidationMsg(null);
  };
  // A timetable that repeats every day is offered one day's slots, so the
  // weekday would only confuse.
  const isDaily = useMemo(() => timetablePeriod(schedule) === DAY_MIN, [schedule]);
  const windowLabel = (delta: number) => {
    const text = formatWeekMinute(leadStart + delta);
    return isDaily ? text.slice(4) : text;
  };

  // Shift schedule when flightHour/Minute changes
  useEffect(() => {
    if (schedule.length === 0) return;
    const firstLead = referenceTrip(schedule)!;
    const deltaMin = (flightHour * 60 + flightMinute) - (firstLead.startHour * 60 + firstLead.startMin);
    if (deltaMin === 0) return;

    const nextSchedule = schedule.map(trip => {
      const newTotalWeekMin = (tripStartMinute(trip) + deltaMin + WEEK_MIN) % WEEK_MIN;
      return {
        ...trip,
        dayId: Math.floor(newTotalWeekMin / DAY_MIN) + 1,
        startHour: Math.floor((newTotalWeekMin % DAY_MIN) / 60),
        startMin: (newTotalWeekMin % DAY_MIN) % 60,
      };
    });

    if (!conflictsWithOtherRoutes(nextSchedule)) {
      setSchedule(nextSchedule);
      setValidationMsg(null);
    } else {
      setValidationMsg("Cannot shift schedule: overlapping with existing flights.");
    }
  }, [flightHour, flightMinute]);

  const daysOfWeek = [
    { id: 1, label: 'MON' },
    { id: 2, label: 'TUE' },
    { id: 3, label: 'WED' },
    { id: 4, label: 'THU' },
    { id: 5, label: 'FRI' },
    { id: 6, label: 'SAT' },
    { id: 7, label: 'SUN' },
  ];

  // ---- Adding flights: "Multiple Ops" and "Max Flights" as in the route planner ----

  // New trips copy the route's own leg time, turnaround and one-way flag, so
  // they block the aircraft exactly as long as the trips already there. A
  // route moving aircraft arrives here already re-timed for the new one.
  const tripTemplate = useMemo(() => {
    const first = (route.schedule || [])[0];
    return {
      durMin: Number(first?.durMin) || getFlightDurationMinutes(selectedOrigin, selectedDest, aircraft) || Number(route.durMin) || 0,
      turnoverMin: Number(first?.turnoverMin) || getTurnoverMinutes(aircraft.class),
      isOneWay: !!first?.isOneWay
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const cycleMin = blockMinutes(tripTemplate);

  // Round trips that fit into one day back to back (the planner's limit).
  const maxMultipleOps = cycleMin >= DAY_MIN / 2 ? 1 : Math.max(1, Math.floor(DAY_MIN / cycleMin));
  const [multipleOps, setMultipleOps] = useState<number>(() => {
    const perDay = new Map<number, number>();
    for (const t of route.schedule || []) perDay.set(Number(t.dayId), (perDay.get(Number(t.dayId)) || 0) + 1);
    return Math.max(1, ...Array.from(perDay.values()));
  });
  const ops = Math.min(multipleOps, maxMultipleOps);
  const [maximizeFlights, setMaximizeFlights] = useState(false);

  // Flight numbers continue the route's own: the n-th trip of a day flies
  // base + 2n out and base + 2n + 1 back, as the planner numbers them.
  const [baseOut, baseIn] = useMemo(() => {
    const lead = referenceTrip(route.schedule || []);
    const out = parseInt(String(lead?.flightNumOut ?? ''), 10);
    const inn = parseInt(String(lead?.flightNumIn ?? ''), 10);
    const o = Number.isFinite(out) ? out : 1000;
    return [o, Number.isFinite(inn) ? inn : o + 1];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Weekly slots this route may use at each end, for the aircraft's class.
  const fleetByRegistration = useMemo(() => new Map(fleet.map(a => [a.registration, a])), [fleet]);
  const slotKey = String(aircraft.class || '').toLowerCase() as 'regional' | 'narrowbody' | 'widebody';
  const slotInfo = [route.origin, route.destination].map(id => ({
    id,
    used: getUsedWeeklySlots(allRoutes, fleetByRegistration, id, aircraft.class, route.id),
    cap: airportManagement[id]?.slots?.[slotKey] || 0
  }));
  const slotRoom = Math.max(0, Math.min(...slotInfo.map(a => a.cap - a.used)));

  const makeTrip = (weekMin: number, op: number, groupId: string, isGroupLead: boolean): ScheduledTrip => ({
    id: Math.random().toString(),
    groupId,
    isGroupLead,
    flightNumOut: (baseOut + op * 2).toString(),
    flightNumIn: (baseIn + op * 2).toString(),
    ...minuteToTripStart(weekMin),
    durMin: tripTemplate.durMin,
    turnoverMin: tripTemplate.turnoverMin,
    ...(tripTemplate.isOneWay ? { isOneWay: true } : {})
  });
  // `count` round trips back to back from `start`, as one group.
  const makeRun = (start: number, count: number) => {
    const groupId = Math.random().toString();
    return Array.from({ length: count }, (_, op) => makeTrip(start + op * cycleMin, op, groupId, op === 0));
  };

  // Sets the timetable and keeps the clock on its reference trip, so the next
  // clock change moves the timetable from where it now is.
  const applySchedule = (next: ScheduledTrip[]) => {
    setSchedule(next);
    const lead = referenceTrip(next);
    if (lead) {
      setFlightHour(lead.startHour);
      setFlightMinute(lead.startMin);
    }
  };

  // The trips a click removes: a trip's whole run when it belongs to one
  // day's Multiple Ops run (it may spill past midnight), otherwise the trip.
  // Max Flights trips share one group across the week and go one by one.
  const runOf = (trip: ScheduledTrip, trips: ScheduledTrip[]) => {
    if (!trip.groupId || trip.groupId === 'maximized') return [trip];
    const group = trips.filter(t => t.groupId === trip.groupId);
    const lead = referenceTrip(group)!;
    const leadStart = tripStartMinute(lead);
    const isDayRun = group.every(t => (tripStartMinute(t) - leadStart + WEEK_MIN) % WEEK_MIN < DAY_MIN);
    return isDayRun ? group : [trip];
  };
  const removeTrips = (toRemove: ScheduledTrip[]) => {
    const ids = new Set(toRemove.map(t => t.id));
    applySchedule(schedule.filter(t => !ids.has(t.id)));
    setValidationMsg(null);
  };

  // Day buttons: a day with flights loses them (with the rest of their runs),
  // an empty day gets `ops` round trips at the clock time, or the next free
  // time that day.
  const handleToggleDay = (dayId: number) => {
    const onDay = schedule.filter(s => Number(s.dayId) === dayId);

    if (onDay.length > 0) {
      const removed = onDay.flatMap(t => {
        const run = runOf(t, schedule);
        const lead = referenceTrip(run)!;
        return Number(lead.dayId) === dayId ? run : [t];
      });
      removeTrips(removed);
      return;
    }

    const label = daysOfWeek[dayId - 1].label;
    if (schedule.length + ops > slotRoom) {
      setValidationMsg(`Not enough ${aircraft.class} slots for ${ops} more flight${ops > 1 ? 's' : ''} (${slotRoom - schedule.length} left).`);
      return;
    }
    const busy = [...occupied, ...schedule.map(tripInterval)];
    const start = findDayRunStart(dayId, ops, cycleMin, busy, blockStartMin);
    if (start === null) {
      setValidationMsg(`No free time on ${label} for ${ops} flight${ops > 1 ? 's' : ''}.`);
      return;
    }
    applySchedule([...schedule, ...makeRun(start, ops)]);
    setValidationMsg(null);
  };

  // "Apply to all days": every day gets `ops` round trips, at one common time
  // when there is one, otherwise each day at its next free time.
  const handleApplyAllDays = () => {
    const days = daysOfWeek.map(d => d.id);
    const common = findCommonRunStart(days, ops, cycleMin, occupied, blockStartMin);
    let room = slotRoom;
    const next: ScheduledTrip[] = [];
    for (const d of days) {
      if (room < ops) break;
      const start = common !== null
        ? (d - 1) * DAY_MIN + common
        : findDayRunStart(d, ops, cycleMin, [...occupied, ...next.map(tripInterval)], blockStartMin);
      if (start === null) continue;
      next.push(...makeRun(start, ops));
      room -= ops;
    }
    if (next.length === 0) {
      setValidationMsg(room < ops ? `Not enough ${aircraft.class} slots for ${ops} flight${ops > 1 ? 's' : ''} a day.` : 'No valid slots or days available.');
      return;
    }
    applySchedule(next);
    setValidationMsg(next.length < days.length * ops ? `Only ${next.length / ops} of 7 days fit.` : null);
  };

  // "Max Flights": as many round trips as the aircraft's week and the slots allow.
  const handleApplyMaxFlights = () => {
    const starts = maxFlightStarts(occupied, cycleMin, slotRoom, blockStartMin);
    if (starts.length === 0) {
      setValidationMsg(slotRoom <= 0 ? `No free ${aircraft.class} slots.` : 'No free time on this aircraft.');
      return;
    }
    // One flight number per time of day, in the order the times come up.
    const numberByTime = new Map<number, number>();
    const next = starts.map((m, i) => {
      const timeOfDay = m % DAY_MIN;
      if (!numberByTime.has(timeOfDay)) numberByTime.set(timeOfDay, numberByTime.size);
      return makeTrip(m, numberByTime.get(timeOfDay)!, 'maximized', i === 0);
    });
    applySchedule(next);
    setValidationMsg(null);
  };

  const allBlocks = useMemo(() => {
    const blocks: any[] = [];
    
    // Busy blocks from other routes
    const otherRoutes = allRoutes.filter(r => r.aircraft === aircraft.registration && r.id !== route.id);
    otherRoutes.forEach(r => {
      const originName = r.origin || '???';
      const destName = r.destination || '???';
      r.schedule?.forEach(s => {
        let remaining = blockMinutes(s);
        let currentWeekMin = tripStartMinute(s) % WEEK_MIN;
        let isFirst = true;
        
        while (remaining > 0) {
          const currentDayId = Math.floor(currentWeekMin / 1440) + 1;
          const currentStartInDay = currentWeekMin % 1440;
          const mLeftInDay = 1440 - currentStartInDay;
          const chunkLen = Math.min(remaining, mLeftInDay);
          
          blocks.push({
            id: `busy-${r.id}-${s.id}-${currentWeekMin}`,
            dayId: currentDayId,
            top: (currentStartInDay / 1440) * 720,
            height: (chunkLen / 1440) * 720,
            s,
            orig: originName,
            dest: destName,
            isBusy: true,
            isFirst,
            isLast: remaining <= mLeftInDay
          });
          
          remaining -= chunkLen;
          currentWeekMin = (currentWeekMin + chunkLen) % 10080;
          isFirst = false;
        }
      });
    });

    // Current schedule blocks
    schedule.forEach(s => {
      // One-way legs block less time; this used to draw every leg as a round trip.
      let remaining = blockMinutes(s);
      let currentWeekMin = tripStartMinute(s) % WEEK_MIN;
      let isFirst = true;

      while (remaining > 0) {
        const currentDayId = Math.floor(currentWeekMin / 1440) + 1;
        const currentStartInDay = currentWeekMin % 1440;
        const mLeftInDay = 1440 - currentStartInDay;
        const chunkLen = Math.min(remaining, mLeftInDay);
        
        blocks.push({
          id: `edit-${s.id}-${currentWeekMin}`,
          dayId: currentDayId,
          top: (currentStartInDay / 1440) * 720,
          height: (chunkLen / 1440) * 720,
          s,
          orig: selectedOrigin?.id || '???',
          dest: selectedDest?.id || '???',
          isBusy: false,
          isFirst,
          isLast: remaining <= mLeftInDay
        });
        
        remaining -= chunkLen;
        currentWeekMin = (currentWeekMin + chunkLen) % 10080;
        isFirst = false;
      }
    });

    return blocks;
  }, [schedule, allRoutes, aircraft, selectedOrigin, selectedDest]);

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    if (isSaving) return;
    setIsSaving(true);

    const updatedRoute = {
      ...route,
      // Passenger figures are left to the engine (App recomputes them). This
      // used to store full capacity, so the route showed a 100% load factor
      // until the month closed.
      weeklyFlights: schedule.length,
      schedule: schedule
    };
    onSave(updatedRoute);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setIsSaving(false);
      onClose();
    }, 1500);
  };

  const handleDragStart = (e: React.MouseEvent, dragTrip: ScheduledTrip) => {
    e.preventDefault();
    const startY = e.clientY;
    
    // Shift all trips in the current schedule proportionally
    const initialPositions = schedule.map(s => ({
      id: s.id,
      startWeekMin: tripStartMinute(s)
    }));

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const deltaMin = Math.round(deltaY / 10) * 5;
      if (deltaMin === 0) return;
      
      const nextSchedule = schedule.map(trip => {
        const initial = initialPositions.find(p => p.id === trip.id);
        if (initial) {
          const newTotalWeekMin = (initial.startWeekMin + deltaMin + 10080) % 10080;
          return {
            ...trip,
            dayId: Math.floor(newTotalWeekMin / 1440) + 1,
            startHour: Math.floor((newTotalWeekMin % 1440) / 60),
            startMin: (newTotalWeekMin % 1440) % 60,
          };
        }
        return trip;
      });

      if (!conflictsWithOtherRoutes(nextSchedule)) {
        setSchedule(nextSchedule);

        // Update the reference flight control time based on the lead trip's movement
        const lead = referenceTrip(nextSchedule);
        if (lead) {
          setFlightHour(lead.startHour);
          setFlightMinute(lead.startMin);
        }
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="absolute inset-0 z-[100] bg-aero-black font-sans flex flex-col overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      
      {/* Header */}
      <div className="relative z-10 px-4 py-3 border-b border-white/10 flex justify-between items-center bg-black/40 backdrop-blur-md">
        <div className="flex flex-col">
          <h2 className="text-3xl font-black uppercase tracking-widest text-aero-yellow italic">{isReassign ? 'Choose Time Slot' : 'Edit Timetable'}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-bold text-white/50 uppercase tracking-widest">{selectedOrigin?.id}</span>
            <span className="text-aero-yellow/50">→</span>
            <span className="text-xs font-bold text-white/50 uppercase tracking-widest">{selectedDest?.id}</span>
            <span className="mx-2 text-white/20">|</span>
            {isReassign ? (
              <span className="text-xs font-bold text-white/50 uppercase tracking-widest flex items-center gap-1.5">
                {reassignFrom} <ArrowLeftRight size={12} className="text-aero-yellow/60" /> <span className="text-aero-yellow">{aircraft.registration}</span>
              </span>
            ) : (
              <span className="text-xs font-bold text-white/50 uppercase tracking-widest">{aircraft.registration}</span>
            )}
          </div>
        </div>
        <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-white">
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Left Control Panel */}
        <div className="w-80 border-r border-white/10 bg-black/60 p-4 flex flex-col gap-3 overflow-y-auto custom-scrollbar uppercase">
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black tracking-widest text-white/40">Timetable Management</span>
            </div>

            {/* Slots this route may use, as in the planner */}
            <div className="bg-white/5 border border-white/10 p-3 space-y-1 rounded-sm border-t-2 border-t-aero-yellow">
              <div className="text-3xs font-black tracking-widest text-aero-yellow flex justify-between">
                <span>Required Slots</span>
                <span>({aircraft.class})</span>
              </div>
              {slotInfo.map(a => (
                <div key={a.id} className="flex justify-between font-mono text-2xs text-white/70">
                  <span>{a.id}</span>
                  <span className={a.used + schedule.length > a.cap ? 'text-aero-warn' : 'text-aero-yellow font-bold'}>
                    {a.used + schedule.length} / {a.cap}
                  </span>
                </div>
              ))}
            </div>

            {/* Multiple Ops / Max Flights, as in the planner's timetable step */}
            <div className="flex items-center justify-between gap-2 bg-black/40 border border-white/10 p-2">
              <div className={`flex items-center gap-2 transition-opacity ${maximizeFlights ? 'opacity-30 pointer-events-none' : ''}`}>
                <label className="text-3xs font-black tracking-widest text-white/50 whitespace-nowrap" title="Round trips flown back to back on each day you add">Multiple Ops</label>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setMultipleOps(Math.max(1, ops - 1))}
                    disabled={ops <= 1}
                    className="w-5 h-5 flex items-center justify-center bg-white/5 border border-white/10 text-white hover:border-aero-yellow disabled:opacity-20"
                  >
                    <Minus className="w-2 h-2" />
                  </button>
                  <div className="w-6 h-5 flex items-center justify-center bg-black border border-white/20 font-mono text-2xs text-aero-yellow font-bold">{ops}</div>
                  <button
                    onClick={() => setMultipleOps(Math.min(maxMultipleOps, ops + 1))}
                    disabled={ops >= maxMultipleOps}
                    className="w-5 h-5 flex items-center justify-center bg-white/5 border border-white/10 text-white hover:border-aero-yellow disabled:opacity-20"
                  >
                    <Plus className="w-2 h-2" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => setMaximizeFlights(!maximizeFlights)} title="Fill the aircraft's free week with as many round trips as the slots allow">
                <span className="text-3xs font-black tracking-widest text-white/50 hover:text-white transition-colors whitespace-nowrap">Max Flights</span>
                <div className={`w-4 h-4 border flex items-center justify-center transition-all ${maximizeFlights ? 'bg-aero-yellow border-aero-yellow text-black' : 'border-white/20'}`}>
                  {maximizeFlights && <Check className="w-2 h-2" />}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={maximizeFlights ? handleApplyMaxFlights : handleApplyAllDays}
                className="w-full h-10 text-2xs font-bold border border-aero-yellow bg-aero-yellow text-black hover:bg-aero-yellow/80 transition-all rounded-sm flex items-center justify-center gap-2 uppercase tracking-widest"
                title={maximizeFlights ? 'Replace the timetable with the most flights that fit' : `Replace the timetable with ${ops} flight${ops > 1 ? 's' : ''} on every day`}
              >
                <Calendar size={14} /> {maximizeFlights ? 'Apply Max Flights' : 'Apply to All Days'}
              </button>
              {schedule.length > 0 && (
                <button 
                  onClick={() => { setSchedule([]); setValidationMsg(null); }}
                  className="w-full h-10 text-2xs font-bold border border-white/20 text-aero-yellow/60 bg-aero-panel hover:bg-aero-carbon hover:text-white transition-all rounded-sm flex items-center justify-center gap-2 uppercase tracking-widest"
                >
                  <Trash2 size={14} /> Clear All Flights
                </button>
              )}
              
              <div className="p-3 bg-white/5 border border-white/10 rounded-sm">
                <p className="text-3xs text-white/30 leading-relaxed uppercase tracking-widest text-center">
                  Click a day to add {ops} flight{ops > 1 ? 's' : ''} at the starting time (or the next free time), or to remove its flights. Drag flights in the timetable to shift the schedule.
                </p>
              </div>
            </div>

            <div className={`grid grid-cols-4 gap-2 transition-opacity ${maximizeFlights ? 'opacity-30 pointer-events-none' : ''}`}>
                {daysOfWeek.map(day => {
                  const count = schedule.filter(s => Number(s.dayId) === day.id).length;
                  const isSelected = count > 0;
                  return (
                    <button
                      key={day.id}
                      disabled={maximizeFlights}
                      onClick={() => handleToggleDay(day.id)}
                      title={isSelected ? `Remove the ${day.label} flights` : `Add ${ops} flight${ops > 1 ? 's' : ''} on ${day.label}`}
                      className={`h-12 flex flex-col items-center justify-center border font-black transition-all rounded-sm gap-0.5 ${isSelected ? 'bg-aero-yellow text-black border-aero-yellow shadow-2xl hover:bg-aero-yellow/80' : 'bg-black/40 text-white/30 border-white/10 hover:border-white/40 hover:text-white'}`}
                    >
                      <span className="text-2xs leading-none">{day.label}</span>
                      <span className={`text-4xs font-mono leading-none ${isSelected ? 'text-black/60' : 'text-white/20'}`}>{isSelected ? `${count}x` : '+'}</span>
                    </button>
                  )
                })}
             </div>
          </div>

          <div className="h-px bg-white/10"></div>

          <div className="transition-opacity">
            <div className="flex justify-between items-end mb-3">
              <label className="block text-2xs uppercase tracking-widest text-white/40 font-black">Starting Time</label>
              <div className="text-3xs font-mono text-aero-yellow bg-aero-yellow/10 px-2 py-0.5 border border-aero-yellow/20 uppercase">
                Takeoff: {fmtClock(takeoffMin)}
              </div>
            </div>
            <div className="flex items-center justify-center gap-4 bg-black/80 border border-white/5 p-4 font-mono rounded-sm shadow-inner relative overflow-hidden group">
               <div className="absolute inset-0 bg-aero-yellow/[0.02] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
               <div className="flex flex-col items-center">
                 <button onClick={() => updateFromDisplay((displayH + 1) % 24, displayM)} className="p-2 text-white/20 hover:text-aero-yellow hover:scale-125 transition-all"><ChevronLeft className="rotate-90" /></button>
                 <div className="text-5xl font-black text-white tracking-widest">{displayH.toString().padStart(2, '0')}</div>
                 <button onClick={() => updateFromDisplay((displayH + 23) % 24, displayM)} className="p-2 text-white/20 hover:text-aero-yellow hover:scale-125 transition-all"><ChevronLeft className="rotate-270" /></button>
               </div>
               <div className="text-4xl text-white/10 font-thin mb-2 shrink-0">:</div>
               <div className="flex flex-col items-center">
                 <button onClick={() => updateFromDisplay(displayH, (displayM + 5) % 60)} className="p-2 text-white/20 hover:text-aero-yellow hover:scale-125 transition-all"><ChevronLeft className="rotate-90" /></button>
                 <div className="text-5xl font-black text-white tracking-widest">{displayM.toString().padStart(2, '0')}</div>
                 <button onClick={() => updateFromDisplay(displayH, (displayM + 55) % 60)} className="p-2 text-white/20 hover:text-aero-yellow hover:scale-125 transition-all"><ChevronLeft className="rotate-270" /></button>
               </div>
            </div>
            <div className="mt-2 text-3xs text-center text-white/20 uppercase tracking-[0.2em] font-bold">Block start (boarding) · takeoff {BOARDING_MIN} min later</div>
          </div>

          {isReassign && (
            <div className="flex flex-col gap-2">
              <label className="block text-2xs uppercase tracking-widest text-white/40 font-black">Free Time Slots on {aircraft.registration}</label>
              <p className="text-3xs text-white/30 leading-relaxed normal-case">
                Block start of the first flight. Pick a slot, then fine-tune with the clock or by dragging. Grey blocks are flights {aircraft.registration} already flies.
              </p>
              {freeWindows.length === 0 ? (
                <div className="text-2xs text-aero-warn font-bold">No free slot for all flights. Remove days to make room.</div>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                  {freeWindows.map(w => {
                    const isCurrent = w.from <= 0 && 0 <= w.to;
                    return (
                      <button
                        key={w.from}
                        onClick={() => { if (!isCurrent) moveBy(w.from); }}
                        className={`px-2 py-1 text-3xs font-mono font-bold border rounded-sm transition-colors ${
                          isCurrent ? 'bg-aero-yellow text-black border-aero-yellow' : 'bg-black/40 text-white/70 border-white/15 hover:border-aero-yellow hover:text-aero-yellow'
                        }`}
                        title={isCurrent ? 'The timetable is in this slot' : 'Move the timetable to the start of this slot'}
                      >
                        {w.from === w.to ? windowLabel(w.from) : `${windowLabel(w.from)} - ${windowLabel(w.to)}`}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {validationMsg && (
            <div className="bg-aero-panel border border-white/20 p-3 flex gap-2 items-start">
               <AlertCircle size={14} className="text-aero-warn shrink-0 mt-0.5" />
               <span className="text-2xs text-aero-warn font-bold leading-tight">{validationMsg}</span>
            </div>
          )}

          <div className="mt-auto space-y-3">
             <div className="bg-aero-yellow/10 border border-aero-yellow/20 p-4 rounded-sm">
                <div className="flex justify-between items-center mb-1">
                   <span className="text-3xs uppercase font-black text-white/40">Total Flights</span>
                   <span className="text-xl font-black text-aero-yellow italic">{schedule.length}</span>
                </div>
                <div className="flex justify-between items-center">
                   <span className="text-3xs uppercase font-black text-white/40">Daily Average</span>
                   <span className="text-sm font-bold text-white">{(schedule.length / 7).toFixed(1)}</span>
                </div>
             </div>

             {isReassign && hasConflict && (
               <div className="text-2xs text-aero-warn font-bold normal-case">
                 The timetable overlaps flights {aircraft.registration} already flies. Pick a free slot.
               </div>
             )}
             <button 
                onClick={handleSave}
                disabled={schedule.length === 0 || (isReassign && hasConflict)}
                className="w-full py-4 px-6 bg-aero-yellow text-black font-black uppercase text-sm tracking-widest hover:bg-white transition-all shadow-2xl disabled:opacity-50 flex items-center justify-center gap-2 rounded-none"
             >
                {isReassign ? <><ArrowLeftRight size={18} /> Assign to {aircraft.registration}</> : <><Save size={18} /> Update Schedule</>}
             </button>
          </div>
        </div>

        {/* Timetable Grid Area */}
        <div className="flex-1 bg-black flex flex-col overflow-hidden relative">
           <div className="flex shrink-0">
              <div className="w-16 border-r border-white/10 bg-black"></div>
              {daysOfWeek.map(day => (
                <div key={day.id} className="flex-1 text-center text-2xs uppercase font-black text-white/40 py-4 bg-black border-b border-white/10">
                  {day.label}
                </div>
              ))}
           </div>

           <div className="flex-1 overflow-auto custom-scrollbar flex relative bg-black/40 pt-4">
              {/* Time Indicators */}
              <div className="w-16 shrink-0 border-r border-white/20 bg-black/90 relative z-20">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="h-[30px] border-b border-white/5 flex items-start justify-end pr-2 relative">
                    <span className="text-3xs font-mono text-white/30 absolute top-[-6px]">{i.toString().padStart(2, '0')}:00</span>
                  </div>
                ))}
              </div>

              {/* Grid content */}
              <div className="flex-1 flex min-w-[700px]">
                 {daysOfWeek.map(day => (
                   <div key={day.id} className="flex-1 border-r border-white/5 relative">
                      <div className="relative h-[720px]">
                         {allBlocks.filter(b => b.dayId === day.id).map(b => (
                           <div 
                              key={b.id} 
                              onMouseDown={(e) => {
                                 if (!b.isBusy) {
                                     handleDragStart(e, b.s);
                                 }
                              }}
                              onClick={(e) => {
                                 if (!b.isBusy && e.ctrlKey) removeTrips(runOf(b.s, schedule));
                              }}
                              title={b.isBusy ? 'Busy - Cannot edit' : 'Drag to adjust time. Ctrl+Click to delete.'}
                              className={`absolute left-0.5 right-0.5 p-1 px-1.5 text-2xs font-mono shadow-xl transition-all ${
                                b.isBusy 
                                  ? 'bg-white/10 border-l-2 border-white/20 italic opacity-40 cursor-not-allowed' 
                                  : 'bg-aero-yellow/20 border-l-2 border-aero-yellow text-aero-yellow cursor-ns-resize hover:bg-aero-yellow/40 hover:border-white group select-none'
                              }`}
                              style={{ top: b.top, height: b.height, zIndex: b.isBusy ? 5 : 10 }}
                           >
                              <div className="flex flex-col h-full overflow-hidden relative">
                                {b.isFirst && <div className="text-3xs opacity-70 mb-0.5">{b.orig} → {b.dest}</div>}
                                <div className="font-bold truncate group-hover:text-white transition-colors">{aircraft.registration}</div>
                                {!b.isBusy && b.isFirst && <div className="text-3xs text-white/40 mt-1 uppercase font-bold tracking-tighter">Adjust Time</div>}
                                {b.isLast && <div className="mt-auto text-3xs text-right opacity-50 font-bold">End</div>}
                              </div>
                           </div>
                         ))}
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>

      {/* Success Animation Overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4"
          >
             <motion.div 
                initial={{ scale: 0.8, rotateX: 45 }}
                animate={{ scale: 1, rotateX: 0 }}
                className="bg-aero-yellow text-black p-12 rounded-sm shadow-2xl flex flex-col items-center gap-3 text-center border-t-8 border-white"
             >
                <div className="w-24 h-24 bg-black rounded-full flex items-center justify-center shadow-inner">
                   <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring' }}>
                      <Check size={64} className="text-aero-yellow" strokeWidth={4} />
                   </motion.div>
                </div>
                <div>
                   <h3 className="text-4xl font-black uppercase italic tracking-tighter">{isReassign ? 'Aircraft Changed' : 'Schedule Updated'}</h3>
                   <div className="h-1 w-12 bg-black mx-auto my-3"></div>
                   <p className="text-xs uppercase tracking-[0.3em] font-bold opacity-80">Synchronizing fleet data...</p>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RouteScheduleEditView;
