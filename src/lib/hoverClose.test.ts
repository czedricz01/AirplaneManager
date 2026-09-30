import test from 'node:test';
import assert from 'node:assert/strict';

import { HOVER_CLOSE_DELAY_MS, createHoverCloser } from './hoverClose';

test('the delay is two seconds', () => {
  assert.equal(HOVER_CLOSE_DELAY_MS, 2000);
});

test('closes two seconds after the mouse left, not before', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let closed = 0;
  const closer = createHoverCloser(() => { closed++; });

  closer.leave();
  t.mock.timers.tick(1999);
  assert.equal(closed, 0, 'one millisecond early');
  t.mock.timers.tick(1);
  assert.equal(closed, 1, 'on time');
});

test('the mouse coming back stops the countdown', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let closed = 0;
  const closer = createHoverCloser(() => { closed++; });

  closer.leave();
  t.mock.timers.tick(1500);
  closer.enter();
  t.mock.timers.tick(10_000);
  assert.equal(closed, 0);
});

test('leaving again starts a fresh two seconds', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let closed = 0;
  const closer = createHoverCloser(() => { closed++; });

  closer.leave();
  t.mock.timers.tick(1500);
  closer.enter();
  closer.leave();
  t.mock.timers.tick(1999);
  assert.equal(closed, 0, 'the first 1500 ms no longer count');
  t.mock.timers.tick(1);
  assert.equal(closed, 1);
});

test('closes once, however often the mouse leaves', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let closed = 0;
  const closer = createHoverCloser(() => { closed++; });

  closer.leave();
  closer.leave();
  closer.leave();
  t.mock.timers.tick(10_000);
  assert.equal(closed, 1);
});

test('cancel drops the countdown, and works with none running', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let closed = 0;
  const closer = createHoverCloser(() => { closed++; });

  closer.cancel();
  closer.leave();
  closer.cancel();
  t.mock.timers.tick(10_000);
  assert.equal(closed, 0);
});

test('a different delay can be given', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let closed = 0;
  const closer = createHoverCloser(() => { closed++; }, 500);

  closer.leave();
  t.mock.timers.tick(500);
  assert.equal(closed, 1);
});
