import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeSegmentCount, getRoutePath, ROUTE_PATH_SEGMENTS } from './geoUtils';
import type { Airport } from '../data/airportTypes';

const FRA: [number, number] = [50.03, 8.57];
const CDG: [number, number] = [49.01, 2.55];
const SYD: [number, number] = [-33.95, 151.18];

test('short routes are drawn with fewer points than long ones', () => {
  const short = routeSegmentCount(FRA, CDG); // ~450 km
  assert.ok(short < 10, `FRA-CDG got ${short} segments`);
  assert.equal(routeSegmentCount(FRA, SYD), ROUTE_PATH_SEGMENTS);
});

test('an airport pair at the same place still gets the minimum', () => {
  assert.equal(routeSegmentCount(FRA, FRA), 8);
});

test('the drawn path still starts and ends at the airports', () => {
  const a = { id: 'T1', coords: FRA } as Airport;
  const b = { id: 'T2', coords: CDG } as Airport;
  const path = getRoutePath(a, b, 360);
  assert.equal(path.length, routeSegmentCount(FRA, CDG) + 1);
  assert.deepEqual(path[0].map(v => +v.toFixed(6)), [FRA[0], FRA[1] + 360]);
  assert.deepEqual(path[path.length - 1].map(v => +v.toFixed(6)), [CDG[0], CDG[1] + 360]);
});
