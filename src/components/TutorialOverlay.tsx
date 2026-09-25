import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight, GraduationCap, Minus, X } from 'lucide-react';
import {
  MODAL_SELECTOR,
  TUTORIAL_STEPS,
  isCovered,
  isLastTutorialStep,
  isOnScreen,
  nextTutorialStep,
  placeTooltip,
  previousTutorialStep,
  type Box,
  type TutorialDestination,
  type TutorialState,
  type TutorialView,
  visibleCenter
} from '../lib/tutorial';

/** Space between the target and the spotlight's edge. */
const PAD = 6;
/** What the tooltip is assumed to measure until it has been measured. */
const INITIAL_SIZE = { width: 320, height: 190 };

export interface TutorialOverlayProps {
  /** The step on screen, an index into TUTORIAL_STEPS. */
  step: number;
  state: TutorialState;
  /** Where the player is, to get out of the way once they are busy where the step sends them. */
  currentView: TutorialView | null;
  /** Changes whenever the screen underneath changes, so the target is looked for again at once. */
  layoutKey: string;
  /** Moves to a step, or ends the tutorial with null. `skipped` tells finishing from skipping. */
  onGoTo: (step: number | null, skipped?: boolean) => void;
  /** Takes the player to where a step's control is. */
  onNavigate: (view: TutorialDestination) => void;
}

const sameBox = (a: Box | null, b: Box | null) =>
  a === b || (!!a && !!b &&
    Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5);

const viewportSize = () => ({ width: window.innerWidth, height: window.innerHeight });

const hasSize = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

/**
 * Where the target is on screen, kept up to date, and whether the tutorial
 * should step aside: when something the App does not tell it about -- a
 * modal, a console, a full-screen view -- is drawn over the target, or any
 * modal is open at all, which a card in the middle of the screen would
 * cover. Measured again, at most once a frame, on resizes, on scrolling
 * anywhere, on clicks and keys (which open and close dialogs), when the
 * target itself changes size, when the screen underneath changes
 * (`layoutKey`), and every so often for targets that appear late: most
 * views are loaded lazily. `own` is the overlay itself, never in the way.
 */
function useTargetBox(selector: string, layoutKey: string, own: RefObject<HTMLElement | null>) {
  const [box, setBox] = useState<Box | null>(null);
  const [viewport, setViewport] = useState(viewportSize);
  const [blocked, setBlocked] = useState(false);

  useLayoutEffect(() => {
    let frame = 0;
    let observed: Element | null = null;
    const ours = (node: Element) => !!own.current?.contains(node);
    const measure = () => {
      frame = 0;
      let el: Element | null = null;
      try {
        el = selector ? document.querySelector(selector) : null;
      } catch {
        el = null; // not a valid selector: treated as a target not on screen
      }
      if (el !== observed) {
        if (observed) resize?.unobserve(observed);
        if (el) resize?.observe(el);
        observed = el;
      }
      const r = el?.getBoundingClientRect();
      const vp = viewportSize();
      const next = r ? { x: r.left, y: r.top, width: r.width, height: r.height } : null;
      const usable = isOnScreen(next, vp) ? next : null;
      const center = el && usable ? visibleCenter(usable, vp) : null;
      const covered = !!el && !!center && isCovered<Element>(el, document.elementsFromPoint(center.x, center.y), ours);
      const modalOpen = Array.from(document.querySelectorAll(MODAL_SELECTOR)).some(m => !ours(m) && hasSize(m));
      setBox(prev => (sameBox(prev, usable) ? prev : usable));
      setBlocked(covered || modalOpen);
      setViewport(prev => (prev.width === vp.width && prev.height === vp.height ? prev : vp));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const resize = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    resize?.observe(document.body);
    measure();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('click', schedule, true);
    window.addEventListener('keyup', schedule, true);
    const poll = window.setInterval(schedule, 400);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('click', schedule, true);
      window.removeEventListener('keyup', schedule, true);
      window.clearInterval(poll);
      resize?.disconnect();
    };
  }, [selector, layoutKey, own]);

  return { box, viewport, blocked };
}

