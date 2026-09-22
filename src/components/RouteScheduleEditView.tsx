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
  AlertCircle
} from 'lucide-react';
import { Airport } from '../data/airports';
import { getFlightDurationMinutes } from '../lib/financeUtils';
import { Aircraft } from '../data/aircraft';
import { OwnedAircraft } from './MyFleetView';
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
  onSave: (updatedRoute: SimulatedRoute) => void;
  onClose: () => void;
}

const RouteScheduleEditView: React.FC<RouteScheduleEditViewProps> = ({
  route,
  aircraft,
  allAirports,
  allRoutes,
  airportManagement,
  airlineCode,
  onSave,
  onClose
}) => {
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
  const [flightHour, setFlightHour] = useState<number>(() => {
    const val = Number(route.schedule && route.schedule.length > 0 ? route.schedule[0].startHour : 12);
    return isNaN(val) ? 12 : val;
  });
  const [flightMinute, setFlightMinute] = useState<number>(() => {
    const val = Number(route.schedule && route.schedule.length > 0 ? route.schedule[0].startMin : 0);
    return isNaN(val) ? 0 : val;
  });
  const [multipleOps, setMultipleOps] = useState(1);
  const [maximizeFlights, setMaximizeFlights] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [validationMsg, setValidationMsg] = useState<string | null>(null);

  const initialBaseNum = route.schedule?.[0]?.flightNumOut ? parseInt(route.schedule[0].flightNumOut) : Math.floor(1000 + Math.random() * 8000);
  const [flightNumberBase, setFlightNumberBase] = useState(isNaN(initialBaseNum) ? 1000 : initialBaseNum);

  const getTurnoverMinutes = () => 45; // Fixed for now or based on aircraft

  // Shared with the route planner, so a schedule edited here keeps the duration
  // the route was planned and priced with.
  const durMin = getFlightDurationMinutes(selectedOrigin, selectedDest, aircraft);
  const turnMin = getTurnoverMinutes();

  const displayMins = (Number(flightHour) * 60 + Number(flightMinute) - 30 + 10080) % 1440;
  const displayH = Math.floor(displayMins / 60);
  const displayM = displayMins % 60;

  const updateFromDisplay = (newH: number, newM: number) => {
    const h = Number(newH);
    const m = Number(newM);
    if (isNaN(h) || isNaN(m)) return;
    const newFlightTotal = (h * 60 + m + 30) % 1440;
    setFlightHour(Math.floor(newFlightTotal / 60));
    setFlightMinute(newFlightTotal % 60);
  };

  // Find optimal config for maximize or initial auto-fill
  const findOptimalConfig = () => {
    const totalDurRaw = (30 + durMin + turnMin + durMin + 30);
    const cycleMin = Math.ceil(totalDurRaw / 5) * 5;
    const maxWeekMins = 10080;

    const otherRoutes = allRoutes.filter(r => r.aircraft === aircraft.registration && r.id !== route.id);
    const occupied = otherRoutes.flatMap(r => r.schedule?.map(s => {
      const exCycleRaw = (s as any).isOneWay ? (30 + s.durMin + 30) : (30 + s.durMin + s.turnoverMin + s.durMin + 30);
      const exCycle = Math.ceil(exCycleRaw / 5) * 5;
      const start = ((s.dayId - 1) * 24 * 60) + (s.startHour * 60 + s.startMin);
      return { start, end: start + exCycle };
    }) || []);

    const aircraftClass = aircraft.class;
    const slotKey = aircraftClass.toLowerCase() as 'regional' | 'narrowbody' | 'widebody';
    const originInfra = airportManagement[route.origin];
    const destInfra = airportManagement[route.destination];
    const originCap = originInfra?.slots?.[slotKey] || 0;
    const destCap = destInfra?.slots?.[slotKey] || 0;
    const originUsed = getUsedWeeklySlots(route.origin, aircraftClass);
    const destUsed = getUsedWeeklySlots(route.destination, aircraftClass);
    const remainingSlots = Math.min(originCap - originUsed, destCap - destUsed);

    if (remainingSlots <= 0) return { hour: 8, minute: 0, autoSchedule: [] };

    let bestCount = -1;
    let bestStartTimes: number[] = [];

    // Search for the best start time to pack as many flights as possible
    for (let testStart = 0; testStart < 1440; testStart += 5) {
      let searchTime = testStart;
      let added = 0;
      let i = 0;
      const localOccupied = [...occupied];

      // Test all 7 days for this specific start time
      for (let dayId = 1; dayId <= 7; dayId++) {
        const candidateStart = ((dayId - 1) * 1440 + testStart) % maxWeekMins;
        const candidateEnd = candidateStart + cycleMin;
        
        let conflict = false;
        for (const occ of localOccupied) {
          if (checkOverlap(candidateStart, candidateEnd, occ.start, occ.end)) {
            conflict = true; break;
          }
        }
        
        if (!conflict && added < remainingSlots) {
          localOccupied.push({ start: candidateStart, end: candidateEnd });
          added++;
        }
      }

      if (added > bestCount) {
        bestCount = added;
        bestStartTimes = [testStart];
      } else if (added === bestCount) {
        bestStartTimes.push(testStart);
      }
    }

    const chosenPrepStart = bestStartTimes[0] !== undefined ? bestStartTimes[0] : (displayH * 60 + displayM);
    const departureTotal = (chosenPrepStart + 30 + 10080) % 10080;
    const h = Math.floor((departureTotal % 1440) / 60);
    const m = (departureTotal % 1440) % 60;
    
    const autoSchedule: ScheduledTrip[] = [];
    const groupId = Math.random().toString();
    let numOffset = 0;

    for (let dayId = 1; dayId <= 7; dayId++) {
      if (autoSchedule.length >= remainingSlots) break;
      const prepStart = (dayId - 1) * 1440 + chosenPrepStart;
      const depStart = (prepStart + 30 + 10080) % 10080;
      
      let conflict = false;
      for (const occ of occupied) {
        if (checkOverlap(prepStart, prepStart + cycleMin, occ.start, occ.end)) { conflict = true; break; }
      }
      if (conflict) continue;

        autoSchedule.push({
          id: Math.random().toString(),
          groupId,
          isGroupLead: autoSchedule.length === 0,
          flightNumOut: (flightNumberBase + (autoSchedule.length * 2)).toString(),
          flightNumIn: (flightNumberBase + (autoSchedule.length * 2) + 1).toString(),
          dayId: Math.floor((depStart % 10080) / 1440) + 1,
          startHour: Math.floor((depStart % 1440) / 60),
          startMin: (depStart % 1440) % 60,
          durMin,
          turnoverMin: turnMin
        });
    }

    return { hour: h, minute: m, autoSchedule };
  };

  // Shift schedule when flightHour/Minute changes
  useEffect(() => {
    if (schedule.length > 0 && !maximizeFlights) {
      const firstLead = schedule.find(s => s.isGroupLead);
      if (firstLead) {
        const deltaMin = (flightHour * 60 + flightMinute) - (firstLead.startHour * 60 + firstLead.startMin);
        if (deltaMin === 0) return;

        const nextSchedule = schedule.map(trip => {
          const currentTotal = (trip.dayId - 1) * 1440 + trip.startHour * 60 + trip.startMin;
          const newTotalWeekMin = (currentTotal + deltaMin + 10080) % 10080;
          return {
            ...trip,
            dayId: Math.floor(newTotalWeekMin / 1440) + 1,
            startHour: Math.floor((newTotalWeekMin % 1440) / 60),
            startMin: (newTotalWeekMin % 1440) % 60,
          };
        });

        // Simple validation for shift
        const otherRoutes = allRoutes.filter(r => r.aircraft === aircraft.registration && r.id !== route.id);
        const occupied = otherRoutes.flatMap(r => r.schedule?.map(s => {
          const c = Math.ceil(((s as any).isOneWay ? (30 + s.durMin + 30) : (30 + s.durMin + s.turnoverMin + s.durMin + 30)) / 5) * 5;
          const start = ((s.dayId - 1) * 24 * 60) + (s.startHour * 60 + s.startMin);
          return { start, end: start + c };
        }) || []);

        let conflict = false;
        for (const trip of nextSchedule) {
          const s = (trip.dayId - 1) * 1440 + trip.startHour * 60 + trip.startMin;
          const cycle = Math.ceil((30 + trip.durMin + trip.turnoverMin + trip.durMin + 30) / 5) * 5;
          const e = s + cycle;
          for (const occ of occupied) {
            if (checkOverlap(s, e, occ.start, occ.end)) { conflict = true; break; }
          }
          if (conflict) break;
        }

        if (!conflict) {
          setSchedule(nextSchedule);
          setValidationMsg(null);
        } else {
          setValidationMsg("Cannot shift schedule: overlapping with existing flights.");
        }
      }
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

  const checkOverlap = (s1: number, e1: number, s2: number, e2: number) => {
    const maxWeek = 10080;
    const normalize = (t: number) => ((t % maxWeek) + maxWeek) % maxWeek;
    
    let a1 = normalize(s1), b1 = normalize(e1);
    let a2 = normalize(s2), b2 = normalize(e2);

    const getIntervals = (s: number, e: number) => {
      if (e <= s) return [[s, maxWeek], [0, e]];
      return [[s, e]];
    };

    const i1 = getIntervals(a1, b1);
    const i2 = getIntervals(a2, b2);

    for (const [start1, end1] of i1) {
      for (const [start2, end2] of i2) {
        if (Math.max(start1, start2) < Math.min(end1, end2)) return true;
      }
    }
    return false;
  };

  const getUsedWeeklySlots = (airportId: string, aircraftClass: string) => {
    const slotKey = aircraftClass.toLowerCase() as 'regional' | 'narrowbody' | 'widebody';
    let count = 0;
    allRoutes.forEach(r => {
      // Skip current route because we are managing its schedule locally
      if (r.id === route.id) return;

      if (r.origin === airportId || r.destination === airportId) {
        // We use weeklyFlights if provided, otherwise count the schedule
        count += r.schedule?.length || r.weeklyFlights || 0;
      }
    });
    return count;
  };

  // Handle trip deletion
  const handleToggleDay = (dayId: number) => {
    // Determine which groups or trips start on this day (prep-normalized)
    const existingGroups = schedule.filter(s => {
      const depT = (s.dayId - 1) * 1440 + s.startHour * 60 + s.startMin;
      const pStart = (depT - 30 + 10080) % 10080;
      const dId = Math.floor(pStart / 1440) + 1;
      return dId === dayId;
    });

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
        const depTotal = (s.dayId - 1) * 1440 + s.startHour * 60 + s.startMin;
        const prepStartTotal = (depTotal - 30 + 10080) % 10080;
        const totalDurRaw = ((s as any).isOneWay ? (30 + s.durMin + 30) : (30 + s.durMin + s.turnoverMin + s.durMin + 30));
        const cycleMin = Math.ceil(totalDurRaw / 5) * 5;
        
        let remaining = cycleMin;
        let currentWeekMin = prepStartTotal;
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
      const depTotal = (s.dayId - 1) * 1440 + s.startHour * 60 + s.startMin;
      const prepStartTotal = (depTotal - 30 + 10080) % 10080;
      const cycleMin = Math.ceil((30 + s.durMin + s.turnoverMin + s.durMin + 30) / 5) * 5;
      
      let remaining = cycleMin;
      let currentWeekMin = prepStartTotal;
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
      weeklyFlights: schedule.length,
      paxPerWeek: schedule.length * aircraft.capacity * 2,
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
      startWeekMin: (s.dayId - 1) * 1440 + s.startHour * 60 + s.startMin
    }));

    const otherRoutes = allRoutes.filter(r => r.aircraft === aircraft.registration && r.id !== route.id);
    const occupied = otherRoutes.flatMap(r => r.schedule?.map(s => {
      const c = Math.ceil(((s as any).isOneWay ? (30 + s.durMin + 30) : (30 + s.durMin + s.turnoverMin + s.durMin + 30)) / 5) * 5;
      const start = ((s.dayId - 1) * 24 * 60) + (s.startHour * 60 + s.startMin);
      return { start, end: start + c };
    }) || []);

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

      let conflict = false;
      for (const trip of nextSchedule) {
        const tempStart = (trip.dayId - 1) * 1440 + trip.startHour * 60 + trip.startMin;
        const cycle = Math.ceil((30 + trip.durMin + trip.turnoverMin + trip.durMin + 30) / 5) * 5;
        const newEnd = tempStart + cycle;
        for (const occ of occupied) {
          if (checkOverlap(tempStart, newEnd, occ.start, occ.end)) {
            conflict = true;
            break;
          }
        }
        if (conflict) break;
      }

      if (!conflict) {
        setSchedule(nextSchedule);
        
        // Update the reference flight control time based on the lead trip's movement
        const lead = nextSchedule.find(s => s.isGroupLead);
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
          <h2 className="text-3xl font-black uppercase tracking-widest text-aero-yellow italic">Edit Timetable</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-bold text-white/50 uppercase tracking-widest">{selectedOrigin?.id}</span>
            <span className="text-aero-yellow/50">→</span>
            <span className="text-xs font-bold text-white/50 uppercase tracking-widest">{selectedDest?.id}</span>
            <span className="mx-2 text-white/20">|</span>
            <span className="text-xs font-bold text-white/50 uppercase tracking-widest">{aircraft.registration}</span>
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
                  className="w-full h-10 text-[10px] font-bold border border-white/20 text-aero-yellow/60 bg-[#111] hover:bg-[#1a1a1a] hover:text-white transition-all rounded-sm flex items-center justify-center gap-2 uppercase tracking-widest"
                >
                  <Trash2 size={14} /> Clear All Flights
                </button>
              )}
              
              <div className="p-4 bg-white/5 border border-white/10 rounded-sm">
                <p className="text-[9px] text-white/30 leading-relaxed uppercase tracking-widest text-center">
                  Select day buttons below to remove specific flights, or drag flights in the timetable to shift the schedule.
                </p>
              </div>
            </div>

            <div className={`grid grid-cols-4 gap-2 transition-opacity`}>
                {daysOfWeek.map(day => {
                  const isSelected = schedule.some(s => {
                    const depTotal = (Number(s.dayId) - 1) * 1440 + Number(s.startHour) * 60 + Number(s.startMin);
                    const prepStartTotal = (depTotal - 30 + 10080) % 10080;
                    const dayIdForPrep = Math.floor(prepStartTotal / 1440) + 1;
                    return dayIdForPrep === day.id;
                  });
                  return (
                    <button
                      key={day.id}
                      disabled={!isSelected}
                      onClick={() => handleToggleDay(day.id)}
                      className={`h-12 flex flex-col items-center justify-center border font-black transition-all rounded-sm gap-0.5 ${isSelected ? 'bg-aero-yellow text-black border-aero-yellow shadow-2xl' : 'bg-black/20 text-white/10 border-white/5 opacity-50 cursor-not-allowed'}`}
                    >
                      <span className="text-[10px] leading-none">{day.label}</span>
                      <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-black/40' : 'bg-white/5'}`}></div>
                    </button>
                  )
                })}
             </div>
          </div>

          <div className="h-px bg-white/10"></div>

          <div className={maximizeFlights ? 'opacity-30 pointer-events-none grayscale transition-opacity' : 'transition-opacity'}>
            <div className="flex justify-between items-end mb-3">
              <label className="block text-[10px] uppercase tracking-widest text-white/40 font-black">Starting Time</label>
              <div className="text-[9px] font-mono text-aero-yellow bg-aero-yellow/10 px-2 py-0.5 border border-aero-yellow/20 uppercase">
                Takeoff: {flightHour.toString().padStart(2, '0')}:{flightMinute.toString().padStart(2, '0')}
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
            <div className="mt-2 text-[8px] text-center text-white/20 uppercase tracking-[0.2em] font-bold">Adjusting Prep Start time</div>
          </div>

          {validationMsg && (
            <div className="bg-[#111] border border-white/20 p-3 flex gap-2 items-start">
               <AlertCircle size={14} className="text-aero-yellow/60 shrink-0 mt-0.5" />
               <span className="text-[10px] text-aero-yellow/60 font-bold leading-tight">{validationMsg}</span>
            </div>
          )}

          <div className="mt-auto space-y-3">
             <div className="bg-aero-yellow/10 border border-aero-yellow/20 p-4 rounded-sm">
                <div className="flex justify-between items-center mb-1">
                   <span className="text-[9px] uppercase font-black text-white/40">Total Flights</span>
                   <span className="text-xl font-black text-aero-yellow italic">{schedule.length}</span>
                </div>
                <div className="flex justify-between items-center">
                   <span className="text-[9px] uppercase font-black text-white/40">Daily Average</span>
                   <span className="text-sm font-bold text-white">{(schedule.length / 7).toFixed(1)}</span>
                </div>
             </div>

             <button 
                onClick={handleSave}
                disabled={schedule.length === 0}
                className="w-full py-4 px-6 bg-aero-yellow text-black font-black uppercase text-sm tracking-widest hover:bg-white transition-all shadow-2xl disabled:opacity-50 flex items-center justify-center gap-2 rounded-none"
             >
                <Save size={18} /> Update Schedule
             </button>
          </div>
        </div>

        {/* Timetable Grid Area */}
        <div className="flex-1 bg-black flex flex-col overflow-hidden relative">
           <div className="flex shrink-0">
              <div className="w-16 border-r border-white/10 bg-black"></div>
              {daysOfWeek.map(day => (
                <div key={day.id} className="flex-1 text-center text-[10px] uppercase font-black text-white/40 py-4 bg-black border-b border-white/10">
                  {day.label}
                </div>
              ))}
           </div>

           <div className="flex-1 overflow-auto custom-scrollbar flex relative bg-black/40 pt-4">
              {/* Time Indicators */}
              <div className="w-16 shrink-0 border-r border-white/20 bg-black/90 relative z-20">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="h-[30px] border-b border-white/5 flex items-start justify-end pr-2 relative">
                    <span className="text-[9px] font-mono text-white/30 absolute top-[-6px]">{i.toString().padStart(2, '0')}:00</span>
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
                              className={`absolute left-0.5 right-0.5 p-1 px-1.5 text-[10px] font-mono shadow-xl transition-all ${
                                b.isBusy 
                                  ? 'bg-white/10 border-l-2 border-white/20 italic opacity-40 cursor-not-allowed' 
                                  : 'bg-aero-yellow/20 border-l-2 border-aero-yellow text-aero-yellow cursor-ns-resize hover:bg-aero-yellow/40 hover:border-white group select-none'
                              }`}
                              style={{ top: b.top, height: b.height, zIndex: b.isBusy ? 5 : 10 }}
                           >
                              <div className="flex flex-col h-full overflow-hidden relative">
                                {b.isFirst && <div className="text-[8px] opacity-70 mb-0.5">{b.orig} → {b.dest}</div>}
                                <div className="font-bold truncate group-hover:text-white transition-colors">{aircraft.registration}</div>
                                {!b.isBusy && b.isFirst && <div className="text-[7px] text-white/40 mt-1 uppercase font-bold tracking-tighter">Adjust Time</div>}
                                {b.isLast && <div className="mt-auto text-[8px] text-right opacity-50 font-bold">End</div>}
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
                   <h3 className="text-4xl font-black uppercase italic tracking-tighter">Schedule Updated</h3>
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
