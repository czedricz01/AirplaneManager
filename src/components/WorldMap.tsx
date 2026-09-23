import React from 'react';
import { MapContainer, TileLayer, Marker, CircleMarker, Tooltip, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Airport } from '../data/airportTypes';
import { airportsMapAdjusted } from '../data/airportRegistry';
import { LiveTraffic } from './LiveTraffic';
import { OwnedAircraft } from './MyFleetView';
import { MAP_YELLOW, MAP_CONGESTION_COLORS } from '../lib/theme';

/**
 * Airport markers, cached by zoom and management tier. The cache used to be a
 * ref inside App; it belongs next to the only code that draws them.
 */
const iconCache: Record<string, L.DivIcon> = {};

function getAirportIcon(zoomLevel: number, level: number): L.DivIcon {
  const key = `${zoomLevel}-${level}`;
  if (iconCache[key]) return iconCache[key];

  let bgColor: string = MAP_YELLOW;
  if (level === 1) bgColor = MAP_CONGESTION_COLORS.low;
  else if (level === 2) bgColor = MAP_CONGESTION_COLORS.medium;
  else if (level >= 3) bgColor = MAP_CONGESTION_COLORS.high;

  let iconInfo: L.DivIcon;
  if (zoomLevel < 5) {
    // Simple dot for low zoom
    const dotSize = zoomLevel < 3 ? 2 : 3;
    iconInfo = L.divIcon({
      className: '',
      html: `<div style="width: ${dotSize}px; height: ${dotSize}px; background-color: ${bgColor}; border-radius: 50%; transform: translate(-50%, -50%); pointer-events: none;"></div>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  } else if (zoomLevel < 8) {
    // Small circle with border
    const outerSize = Math.max(6, zoomLevel * 1.2);
    iconInfo = L.divIcon({
      className: '',
      html: `<div style="width: ${outerSize}px; height: ${outerSize}px; background-color: ${bgColor}; border: 1px solid black; border-radius: 50%; transform: translate(-50%, -50%); box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  } else {
    // Complex "radar" icon for high zoom
    const outerSize = Math.max(10, zoomLevel * 2.5);
    iconInfo = L.divIcon({
      className: '',
      html: `<div style="width: ${outerSize}px; height: ${outerSize}px; background-color: ${bgColor}; border: 2px solid black; border-radius: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 8px rgba(0,0,0,0.5);">
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
  setSelectedAirport, getRoutePath
}: WorldMapProps) {
  return (
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
              updateInterval={100}
              keepBuffer={6}
              updateWhenIdle={false}
              updateWhenZooming={true}
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
                  const key = [a1.id, a2.id].sort().join('-');
                  if (pairs.has(key)) return null;
                  pairs.add(key);
                  const points = getRoutePath(a1, a2, offset);
                  return (
                    <Polyline 
                      key={`${r.id}-${offset}`}
                      positions={points}
                      color={MAP_YELLOW}
                      weight={1.2}
                      opacity={0.8}
                      smoothFactor={1} 
                      lineCap="round"
                      lineJoin="round"
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
                                color={MAP_YELLOW}
                                weight={1.2}
                                opacity={0.8} 
                                smoothFactor={1}
                                lineCap="round"
                                lineJoin="round"
                            />
                        );
                    }
                }

                // Render Rival routes as red lines on the map
                if (showRivalRoutes && aiAirlines && aiAirlines.length > 0) {
                  aiAirlines.forEach((airline, aiIdx) => {
                    if (airline.routes && airline.routes.length > 0) {
                      airline.routes.forEach((r, routeIdx) => {
                        const a1 = airportsMapAdjusted.get(r.origin);
                        const a2 = airportsMapAdjusted.get(r.destination);
                        if (!a1 || !a2) return;
                        const points = getRoutePath(a1, a2, offset);
                        lines.push(
                          <Polyline 
                            key={`ai-${airline.code}-${aiIdx}-${routeIdx}-${offset}`}
                            positions={points}
                            color={MAP_CONGESTION_COLORS.bad}
                            weight={1.5}
                            opacity={0.7}
                            smoothFactor={1}
                            lineCap="round"
                            lineJoin="round"
                          >
                            <Tooltip sticky>
                              <div className="bg-aero-black/95 backdrop-blur-sm border border-white/10 text-aero-yellow/60 px-3 py-1.5 font-mono text-2xs uppercase tracking-widest shadow-2xl">
                                <div className="text-xs leading-none mb-1 text-white font-sans font-bold">{airline.name}</div>
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
                  const radius = Math.max(3, zoom * 1.2);
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
            />
          )}
        </MapContainer>
  );
}

export const WorldMap = React.memo(WorldMapImpl);
