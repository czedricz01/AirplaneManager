import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

/**
 * The explain-this-term affordance.
 *
 * This started life as a local `SeatInfoTooltip` inside ConfigurePurchaseView,
 * where it was the only place in the game that explained anything. Everywhere
 * else the interface showed a bare number or an abbreviation -- SAT, BE75, L4,
 * Max ICAO Code -- and left the player to guess. Lifting it here lets the same
 * affordance carry the terms the simulation actually prices with.
 *
 * Unlike the original it is reachable by keyboard: a native `title` attribute
 * never appears on focus, which made it the wrong mechanism for anything
 * load-bearing.
 */
export const InfoTooltip = ({
  title,
  desc,
  hidden,
  size = 14,
}: {
  title: string;
  desc?: string;
  hidden?: boolean;
  size?: number;
}) => {
  const [pos, setPos] = useState({ x: 0, y: 0, show: false });
  const ref = useRef<HTMLButtonElement>(null);

  if (hidden) return null;

  const showAt = (x: number, y: number) => setPos({ x: x + 10, y: y + 10, show: true });
  const hide = () => setPos(p => ({ ...p, show: false }));

  // Keyboard users have no pointer position, so anchor to the icon itself.
  const showAtIcon = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) showAt(r.left, r.bottom);
  };

  return (
    <button
      ref={ref}
      type="button"
      aria-label={`What is ${title}?`}
      className="inline-flex items-center ml-2 cursor-help align-middle bg-transparent border-0 p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-aero-yellow"
      onMouseEnter={e => showAt(e.clientX, e.clientY)}
      onMouseMove={e => showAt(e.clientX, e.clientY)}
      onMouseLeave={hide}
      onFocus={showAtIcon}
      onBlur={hide}
      onClick={e => {
        e.preventDefault();
        e.stopPropagation();
        pos.show ? hide() : showAtIcon();
      }}
      onKeyDown={e => {
        if (e.key === 'Escape') hide();
      }}
    >
      <Info size={size} className="text-white/40 hover:text-aero-yellow transition-colors" />
      {pos.show &&
        createPortal(
          <div
            role="tooltip"
            className="fixed z-[999999] flex flex-col bg-aero-panel border border-white/20 p-3 rounded-sm shadow-2xl w-[250px] pointer-events-none"
            style={{
              top: pos.y > window.innerHeight - 160 ? Math.max(8, pos.y - 170) : pos.y,
              // Clamped: on a phone, flipping 280px to the left of the icon would
              // otherwise start the tooltip off the screen.
              left: pos.x > window.innerWidth - 260 ? Math.max(8, pos.x - 280) : pos.x,
            }}
          >
            <span className="font-mono text-xs text-aero-yellow font-bold uppercase tracking-widest leading-tight mb-1">
              {title}
            </span>
            {desc && (
              <span className="text-2xs text-white/70 whitespace-pre-wrap leading-relaxed">{desc}</span>
            )}
          </div>,
          document.body
        )}
    </button>
  );
};

/**
 * The terms the game prices with, in one place so the wording cannot drift
 * between the screens that use them. Each entry says what the number is, which
 * way is better, and -- where it matters -- what it costs you to ignore.
 */
