import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TUTORIAL_STEPS,
  isLastTutorialStep,
  isOnScreen,
  nextTutorialStep,
  placeTooltip,
  previousTutorialStep,
  restartTutorial,
  settleTutorialStep,
  skipTutorial,
  type TutorialState
} from './tutorial';

const fresh: TutorialState = { fleetSize: 0, routeCount: 0, planning: false, reportOpen: false };
const index = (id: string) => TUTORIAL_STEPS.findIndex(s => s.id === id);

test('the steps point at controls and finish when the game gets there', () => {
  assert.deepEqual(TUTORIAL_STEPS.map(s => s.id), ['welcome', 'buy', 'plan', 'schedule', 'advance', 'report', 'company']);
  for (const s of TUTORIAL_STEPS) assert.match(s.target, /^\[data-tour="[a-z-]+"\]$/, s.id);

  assert.equal(settleTutorialStep(index('buy'), fresh), index('buy'), 'nothing bought yet');
  assert.equal(settleTutorialStep(index('buy'), { ...fresh, fleetSize: 1 }), index('plan'), 'an aircraft finishes it');
  assert.equal(settleTutorialStep(index('plan'), { ...fresh, fleetSize: 1, planning: true }), index('schedule'), 'opening the planner finishes it');
  assert.equal(settleTutorialStep(index('schedule'), { ...fresh, fleetSize: 1, planning: true }), index('schedule'), 'still planning');
  assert.equal(settleTutorialStep(index('schedule'), { ...fresh, fleetSize: 1, routeCount: 1 }), index('advance'), 'a saved route finishes planning');
  assert.equal(settleTutorialStep(index('advance'), { ...fresh, fleetSize: 1, routeCount: 1, reportOpen: true }), index('report'), 'the month closed');
  assert.equal(settleTutorialStep(index('report'), { ...fresh, fleetSize: 1, routeCount: 1 }), index('company'), 'the report was left');
  assert.equal(settleTutorialStep(index('company'), fresh), index('company'), 'the last step waits for Finish');
});

test('steps already done are passed over, several at once', () => {
  const scenarioFleet = { ...fresh, fleetSize: 3 };
  assert.equal(nextTutorialStep(index('welcome'), scenarioFleet), index('plan'), 'a scenario brings its own aircraft');
  const flying = { ...fresh, fleetSize: 2, routeCount: 4 };
  assert.equal(settleTutorialStep(index('buy'), flying), index('advance'));
  assert.equal(nextTutorialStep(index('company'), fresh), null, 'Next on the last step finishes');
  assert.equal(settleTutorialStep(null, fresh), null, 'a finished tutorial stays finished');
  assert.equal(settleTutorialStep(99, fresh), null);
});

test('back goes to the nearest step that would not finish at once', () => {
  const flying = { ...fresh, fleetSize: 2, routeCount: 4 };
  // From the last step, the report (done: not open) and the planning steps are skipped.
  assert.equal(previousTutorialStep(index('company'), flying), index('advance'));
  assert.equal(previousTutorialStep(index('company'), { ...flying, reportOpen: true }), index('report'));
  assert.equal(previousTutorialStep(index('welcome'), fresh), index('welcome'), 'nowhere before the first');
  assert.equal(previousTutorialStep(index('plan'), { ...fresh, fleetSize: 1 }), index('welcome'));
});

test('skip ends the tutorial, restart starts over, and the last step is known', () => {
  assert.equal(skipTutorial(), null);
  assert.equal(restartTutorial(), 0);
  assert.equal(isLastTutorialStep(index('company')), true);
  assert.equal(isLastTutorialStep(index('report')), false);
});

test('the tooltip sits beside its target, or in the middle without one', () => {
  const viewport = { width: 1440, height: 900 };
  const size = { width: 300, height: 160 };

  const nav = placeTooltip({ x: 0, y: 140, width: 64, height: 60 }, size, viewport);
  assert.equal(nav.side, 'right');
  assert.equal(nav.x, 64 + 14);
  assert.equal(nav.y, 170 - 80);
  assert.equal(nav.arrow, 80, 'the arrow points at the middle of the target');

  const nextMonth = placeTooltip({ x: 1250, y: 830, width: 170, height: 44 }, size, viewport);
  assert.equal(nextMonth.side, 'left', 'no room to the right or below');
  assert.ok(nextMonth.y + size.height <= viewport.height - 12, 'kept on screen');
  assert.ok(nextMonth.arrow! >= 14 && nextMonth.arrow! <= size.height - 14);

  const topBar = placeTooltip({ x: 1200, y: 10, width: 230, height: 36 }, size, viewport);
  assert.equal(topBar.side, 'bottom');
  assert.ok(topBar.x + size.width <= viewport.width - 12);

  const map = placeTooltip({ x: 64, y: 56, width: 1376, height: 844 }, size, viewport);
  assert.equal(map.side, 'inside', 'too big to sit beside');
  assert.equal(map.arrow, undefined);
  assert.deepEqual([map.x, map.y], [64 + 12, 900 - 160 - 12], 'the bottom-left corner, kept on screen');
  const report = placeTooltip({ x: 260, y: 170, width: 920, height: 560 }, size, viewport, 'top-right');
  assert.deepEqual([report.x, report.y, report.side], [260 + 920 - 300 - 12, 170 + 12, 'inside']);

  const missing = placeTooltip(null, size, viewport);
  assert.equal(missing.side, 'center');
  assert.equal(missing.x, (1440 - 300) / 2);
  assert.equal(placeTooltip({ x: 2000, y: 10, width: 50, height: 50 }, size, viewport).side, 'center', 'off screen counts as missing');
  assert.equal(isOnScreen({ x: 0, y: 0, width: 0, height: 10 }, viewport), false, 'a hidden element has no size');
});
