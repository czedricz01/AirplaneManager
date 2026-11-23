import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeOrders, type PreOrder } from './preorders';

const order = (id: string, deliveryOffset: number, over: Partial<PreOrder> = {}): PreOrder =>
  ({ id, aircraftId: 'x1', quantity: 2, placedOffset: 380, deliveryOffset, unitPrice: 10_000_000, deposit: 4_000_000, postponed: 0, ...over });

test('a saved order book keeps good orders and drops the rest', () => {
  const good = order('a', 405);
  const book = normalizeOrders([good, { id: 'b', aircraftId: 'ghost', quantity: 1, deliveryOffset: 5, unitPrice: 1 }, null, { id: 'c' }], id => id === 'x1');
  assert.deepEqual(book, [good]);
  assert.deepEqual(normalizeOrders('x', () => true), []);
});
