import test from 'node:test';
import assert from 'node:assert/strict';

import { formatCurrency, formatNumber, formatMoneyCompact, formatMonthLong, formatMonthOffset, formatNumberCompact, formatSignedCurrency, setDecimalSymbol } from './format';

test('currency follows the decimal-separator setting', () => {
  setDecimalSymbol('.');
  assert.equal(formatCurrency(1234567), '$1,234,567');
  setDecimalSymbol(',');
  // de-DE puts the symbol after the number; the digits are what matters here.
  assert.match(formatCurrency(1234567), /^1\.234\.567\s\$$/);
  setDecimalSymbol('.');
});

test('numbers honour the requested decimals', () => {
  setDecimalSymbol('.');
  assert.equal(formatNumber(0.2784, 3), '0.278');
  assert.equal(formatNumber(1500), '1,500');
});

test('signed and compact money', () => {
  setDecimalSymbol('.');
  assert.equal(formatSignedCurrency(-150000), '-$150,000');
  assert.equal(formatSignedCurrency(80000), '+$80,000');
  assert.equal(formatMoneyCompact(1_250_000), '$1.3M');
  assert.equal(formatMoneyCompact(-45_000), '-$45K');
  assert.equal(formatMoneyCompact(2_400_000_000), '$2.4B');
});

test('non-finite input never prints NaN', () => {
  setDecimalSymbol('.');
  assert.equal(formatCurrency(NaN), '$0');
  assert.equal(formatMoneyCompact(Infinity), '$0');
});

test('month offsets read as game dates', () => {
  assert.equal(formatMonthOffset(0), '01/1960');
  assert.equal(formatMonthOffset(62), '03/1965');
  assert.equal(formatMonthLong(62), 'March 1965');
  assert.equal(formatMonthLong(11), 'December 1960');
  assert.equal(formatMonthOffset(Number.NaN), '01/1960', 'never NaN');
});

test('compact counts', () => {
  setDecimalSymbol('.');
  assert.equal(formatNumberCompact(950), '950');
  assert.equal(formatNumberCompact(1_250), '1.3K');
  assert.equal(formatNumberCompact(34_000), '34K');
  assert.equal(formatNumberCompact(1_200_000), '1.2M');
  assert.equal(formatNumberCompact(-2_000), '-2.0K');
});
