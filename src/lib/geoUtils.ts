import { Airport } from '../data/airportTypes';

/**
 * Great-circle paths for drawing routes.
 *
 * This existed twice, byte for byte: once in App and once in LiveTraffic, each
 * with its own cache and each keyed differently -- App on origin>dest@offset,
 * LiveTraffic on origin>dest alone. Both used 100 segments, so the same path was
 * computed twice and stored in two maps that never saw each other.
 */
export const ROUTE_PATH_SEGMENTS = 100;

export function getGreatCirclePoints(start: [number, number], end: [number, number], segments = 150): [number, number][] {
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

/**
 * Cached polyline for an airport pair on a given world copy.
 *
 * A route's great circle never changes, but this used to be recomputed — 101
 * trigonometric points per route per world copy — on every single render of App,
 * which happens on any capital, message or zoom change.
 */
const routePathCache = new Map<string, [number, number][]>();

export function getRoutePath(a1: Airport, a2: Airport, offset: number): [number, number][] {
  const key = `${a1.id}>${a2.id}@${offset}`;
  const cached = routePathCache.get(key);
  if (cached) return cached;

  const points = getGreatCirclePoints(a1.coords, a2.coords, ROUTE_PATH_SEGMENTS)
    .map(p => [p[0], p[1] + offset] as [number, number]);
  routePathCache.set(key, points);
  return points;
}
