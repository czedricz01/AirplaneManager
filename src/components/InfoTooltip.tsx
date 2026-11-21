import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { MODEL_GLOSSARY, type GlossaryEntry, type GlossaryKey } from '../model/glossary';

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
      className="inline-flex items-center ml-2 cursor-help align-middle bg-transparent border-0 p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
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
      <Info size={size} className="text-muted hover:text-accent transition-colors" />
      {pos.show &&
        createPortal(
          <div
            role="tooltip"
            className="fixed z-[999999] flex flex-col bg-surface border border-rule p-3 rounded-sm w-[250px] pointer-events-none"
            style={{
              top: pos.y > window.innerHeight - 160 ? Math.max(8, pos.y - 170) : pos.y,
              // Clamped: on a phone, flipping 280px to the left of the icon would
              // otherwise start the tooltip off the screen.
              left: pos.x > window.innerWidth - 260 ? Math.max(8, pos.x - 280) : pos.x,
            }}
          >
            <span className="font-label text-xs text-muted font-semibold uppercase tracking-label leading-tight mb-1">
              {title}
            </span>
            {desc && (
              <span className="text-2xs text-muted whitespace-pre-wrap leading-relaxed">{desc}</span>
            )}
          </div>,
          document.body
        )}
    </button>
  );
};

/**
 * The terms the game prices with, in one place so the wording cannot drift
 * between the screens that use them. The texts live in the model
 * (`src/model/glossary.ts`) and take every number from its constants (E52).
 *
 * Kept here until the view that shows the rule moves to the model:
 * - `breakEven`: the planner slider still marks BE99 / BE75 / BE35 (package 4.5).
 */
export const GLOSSARY: Record<GlossaryKey, GlossaryEntry> = {
  ...MODEL_GLOSSARY,
  breakEven: {
    title: 'Break-even price',
    desc:
      'The fare at which this route covers its costs exactly, at a given load factor.\n\n' +
      'The left end of the slider is break-even if you fill 99% of seats — the cheapest fare that could ever work. The right end is break-even at 35% — what you would have to charge if the aircraft flew nearly empty.\n\n' +
      'The marked point is break-even at 75%, a realistic full-year average. Price below it and you are betting on filling more seats than that.',
  },
};
