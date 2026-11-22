import { useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { Panel } from './ui/Panel';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { aircraftList, type Aircraft } from '../data/aircraft';
import { classGateMessage, type AircraftClassId } from '../lib/aircraftClasses';
import type { PreOrder } from '../lib/preorders';
import {
  preorderableTypes, preorderFigures, preorderQuote, resoldSellerCode, usedMarket, type UsedListing
} from '../lib/modelFleet';
import { formatCurrency, formatMonthOffset, formatNumber } from '../lib/format';
import {
  CABIN_CLASSES, DEALER_SPREAD_BUY, LAUNCH_BONUS, LAUNCH_BONUS_MONTHS, LAUNCH_WINDOW_MONTHS, PREORDER_DEPOSIT_SHARE,
  PREORDER_MAX, PREORDER_MAX_DELAYS, PREORDER_REFUND_SHARE, PREORDER_WINDOW_MONTHS, USED_RESOLD_MONTHS
} from '../model/constants';
import type { ResoldPlane } from '../model/monthClose';

export type MarketTab = 'orders' | 'used';

export interface AircraftMarketPanelProps {
  tab: MarketTab;
  currentDateOffset: number;
  capital: number;
  /** The aircraft classes the airline has developed (or flies). */
  classesOpen: ReadonlySet<AircraftClassId>;
  orders: PreOrder[];
  /** Used listings already bought this month. */
  soldUsedIds: string[];
  /** Aircraft sold to the market in the last months (model `world.resold`, 8.11). */
  resold: readonly ResoldPlane[];
  /** Finished research, for the figures of a listing (efficiency, sale value). */
  completedResearch: readonly string[];
  /** Rival names by code, for the seller of a resold aircraft. */
  rivalNameByCode: Readonly<Record<string, string>>;
  onOrder: (aircraft: Aircraft, quantity: number) => void;
  onCancelOrder: (orderId: string) => void;
  onBuyUsed: (listing: UsedListing) => void;
}

const byId = new Map(aircraftList.map(a => [a.id, a]));
const name = (a: Aircraft) => `${a.manufacturer} ${a.type}`;
const pct = (share: number) => `${Math.round(share * 100)}%`;
const SHARE_WORDS: Record<number, string> = { 0.2: 'a fifth', 0.25: 'a quarter', 0.5: 'half' };

function OrdersTab({ currentDateOffset, capital, classesOpen, orders, onOrder, onCancelOrder }: AircraftMarketPanelProps) {
  const announced = useMemo(() => preorderableTypes(currentDateOffset), [currentDateOffset]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-2xs uppercase tracking-label text-muted font-semibold">Order book</span>
          <span className="text-2xs font-mono text-muted">{orders.length} open order{orders.length === 1 ? '' : 's'}</span>
        </div>
        {orders.length === 0 ? (
          <p className="text-2xs text-muted leading-relaxed max-w-2xl">
            No open orders. Types announced for the next {PREORDER_WINDOW_MONTHS} months can be ordered ahead of delivery:{' '}
            {SHARE_WORDS[PREORDER_DEPOSIT_SHARE] ?? pct(PREORDER_DEPOSIT_SHARE)} up front, a discount that grows with the size of the
            order, and the balance when the aircraft arrive, at the prices of the delivery month. Without the cash on delivery
            the aircraft slips a month, up to {PREORDER_MAX_DELAYS} times; after that the order is cancelled and the deposit is gone.
            Cancelling yourself returns {pct(PREORDER_REFUND_SHARE)} of the deposit.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {orders.map(o => {
              const spec = byId.get(o.aircraftId);
              if (!spec) return null;
              const figures = preorderFigures(o);
              return (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 border border-line bg-surface px-3 py-2 rounded-sm">
                  <div className="text-2xs leading-relaxed">
                    <div className="font-semibold text-xs">{o.quantity} &times; {name(spec)}</div>
                    <div className="text-muted">
                      Delivery {formatMonthOffset(o.deliveryOffset)}{o.postponed > 0 && <span className="text-bad"> (slipped {o.postponed}&times;, cash was short)</span>}
                      {' · '}balance due {formatCurrency(figures.balance)}
                    </div>
                  </div>
                  <Button variant="danger" onClick={() => onCancelOrder(o.id)}>
                    Cancel · refund {formatCurrency(figures.refund)}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-2xs uppercase tracking-label text-muted font-semibold">Announced</span>
          <span className="text-2xs text-muted">first deliveries within {PREORDER_WINDOW_MONTHS} months</span>
        </div>
        {announced.length === 0 ? (
          <p className="text-2xs text-muted">Nothing is announced for the coming year.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {announced.map(a => {
              const qty = quantities[a.id] ?? 1;
              const quote = preorderQuote(a, qty, currentDateOffset);
              const gate = classGateMessage(a, classesOpen);
              const affordable = capital >= quote.deposit;
              return (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 border border-line bg-surface px-3 py-2 rounded-sm">
                  <div className="text-2xs leading-relaxed min-w-0">
                    <div className="font-semibold text-xs">{name(a)} <Badge>{a.class}</Badge></div>
                    <div className="text-muted">
                      {a.capacity} seats · {formatNumber(a.maxRange)} km · first delivery {formatMonthOffset(a.firstDeliveryOffset)}
                    </div>
                    <div className="text-muted">
                      {formatCurrency(quote.unitPrice)} each (&minus;{Math.round(quote.discount * 100)}%) · deposit {formatCurrency(quote.deposit)} · your delivery {formatMonthOffset(quote.deliveryMonth)}
                    </div>
                    {gate && <div className="text-bad flex items-center gap-1 mt-1"><Lock size={11} aria-hidden="true" /> {gate}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-2xs font-label uppercase tracking-label text-muted flex items-center gap-1">
                      Qty
                      <input
                        type="number"
                        min={1}
                        max={PREORDER_MAX}
                        value={qty}
                        onChange={e => setQuantities(prev => ({ ...prev, [a.id]: Math.max(1, Math.min(PREORDER_MAX, Number(e.target.value) || 1)) }))}
                        className="w-14 bg-ground/40 border border-line rounded-sm px-2 py-1 text-xs"
                      />
                    </label>
                    <Button variant="primary" disabled={!!gate || !affordable} onClick={() => onOrder(a, qty)}>
                      {gate ? 'Locked' : affordable ? 'Order' : 'No cash'}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-2xs text-muted mt-3 leading-relaxed">
          Orders arrive with the standard economy cabin; refit them afterwards. Aircraft delivered within {LAUNCH_WINDOW_MONTHS} months
          of the type's first delivery are a launch customer's: type appeal +{LAUNCH_BONUS} for {LAUNCH_BONUS_MONTHS} months.
        </p>
      </Panel>
    </div>
  );
}

/** Who sold a listing: the market for a new offer, otherwise the rival (by its code) or the player. */
function sellerOf(l: UsedListing, rivalNameByCode: Readonly<Record<string, string>>): string {
  if (l.source === 'offer') return 'a leasing company';
  const code = resoldSellerCode(l.planeId);
  if (code === null) return 'your airline';
  return rivalNameByCode[code] ? `ex-${rivalNameByCode[code]}` : 'a rival airline';
}

/** Seats of a listing's cabin, as F / C / W / Y. */
const seatLine = (l: UsedListing) =>
  [...CABIN_CLASSES].reverse().map(c => l.figures.seats[c] ?? 0).join(' / ');

function UsedTab({ currentDateOffset, capital, classesOpen, soldUsedIds, resold, completedResearch, rivalNameByCode, onBuyUsed }: AircraftMarketPanelProps) {
  const listings = useMemo(
    () => usedMarket(currentDateOffset, resold, completedResearch),
    [currentDateOffset, resold, completedResearch]
  );
  return (
    <Panel>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-2xs uppercase tracking-label text-muted font-semibold">Used market</span>
        <span className="text-2xs text-muted">new listings every month</span>
      </div>
      {listings.length === 0 ? (
        <p className="text-2xs text-muted">The market has nothing second-hand yet: the first jets are still new.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {listings.map(l => {
            const spec = byId.get(l.typeId);
            if (!spec) return null;
            const sold = soldUsedIds.includes(l.id);
            const gate = classGateMessage(spec, classesOpen);
            return (
              <li key={l.id} className={`flex flex-wrap items-center justify-between gap-3 border border-line px-3 py-2 rounded-sm ${sold ? 'opacity-40' : 'bg-surface'}`}>
                <div className="text-2xs leading-relaxed min-w-0">
                  <div className="font-semibold text-xs">{name(spec)} <Badge>{spec.class}</Badge></div>
                  <div className="text-muted">
                    {l.figures.ageYears.toFixed(1)} years old · airframe {Math.round(l.airframeCondition)}% · cabin {Math.round(l.cabinCondition)}% · {formatNumber(spec.maxRange)} km
                  </div>
                  <div className="text-muted">
                    Seats {seatLine(l)} (F / C / W / Y) · type appeal {Math.round(l.figures.typeAppeal)} · cabin rating (avg.) {Math.round(l.figures.averageCabinRating)}
                    {!l.exactCabin && <span> · fittings reset to standard</span>}
                  </div>
                  <div className="text-muted">
                    Sold by {sellerOf(l, rivalNameByCode)}
                    {spec.lastDeliveryOffset !== null && spec.lastDeliveryOffset < currentDateOffset && <span className="text-accent"> · out of production</span>}
                    {' · '}new price {formatCurrency(l.newPrice)}
                  </div>
                  {gate && <div className="text-bad flex items-center gap-1 mt-1"><Lock size={11} aria-hidden="true" /> {gate}</div>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-semibold text-sm">{formatCurrency(l.price)}</span>
                  <Button variant="primary" disabled={sold || !!gate || capital < l.price} onClick={() => onBuyUsed(l)}>
                    {sold ? 'Sold' : gate ? 'Locked' : capital < l.price ? 'No cash' : 'Buy'}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-2xs text-muted mt-3 leading-relaxed">
        The price is the aircraft's value plus the dealer's {pct(DEALER_SPREAD_BUY)}; its value falls with age and wear.
        New listings arrive with the standard economy cabin. Aircraft sold to the market by you or a rival stay
        listed for {USED_RESOLD_MONTHS} months with their own cabin. Older aircraft cost more to maintain and are less liked by passengers.
      </p>
    </Panel>
  );
}

/** The order book and the used market, shown in place of the shop's list of new aircraft. */
export function AircraftMarketPanel(props: AircraftMarketPanelProps) {
  return props.tab === 'orders' ? <OrdersTab {...props} /> : <UsedTab {...props} />;
}
