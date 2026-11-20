/**
 * Regeltests zu Paket 4.1 (Glossar und Erklärtexte, E52): Jede Zahl in einem Text kommt aus den Konstanten.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  DESK_OVERLOAD_MAX,
  DESK_TYPE_PENALTY,
  FLIGHT_TIME_INDEX_ANCHORS,
  LOUNGE_POINTS,
  SCALES,
  SLOTS_PER_AIRPORT_LEVEL,
  STAND_POINTS,
  WEAR_FLOOR,
} from './constants';
import { CLASS_LABEL, MODEL_GLOSSARY, loungeEffectText, textNumber, textPercent, textSigned } from './glossary';
import { deskOverloadPoints, satisfactionFactor } from './satisfaction';

const entries = Object.entries(MODEL_GLOSSARY);
const allText = entries.map(([, e]) => `${e.title}\n${e.desc}`).join('\n');

describe('Paket 4.1 Glossar aus den Konstanten', () => {
  it('E52: glossary.ts enthält keine Zahl mit Spielbedeutung (nur 0, 1, 2, 100)', () => {
    const source = readFileSync(fileURLToPath(new URL('./glossary.ts', import.meta.url)), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    const numbers = source.match(/(?<![\w.])\d+(?:\.\d+)?(?!\w)/g) ?? [];
    const unexpected = numbers.filter((n) => !['0', '1', '2', '100'].includes(n));
    assert.deepEqual(unexpected, []);
  });

  it('E52: jeder Eintrag hat Titel und Text, ohne ungültige Zahlen', () => {
    for (const [key, entry] of entries) {
      assert.ok(entry.title.length > 0, key);
      assert.ok(entry.desc.length > 0, key);
      assert.doesNotMatch(`${entry.title} ${entry.desc}`, /NaN|undefined|Infinity|\[object/, key);
    }
  });

  it('1.5 (E9): kein Sammelname „SAT“ in den Texten', () => {
    assert.doesNotMatch(allText, /\bSAT\b/);
  });

  it('2.6.3: Stände, Schalter-Last und Schalter-Art nennen die Werte der Konstanten', () => {
    assert.match(MODEL_GLOSSARY.stands.desc, new RegExp(`adds ${textNumber(STAND_POINTS)} satisfaction points`));
    assert.match(MODEL_GLOSSARY.deskLoad.desc, new RegExp(`about ${textNumber(-deskOverloadPoints(1), 0)} points at 100%`));
    assert.match(MODEL_GLOSSARY.deskLoad.desc, new RegExp(`the full ${textNumber(DESK_OVERLOAD_MAX)} from`));
    assert.match(MODEL_GLOSSARY.desks.desc, new RegExp(`lose ${textNumber(Math.abs(DESK_TYPE_PENALTY))} satisfaction`));
  });

  it('2.6.3: Schalter-Last-Beispiele liegen auf der Kurve des Modells (voller Abzug ab der genannten Last)', () => {
    const fullFrom = MODEL_GLOSSARY.deskLoad.desc.match(/the full \d+ from (\d+(?:\.\d+)?)%/);
    assert.ok(fullFrom);
    const load = Number(fullFrom[1]) / 100;
    assert.ok(Math.abs(deskOverloadPoints(load) + DESK_OVERLOAD_MAX) < 1e-9);
    assert.ok(deskOverloadPoints(load - 0.01) > -DESK_OVERLOAD_MAX);
  });

  it('2.6.3: Lounge-Text = halbe Punkte je Ende, volle an beiden Enden', () => {
    const text = loungeEffectText();
    assert.match(text, new RegExp(`\\${textSigned(LOUNGE_POINTS.business / 2)} \\(${CLASS_LABEL.business}/${CLASS_LABEL.first}\\)`));
    assert.match(text, new RegExp(`\\${textSigned(LOUNGE_POINTS.premium / 2)} \\(${CLASS_LABEL.premium}\\)`));
    assert.doesNotMatch(text, new RegExp(CLASS_LABEL.economy));
  });

  it('2.10: Satisfaction-Text nennt die Zahlungsbereitschaft aus satisfactionFactor', () => {
    const max = SCALES.satisfaction.max;
    assert.match(MODEL_GLOSSARY.sat.desc, new RegExp(`about ${textPercent(satisfactionFactor(max) - 1)} more at ${max}`));
  });

  it('2.1, 2.4, 5.10: Flugzeit-Index, Abnutzung und Slot-Grenze aus den Konstanten', () => {
    const last = FLIGHT_TIME_INDEX_ANCHORS[FLIGHT_TIME_INDEX_ANCHORS.length - 1];
    assert.match(MODEL_GLOSSARY.timeClass.desc, new RegExp(`${last[1]} \\(${last[0]} minutes or more\\)`));
    assert.match(MODEL_GLOSSARY.conditionInterior.desc, new RegExp(`keeps ${textPercent(WEAR_FLOOR)}`));
    assert.match(MODEL_GLOSSARY.airportLevel.desc, new RegExp(`${SLOTS_PER_AIRPORT_LEVEL} per level`));
    assert.match(MODEL_GLOSSARY.slots.desc, new RegExp(`${SLOTS_PER_AIRPORT_LEVEL} per level`));
  });

  it('Zahlen für Texte: Tausender-Komma, höchstens die genannten Nachkommastellen, Vorzeichen', () => {
    assert.equal(textNumber(5000), '5,000');
    assert.equal(textNumber(0.25, 1), '0.3');
    assert.equal(textNumber(1.2), '1.2');
    assert.equal(textPercent(0.2), '20%');
    assert.equal(textSigned(-10), '−10');
    assert.equal(textSigned(4), '+4');
  });
});
