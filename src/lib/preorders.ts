
/** The most aircraft one order may hold. */
export const MAX_ORDER_SIZE = 12;

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
