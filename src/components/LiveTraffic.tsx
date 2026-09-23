import React, { useMemo } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { aircraftList } from "../data/aircraft";

interface LiveTrafficProps {
  routes: any[];
  aiRoutes: any[];
  airports: any[];
  /** World copies to draw on, e.g. [-360, 0, 360]. */
  offsets?: number[];
  fleet?: any[];
}

// Great circle path calculator for high-fidelity routes
function computeGreatCirclePoints(start: [number, number], end: [number, number], segments = 100): [number, number][] {
  const points: [number, number][] = [];

  const lat1 = start[0] * Math.PI / 180;
  const lon1 = start[1] * Math.PI / 180;
  const lat2 = end[0] * Math.PI / 180;
  const lon2 = end[1] * Math.PI / 180;

  const d = Math.acos(
    Math.min(1, Math.max(-1, Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos(lon1 - lon2)))
  );

  if (d === 0 || isNaN(d)) {
    return [start, end];
  }

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const A = Math.sin((1 - t) * d) / Math.sin(d);
    const B = Math.sin(t * d) / Math.sin(d);

    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);

    const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * 180 / Math.PI;
    let lon = Math.atan2(y, x) * 180 / Math.PI;

    if (points.length > 0) {
      const prevLon = points[points.length - 1][1];
      while (lon - prevLon > 180) lon -= 360;
      while (lon - prevLon < -180) lon += 360;
    }

    points.push([lat, lon]);
  }
  return points;
}

// A route's great circle never changes, so it is computed once per airport pair
// instead of once per aircraft per tick.
const SEGMENTS = 100;
const pathCache = new Map<string, [number, number][]>();

function getGreatCirclePoints(originId: string, destId: string, start: [number, number], end: [number, number]): [number, number][] {
  const key = `${originId}>${destId}`;
  const cached = pathCache.get(key);
  if (cached) return cached;
  const points = computeGreatCirclePoints(start, end, SEGMENTS);
  pathCache.set(key, points);
  return points;
}

const PLANE_YELLOW = "#FACC15";
const PLANE_STROKE = "#121212";

// Plain SVG strings rather than react-dom/server: this used to run a full React
// server render for every marker on every tick.
function getPlaneSvgPath(aircraftId: string, planeClass: string, icaoClass: string): { d: string; stroke: number; extra?: string } {
  const id = (aircraftId || '').toLowerCase();
  const scaleClass = (planeClass || 'narrowbody').toLowerCase();

  // 1. Sleek delta wing: Concorde
  if (id === 'concorde') {
    return {
      d: "M16,1 L14,12 L1,24 L14,22 L14,28 L11,30 L11,31 L16,30.5 L21,31 L21,30 L18,28 L18,22 L31,24 L18,12 Z",
      stroke: 1.2,
      extra: '<path d="M16,4 L16,10" stroke="#000" stroke-width="0.8" opacity="0.4" />'
    };
  }

  // 2. Giant Quad-Engine Heavy Jumbo (A380, B747)
  if (icaoClass === 'F' || icaoClass === 'E' || id.includes('380') || id.includes('747')) {
    return {
      d: "M16,1 C14.5,1 13.5,4 13.5,10 L13.5,13 L0,18.5 L0,21.5 L13.5,19.2 L13.5,27.2 L5,29.2 L5,31 L16,30 L27,31 L27,29.2 L18.5,27.2 L18.5,19.2 L32,21.5 L32,18.5 L18.5,13 L18.5,10 C18.5,4 17.5,1 16,1 Z",
      stroke: 1.3
    };
  }

  // 3. Widebody Dual-Engine Heavy (B777, B787, A350, A330)
  if (scaleClass === 'widebody' || icaoClass === 'D') {
    return {
      d: "M16,1.5 C14.5,1.5 13.8,4 13.8,9.5 L13.8,14 L0.5,18.8 L0.5,21.2 L13.8,19.2 L13.8,27 L6,29.2 L6,31 L16,30 L26,31 L26,29.2 L18.2,27 L18.2,19.2 L31.5,21.2 L31.5,18.8 L18.2,14 L18.2,9.5 C18.2,4 17.5,1.5 16,1.5 Z",
      stroke: 1.2
    };
  }

  // 4. Regional Jets / Turboprops (ATR, CRJ, ERJ, etc.)
  if (scaleClass === 'regional' || icaoClass === 'A' || icaoClass === 'B') {
    return {
      d: "M16,2.5 C15.1,2.5 14.5,4 14.5,9 L14.5,13 L3,15 L3,17.2 L14.5,16.5 L14.5,24.8 L8,26.8 L8,28.5 L16,27.5 L24,28.5 L24,26.8 L17.5,24.8 L17.5,16.5 L29,17.2 L29,15 L17.5,13 L17.5,9 C17.5,4 16.9,2.5 16,2.5 Z",
      stroke: 1.1
    };
  }

  // 5. Narrowbody Jets (Default - A320, B737 family)
  return {
    d: "M16,2 C15,2 14.2,4.5 14.2,9.5 L14.2,14.2 L1,17.8 L1,20.2 L14.2,18.5 L14.2,26.5 L7.5,28.5 L7.5,30.2 L16,29.2 L24.5,30.2 L24.5,28.5 L17.8,26.5 L17.8,18.5 L31,20.2 L31,17.8 L17.8,14.2 L17.8,9.5 C17.8,4.5 17,2 16,2 Z",
    stroke: 1.2
  };
}

