/**
 * The order book: buying an aircraft before it is delivered.
 *
 * New types are announced up to a year ahead (the January forecast). Until now
 * they could only be bought once they were on the market. Now the player can
 * order them: a fifth up front, a discount that grows with the size of the
 * order, and delivery after the first aircraft are due plus a wait that grows
 * with the order. The balance falls due on delivery; without the cash the
 * delivery slips by a month, three times, and then the order is cancelled and
 * the deposit lost. A launch customer's aircraft are fashionable for two years.
 *
 * Everything here is pure.
 */
import type { Aircraft } from '../data/aircraft';

/** How far ahead of its first delivery an aircraft can be ordered, in months. */
export const ORDER_HORIZON = 12;
/** Share of the price paid when the order is placed. */
export const DEPOSIT_SHARE = 0.2;
/** Discount on the list price: this much for any order, and more per extra aircraft up to the cap. */
export const BASE_DISCOUNT = 0.12;
export const DISCOUNT_PER_EXTRA = 0.01;
export const MAX_DISCOUNT = 0.2;
/** The most aircraft one order may hold. */
export const MAX_ORDER_SIZE = 12;
/** Months a delivery can slip for want of cash before the order is cancelled. */
export const MAX_POSTPONEMENTS = 3;
/** Share of the deposit given back when the player cancels an order. */
export const CANCEL_REFUND = 0.5;
/** Launch customers: popularity points and the months they last. */
export const LAUNCH_BONUS = 5;
export const LAUNCH_BONUS_MONTHS = 24;
/** A delivery within this many months of the type's first delivery counts as a launch customer's. */
export const LAUNCH_WINDOW_MONTHS = 12;

export interface PreOrder {
  id: string;
  aircraftId: string;
  quantity: number;
  placedOffset: number;
  /** The month the aircraft arrive, unless slipped. */
  deliveryOffset: number;
  /** Price per aircraft after the discount. */
  unitPrice: number;
  /** Paid when the order was placed. */
  deposit: number;
  postponed: number;
}

/** Aircraft that can be ordered at `offset`: first delivery ahead of it, but within a year. */
export function announcedAircraft(list: readonly Aircraft[], offset: number): Aircraft[] {
  return list
    .filter(a => a.firstDeliveryOffset > offset && a.firstDeliveryOffset <= offset + ORDER_HORIZON)
    .sort((a, b) => a.firstDeliveryOffset - b.firstDeliveryOffset);
}

export interface OrderQuote {
  quantity: number;
  discount: number;
  unitPrice: number;
  total: number;
  deposit: number;
  balance: number;
  deliveryOffset: number;
}

/** What an order of `quantity` aircraft of a type costs and when it arrives. */
export function quoteOrder(aircraft: Pick<Aircraft, 'basePrice' | 'firstDeliveryOffset'>, quantity: number): OrderQuote {
  const q = Math.max(1, Math.min(MAX_ORDER_SIZE, Math.round(quantity)));
  const discount = Math.min(MAX_DISCOUNT, BASE_DISCOUNT + DISCOUNT_PER_EXTRA * (q - 1));
  const unitPrice = Math.round(aircraft.basePrice * (1 - discount));
  const total = unitPrice * q;
  const deposit = Math.round(total * DEPOSIT_SHARE);
  // The line is full for a while: a big order waits longer for its aircraft.
  const wait = 1 + Math.floor(q / 3);
  return { quantity: q, discount, unitPrice, total, deposit, balance: total - deposit, deliveryOffset: aircraft.firstDeliveryOffset + wait };
}

/** A new order, the deposit already known. */
export function createOrder(aircraft: Aircraft, quantity: number, offset: number, id: string): PreOrder {
  const quote = quoteOrder(aircraft, quantity);
  return {
    id,
    aircraftId: aircraft.id,
    quantity: quote.quantity,
    placedOffset: offset,
    deliveryOffset: quote.deliveryOffset,
    unitPrice: quote.unitPrice,
    deposit: quote.deposit,
    postponed: 0
  };
}

/** What is still to pay on an order at delivery. */
export function orderBalance(order: PreOrder): number {
  return order.unitPrice * order.quantity - order.deposit;
}

/** What the player gets back for cancelling an order. */
export function cancelRefund(order: PreOrder): number {
  return Math.round(order.deposit * CANCEL_REFUND);
}

export interface DeliveryResult {
  /** Orders delivered this month, in order. */
  delivered: PreOrder[];
  /** Orders that could not be paid for and slip a month. */
  postponed: PreOrder[];
  /** Orders given up after too many slips: the deposit is gone. */
  cancelled: PreOrder[];
  /** The book after this month. */
  remaining: PreOrder[];
  /** Balances paid for the delivered orders. */
  charged: number;
}

/**
 * What happens to the order book when the month at `offset` begins. Orders due
 * are paid for out of `cash`, oldest first; one that cannot be paid slips.
 */
export function settleDeliveries(orders: readonly PreOrder[], offset: number, cash: number): DeliveryResult {
  const delivered: PreOrder[] = [];
  const postponed: PreOrder[] = [];
  const cancelled: PreOrder[] = [];
  const remaining: PreOrder[] = [];
  let available = cash;
  let charged = 0;
  const due = orders.filter(o => o.deliveryOffset <= offset).sort((a, b) => a.deliveryOffset - b.deliveryOffset || a.placedOffset - b.placedOffset);
  const dueIds = new Set(due.map(o => o.id));
  for (const order of orders) if (!dueIds.has(order.id)) remaining.push(order);
  for (const order of due) {
    const balance = orderBalance(order);
    if (available >= balance) {
      available -= balance;
      charged += balance;
      delivered.push(order);
    } else if (order.postponed >= MAX_POSTPONEMENTS) {
      cancelled.push(order);
    } else {
      const slipped = { ...order, deliveryOffset: offset + 1, postponed: order.postponed + 1 };
      postponed.push(slipped);
      remaining.push(slipped);
    }
  }
  return { delivered, postponed, cancelled, remaining, charged };
}

/** Whether an aircraft delivered at `offset` makes its buyer a launch customer. */
export function isLaunchDelivery(aircraft: Pick<Aircraft, 'firstDeliveryOffset'>, offset: number): boolean {
  return offset - aircraft.firstDeliveryOffset <= LAUNCH_WINDOW_MONTHS;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** The saved order book, with anything unusable dropped. */
export function normalizeOrders(raw: unknown, knownAircraft: (id: string) => boolean): PreOrder[] {
  if (!Array.isArray(raw)) return [];
  const out: PreOrder[] = [];
  for (const o of raw) {
    if (!o || typeof o !== 'object') continue;
    const r = o as Record<string, unknown>;
    if (typeof r.id !== 'string' || typeof r.aircraftId !== 'string' || !knownAircraft(r.aircraftId)) continue;
    if (!isNum(r.quantity) || !isNum(r.deliveryOffset) || !isNum(r.unitPrice)) continue;
    out.push({
      id: r.id,
      aircraftId: r.aircraftId,
      quantity: Math.max(1, Math.min(MAX_ORDER_SIZE, Math.round(r.quantity))),
      placedOffset: isNum(r.placedOffset) ? Math.round(r.placedOffset) : 0,
      deliveryOffset: Math.round(r.deliveryOffset),
      unitPrice: Math.max(0, Math.round(r.unitPrice)),
      deposit: isNum(r.deposit) ? Math.max(0, Math.round(r.deposit)) : 0,
      postponed: isNum(r.postponed) ? Math.max(0, Math.round(r.postponed)) : 0
    });
  }
  return out;
}