export const GLOSSARY: Record<string, { title: string; desc: string }> = {
  sat: {
    title: 'SAT (Satisfaction)',
    desc:
      'How well this cabin meets what passengers expect for the class and the length of the flight.\n\n' +
      '100% means you met expectations exactly. Above that, passengers tolerate a higher fare; below it, they will only book at a discount.\n\n' +
      'It comes from the aircraft and its interior condition, the extras fitted, and the catering, service and airport facilities you pay for. Expectations rise with flight length, so the same cabin scores lower on a long haul.',
  },
  loadFactor: {
    title: 'Load Factor (LF)',
    desc:
      'The share of your seats that are actually filled.\n\n' +
      'It is the link between price and profit: a high fare on a half-empty aircraft can earn less than a low fare on a full one.',
  },
  breakEven: {
    title: 'Break-even price',
    desc:
      'The fare at which this route covers its costs exactly, at a given load factor.\n\n' +
      'The left end of the slider is break-even if you fill 99% of seats — the cheapest fare that could ever work. The right end is break-even at 35% — what you would have to charge if the aircraft flew nearly empty.\n\n' +
      'The marked point is break-even at 75%, a realistic full-year average. Price below it and you are betting on filling more seats than that.',
  },
  timeClass: {
    title: 'Time-Class',
    desc:
      'A flight-length bucket from 1 (under an hour) to 8 (over twelve hours). It is not a cabin class.\n\n' +
      'It drives three things: how many passengers the route generates (short hops generate far more), how many meals a cabin must serve, and how demanding passengers are — expectations rise 15% per class.',
  },
  icaoCode: {
    title: 'Max ICAO Code',
    desc:
      'The largest aircraft this airport can physically handle, A (smallest) through F (largest).\n\n' +
      'It is a hard gate: an aircraft with a bigger code will not appear in the route planner for this airport at all. A regional turboprop is around B or C, a narrowbody C, a widebody D or E, and F is reserved for the very largest types.',
  },
  airportLevel: {
    title: 'Airport Level (L1-L7)',
    desc:
      'The size of the airport itself, which you cannot change.\n\n' +
      'It sets how many slots exist in total (300 per level, shared with every other airline here), what landing and handling fees cost, and how large an aircraft the runway takes.\n\n' +
      'Not to be confused with Management Tier (T1-T3), which is what you buy to operate here.',
  },
  managementTier: {
    title: 'Management Tier (T1-T3)',
    desc:
      'Your own standing at this airport, bought once per airport.\n\n' +
      'T1 is required before you can fly here at all and includes one check-in desk. T2 waives stand rent and lets stands exceed slots. T3 is the full base.\n\n' +
      'The price scales with the airport level, so a tier at a major hub costs many times what it costs at a small field.',
  },
  slots: {
    title: 'Slots',
    desc:
      'Permission for one departure per week. A route flying five times a week needs five slots at each end.\n\n' +
      'Slots are bought once (CAPEX) and then rented weekly. They are finite: the airport has 300 per level in total and rival airlines take from the same pool, so a busy hub can simply run out.',
  },
  stands: {
    title: 'Stands',
    desc:
      'Parking positions for your aircraft, rented weekly rather than bought.\n\n' +
      'Holding at least as many stands as slots adds a small satisfaction bonus. From management tier T2 upwards the rent is waived.',
  },
  desks: {
    title: 'Check-in Desks',
    desc:
      'Where your passengers are processed, rented weekly.\n\n' +
      'This is the harshest penalty in the game: with no desks at all every class loses 15 satisfaction points, and premium classes lose 25 if you offer only self-service. Desks also have a capacity — overloading them costs satisfaction again.',
  },
  deskLoad: {
    title: 'Desk Load',
    desc:
      'How much of your check-in capacity at this airport your schedule already uses, across every route.\n\n' +
      'Above 90% the queue starts costing satisfaction on all of them, not just this route.',
  },
  efficiency: {
    title: 'Efficiency',
    desc:
      'How much fuel this aircraft burns, 0-100, where higher is better.\n\n' +
      'Fuel is the largest variable cost on almost every route, so this is usually the most important number on an aircraft after its capacity and range.',
  },
  conditionInterior: {
    title: 'Interior Condition',
    desc:
      'Wear on the cabin, falling with every block hour flown.\n\n' +
      'It scales the interior part of the aircraft satisfaction directly, so a tired cabin quietly lowers the fare passengers will pay. A refit restores it, but each successive refit restores less.',
  },
  conditionGeneral: {
    title: 'Airframe Condition',
    desc:
      'Wear on the airframe itself, falling with block hours and slowly even when parked.\n\n' +
      'It sets what the aircraft is worth if you sell it. A general check restores some of it, and each check restores less than the last.',
  },
  businessTourism: {
    title: 'Business / Tourism',
    desc:
      'How much traffic this city generates of each kind, in the currently selected year. Both grow over the decades.\n\n' +
      'Demand on a route comes from the pairing of the two ends, weighted heavily toward the smaller of them: a huge hub paired with a small field produces a small route.',
  },
  capex: {
    title: 'CAPEX vs. weekly rent',
    desc:
      'CAPEX is a one-off purchase price, charged once and settled with the next monthly report.\n\n' +
      'A weekly rate is recurring upkeep that appears in every month from now on. Slots cost both; desks and stands are rent only.',
  },
  utilization: {
    title: 'Utilization',
    desc:
      'How much of the aircraft\'s week is already committed to flying, out of the 168 hours available.\n\n' +
      'It counts flight time, turnarounds and the fixed 30 minutes before and after each leg, so it reaches 100% well before the aircraft is literally airborne all week.',
  },
};
