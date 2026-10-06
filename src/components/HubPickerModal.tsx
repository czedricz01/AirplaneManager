import { useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import { Lock, X } from 'lucide-react';
import { Airport, getAirportStats } from '../data/airports';
import { formatNumber } from '../lib/format';
import { MAP_CONGESTION_COLORS, MAP_YELLOW } from '../lib/theme';

interface HubPickerModalProps {
  /** Every airport shown on the map. */
  airports: Airport[];
  /** Airports with a level above this are shown but cannot be chosen (rank restriction). */
  maxLevel: number;
  /** Title of the rank that sets the restriction, for the explanation text. */
  rankTitle: string;
  /** Year whose Tourism and Business values are shown. */
  year: number;
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

/** Marker colour by airport level, like the main map. */
function levelColor(level: number): string {
  if (level <= 1) return MAP_CONGESTION_COLORS.low;
  if (level === 2) return MAP_CONGESTION_COLORS.medium;
  return MAP_CONGESTION_COLORS.high;
}

/**
 * World map for choosing the home hub on the new-game screen. Airports above
 * the allowed level are grey and cannot be chosen. Hover or click an airport
 * to see its level and its Tourism and Business demand for the start year.
 */
export function HubPickerModal({ airports, maxLevel, rankTitle, year, selectedId, onSelect, onClose }: HubPickerModalProps) {
  const [pickedId, setPickedId] = useState(selectedId);
  const byId = useMemo(() => new Map(airports.map(a => [a.id, a])), [airports]);
  const picked = byId.get(pickedId);
  const pickedStats = getAirportStats(picked, year);
  const pickedLocked = !!picked && picked.level > maxLevel;
  const lockedCount = useMemo(() => airports.filter(a => a.level > maxLevel).length, [airports, maxLevel]);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-aero-carbon" role="dialog" aria-label="Select hub">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 p-4 short:p-2">
        <h3 className="text-lg font-black italic uppercase tracking-tighter">
          Select <span className="text-aero-yellow">Hub</span>
        </h3>
        <button onClick={onClose} aria-label="Close" className="text-white/50 hover:text-aero-yellow transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="relative flex-1 min-h-0">
        <MapContainer
          center={[30, 10]}
          zoom={2}
          minZoom={2}
          maxZoom={8}
          preferCanvas
          worldCopyJump
          className="w-full h-full"
          style={{ backgroundColor: '#131517' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="&copy; Esri"
          />
          {airports.map(a => {
            const locked = a.level > maxLevel;
            const isPicked = a.id === pickedId;
            const stats = getAirportStats(a, year);
            return (
              <CircleMarker
                key={a.id}
                center={a.coords}
                radius={isPicked ? 9 : 4 + a.level}
                pathOptions={{
                  color: isPicked ? '#fff' : 'black',
                  weight: isPicked ? 3 : 1,
                  fillColor: locked ? '#6b7280' : isPicked ? MAP_YELLOW : levelColor(a.level),
                  fillOpacity: locked ? 0.45 : 0.95
                }}
                eventHandlers={{ click: () => setPickedId(a.id) }}
              >
                <Tooltip>
                  <div className="font-mono text-xs">
                    <div className="font-bold">{a.name} ({a.id})</div>
                    <div>Level {a.level}</div>
                    <div>Tourism: {formatNumber(stats.tourism)}</div>
                    <div>Business: {formatNumber(stats.business)}</div>
                    {locked && <div>Locked: {rankTitle} cannot use this airport</div>}
                  </div>
                </Tooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      <div className="border-t border-white/10 p-4 short:p-2 space-y-3 short:space-y-1">
        {lockedCount > 0 && (
          <p className="text-2xs text-white/50 flex items-center gap-2">
            <Lock size={12} className="shrink-0" />
            Rank restriction: as a {rankTitle} you can start at airports up to level {maxLevel}.
            Grey airports ({lockedCount}) open with a higher rank; Free Mode has no restriction.
          </p>
        )}
        {picked ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="font-mono text-sm">
              <div className="font-bold text-white">{picked.name} ({picked.id}) - Level {picked.level}</div>
              <div className="text-white/70">
                Tourism: <span className="text-aero-yellow">{formatNumber(pickedStats.tourism)}</span>
                {' | '}
                Business: <span className="text-aero-yellow">{formatNumber(pickedStats.business)}</span>
                <span className="text-white/40"> (year {year})</span>
              </div>
              {pickedLocked && <div className="text-aero-warn">Locked at your rank.</div>}
            </div>
            <button
              disabled={pickedLocked}
              onClick={() => { onSelect(picked.id); onClose(); }}
              className="px-6 py-3 short:py-1.5 bg-aero-yellow text-black font-mono text-sm uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Choose as hub
            </button>
          </div>
        ) : (
          <p className="text-sm text-white/60 font-mono">Click an airport on the map.</p>
        )}
      </div>
    </div>
  );
}
