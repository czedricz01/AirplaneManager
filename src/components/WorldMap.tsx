import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, CircleMarker, Tooltip, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Airport } from '../data/airportTypes';
import { airportsMapAdjusted } from '../data/airportRegistry';
import { LiveTraffic } from './LiveTraffic';
import type { OwnedAircraft } from './MyFleetView';
import { MAP_YELLOW, MAP_CONGESTION_COLORS, HEATMAP_COLORS, profitColor, paxWeight } from '../lib/theme';
import { formatNumber, formatSignedCurrency } from '../lib/format';

/**
 * Airport markers, cached by zoom and management tier. The cache used to be a
 * ref inside App; it belongs next to the only code that draws them.
 */
const iconCache: Record<string, L.DivIcon> = {};

// Zoom range the map allows (see MapContainer minZoom / TileLayer maxZoom below).
const MIN_MAP_ZOOM = 2;
const MAX_MAP_ZOOM = 20;
const MIN_ICON_PX = 5;
const MAX_ICON_PX = 30;

/**
 * One continuous, monotonic size curve shared by every marker style
 * (CircleMarker below the icon threshold, and every DivIcon tier above it).
 * Previously each zoom tier had its own ad-hoc formula (`zoom * 1.2`,
 * `zoom * 2.5`, a fixed 2-3px dot, ...), so airports visibly jumped in size
 * at the tier boundaries instead of scaling smoothly with the zoom level.
 */
function iconDiameter(zoomLevel: number): number {
  const t = Math.min(1, Math.max(0, (zoomLevel - MIN_MAP_ZOOM) / (MAX_MAP_ZOOM - MIN_MAP_ZOOM)));
  return MIN_ICON_PX + t * (MAX_ICON_PX - MIN_ICON_PX);
}

