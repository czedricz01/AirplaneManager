import { useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { Panel } from './ui/Panel';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { aircraftList, type Aircraft } from '../data/aircraft';
import { classGateMessage, type AircraftClassId } from '../lib/aircraftClasses';
import {
  ORDER_HORIZON, announcedAircraft, cancelRefund, orderBalance, quoteOrder, MAX_ORDER_SIZE, type PreOrder
} from '../lib/preorders';
import { usedListings, type UsedListing } from '../lib/usedMarket';
import { formatCurrency, formatMonthOffset, formatNumber } from '../lib/format';

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
  /** Rival names, for the "ex-" in a used listing. */
  rivalNames: string[];
  onOrder: (aircraft: Aircraft, quantity: number) => void;
  onCancelOrder: (orderId: string) => void;
  onBuyUsed: (listing: UsedListing) => void;
}

const byId = new Map(aircraftList.map(a => [a.id, a]));
const name = (a: Aircraft) => `${a.manufacturer} ${a.type}`;

function OrdersTab({ currentDateOffset, capital, classesOpen, orders, onOrder, onCancelOrder }: AircraftMarketPanelProps) {
  const announced = useMemo(() => announcedAircraft(aircraftList, currentDateOffset), [currentDateOffset]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-2xs uppercase tracking-label text-muted font-semibold">Order book</span>
          <span className="text-2xs font-mono text-muted">{orders.length} open order{orders.length === 1 ? '' : 's'}</span>
        </div>
        {orders.length === 0 ? (
          <p className="text-2xs font-mono text-muted leading-relaxed max-w-2xl">
            No open orders. Types announced for the next {ORDER_HORIZON} months can be ordered ahead of delivery: a fifth up front,
            a discount that grows with the size of the order, and the balance when the aircraft arrive. Without the cash on delivery
            the aircraft slips a month, up to three times; after that the order is cancelled and the deposit is gone.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {orders.map(o => {
              const spec = byId.get(o.aircraftId);
              if (!spec) return null;
              return (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 border border-line bg-surface px-3 py-2 rounded-sm">
                  <div className="font-mono text-2xs leading-relaxed">
                    <div className="font-semibold text-xs">{o.quantity} &times; {name(spec)}</div>
                    <div className="text-muted">
                      Delivery {formatMonthOffset(o.deliveryOffset)}{o.postponed > 0 && <span className="text-bad"> (slipped {o.postponed}&times;, cash was short)</span>}
                      {' · '}balance due {formatCurrency(orderBalance(o))}
                    </div>
                  </div>
                  <Button variant="danger" onClick={() => onCancelOrder(o.id)}>
                    Cancel · refund {formatCurrency(cancelRefund(o))}
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
          <span className="text-2xs font-mono text-muted">first deliveries within {ORDER_HORIZON} months</span>
        </div>
        {announced.length === 0 ? (
          <p className="text-2xs font-mono text-muted">Nothing is announced for the coming year.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {announced.map(a => {
              const qty = quantities[a.id] ?? 1;
              const quote = quoteOrder(a, qty);
              const gate = classGateMessage(a, classesOpen);
              const affordable = capital >= quote.deposit;
              return (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 border border-line bg-surface px-3 py-2 rounded-sm">
                  <div className="font-mono text-2xs leading-relaxed min-w-0">
                    <div className="font-semibold text-xs">{name(a)} <Badge>{a.class}</Badge></div>
                    <div className="text-muted">
                      {a.capacity} seats · {formatNumber(a.maxRange)} km · first delivery {formatMonthOffset(a.firstDeliveryOffset)}
                    </div>
                    <div className="text-muted">
                      {formatCurrency(quote.unitPrice)} each (&minus;{Math.round(quote.discount * 100)}%) · deposit {formatCurrency(quote.deposit)} · your delivery {formatMonthOffset(quote.deliveryOffset)}
                    </div>
                    {gate && <div className="text-bad flex items-center gap-1 mt-1"><Lock size={11} aria-hidden="true" /> {gate}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-2xs font-label uppercase tracking-label text-muted flex items-center gap-1">
                      Qty
                      <input
                        type="number"
                        min={1}
                        max={MAX_ORDER_SIZE}
                        value={qty}
                        onChange={e => setQuantities(prev => ({ ...prev, [a.id]: Math.max(1, Math.min(MAX_ORDER_SIZE, Number(e.target.value) || 1)) }))}
                        className="w-14 bg-ground/40 border border-line rounded-sm px-2 py-1 text-xs font-mono"
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
        <p className="text-2xs font-mono text-muted mt-3 leading-relaxed">
          Orders arrive with the standard economy cabin; refit them afterwards. A launch customer's aircraft are the talk of the
          industry: popularity +5 for two years.
        </p>
      </Panel>
    </div>
  );
}

function UsedTab({ currentDateOffset, capital, classesOpen, soldUsedIds, rivalNames, onBuyUsed }: AircraftMarketPanelProps) {
  const listings = useMemo(() => usedListings(aircraftList, currentDateOffset, rivalNames), [currentDateOffset, rivalNames]);
  return (
    <Panel>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-2xs uppercase tracking-label text-muted font-semibold">Used market</span>
        <span className="text-2xs font-mono text-muted">new listings every month</span>
      </div>
      {listings.length === 0 ? (
        <p className="text-2xs font-mono text-muted">The market has nothing second-hand yet: the first jets are still new.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {listings.map(l => {
            const spec = byId.get(l.aircraftId);
            if (!spec) return null;
            const sold = soldUsedIds.includes(l.id);
            const gate = classGateMessage(spec, classesOpen);
            const years = l.ageMonths / 12;
            return (
              <li key={l.id} className={`flex flex-wrap items-center justify-between gap-3 border border-line px-3 py-2 rounded-sm ${sold ? 'opacity-40' : 'bg-surface'}`}>
                <div className="font-mono text-2xs leading-relaxed min-w-0">
                  <div className="font-semibold text-xs">{name(spec)} <Badge>{spec.class}</Badge></div>
                  <div className="text-muted">
                    {years.toFixed(1)} years old · airframe {l.conditionGeneral}% · cabin {l.conditionInterior}% · {spec.capacity} seats · {formatNumber(spec.maxRange)} km
                  </div>
                  <div className="text-muted">
                    Sold by {l.seller}
                    {spec.lastDeliveryOffset !== null && spec.lastDeliveryOffset < currentDateOffset && <span className="text-accent"> · out of production</span>}
                    {' · '}new price {formatCurrency(spec.basePrice)}
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
      <p className="text-2xs font-mono text-muted mt-3 leading-relaxed">
        Cheaper than new, but worn: older aircraft cost more to maintain, fetch less when sold and are less liked by passengers.
        They arrive with the standard economy cabin.
      </p>
    </Panel>
  );
}

/** The order book and the used market, shown in place of the shop's list of new aircraft. */
export function AircraftMarketPanel(props: AircraftMarketPanelProps) {
  return props.tab === 'orders' ? <OrdersTab {...props} /> : <UsedTab {...props} />;
}
