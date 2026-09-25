/**
 * The tutorial: a handful of steps, each pointing at one control on screen.
 *
 * A step points at an element carrying `data-tour="..."` and explains it. A
 * step with a `done` predicate finishes by itself once the game reaches that
 * state -- an aircraft bought, a route saved, the report read -- so a player
 * who simply does what it says never has to click "Next". Steps without one
 * wait for the player's Next.
 *
 * The step on screen is stored per savegame (GameSystems.tutorialStep); null
 * means finished or skipped. Everything here is pure: the overlay component
 * and the App only render and store what these functions return.
 */

/** Where the player is: a screen of the game, or the monthly report. */
export type TutorialView = 'map' | 'buy-aircraft' | 'new-route' | 'my-company' | 'report';

/** The screens a step can send the player to. */
export type TutorialDestination = Exclude<TutorialView, 'report'>;

/** The parts of the game the steps watch. */
export interface TutorialState {
  fleetSize: number;
  routeCount: number;
  /** The route planner is open. */
  planning: boolean;
  /** The monthly report is on screen, i.e. a month has just been closed. */
  reportOpen: boolean;
}

export interface TutorialStep {
  id: string;
  title: string;
  text: string;
  /** A CSS selector for the control, normally `[data-tour="..."]`. */
  target: string;
  /** Said instead, when the control is not on screen. */
  hint: string;
  /** Where the control is, for a "Show me" button when it is not on screen. */
  view?: TutorialDestination;
  /** Once the player is here they are busy doing what the step asks: the card folds away and nothing is dimmed. */
  busyIn?: TutorialView;
  /** False for a step whose screen is there to be read. */
  dim?: boolean;
  /** Which corner of a target too big to sit beside the card goes into. */
  corner?: InsideCorner;
  /** Finishes the step by itself. Without it the step waits for Next. */
  done?: (s: TutorialState) => boolean;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome aboard',
    text:
      'This is your world. Your hub is the airport you picked; every route starts or ends at an airport you manage, ' +
      'and your hub is managed from day one. The bar at the top keeps your cash, fleet, routes and reputation in view.',
    target: '[data-tour="map"]',
    hint: 'Open the map to see your hub.',
    view: 'map'
  },
  {
    id: 'buy',
    title: 'Buy an aircraft',
    text:
      'Open Buy Aircraft, pick a model whose range suits the routes you have in mind and confirm the purchase. ' +
      'A cabin with some business seats earns far more than one that is all economy.',
    target: '[data-tour="nav-buy-aircraft"]',
    hint: 'Buy Aircraft is in the sidebar on the left.',
    view: 'buy-aircraft',
    busyIn: 'buy-aircraft',
    done: s => s.fleetSize > 0
  },
  {
    id: 'plan',
    title: 'Plan a route',
    text:
      'Click New Route. Pick your hub and a destination, then the aircraft to fly it. Every airport you fly to needs T1 ' +
      'management, and every weekly departure a slot at both ends: the planner sells both.',
    target: '[data-tour="nav-new-route"]',
    hint: 'New Route is at the bottom of the sidebar.',
    view: 'new-route',
    done: s => s.planning || s.routeCount > 0
  },
  {
    id: 'schedule',
    title: 'Timetable and fares',
    text:
      'Lay out the weekly timetable, fit the cabin service and set the fares. The planner shows what the route will ' +
      'earn before you commit; save it and it flies from this month.',
    target: '[data-tour="route-planner"]',
    hint: 'The route planner is closed. Open New Route to carry on.',
    view: 'new-route',
    done: s => s.routeCount > 0
  },
  {
    id: 'advance',
    title: 'Advance the month',
    text:
      'When you are ready, press Next Month. Your routes fly, the bills arrive and the month is closed. ' +
      'Nothing moves until you do, so take your time.',
    target: '[data-tour="next-month"]',
    hint: 'Next Month is at the bottom right of the map.',
    view: 'map',
    done: s => s.reportOpen
  },
  {
    id: 'report',
    title: 'The monthly report',
    text:
      'Every month closes with this report and a copy of The Aviation Times. The paper can be reopened from here ' +
      'and from Messages. Press Continue when you have read it.',
    target: '[data-tour="monthly-report"]',
    hint: 'The report shows after every Next Month.',
    dim: false,
    corner: 'top-right',
    done: s => !s.reportOpen
  },
  {
    id: 'company',
    title: 'Your company',
    text:
      'My Company keeps the long view: Overview for the balance sheet and reputation, History for charts and the ' +
      'chronicle, Marketing for campaigns and the frequent flyer programme, Staff for pay and morale. ' +
      'That is the tour. Settings can restart it any time.',
    target: '[data-tour="nav-my-company"]',
    hint: 'My Company is in the sidebar on the left.',
    view: 'my-company'
  }
];

const lastIndex = TUTORIAL_STEPS.length - 1;

/**
 * The step to show: `step`, or the first one after it that is not already
 * done in `state`. Null once past the end, or for a finished tutorial.
 */
export function settleTutorialStep(step: number | null, state: TutorialState, steps: readonly TutorialStep[] = TUTORIAL_STEPS): number | null {
  if (step === null || !Number.isFinite(step)) return null;
  let i = Math.max(0, Math.floor(step));
  while (i < steps.length && steps[i].done?.(state)) i++;
  return i < steps.length ? i : null;
}

/** The step after Next: the following one not already done, or null after the last. */
export function nextTutorialStep(step: number, state: TutorialState, steps: readonly TutorialStep[] = TUTORIAL_STEPS): number | null {
  return settleTutorialStep(step + 1, state, steps);
}

