import test from 'node:test';
import assert from 'node:assert/strict';

import { createTimerBag } from './timerBag';

test('runs the action after the delay, not before', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let ran = 0;
  const bag = createTimerBag();

  bag.after(() => { ran++; }, 2000);
  t.mock.timers.tick(1999);
  assert.equal(ran, 0, 'one millisecond early');
  t.mock.timers.tick(1);
  assert.equal(ran, 1, 'on time');
});

test('cancelAll stops actions that are still waiting', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let ran = 0;
  const bag = createTimerBag();

  bag.after(() => { ran++; }, 1500);
  bag.after(() => { ran++; }, 2000);
  assert.equal(bag.size, 2);

  bag.cancelAll();
  t.mock.timers.tick(10_000);
  assert.equal(ran, 0);
  assert.equal(bag.size, 0);
});

// The route planner bug: save, leave the planner, open it again within two
// seconds. The first planner's timer must not close the second one.
test('a screen that is gone cannot close the next one', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let secondPlannerOpen = true;
  const firstPlanner = createTimerBag();

  firstPlanner.after(() => { secondPlannerOpen = false; }, 2000); // "close after the save"
  t.mock.timers.tick(1000);                                       // the player opens the planner again
  firstPlanner.cancelAll();                                       // the first planner unmounts
  t.mock.timers.tick(5000);

  assert.equal(secondPlannerOpen, true);
});

test('the bag still works after cancelAll, as after a Strict Mode remount', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let ran = 0;
  const bag = createTimerBag();

  bag.cancelAll();
  bag.after(() => { ran++; }, 100);
  t.mock.timers.tick(100);
  assert.equal(ran, 1);
});

test('an action that has run is no longer counted as waiting', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const bag = createTimerBag();

  bag.after(() => {}, 100);
  assert.equal(bag.size, 1);
  t.mock.timers.tick(100);
  assert.equal(bag.size, 0);
});