function getAirportIcon(zoomLevel: number, level: number): L.DivIcon {
  const key = `${zoomLevel}-${level}`;
  if (iconCache[key]) return iconCache[key];

  let bgColor: string = MAP_YELLOW;
  if (level === 1) bgColor = MAP_CONGESTION_COLORS.low;
  else if (level === 2) bgColor = MAP_CONGESTION_COLORS.medium;
  else if (level >= 3) bgColor = MAP_CONGESTION_COLORS.high;

  const size = iconDiameter(zoomLevel);
  let iconInfo: L.DivIcon;
  if (zoomLevel < 8) {
    // Small circle with border
    iconInfo = L.divIcon({
      className: '',
      html: `<div style="width: ${size}px; height: ${size}px; background-color: ${bgColor}; border: 1px solid black; border-radius: 50%; transform: translate(-50%, -50%); box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  } else {
    // "Radar" icon for high zoom, sized on the same curve so it lines up
    // with the plain circle at the zoom=8 boundary instead of jumping.
    iconInfo = L.divIcon({
      className: '',
      html: `<div style="position: relative; width: ${size}px; height: ${size}px; background-color: ${bgColor}; border: 2px solid black; border-radius: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 8px rgba(0,0,0,0.5);">
               <div style="width: 30%; height: 30%; background-color: black; border-radius: 50%;"></div>
               <div style="position: absolute; width: 120%; height: 120%; border: 1px dashed ${bgColor}; border-radius: 50%; opacity: 0.3;"></div>
             </div>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  }
  iconCache[key] = iconInfo;
  return iconInfo;
}

interface MapEventsProps { setZoom: (z: number) => void; setBounds?: (b: L.LatLngBounds) => void }

function MapEvents({ setZoom, setBounds }: MapEventsProps) {
  useMapEvents({
    zoomend: (e) => {
      setZoom(e.target.getZoom());
      if (setBounds) setBounds(e.target.getBounds());
    },
    moveend: (e) => {
      if (setBounds) setBounds(e.target.getBounds());
    }
  });
  return null;
}

export interface WorldMapProps {
  sessionKey: number;
  zoom: number;
  setZoom: (z: number) => void;
  setMapBounds: (b: L.LatLngBounds) => void;
  visibleAirports: Airport[];
  visibleWorldOffsets: number[];
  airports: Airport[];
  routes: any[];
  aiRouteList: any[];
  aiAirlines: any[];
  fleet: OwnedAircraft[];
  airportManagement: Record<string, any>;
  showYourRoutes: boolean;
  showRivalRoutes: boolean;
  showLiveTraffic: boolean;
  planningOriginId: string | null;
  planningDestId: string | null;
  setSelectedAirport: (a: Airport | null) => void;
  getRoutePath: (a1: Airport, a2: Airport, offset: number) => [number, number][];
  /** The player's brand colour, for their routes and aircraft. */
  playerColor: string;
  /** Colour the player's routes by profit instead of by brand. */
  heatmap: boolean;
  /** This month's profit per player route id, for the heatmap. */
  routeProfits: Record<string, number>;
  /** Passengers per week per player route id, for the heatmap's line widths. */
  routePax: Record<string, number>;
}

type PathStyle = { color: string; weight: number; opacity: number; lineCap: 'round'; lineJoin: 'round' };

/** One airport pair on the heatmap: every player route between the two, summed. */
interface HeatPair {
  a: string;
  b: string;
  profit: number;
  pax: number;
  routes: number;
  style: PathStyle;
}

const pairKey = (a: string, b: string) => (a < b ? `${a}-${b}` : `${b}-${a}`);

/**
 * The heatmap's key: the colour ramp and what the line width means. Sits in
 * the map's corner only while the heatmap is on.
 */
function HeatmapLegend() {
  return (
    <div className="absolute bottom-4 left-4 z-[800] pointer-events-none bg-aero-black/85 backdrop-blur-sm border border-white/10 px-3 py-2 shadow-2xl w-56 font-mono">
      <div className="text-3xs font-black uppercase tracking-[0.25em] text-white/60 mb-1.5">Profit heatmap</div>
      <div
        className="h-2 w-full"
        style={{ background: `linear-gradient(to right, ${HEATMAP_COLORS.loss}, ${HEATMAP_COLORS.neutral}, ${HEATMAP_COLORS.profit})` }}
      />
      <div className="flex justify-between text-3xs uppercase tracking-wider text-white/50 mt-1">
        <span>Loss</span>
        <span>Break-even</span>
        <span>Profit</span>
      </div>
      <div className="flex items-center gap-2 mt-2 text-3xs uppercase tracking-wider text-white/50">
        <span className="flex items-center gap-1">
          <span className="block w-4 bg-white/60" style={{ height: 1 }} />
          <span className="block w-4 bg-white/60" style={{ height: 3 }} />
          <span className="block w-4 bg-white/60" style={{ height: 5 }} />
        </span>
        Line width = passengers
      </div>
    </div>
  );
}

/**
 * The world map, lifted out of App and memoised.
 *
 * The map stays mounted under every overlay view, and it used to be an
 * un-memoised block inside App's render. Late in a game that meant re-creating
 * roughly 750 Polyline, Marker and Tooltip elements -- for every world copy --
 * on any state change anywhere in the application: opening the settings modal,
 * typing a savegame name, or the live-traffic clock ticking. None of those
 * change what the map draws.
 *
 * React.memo now compares the props below, so the map re-renders only when its
 * own inputs change. That requires App to keep the callbacks stable, which is
 * why they are useCallback there.
 */
function WorldMapImpl({
  sessionKey, zoom, setZoom, setMapBounds, visibleAirports, visibleWorldOffsets,
  airports, routes, aiRouteList, aiAirlines, fleet, airportManagement, showYourRoutes,
  showRivalRoutes, showLiveTraffic, planningOriginId, planningDestId,
  setSelectedAirport, getRoutePath, playerColor, heatmap, routeProfits, routePax
}: WorldMapProps) {
  // Style objects are memoised and handed over as pathOptions, which
  // react-leaflet compares by identity: a line is restyled when its colour
  // actually changes, not on every zoom step. (Plain color/weight props are
  // read once, when the line is created.)
  const playerStyle = useMemo<PathStyle>(
    () => ({ color: playerColor, weight: 1.2, opacity: 0.8, lineCap: 'round', lineJoin: 'round' }),
    [playerColor]
  );

  /** One style per rival, in the order of aiAirlines. */
  const rivalStyles = useMemo(() => (aiAirlines || []).map((airline): PathStyle => ({
    color: airline.color || MAP_CONGESTION_COLORS.bad,
    weight: 1.5,
    // Faded while the heatmap is on, so the rivals' own greens and reds are
    // not read as profit and loss.
    opacity: heatmap ? 0.3 : 0.7,
    lineCap: 'round',
    lineJoin: 'round'
  })), [aiAirlines, heatmap]);

  // The map draws one line per airport pair, so the heatmap sums every
  // player route flying the same pair.
  const heatPairs = useMemo(() => {
    if (!heatmap) return null;
    const totals = new Map<string, Omit<HeatPair, 'style'>>();
    for (const r of routes) {
      if (!r?.origin || !r?.destination) continue;
      const key = pairKey(r.origin, r.destination);
      const entry = totals.get(key) || { a: r.origin, b: r.destination, profit: 0, pax: 0, routes: 0 };
      entry.profit += routeProfits[r.id] || 0;
      entry.pax += routePax[r.id] || 0;
      entry.routes += 1;
      totals.set(key, entry);
    }
    let maxAbs = 0;
    let maxPax = 0;
    for (const p of totals.values()) {
      maxAbs = Math.max(maxAbs, Math.abs(p.profit));
      maxPax = Math.max(maxPax, p.pax);
    }
    const pairs = new Map<string, HeatPair>();
    for (const [key, p] of totals) {
      pairs.set(key, {
        ...p,
        style: {
          color: profitColor(p.profit, maxAbs),
          weight: paxWeight(p.pax, maxPax),
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round'
        }
      });
    }
    return pairs;
  }, [heatmap, routes, routeProfits, routePax]);

  return (
    <>
          <MapContainer 
            key={`map-${sessionKey}`}
            center={[20, 0]} 
            zoom={3} 
            minZoom={2}
            preferCanvas={true}
            worldCopyJump={true}
            maxBounds={[[-85, -5000], [85, 5000]]}
            maxBoundsViscosity={0.8}
            className="w-full h-full"
            style={{ backgroundColor: '#131517' }}
            zoomControl={false}
          >
            {/* Low-resolution world backdrop that fills gaps while the detail
                layer loads. Two further duplicate layers were removed here:
                all four requested the same tile service, so the map fetched
                every visible area up to four times. */}
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution='&copy; Esri'
              noWrap={false}
              minNativeZoom={2}
              maxNativeZoom={3}
              maxZoom={20}
              zIndex={0}
              opacity={0.9}
              keepBuffer={8}
            />
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution='&copy; Esri'
              noWrap={false}
              maxNativeZoom={19}
              maxZoom={20}
              detectRetina={true}
              updateInterval={150}
              keepBuffer={6}
              updateWhenIdle={false}
              updateWhenZooming={false}
              zIndex={2}
            />
          <MapEvents setZoom={setZoom} setBounds={setMapBounds} />
                  {/* Route Lines - Rendered on 3 worlds for continuity */}
          {visibleWorldOffsets.map(offset => (
            <React.Fragment key={`world-${offset}-routes`}>
              {(() => {
                const pairs = new Set<string>();
                const lines = showYourRoutes ? routes.map(r => {
                  const a1 = airportsMapAdjusted.get(r.origin);
                  const a2 = airportsMapAdjusted.get(r.destination);
                  if (!a1 || !a2) return null;
                  const key = pairKey(a1.id, a2.id);
                  if (pairs.has(key)) return null;
                  pairs.add(key);
                  const points = getRoutePath(a1, a2, offset);
                  const heat = heatPairs?.get(key);
                  if (heat) {
                    return (
                      <Polyline
                        key={`heat-${key}-${offset}`}
                        positions={points}
                        {...heat.style}
                        pathOptions={heat.style}
                        smoothFactor={1}
                      >
                        <Tooltip sticky>
                          <div className="bg-aero-black/95 backdrop-blur-sm border border-white/10 px-3 py-1.5 font-mono text-2xs uppercase tracking-widest shadow-2xl">
                            <div className="text-xs leading-none mb-1 text-white font-sans font-bold">{heat.a} ↔ {heat.b}</div>
                            <div className="text-2xs leading-none font-black mb-1" style={{ color: heat.style.color }}>
                              {formatSignedCurrency(heat.profit)} / month
                            </div>
                            <div className="text-[8px] leading-none text-white/60">
                              {formatNumber(heat.pax)} pax/week{heat.routes > 1 ? ` · ${heat.routes} routes` : ''}
                            </div>
                          </div>
                        </Tooltip>
                      </Polyline>
                    );
                  }
                  return (
                    <Polyline 
                      key={`${r.id}-${offset}`}
                      positions={points}
                      {...playerStyle}
                      pathOptions={playerStyle}
                      smoothFactor={1} 
                    />
                  );
                }) : [];

                // Add planning line if both ends are selected
                if (showYourRoutes && planningOriginId && planningDestId) {
                    const a1 = airportsMapAdjusted.get(planningOriginId);
                    const a2 = airportsMapAdjusted.get(planningDestId);
                    if (a1 && a2) {
                        const points = getRoutePath(a1, a2, offset);
                        lines.push(
                            <Polyline 
                                key={`planning-${offset}`}
                                positions={points}
                                {...playerStyle}
                                pathOptions={playerStyle}
                                smoothFactor={1}
                            />
                        );
                    }
                }

                // Rival routes, each airline in its own colour
                if (showRivalRoutes && aiAirlines && aiAirlines.length > 0) {
                  aiAirlines.forEach((airline, aiIdx) => {
                    const style = rivalStyles[aiIdx];
                    if (style && airline.routes && airline.routes.length > 0) {
                      airline.routes.forEach((r, routeIdx) => {
                        const a1 = airportsMapAdjusted.get(r.origin);
                        const a2 = airportsMapAdjusted.get(r.destination);
                        if (!a1 || !a2) return;
                        const points = getRoutePath(a1, a2, offset);
                        lines.push(
                          <Polyline 
                            key={`ai-${airline.code}-${aiIdx}-${routeIdx}-${offset}`}
                            positions={points}
                            {...style}
                            pathOptions={style}
                            smoothFactor={1}
                          >
                            <Tooltip sticky>
                              <div className="bg-aero-black/95 backdrop-blur-sm border border-white/10 text-aero-yellow/60 px-3 py-1.5 font-mono text-2xs uppercase tracking-widest shadow-2xl">
                                <div className="text-xs leading-none mb-1 text-white font-sans font-bold flex items-center gap-1.5">
                                  <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: style.color }} />
                                  {airline.name}
                                </div>
                                <div className="text-2xs leading-none text-aero-yellow/60 font-mono mb-1">{r.origin} ↔ {r.destination}</div>
                                <div className="text-[8px] opacity-60 leading-none">{r.departures} departures/week</div>
                              </div>
                            </Tooltip>
                          </Polyline>
                        );
                      });
                    }
                  });
                }
                return lines;
              })()}
            </React.Fragment>
          ))}
      
          {/* Airport Markers - Rendered on 3 worlds */}
          {visibleWorldOffsets.map(offset => (
            <React.Fragment key={`world-${offset}-airports`}>
              {visibleAirports.map((airport) => {
                const mgtLvl = airportManagement[airport.id]?.level || 0;
                const pos: [number, number] = [airport.coords[0], airport.coords[1] + offset];
            
                if (zoom >= 6) {
                  return (
                    <Marker 
                      key={`${airport.id}-${offset}`} 
                      position={pos}
                      icon={getAirportIcon(zoom, mgtLvl)}
                      eventHandlers={{
                        click: () => setSelectedAirport(airport)
                      }}
                    >
                      <Tooltip direction="top" offset={[0, -10]} opacity={1} sticky>
                        <div className="bg-aero-black/90 backdrop-blur-sm border border-aero-yellow text-aero-yellow px-3 py-1.5 font-mono text-[11px] uppercase font-black tracking-widest shadow-2xl flex flex-col items-center">
                          <div className="text-[14px] leading-none mb-1 text-white">{airport.id}</div>
                          <div className="text-[8px] opacity-60 leading-none">{airport.name}</div>
                        </div>
                      </Tooltip>
                    </Marker>
                  );
                } else {
                  // Same size curve as getAirportIcon, so the marker doesn't
                  // jump in size when it switches from CircleMarker to Marker
                  // at the zoom >= 6 threshold.
                  const radius = iconDiameter(zoom) / 2;
                  const isGreen = mgtLvl > 0;
                  return (
                    <CircleMarker
                      key={`${airport.id}-${offset}`}
                      center={pos}
                      radius={radius}
                      pathOptions={{
                        color: 'black',
                        weight: 1,
                        fillColor: isGreen ? MAP_CONGESTION_COLORS.good : MAP_YELLOW,
                        fillOpacity: 1
                      }}
                      eventHandlers={{
                        click: () => setSelectedAirport(airport)
                      }}
                    >
                      <Tooltip direction="top" opacity={1} sticky>
                        <div className="bg-aero-black/90 backdrop-blur-sm border border-aero-yellow text-aero-yellow px-2 py-1 font-mono text-[10px] uppercase font-black tracking-widest shadow-2xl">
                          {airport.id}
                        </div>
                      </Tooltip>
                    </CircleMarker>
                  );
                }
              })}
            </React.Fragment>
          ))}

          {/* Rendered once for every world copy: flight positions do not
              depend on the copy, only the drawn longitude does. */}
          {showLiveTraffic && (
            <LiveTraffic
              routes={routes}
              aiRoutes={aiRouteList}
              airports={airports}
              offsets={visibleWorldOffsets}
              fleet={fleet}
              playerColor={playerColor}
            />
          )}
        </MapContainer>
        {heatmap && showYourRoutes && <HeatmapLegend />}
    </>
  );
}

export const WorldMap = React.memo(WorldMapImpl);
