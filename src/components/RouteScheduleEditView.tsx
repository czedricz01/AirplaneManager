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
  occupiedIntervals,
  tripInterval,
  tripStartMinute
} from '../lib/scheduleUtils';
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

  // Handle trip deletion
  const handleToggleDay = (dayId: number) => {
    // Trips whose block starts on this day.
    const existingGroups = schedule.filter(s => s.dayId === dayId);

    if (existingGroups.length > 0) {
      // Toggle OFF: Remove these trips
      const idsToRemove = new Set(existingGroups.map(g => g.id));
      const groupIdsToRemove = new Set(existingGroups.filter(g => g.groupId).map(g => g.groupId));
      
      setSchedule(schedule.filter(s => !idsToRemove.has(s.id) && (!s.groupId || !groupIdsToRemove.has(s.groupId))));
      setValidationMsg(null);
    } 
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

            <div className="flex flex-col gap-2">
              {schedule.length > 0 && (
                <button 
                  onClick={() => setSchedule([])}
                  className="w-full h-10 text-2xs font-bold border border-white/20 text-aero-yellow/60 bg-aero-panel hover:bg-aero-carbon hover:text-white transition-all rounded-sm flex items-center justify-center gap-2 uppercase tracking-widest"
                >
                  <Trash2 size={14} /> Clear All Flights
                </button>
              )}
              
              <div className="p-4 bg-white/5 border border-white/10 rounded-sm">
                <p className="text-3xs text-white/30 leading-relaxed uppercase tracking-widest text-center">
                  Select day buttons below to remove specific flights, or drag flights in the timetable to shift the schedule.
                </p>
              </div>
            </div>

            <div className={`grid grid-cols-4 gap-2 transition-opacity`}>
                {daysOfWeek.map(day => {
                  const isSelected = schedule.some(s => Number(s.dayId) === day.id);
                  return (
                    <button
                      key={day.id}
                      disabled={!isSelected}
                      onClick={() => handleToggleDay(day.id)}
                      className={`h-12 flex flex-col items-center justify-center border font-black transition-all rounded-sm gap-0.5 ${isSelected ? 'bg-aero-yellow text-black border-aero-yellow shadow-2xl' : 'bg-black/20 text-white/10 border-white/5 opacity-50 cursor-not-allowed'}`}
                    >
                      <span className="text-2xs leading-none">{day.label}</span>
                      <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-black/40' : 'bg-white/5'}`}></div>
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
                                 if (!b.isBusy && e.ctrlKey) {
                                     if (b.s.groupId) {
                                         setSchedule(schedule.filter(s => s.groupId !== b.s.groupId));
                                     } else {
                                         setSchedule(schedule.filter(s => s.id !== b.s.id));
                                     }
                                 }
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
