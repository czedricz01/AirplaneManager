import test from 'node:test';
import assert from 'node:assert/strict';

import {
  heatmapScale,
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

test('the heatmap scale is the 80th percentile of the results, not the largest', () => {
  // Ten ordinary routes and one trunk route earning a hundred times as much.
  const ordinary = [-40_000, -10_000, 20_000, 30_000, 40_000, 50_000, 60_000, 70_000, 80_000, 90_000];
  const scale = heatmapScale([...ordinary, 9_000_000]);
  assert.equal(scale, 80_000, 'rank floor(10 x 0.8): the 9th of 11 absolute values');
  // So the typical route is clearly coloured...
  assert.ok(colorDistance(profitColor(50_000, scale), HEATMAP_COLORS.profit) < 0.25 * colorDistance(HEATMAP_COLORS.neutral, HEATMAP_COLORS.profit));
  assert.ok(colorDistance(profitColor(-40_000, scale), HEATMAP_COLORS.loss) < 0.4 * colorDistance(HEATMAP_COLORS.neutral, HEATMAP_COLORS.loss));
  // ...where scaling to the largest result left it next to grey.
  assert.ok(colorDistance(profitColor(50_000, 9_000_000), HEATMAP_COLORS.neutral) < 0.05 * colorDistance(HEATMAP_COLORS.neutral, HEATMAP_COLORS.profit));
  // And the outlier clamps at the end colour.
  assert.equal(profitColor(9_000_000, scale), HEATMAP_COLORS.profit);
});

test('on a small network one big earner does not set the heatmap scale', () => {
  // Four routes, one of them earning twenty times the others. The old
  // nearest rank, ceil(4 x 0.8) = 4th of 4, was the million itself.
  const scale = heatmapScale([1_000_000, 50_000, 40_000, -30_000]);
  assert.equal(scale, 50_000);
  assert.ok(colorDistance(profitColor(40_000, scale), HEATMAP_COLORS.profit) < 0.25 * colorDistance(HEATMAP_COLORS.neutral, HEATMAP_COLORS.profit), 'the small earner reads green');
  assert.ok(colorDistance(profitColor(-30_000, scale), HEATMAP_COLORS.loss) < 0.4 * colorDistance(HEATMAP_COLORS.neutral, HEATMAP_COLORS.loss), 'the loss reads red');
  assert.equal(profitColor(1_000_000, scale), HEATMAP_COLORS.profit, 'the big earner at the end colour');

  // Five routes or fewer: never the largest. One route: its own result.
  for (let n = 2; n <= 5; n++) {
    const values = Array.from({ length: n }, (_, i) => (i + 1) * 1000);
    assert.ok(heatmapScale(values) < n * 1000, `n = ${n}`);
  }
  assert.equal(heatmapScale([-70_000]), 70_000);
});

test('the heatmap scale is at least 1 and ignores unusable numbers', () => {
  assert.equal(heatmapScale([]), 1);
  assert.equal(heatmapScale([0, 0, 0]), 1);
  assert.equal(heatmapScale([0.2, -0.5]), 1);
  assert.equal(heatmapScale([Number.NaN, 500, Infinity]), 500);
  assert.equal(heatmapScale([-700]), 700, 'a single route sets the scale by itself');
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