// Icons are shared between every aircraft with the same silhouette, size and
// (5-degree-rounded) heading, so Leaflet gets a handful of objects, not hundreds.
const iconCache = new Map<string, L.DivIcon>();

function getPlaneIcon(aircraftId: string, planeClass: string, icaoClass: string, size: number, heading: number): L.DivIcon {
  const shape = getPlaneSvgPath(aircraftId, planeClass, icaoClass);
  const roundedHeading = Math.round(heading / 5) * 5;
  const key = `${shape.d.length}-${shape.stroke}-${size}-${roundedHeading}-${shape.extra ? 1 : 0}`;

  const cached = iconCache.get(key);
  if (cached) return cached;

  const html =
    `<div style="transform:rotate(${roundedHeading}deg);width:${size}px;height:${size}px">` +
    `<svg viewBox="0 0 32 32" width="${size}" height="${size}" style="filter:drop-shadow(0px 1px 2px rgba(0,0,0,0.85))">` +
    `<path d="${shape.d}" fill="${PLANE_YELLOW}" stroke="${PLANE_STROKE}" stroke-width="${shape.stroke}" stroke-linejoin="round" />` +
    (shape.extra || '') +
    `</svg></div>`;

  const icon = L.divIcon({
    html,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
  iconCache.set(key, icon);
  return icon;
}

interface ScheduleEntry {
  dayId: number;
  startHour: number;
  startMin: number;
  durMin: number;
  turnoverMin: number;
  isOneWay?: boolean;
}

// Rival routes store a weekly departure count rather than a timetable. Without this
// they were skipped entirely and no competitor aircraft ever appeared on the map.
const syntheticScheduleCache = new WeakMap<object, ScheduleEntry[]>();

function getScheduleFor(route: any): ScheduleEntry[] {
  if (Array.isArray(route.schedule) && route.schedule.length > 0) return route.schedule;

  const cached = syntheticScheduleCache.get(route);
  if (cached) return cached;

  const departures = Number(route.departures) || 0;
  const durMin = Number(route.durMin) || 90;
  const synthetic: ScheduleEntry[] = [];

  for (let i = 0; i < departures; i++) {
    const weekMin = Math.round((i * 10080) / departures);
    synthetic.push({
      dayId: Math.floor(weekMin / 1440) + 1,
      startHour: Math.floor((weekMin % 1440) / 60),
      startMin: weekMin % 60,
      durMin,
      turnoverMin: 45,
      isOneWay: false
    });
  }

  syntheticScheduleCache.set(route, synthetic);
  return synthetic;
}

function bearingBetween(p1: [number, number], p2: [number, number]): number {
  const lat1 = p1[0] * Math.PI / 180;
  const lat2 = p2[0] * Math.PI / 180;
  const dLon = (p2[1] - p1[1]) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
}

interface ActiveFlight {
  key: string;
  lat: number;
  lng: number;
  heading: number;
  progress: number;
  size: number;
  aircraftId: string;
  planeClass: string;
  icaoCode: string;
  labelName: string;
  registration: string;
  carrier: string;
  flightRef: string;
  fromId: string;
  toId: string;
  isReturn: boolean;
  cruiseSpeed: number;
}

export function LiveTraffic({ routes, aiRoutes, airports, offsets = [0], fleet = [] }: LiveTrafficProps) {
  /**
   * The live-traffic clock lives here, not in App.
   *
   * It used to be App state, so every tick re-rendered the whole application --
   * including the ~750 map polylines and every mounted view -- to move a few
   * aircraft markers. Nothing outside this component reads it.
   */
  const [realTime, setRealTime] = React.useState(() => new Date());
  React.useEffect(() => {
    const interval = setInterval(() => setRealTime(new Date()), 20000);
    return () => clearInterval(interval);
  }, []);

  const airportsMap = useMemo(() => new Map(airports.map(a => [a.id, a])), [airports]);
  const fleetByRegistration = useMemo(() => new Map(fleet.map(f => [f.registration, f])), [fleet]);
  const aircraftById = useMemo(() => new Map(aircraftList.map(a => [a.id, a])), []);

  // Positions depend only on the clock tick, the network and the fleet — not on the
  // world copies we draw them on, so this is computed once for all offsets.
  const activeFlights = useMemo<ActiveFlight[]>(() => {
    const nowDayOfWeek = realTime.getDay() === 0 ? 7 : realTime.getDay();
    const nowWeeklyMins = (nowDayOfWeek - 1) * 1440 + realTime.getHours() * 60 + realTime.getMinutes() + realTime.getSeconds() / 60;

    const flights: ActiveFlight[] = [];

    const processRoutes = (routeList: any[], isRival: boolean) => {
      routeList.forEach((r, routeIndex) => {
        const o = airportsMap.get(r.origin);
        const d = airportsMap.get(r.destination);
        if (!o || !d) return;

        const schedule = getScheduleFor(r);
        if (schedule.length === 0) return;

        // Player routes key the fleet by registration; rival routes carry the
        // aircraft type id directly.
        const ownedPlane = isRival ? null : fleetByRegistration.get(r.aircraft);
        const spec = ownedPlane || aircraftById.get(r.aircraft) || null;

        const planeClass = spec?.class || r.aircraftClass || 'Narrowbody';
        const icaoCode = spec?.icaoCode || 'C';
        const aircraftId = ownedPlane?.id || r.aircraft || '';
        const labelName = spec ? `${spec.manufacturer} ${spec.type}` : (r.aircraft || 'Aircraft');
        const registration = ownedPlane?.registration || r.aircraftReg || 'N/A';
        const cruiseSpeed = spec?.cruiseSpeed || 800;

        let size = 34;
        if (aircraftId.toLowerCase() === 'concorde') size = 36;
        else if (String(planeClass).toLowerCase() === 'regional') size = 29;
        else if (String(planeClass).toLowerCase() === 'widebody') size = 40;
        if (icaoCode === 'F' || icaoCode === 'E') size = 46;

        const routeKey = r.id || `${isRival ? 'ai' : 'own'}-${routeIndex}-${r.origin}-${r.destination}`;
        const points = getGreatCirclePoints(o.id, d.id, o.coords, d.coords);

        const pushFlight = (progress: number, reversed: boolean, legKey: string) => {
          const rawIndex = Math.floor(progress * SEGMENTS);
          const index = reversed
            ? Math.max(0, SEGMENTS - Math.min(SEGMENTS, rawIndex))
            : Math.min(SEGMENTS, rawIndex);
          const point = points[index];
          if (!point) return;

          const nextIndex = reversed ? Math.max(0, index - 1) : Math.min(SEGMENTS, index + 1);
          const heading = bearingBetween(point, points[nextIndex] || point);

          flights.push({
            key: legKey,
            lat: point[0],
            lng: point[1],
            heading,
            progress,
            size,
            aircraftId,
            planeClass: String(planeClass),
            icaoCode,
            labelName,
            registration,
            carrier: isRival ? (r.airline || 'Rival Carrier') : 'Your Airline',
            flightRef: String(routeKey).substring(0, 5).toUpperCase(),
            fromId: reversed ? d.id : o.id,
            toId: reversed ? o.id : d.id,
            isReturn: reversed,
            cruiseSpeed
          });
        };

        schedule.forEach((s, sIdx) => {
          const dayOffset = (s.dayId - 1) * 1440;
          const flightDuration = s.durMin || 60;
          const turnover = s.turnoverMin || 45;

          const outboundStart = dayOffset + (s.startHour * 60 + s.startMin) + 30; // boarding buffer
          const outboundEnd = outboundStart + flightDuration;
          const inboundStart = outboundEnd + turnover + 30;

          const outboundDiff = (nowWeeklyMins - outboundStart + 10080) % 10080;
          if (outboundDiff <= flightDuration) {
            pushFlight(outboundDiff / Math.max(flightDuration, 1), false, `${routeKey}-${sIdx}-out`);
          }

          if (!s.isOneWay) {
            const inboundDiff = (nowWeeklyMins - inboundStart + 10080) % 10080;
            if (inboundDiff <= flightDuration) {
              pushFlight(inboundDiff / Math.max(flightDuration, 1), true, `${routeKey}-${sIdx}-ret`);
            }
          }
        });
      });
    };

    processRoutes(routes, false);
    processRoutes(aiRoutes, true);

    return flights;
  }, [realTime, routes, aiRoutes, airportsMap, fleetByRegistration, aircraftById]);

  return (
    <>
      {offsets.map(offset =>
        activeFlights.map(f => (
          <Marker
            key={`${f.key}-${offset}`}
            position={[f.lat, f.lng + offset]}
            icon={getPlaneIcon(f.aircraftId, f.planeClass, f.icaoCode, f.size, f.heading)}
          >
            <Popup>
              <div className="bg-[#1a1a1a] border-l-2 border-[#FACC15] p-3 rounded-none text-[10px] font-mono leading-relaxed text-white min-w-[260px] shadow-2xl select-none">
                {/* Carrier & Callsign Banner */}
                <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-2">
                  <span className="text-[#FACC15] font-black uppercase tracking-widest text-[9px] flex items-center gap-2">
                    {f.carrier}
                  </span>
                  <span className="bg-[#0f0f0f] border border-white/10 text-white text-[8px] px-2 py-0.5 uppercase tracking-wide font-bold">
                    FLIGHT {f.flightRef}
                  </span>
                </div>

                {/* Aircraft Info */}
                <div className="mb-3 text-[11px] font-bold text-white tracking-wide">
                  {f.labelName} <span className="text-white/40 font-normal">({f.registration})</span>
                </div>

                {/* Route Info */}
                <div className="flex items-center justify-between mb-3 bg-[#0f0f0f] p-2 border border-white/5">
                  <div className="flex flex-col items-start">
                    <span className="text-white/50 text-[8px] uppercase">From</span>
                    <span className="font-black text-lg text-white">{f.fromId}</span>
                  </div>
                  <div className="flex-1 px-4 flex flex-col items-center relative">
                    <div className="w-full h-[1px] bg-white/20 absolute top-1/2 -translate-y-1/2"></div>
                    <div
                      className="absolute h-[3px] w-[3px] bg-[#FACC15] rounded-full top-1/2 -translate-y-1/2 transition-all duration-1000"
                      style={{ left: `${f.progress * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-white/50 text-[8px] uppercase">To</span>
                    <span className="font-black text-lg text-white">{f.toId}</span>
                  </div>
                </div>

                {/* Flight Details Grid */}
                <div className="grid grid-cols-2 gap-2 text-[9px] border-t border-white/5 pt-2">
                  <div className="flex flex-col">
                    <span className="text-white/40 uppercase">Status</span>
                    <span className="text-[#FACC15] uppercase">{f.isReturn ? 'Inbound' : 'Outbound'}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-white/40 uppercase">Progress</span>
                    <span className="text-white">{(f.progress * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white/40 uppercase">Speed</span>
                    <span className="text-white">{f.cruiseSpeed} km/h</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-white/40 uppercase">Class</span>
                    <span className="text-white">{f.planeClass.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))
      )}
    </>
  );
}