/**
 * The step after Back: the nearest earlier one not already done. A step
 * that would finish itself at once is no use to go back to. Stays put when
 * there is none.
 */
export function previousTutorialStep(step: number, state: TutorialState, steps: readonly TutorialStep[] = TUTORIAL_STEPS): number {
  for (let i = Math.min(step, steps.length) - 1; i >= 0; i--) {
    if (!steps[i].done?.(state)) return i;
  }
  return step;
}

/** Skipping ends the tutorial for this game only; whether new games offer it is a setting. */
export const skipTutorial = (): null => null;

/** Restarting starts over at the first step. */
export const restartTutorial = (): number => 0;

export const isLastTutorialStep = (step: number) => step >= lastIndex;

// --- Placing the tooltip ---------------------------------------------------------

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type TooltipSide = 'right' | 'left' | 'bottom' | 'top' | 'inside' | 'center';

export type InsideCorner = 'bottom-left' | 'top-right';

export interface TooltipPlacement {
  x: number;
  y: number;
  side: TooltipSide;
  /** Where along the side facing the target the arrow sits, in px from the tooltip's edge; absent without an arrow. */
  arrow?: number;
}

/** A target is usable when it has a size and at least part of it is in the viewport. */
export function isOnScreen(box: Box | null | undefined, viewport: { width: number; height: number }): box is Box {
  return !!box && box.width > 0 && box.height > 0 &&
    box.x < viewport.width && box.y < viewport.height && box.x + box.width > 0 && box.y + box.height > 0;
}

const clampTo = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/**
 * Where the tooltip goes: beside the target, trying right, bottom, left and
 * top in that order, on the first side where it fits whole. A target too big
 * for any side (the map, the planner, the report) gets it inside one of its
 * corners, bottom-left unless told otherwise; no target at all, the middle
 * of the screen.
 */
export function placeTooltip(
  target: Box | null,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  corner: InsideCorner = 'bottom-left',
  gap = 14,
  margin = 12
): TooltipPlacement {
  const center = { x: Math.max(margin, (viewport.width - size.width) / 2), y: Math.max(margin, (viewport.height - size.height) / 2), side: 'center' as const };
  if (!isOnScreen(target, viewport)) return center;

  const maxX = viewport.width - size.width - margin;
  const maxY = viewport.height - size.height - margin;
  const midX = target.x + target.width / 2;
  const midY = target.y + target.height / 2;
  const arrowAlong = (start: number, mid: number, length: number) => clampTo(mid - start, 14, length - 14);

  const right = target.x + target.width + gap;
  if (right + size.width <= viewport.width - margin) {
    const y = clampTo(midY - size.height / 2, margin, maxY);
    return { x: right, y, side: 'right', arrow: arrowAlong(y, midY, size.height) };
  }
  const below = target.y + target.height + gap;
  if (below + size.height <= viewport.height - margin) {
    const x = clampTo(midX - size.width / 2, margin, maxX);
    return { x, y: below, side: 'bottom', arrow: arrowAlong(x, midX, size.width) };
  }
  const left = target.x - gap - size.width;
  if (left >= margin) {
    const y = clampTo(midY - size.height / 2, margin, maxY);
    return { x: left, y, side: 'left', arrow: arrowAlong(y, midY, size.height) };
  }
  const above = target.y - gap - size.height;
  if (above >= margin) {
    const x = clampTo(midX - size.width / 2, margin, maxX);
    return { x, y: above, side: 'top', arrow: arrowAlong(x, midX, size.width) };
  }
  // Too big to sit beside: inside one of its corners, on screen.
  if (corner === 'top-right') {
    return {
      x: clampTo(Math.min(target.x + target.width, viewport.width) - size.width - margin, margin, maxX),
      y: clampTo(Math.max(target.y, 0) + margin, margin, maxY),
      side: 'inside'
    };
  }
  return {
    x: clampTo(Math.max(target.x, 0) + margin, margin, maxX),
    y: clampTo(Math.min(target.y + target.height, viewport.height) - size.height - margin, margin, maxY),
    side: 'inside'
  };
}

// --- Stepping aside ------------------------------------------------------------------

/**
 * Dialogs that want the player's whole attention: while one is on screen the
 * tutorial steps aside, whatever it points at. The in-app modals carry
 * `aria-modal="true"`; the scenario's verdict is an alertdialog.
 */
export const MODAL_SELECTOR = '[aria-modal="true"], [role="alertdialog"]';

/** The middle of the part of a box inside the viewport; null when none of it is. */
export function visibleCenter(box: Box, viewport: { width: number; height: number }): { x: number; y: number } | null {
  const left = Math.max(0, box.x);
  const right = Math.min(viewport.width, box.x + box.width);
  const top = Math.max(0, box.y);
  const bottom = Math.min(viewport.height, box.y + box.height);
  if (!(right > left && bottom > top)) return null;
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

/**
 * Whether something else is drawn over the target: `stack` is what is on
 * screen at the middle of it, topmost first (document.elementsFromPoint),
 * and `ignore` leaves out the tutorial's own card. The target is covered
 * unless the topmost of the rest is the target, part of it or around it --
 * a modal, a console or anything else opened over it is none of those.
 */
export function isCovered<T extends { contains(other: T): boolean }>(target: T, stack: readonly T[], ignore: (el: T) => boolean = () => false): boolean {
  const top = stack.find(el => !ignore(el));
  if (!top) return false;
  return !(top === target || target.contains(top) || top.contains(target));
}
