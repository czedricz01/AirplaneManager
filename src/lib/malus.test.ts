import test from 'node:test';
import assert from 'node:assert/strict';

import { hadOneTimeMalus } from './malus';

test('a month with a disruption or a running strike had bad luck, others did not', () => {
  const calm = { strike: null };
  const disruption = { id: 'd', kind: 'technical' as const, offset: 10, routeIds: ['r1'], cancelShare: 0.25 };
  assert.equal(hadOneTimeMalus([], calm, 10), false);
  assert.equal(hadOneTimeMalus([disruption], calm, 10), true);
  assert.equal(hadOneTimeMalus([disruption], calm, 11), false);
  assert.equal(hadOneTimeMalus([], { strike: { startOffset: 10, cancelShare: 1 } }, 10), true);
});
