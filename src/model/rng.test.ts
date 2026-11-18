/**
 * Regeltests zu SPEZIFIKATION 8.3 (Zufallsgeber) und zur Bauregel „kein Math.random im Modell“.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { rng } from './rng';

const SEED = 123_456_789;

describe('Abschnitt 8.3 Zufallsgeber', () => {
  it('8.3: rng liefert eine Zahl in [0, 1)', () => {
    for (let month = 0; month < 200; month++) {
      for (const key of ['D-ABCD', 'FRA', 0, 17]) {
        const value = rng(SEED, month, 'defect', key);
        assert.ok(Number.isFinite(value) && value >= 0 && value < 1, `${month}/${key}: ${value}`);
      }
    }
  });

  it('8.3: gleiche Eingaben → gleiche Zahl (jeder Abschluss wiederholbar)', () => {
    assert.equal(rng(SEED, 42, 'airportStrike', 'JFK'), rng(SEED, 42, 'airportStrike', 'JFK'));
  });

  it('8.3: die Reihenfolge der Würfe ändert kein Ergebnis', () => {
    const keys = ['a1', 'a2', 'a3', 'a4', 'a5'];
    const forward = keys.map((key) => rng(SEED, 7, 'defect', key));
    const backward = [...keys].reverse().map((key) => rng(SEED, 7, 'defect', key)).reverse();
    assert.deepEqual(backward, forward);
  });

  it('8.3: Startwert, Monat, Zweck und Schlüssel ändern je für sich das Ergebnis', () => {
    const base = rng(SEED, 10, 'defect', 'D-ABCD');
    assert.notEqual(rng(SEED + 1, 10, 'defect', 'D-ABCD'), base, 'Startwert');
    assert.notEqual(rng(SEED, 11, 'defect', 'D-ABCD'), base, 'Monat');
    assert.notEqual(rng(SEED, 10, 'randomEvent', 'D-ABCD'), base, 'Zweck');
    assert.notEqual(rng(SEED, 10, 'defect', 'D-ABCE'), base, 'Schlüssel');
  });

  it('8.3: die Teile der Eingabe verschmelzen nicht (Zweck „ab“ + Schlüssel „c“ ≠ „a“ + „bc“)', () => {
    assert.notEqual(rng(SEED, 0, 'ab', 'c'), rng(SEED, 0, 'a', 'bc'));
    assert.notEqual(rng(1, 23, 'x', 'k'), rng(12, 3, 'x', 'k'));
  });

  it('8.3: die Zahlen sind gleichmäßig verteilt (10 Fächer, je etwa 10 %)', () => {
    const draws = 20_000;
    const buckets = new Array<number>(10).fill(0);
    let sum = 0;
    for (let i = 0; i < draws; i++) {
      const value = rng(SEED, i % 240, 'randomEvent', Math.floor(i / 240));
      buckets[Math.floor(value * 10)]++;
      sum += value;
    }
    assert.ok(Math.abs(sum / draws - 0.5) < 0.01, `Mittel ${sum / draws}`);
    for (const count of buckets) {
      assert.ok(Math.abs(count / draws - 0.1) < 0.01, `Fach mit ${count} von ${draws}`);
    }
  });

  it('8.3: aufeinanderfolgende Monate hängen nicht zusammen', () => {
    // Korrelation benachbarter Würfe eines Zwecks und Schlüssels über die Monate.
    const values = Array.from({ length: 5000 }, (_, month) => rng(SEED, month, 'defect', 'D-ABCD'));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    let covariance = 0;
    let variance = 0;
    for (let i = 0; i < values.length - 1; i++) {
      covariance += (values[i] - mean) * (values[i + 1] - mean);
      variance += (values[i] - mean) ** 2;
    }
    assert.ok(Math.abs(covariance / variance) < 0.05, `Korrelation ${covariance / variance}`);
  });

  it('8.3: rng braucht kein Math.random', () => {
    const original = Math.random;
    Math.random = () => {
      throw new Error('Math.random im Modell');
    };
    try {
      assert.doesNotThrow(() => rng(SEED, 0, 'defect', 'x'));
    } finally {
      Math.random = original;
    }
  });

  it('8.3: keine Datei in src/model/ (ohne Tests) enthält Math.random', () => {
    const dir = fileURLToPath(new URL('.', import.meta.url));
    const files = readdirSync(dir).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'));
    assert.ok(files.length > 0);
    for (const name of files) {
      const source = readFileSync(join(dir, name), 'utf8');
      // Nur Aufrufe zählen; Kommentare dürfen das Wort nennen.
      assert.ok(!/Math\.random\s*\(/.test(source), `${name} ruft Math.random auf`);
    }
  });
});
