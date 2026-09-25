import test from 'node:test';
import assert from 'node:assert/strict';

import {
  profitColor,
  paxWeight,
  readableTextColor,
  relativeLuminance,
  recolorClashingRivals,
  colorDistance,
  isHexColor,
  HEATMAP_COLORS,
  BRAND_PRESETS,
  MAP_YELLOW,
  RIVAL_PALETTE
} from './theme';

test('profitColor reaches full red and full green at the largest loss and profit', () => {
  assert.equal(profitColor(-500, 500), HEATMAP_COLORS.loss);
  assert.equal(profitColor(500, 500), HEATMAP_COLORS.profit);
  // Beyond the scale it stays at the end colour.
  assert.equal(profitColor(-5000, 500), HEATMAP_COLORS.loss);
  assert.equal(profitColor(5000, 500), HEATMAP_COLORS.profit);
});

test('profitColor is grey at break-even and when there is no scale', () => {
  assert.equal(profitColor(0, 1_000_000), HEATMAP_COLORS.neutral);
  assert.equal(profitColor(1234, 0), HEATMAP_COLORS.neutral);
  assert.equal(profitColor(-1234, -5), HEATMAP_COLORS.neutral);
  assert.equal(profitColor(Number.NaN, 100), HEATMAP_COLORS.neutral);
});

test('profitColor leans clearly red or green for small results next to a large one', () => {
  const smallLoss = profitColor(-100, 1000);
  const smallProfit = profitColor(100, 1000);
  assert.ok(isHexColor(smallLoss) && isHexColor(smallProfit));
  // Closer to its own end than the plain linear midpoint would be.
  assert.ok(colorDistance(smallLoss, HEATMAP_COLORS.neutral) > 0.15 * colorDistance(HEATMAP_COLORS.loss, HEATMAP_COLORS.neutral));
  assert.ok(colorDistance(smallProfit, HEATMAP_COLORS.neutral) > 0.15 * colorDistance(HEATMAP_COLORS.profit, HEATMAP_COLORS.neutral));
  // And it grows monotonically with the profit.
  assert.ok(colorDistance(profitColor(800, 1000), HEATMAP_COLORS.profit) < colorDistance(smallProfit, HEATMAP_COLORS.profit));
});

test('paxWeight runs from 1 to 5 px with the square root of the passengers', () => {
  assert.equal(paxWeight(0, 1000), 1);
  assert.equal(paxWeight(1000, 1000), 5);
  assert.equal(paxWeight(250, 1000), 3);
  assert.equal(paxWeight(5000, 1000), 5);
  assert.equal(paxWeight(-10, 1000), 1);
  assert.equal(paxWeight(100, 0), 1);
});

test('readableTextColor puts black on light colours and white on dark ones', () => {
  assert.equal(readableTextColor(MAP_YELLOW), '#000000');
  assert.equal(readableTextColor('#FFFFFF'), '#000000');
  assert.equal(readableTextColor('#000000'), '#FFFFFF');
  assert.equal(readableTextColor('#2563EB'), '#FFFFFF');
  assert.equal(readableTextColor('not a colour'), '#000000');
  assert.equal(relativeLuminance('#000000'), 0);
  assert.equal(relativeLuminance('#FFFFFF'), 1);
});

test('every brand preset is a valid colour and they are all different', () => {
  for (const p of BRAND_PRESETS) assert.ok(isHexColor(p.color), p.color);
  assert.equal(new Set(BRAND_PRESETS.map(p => p.color.toLowerCase())).size, BRAND_PRESETS.length);
});

test('a new player colour moves only the rivals it clashes with', () => {
  const sky = RIVAL_PALETTE[0];
  const rivals = [
    { code: 'AA', color: sky },
    { code: 'BB', color: RIVAL_PALETTE[2] },
    { code: 'CC', color: RIVAL_PALETTE[3] }
  ];
  const colors = recolorClashingRivals(rivals, sky);
  assert.notEqual(colors[0], sky);
  assert.ok(colorDistance(colors[0], sky) >= 100);
  assert.equal(colors[1], RIVAL_PALETTE[2]);
  assert.equal(colors[2], RIVAL_PALETTE[3]);
  assert.equal(new Set(colors).size, colors.length);

  // Nothing to do when nobody clashes.
  assert.deepEqual(recolorClashingRivals(rivals, MAP_YELLOW), rivals.map(r => r.color));
});
