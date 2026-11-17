import test from 'node:test';
import assert from 'node:assert/strict';

import { aircraftImageStem, getAircraftImageCandidates } from './imageUtils';

const bundled = { airbus_a220_100: '/assets/airbus_a220_100-abc.webp' };

test('the bundled picture is found by the full aircraft name', () => {
  assert.deepEqual(
    getAircraftImageCandidates('Airbus A220-100', 'Airbus', 'A220-100', undefined, bundled),
    [bundled.airbus_a220_100]
  );
});

test('an uploaded picture comes before the bundled one', () => {
  const uploaded = { airbus_a220_100: '/PlanePics/airbus_a220_100/image.png' };
  assert.deepEqual(
    getAircraftImageCandidates('Airbus A220-100', 'Airbus', 'A220-100', uploaded, bundled),
    [uploaded.airbus_a220_100, bundled.airbus_a220_100]
  );
});

test('an aircraft without a picture gets no URLs, so no request is made', () => {
  assert.deepEqual(getAircraftImageCandidates('Unknown X-1', 'Unknown', 'X-1', undefined, bundled), []);
});

test('aircraftImageStem matches the file names in src/assets/planes', () => {
  assert.equal(aircraftImageStem('Airbus A220-100'), 'airbus_a220_100');
  assert.equal(aircraftImageStem('Aerospatiale BAC Concorde'), 'aerospatiale_bac_concorde');
  assert.equal(aircraftImageStem('De Havilland Canada Dash 8-400 (Q400)'), 'de_havilland_canada_dash_8_400_q400');
});