/**
 * The tutorial: a spotlight on one control and a card beside it saying what
 * to do. The rest of the screen is dimmed but never blocked -- the dim lets
 * every click through, so the player can simply do what the card says.
 * "Skip tutorial" is on every step; steps that finish by themselves have no
 * Next. The card folds down to a small button when it is in the way. With
 * reduced motion nothing slides or pulses.
 *
 * Rendered outside the app's scaled root, so it works in screen pixels,
 * and above everything in it: so it steps aside -- nothing drawn but the
 * screen-reader line -- while its target is covered or a modal is open.
 * The App hides it outright for the dialogs and consoles it knows about.
 */
export function TutorialOverlay({ step, state, currentView, layoutKey, onGoTo, onNavigate }: TutorialOverlayProps) {
  const def = TUTORIAL_STEPS[step];
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const maskId = `tutorial-mask-${useId().replace(/:/g, '')}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const { box, viewport, blocked } = useTargetBox(def?.target ?? '', `${layoutKey}|${step}`, rootRef);
  const tipRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [tipSize, setTipSize] = useState(INITIAL_SIZE);
  const [collapsed, setCollapsed] = useState(false);

  // A new step opens unfolded, and is announced to a screen reader through
  // the live region below. Focus moves to it only when nothing else has it:
  // the player may be typing in the planner. Once the player is where the
  // step sends them, busy doing it, the card folds out of their way.
  const busy = !!def?.busyIn && def.busyIn === currentView;
  useEffect(() => {
    setCollapsed(busy);
    const active = document.activeElement;
    if (!busy && (!active || active === document.body)) headingRef.current?.focus({ preventScroll: true });
  }, [step, busy]);

  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!el) return;
    const next = { width: el.offsetWidth, height: el.offsetHeight };
    setTipSize(prev => (prev.width === next.width && prev.height === next.height ? prev : next));
  });

  if (!def) return null;

  const total = TUTORIAL_STEPS.length;
  const manual = !def.done;
  const last = isLastTutorialStep(step);
  const back = manual ? previousTutorialStep(step, state) : step;
  const dim = !!box && def.dim !== false && !busy && !collapsed && !blocked;
  const spot = box && {
    x: box.x - PAD,
    y: box.y - PAD,
    width: box.width + PAD * 2,
    height: box.height + PAD * 2
  };
  const placement = placeTooltip(spot ?? null, tipSize, viewport, def.corner);
  const move = reduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 380, damping: 36 };

  const arrowStyle = (() => {
    if (placement.arrow === undefined) return null;
    const along = placement.arrow - 6;
    switch (placement.side) {
      case 'right': return { left: -6, top: along };
      case 'left': return { right: -6, top: along };
      case 'bottom': return { top: -6, left: along };
      case 'top': return { bottom: -6, left: along };
    }
    return null;
  })();

  return (
    <div ref={rootRef} className="fixed inset-0 z-[4800] pointer-events-none font-sans">
      {dim && spot && (
        <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
          <defs>
            <mask id={maskId}>
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <motion.rect
                initial={false}
                animate={{ x: spot.x, y: spot.y, width: spot.width, height: spot.height }}
                transition={move}
                rx="4"
                fill="black"
              />
            </mask>
          </defs>
          <rect x="0" y="0" width="100%" height="100%" fill="rgba(0, 0, 0, 0.55)" mask={`url(#${maskId})`} />
        </svg>
      )}
      {spot && !blocked && (
        <motion.div
          aria-hidden="true"
          initial={false}
          animate={{ left: spot.x, top: spot.y, width: spot.width, height: spot.height }}
          transition={move}
          className="absolute rounded-[4px] border-2 border-aero-yellow shadow-[0_0_0_4px_rgba(250,204,21,0.2)] motion-safe:animate-pulse"
        />
      )}

      <div className="sr-only" aria-live="polite">
        {`Tutorial step ${step + 1} of ${total}: ${def.title}`}
      </div>

      <AnimatePresence initial={false}>
        {blocked ? null : collapsed ? (
          <motion.button
            key="pill"
            type="button"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onClick={() => setCollapsed(false)}
            className="absolute bottom-4 left-20 pointer-events-auto flex items-center gap-2 bg-aero-panel-2 border border-aero-yellow/60 px-3 py-2 text-2xs font-mono uppercase tracking-widest text-white shadow-2xl hover:border-aero-yellow focus-visible:outline focus-visible:outline-2 focus-visible:outline-aero-yellow"
          >
            <GraduationCap size={14} className="text-aero-yellow" aria-hidden="true" />
            Tutorial {step + 1}/{total}: {def.title}
          </motion.button>
        ) : (
          <motion.div
            key="card"
            ref={tipRef}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1, left: placement.x, top: placement.y }}
            exit={{ opacity: 0 }}
            transition={move}
            style={{ left: placement.x, top: placement.y }}
            className="absolute w-80 max-w-[calc(100vw-24px)] pointer-events-auto bg-aero-panel-2 border border-aero-yellow/50 shadow-[0_18px_50px_rgba(0,0,0,0.6)] text-left"
          >
            {arrowStyle && (
              <span
                aria-hidden="true"
                className="absolute w-3 h-3 rotate-45 bg-aero-panel-2 border-aero-yellow/50 border-l border-b"
                style={{
                  ...arrowStyle,
                  // The two borders that face the target.
                  ...(placement.side === 'bottom' ? { borderLeftWidth: 1, borderTopWidth: 1, borderBottomWidth: 0 } : {}),
                  ...(placement.side === 'top' ? { borderLeftWidth: 0, borderRightWidth: 1, borderBottomWidth: 1 } : {}),
                  ...(placement.side === 'left' ? { borderLeftWidth: 0, borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 0 } : {})
                }}
              />
            )}
            <div className="flex items-center justify-between gap-2 px-4 pt-3">
              <span className="flex items-center gap-1.5 text-3xs font-mono uppercase tracking-[0.25em] text-aero-yellow">
                <GraduationCap size={13} aria-hidden="true" /> Tutorial {step + 1} / {total}
              </span>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                aria-label="Fold the tutorial away"
                title="Fold away"
                className="p-1 text-white/40 hover:text-white rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-aero-yellow"
              >
                <Minus size={14} />
              </button>
            </div>
            <div className="px-4 pb-3 pt-1">
              <h2 ref={headingRef} id={titleId} tabIndex={-1} className="text-sm font-black uppercase tracking-widest text-white mb-1.5 outline-none">
                {def.title}
              </h2>
              <p className="text-xs text-white/75 leading-relaxed">{def.text}</p>
              {!box && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="text-2xs font-mono text-aero-yellow/80 leading-relaxed">{def.hint}</p>
                  {def.view && def.view !== currentView && (
                    <button
                      type="button"
                      onClick={() => onNavigate(def.view!)}
                      className="px-2 py-1 border border-aero-yellow/50 text-3xs font-mono font-bold uppercase tracking-widest text-aero-yellow hover:bg-aero-yellow hover:text-black transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-aero-yellow"
                    >
                      Show me
                    </button>
                  )}
                </div>
              )}
              {!manual && (
                <p className="mt-2 text-3xs font-mono uppercase tracking-widest text-white/35">Moves on by itself once done</p>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-white/10">
              <button
                type="button"
                onClick={() => onGoTo(null, true)}
                className="flex items-center gap-1 text-3xs font-mono uppercase tracking-widest text-white/45 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-aero-yellow"
              >
                <X size={12} aria-hidden="true" /> Skip tutorial
              </button>
              {manual && (
                <div className="flex items-center gap-2">
                  {back !== step && (
                    <button
                      type="button"
                      onClick={() => onGoTo(back)}
                      className="flex items-center gap-1 px-2 py-1.5 border border-white/15 text-3xs font-mono font-bold uppercase tracking-widest text-white/70 hover:text-white hover:border-white/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-aero-yellow"
                    >
                      <ChevronLeft size={12} aria-hidden="true" /> Back
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onGoTo(last ? null : nextTutorialStep(step, state))}
                    className="flex items-center gap-1 px-3 py-1.5 bg-aero-yellow text-black text-3xs font-mono font-black uppercase tracking-widest hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                  >
                    {last ? 'Finish' : 'Next'} {!last && <ChevronRight size={12} aria-hidden="true" />}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
