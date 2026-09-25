import test from 'node:test';
import assert from 'node:assert/strict';

import { brandInitials, BRAND_ICONS } from './BrandBadge';

test('the badge shows the airline code, else the initials of the name', () => {
  assert.equal(brandInitials('nx', 'Neo Airlines'), 'NX');
  assert.equal(brandInitials('', 'neo sky airways'), 'NS');
  assert.equal(brandInitials('  ', ''), '');
});

test('every badge icon is a component', () => {
  assert.deepEqual(Object.keys(BRAND_ICONS), ['plane', 'globe', 'star', 'bird', 'crown']);
  for (const Icon of Object.values(BRAND_ICONS)) assert.ok(Icon);
});
