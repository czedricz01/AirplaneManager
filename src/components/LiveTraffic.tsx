import React, { useMemo, useState, useEffect } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { aircraftList } from "../data/aircraft";

interface LiveTrafficProps {
  realTime: Date;
  routes: any[];
  aiRoutes: any[];
  airports: any[];
  offset?: number;
  fleet?: any[];
}

// Great circle path calculator for high-fidelity routes
function getGreatCirclePoints(start: [number, number], end: [number, number], segments = 100): [number, number][] {
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

// Custom FlightRadar24-style detailed SVG vector selector depending on the specific aircraft
function getDetailedPlaneSvg(aircraftId: string, planeClass: string, icaoClass: string) {
  const customYellow = "#FACC15"; // Solid FlightRadar24 yellow
  const strokeColor = "#121212"; // Crisp black outline
  const scaleClass = (planeClass || 'narrowbody').toLowerCase();

  // 1. Sleek delta wing: Concorde
  if (aircraftId?.toLowerCase() === 'concorde') {
    return (
      <svg viewBox="0 0 32 32" className="w-full h-full" style={{ filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.85))" }}>
        <path 
          d="M16,1 L14,12 L1,24 L14,22 L14,28 L11,30 L11,31 L16,30.5 L21,31 L21,30 L18,28 L18,22 L31,24 L18,12 Z" 
          fill={customYellow} 
          stroke={strokeColor} 
          strokeWidth="1.2" 
          strokeLinejoin="round" 
        />
        <path d="M16,4 L16,10" stroke="#000" strokeWidth="0.8" opacity="0.4" />
      </svg>
    );
  }

  // 2. Giant Quad-Engine Heavy Jumbo (A380, B747)
  if (
    icaoClass === 'F' || 
    icaoClass === 'E' || 
    aircraftId?.toLowerCase().includes('380') || 
    aircraftId?.toLowerCase().includes('747')
  ) {
    return (
      <svg viewBox="0 0 32 32" className="w-full h-full" style={{ filter: "drop-shadow(0px 1px 3px rgba(0,0,0,0.85))" }}>
        <path 
          d="M16,1 C14.5,1 13.5,4 13.5,10 L13.5,13 L0,18.5 L0,21.5 L13.5,19.2 L13.5,27.2 L5,29.2 L5,31 L16,30 L27,31 L27,29.2 L18.5,27.2 L18.5,19.2 L32,21.5 L32,18.5 L18.5,13 L18.5,10 C18.5,4 17.5,1 16,1 Z" 
          fill={customYellow} 
          stroke={strokeColor} 
          strokeWidth="1.3" 
          strokeLinejoin="round" 
        />
      </svg>
    );
  }

  // 3. Widebody Dual-Engine Heavy (B777, B787, A350, A330)
  if (scaleClass === 'widebody' || icaoClass === 'D') {
    return (
      <svg viewBox="0 0 32 32" className="w-full h-full" style={{ filter: "drop-shadow(0px 1px 2.5px rgba(0,0,0,0.85))" }}>
        <path 
          d="M16,1.5 C14.5,1.5 13.8,4 13.8,9.5 L13.8,14 L0.5,18.8 L0.5,21.2 L13.8,19.2 L13.8,27 L6,29.2 L6,31 L16,30 L26,31 L26,29.2 L18.2,27 L18.2,19.2 L31.5,21.2 L31.5,18.8 L18.2,14 L18.2,9.5 C18.2,4 17.5,1.5 16,1.5 Z" 
          fill={customYellow} 
          stroke={strokeColor} 
          strokeWidth="1.2" 
          strokeLinejoin="round" 
        />
      </svg>
    );
  }

  // 4. Regional Jets / Turboprops (ATR, CRJ, ERJ, etc.)
  if (scaleClass === 'regional' || icaoClass === 'A' || icaoClass === 'B') {
    return (
      <svg viewBox="0 0 32 32" className="w-full h-full" style={{ filter: "drop-shadow(0px 1px 1.5px rgba(0,0,0,0.85))" }}>
        <path 
          d="M16,2.5 C15.1,2.5 14.5,4 L14.5,13 L3,15 L3,17.2 L14.5,16.5 L14.5,24.8 L8,26.8 L8,28.5 L16,27.5 L24,28.5 L24,26.8 L17.5,24.8 L17.5,16.5 L29,17.2 L29,15 L17.5,13 L17.5,4 C17.5,4 16.9,2.5 16,2.5 Z" 
          fill={customYellow} 
          stroke={strokeColor} 
          strokeWidth="1.1" 
          strokeLinejoin="round" 
        />
      </svg>
    );
  }

  // 5. Narrowbody Jets (Default - A320, B737 family)
  return (
    <svg viewBox="0 0 32 32" className="w-full h-full" style={{ filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.85))" }}>
      <path 
        d="M16,2 C15,2 14.2,4.5 14.2,9.5 L14.2,14.2 L1,17.8 L1,20.2 L14.2,18.5 L14.2,26.5 L7.5,28.5 L7.5,30.2 L16,29.2 L24.5,30.2 L24.5,28.5 L17.8,26.5 L17.8,18.5 L31,20.2 L31,17.8 L17.8,14.2 L17.8,9.5 C17.8,4.5 17,2 16,2 Z" 
        fill={customYellow} 
        stroke={strokeColor} 
        strokeWidth="1.2" 
        strokeLinejoin="round" 
      />
    </svg>
  );
}

export function LiveTraffic({ realTime, routes, aiRoutes, airports, offset = 0, fleet = [] }: LiveTrafficProps) {
  const [smoothTime, setSmoothTime] = useState(realTime.getTime());

  useEffect(() => {
    let animationFrameId;
    let lastTime = performance.now();
    let currentVirtualTime = realTime.getTime();

    const animate = (time) => {
      const delta = time - lastTime;
      lastTime = time;
      currentVirtualTime += delta * 60; // 60x speed if we want 1 min/sec, but if it runs in real-time, just delta
      // Wait, is the game running in real time or accelerated?
      // Actually, if App.tsx updates realTime by new Date(), it is real time.
      // So delta is just delta.
      currentVirtualTime += delta;
      setSmoothTime(currentVirtualTime);
      animationFrameId = requestAnimationFrame(animate);
    };
    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  useEffect(() => {
    // Sync with external realTime if it deviates too much
    setSmoothTime(prev => {
        if (Math.abs(prev - realTime.getTime()) > 60000) return realTime.getTime();
        return prev;
    });
  }, [realTime]);

  const smoothDate = new Date(smoothTime);
  const nowDayOfWeek = smoothDate.getDay() === 0 ? 7 : smoothDate.getDay();
  const nowTotalMins = smoothDate.getHours() * 60 + smoothDate.getMinutes() + smoothDate.getSeconds() / 60;
  const nowWeeklyMins = (nowDayOfWeek - 1) * 1440 + nowTotalMins;

  const airportsMap = useMemo(() => new Map(airports.map(a => [a.id, a])), [airports]);

  const trafficMarkers = useMemo(() => {
    const markers: React.ReactNode[] = [];

    const processRoutes = (routeList: any[], isRival: boolean) => {
      routeList.forEach((r, routeIndex) => {
        if (!r.schedule) return;
        const o = airportsMap.get(r.origin);
        const d = airportsMap.get(r.destination);
        if (!o || !d) return;

        // Find plane metadata for dependent icons/sizes
        const playerPlane = !isRival ? fleet.find(f => f.id === r.aircraft) : null;
        let planeInfo = null;
        if (!isRival) {
            planeInfo = playerPlane ? aircraftList.find(a => a.id === playerPlane.type) : null;
        } else {
            planeInfo = aircraftList.find(a => a.id === r.aircraft);
        }
        const playerPax = playerPlane ? ((playerPlane.config?.economy || 0) + (playerPlane.config?.premium || 0) + (playerPlane.config?.business || 0) + (playerPlane.config?.first || 0)) : null;

        const planeClass = planeInfo?.class || r.aircraftClass || 'Narrowbody';
        const icaoCode = planeInfo?.icaoCode || 'C';
        const labelName = planeInfo ? `${planeInfo.manufacturer} ${planeInfo.type}` : r.aircraft || 'Aircraft';

        // Size configuration dependent on aircraft class (Scaled up to be bigger and clearly readable)
        let size = 34;
        if (aircraftIdIsConcorde(r.aircraft)) size = 36;
        else if (planeClass.toLowerCase() === 'regional') size = 29;
        else if (planeClass.toLowerCase() === 'widebody') size = 40;
        else if (icaoCode === 'F' || icaoCode === 'E') size = 46;

        r.schedule.forEach((s: any, sIdx: number) => {
           // Roundtrip simulation handling: Outbound and Inbound
           const dayOffset = (s.dayId - 1) * 1440;
           const flightDuration = s.durMin || 60;
           const turnover = s.turnoverMin || 45;

           // Outbound leg timing
           const outboundStart = dayOffset + (s.startHour * 60 + s.startMin) + 30; // 30m buffer for boarding
           const outboundEnd = outboundStart + flightDuration;

           // Inbound/Return leg timing (unless configured as one-way explicitly)
           const inboundStart = outboundEnd + turnover + 30;
           const inboundEnd = inboundStart + flightDuration;

           // 1. Process Outbound Flight
           const outboundDiff = (nowWeeklyMins - outboundStart + 10080) % 10080;
           if (outboundDiff >= 0 && outboundDiff <= flightDuration) {
              const progress = outboundDiff / Math.max(flightDuration, 1);
              renderActiveFlight(progress, o.coords, d.coords, false);
           }

           // 2. Process Inbound Flight (Roundtrip)
           if (!s.isOneWay) {
             const inboundDiff = (nowWeeklyMins - inboundStart + 10080) % 10080;
             if (inboundDiff >= 0 && inboundDiff <= flightDuration) {
                const progress = inboundDiff / Math.max(flightDuration, 1);
                renderActiveFlight(progress, d.coords, o.coords, true);
             }
           }

           function renderActiveFlight(progress: number, startCoords: [number, number], endCoords: [number, number], isReturn: boolean) {
              // Calculate points along the exact Great Circle route
              const segments = 100;
              const points = getGreatCirclePoints(startCoords, endCoords, segments);
              const index = Math.min(segments, Math.floor(progress * segments));
              
              if (!points[index]) return;

              const lat = points[index][0];
              let lng = points[index][1] + offset;

              // Compute rotation angle (heading) based on progress along Great Circle path
              const p1 = points[index];
              const p2 = points[Math.min(segments, index + 1)] || points[index];
              const lat1_rad = p1[0] * Math.PI / 180;
              const lat2_rad = p2[0] * Math.PI / 180;
              const dLon = (p2[1] - p1[1]) * Math.PI / 180;
              
              const y_bearing = Math.sin(dLon) * Math.cos(lat2_rad);
              const x_bearing = Math.cos(lat1_rad) * Math.sin(lat2_rad) - Math.sin(lat1_rad) * Math.cos(lat2_rad) * Math.cos(dLon);
              let bearing = Math.atan2(y_bearing, x_bearing) * (180 / Math.PI);
              const heading = (bearing + 360) % 360;

              // Generate custom detailed flightradar yellow SVG Plane matching aircraft characteristics
              const svgMarkup = getDetailedPlaneSvg(r.aircraft, planeClass, icaoCode);
              const iconHtml = renderToStaticMarkup(
                <div style={{ transform: `rotate(${heading}deg)`, width: `${size}px`, height: `${size}px` }}>
                  {svgMarkup}
                </div>
              );

              const icon = L.divIcon({
                html: iconHtml,
                className: '',
                iconSize: [size, size],
                iconAnchor: [size / 2, size / 2]
              });

              const currentOrigin = startCoords === o.coords ? o : d;
              const currentDest = startCoords === o.coords ? d : o;
              
              const headingCardinal = (() => {
                const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
                return directions[Math.round(heading / 45) % 8];
              })();

              markers.push(
                <Marker 
                  key={`${isRival ? 'ai' : 'player'}-${r.id}-${sIdx}-${isReturn ? 'ret' : 'out'}-${offset}`} 
                  position={[lat, lng]} 
                  icon={icon}
                >
                  <Popup>
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
                              style={{ left: `${progress * 100}%` }}
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
                  </Popup>
                </Marker>
              );
           }
        });
      });
    };

    processRoutes(routes, false);
    processRoutes(aiRoutes, true);

    return markers;
  }, [realTime, routes, aiRoutes, airportsMap, offset]);

  return <>{trafficMarkers}</>;
}

// Utility checker
function aircraftIdIsConcorde(id: string): boolean {
  return id?.toLowerCase() === 'concorde';
}
