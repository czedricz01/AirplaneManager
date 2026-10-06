import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BASE_DISCOUNT, DEPOSIT_SHARE, MAX_DISCOUNT, MAX_ORDER_SIZE, MAX_POSTPONEMENTS, ORDER_HORIZON, announcedAircraft, cancelRefund,
  createOrder, isLaunchDelivery, normalizeOrders, orderBalance, quoteOrder, settleDeliveries, type PreOrder
} from './preorders';
import { aircraftList } from '../data/aircraft';

const spec = { id: 'x1', basePrice: 50_000_000, firstDeliveryOffset: 400 } as any;

test('only types delivered within the next twelve months can be ordered', () => {
  const offset = 500;
  const list = announcedAircraft(aircraftList, offset);
  assert.ok(list.length > 0, 'something is announced then');
  for (const a of list) {
    assert.ok(a.firstDeliveryOffset > offset && a.firstDeliveryOffset <= offset + ORDER_HORIZON);
  }
  assert.deepEqual(list.map(a => a.firstDeliveryOffset), [...list.map(a => a.firstDeliveryOffset)].sort((a, b) => a - b));
});

test('a bigger order gets a bigger discount, up to a cap, and waits longer', () => {
  const one = quoteOrder(spec, 1);
  const six = quoteOrder(spec, 6);
  const many = quoteOrder(spec, 99);
  assert.equal(one.discount, BASE_DISCOUNT);
  assert.ok(six.discount > one.discount);
  assert.equal(many.quantity, MAX_ORDER_SIZE);
  assert.ok(many.discount <= MAX_DISCOUNT);
  assert.ok(six.deliveryOffset > one.deliveryOffset);
  assert.equal(one.deposit, Math.round(one.total * DEPOSIT_SHARE));
  assert.equal(one.deposit + one.balance, one.total);
  assert.ok(one.total < spec.basePrice);
});

test('an order records what was quoted', () => {
  const order = createOrder(spec, 4, 395, 'o1');
  const quote = quoteOrder(spec, 4);
  assert.equal(order.deposit, quote.deposit);
  assert.equal(order.deliveryOffset, quote.deliveryOffset);
  assert.equal(orderBalance(order), quote.balance);
  assert.equal(cancelRefund(order), Math.round(order.deposit * 0.5));
});

const order = (id: string, deliveryOffset: number, over: Partial<PreOrder> = {}): PreOrder =>
  ({ id, aircraftId: 'x1', quantity: 2, placedOffset: 380, deliveryOffset, unitPrice: 10_000_000, deposit: 4_000_000, postponed: 0, ...over });

test('an order is delivered and paid for in the month it falls due', () => {
  const r = settleDeliveries([order('a', 405), order('b', 420)], 405, 100_000_000);
  assert.deepEqual(r.delivered.map(o => o.id), ['a']);
  assert.equal(r.charged, 16_000_000);
  assert.deepEqual(r.remaining.map(o => o.id), ['b']);
});

test('without the cash a delivery slips a month, then is cancelled after the third slip', () => {
  let book = [order('a', 405)];
  for (let n = 1; n <= MAX_POSTPONEMENTS; n++) {
    const r = settleDeliveries(book, 404 + n, 1);
    assert.equal(r.delivered.length, 0);
    assert.equal(r.postponed.length, 1, `slip ${n}`);
    assert.equal(r.remaining[0].postponed, n);
    assert.equal(r.remaining[0].deliveryOffset, 405 + n);
    book = r.remaining;
  }
  const last = settleDeliveries(book, 404 + MAX_POSTPONEMENTS + 1, 1);
  assert.equal(last.cancelled.length, 1);
  assert.equal(last.remaining.length, 0);
});

test('orders are paid oldest first, and one that cannot be paid does not block the next', () => {
  const r = settleDeliveries([order('big', 405, { unitPrice: 90_000_000 }), order('small', 405, { placedOffset: 390 })], 405, 20_000_000);
  assert.deepEqual(r.delivered.map(o => o.id), ['small']);
  assert.equal(r.postponed[0].id, 'big');
});

test('launch customers are those delivered within a year of the first delivery', () => {
  assert.equal(isLaunchDelivery(spec, 405), true);
  assert.equal(isLaunchDelivery(spec, 412), true);
  assert.equal(isLaunchDelivery(spec, 413), false);
});

test('a saved order book keeps good orders and drops the rest', () => {
  const good = order('a', 405);
  const book = normalizeOrders([good, { id: 'b', aircraftId: 'ghost', quantity: 1, deliveryOffset: 5, unitPrice: 1 }, null, { id: 'c' }], id => id === 'x1');
  assert.deepEqual(book, [good]);
  assert.deepEqual(normalizeOrders('x', () => true), []);
});
