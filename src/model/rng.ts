/**
 * Zufallsgeber des Modells: SPEZIFIKATION 8.3.
 *
 * Eigene Datei (statt im späteren Abschnitt-8-Modul), weil alle Abschnitte ihn nutzen dürfen.
 *
 * `rng(seed, month, purpose, key)` liefert eine Zahl in [0, 1), nur aus
 * - `seed`: Startwert des Spielstands (beim neuen Spiel außerhalb des Modells gewürfelt),
 * - `month`: Spielmonat,
 * - `purpose`: Zweck des Wurfs, z. B. `defect`, `airportStrike`, `randomEvent`,
 * - `key`: Kennung, z. B. eines Flugzeugs oder Flughafens.
 *
 * Gleiche Eingaben geben immer dieselbe Zahl. Es gibt keinen inneren Zustand:
 * Die Reihenfolge der Würfe ändert kein Ergebnis, und ein Test kann jeden Abschluss
 * wiederholen. Im Modell gibt es kein `Math.random`.
 */

/** Trennzeichen zwischen den Teilen der Eingabe („unit separator“), damit z. B. `ab|c` ≠ `a|bc`. */
const SEPARATOR = '\u001f';

/** 2^53: Ergebnis der Prüfsumme liegt in 0 … 2^53 − 1. */
const TWO_POW_53 = 2 ** 53;

/**
 * 53-Bit-Prüfsumme einer Zeichenkette (Verfahren „cyrb53“ von bryc, gemeinfrei;
 * Quelle: https://github.com/bryc/code/blob/master/jshash/experimental/cyrb53.js).
 *
 * Einfach erklärt: Zwei 32-Bit-Zähler nehmen jedes Zeichen auf und werden dabei mit
 * großen ungeraden Zahlen multipliziert und verwirbelt. Am Ende werden beide gemischt
 * und zu einer 53-Bit-Zahl zusammengesetzt. Schon ein anderes Zeichen ändert das
 * Ergebnis völlig.
 */
function hash53(text: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * Zufallszahl in [0, 1) aus Startwert, Monat, Zweck und Schlüssel. SPEZIFIKATION 8.3.
 */
export function rng(seed: number, month: number, purpose: string, key: string | number): number {
  const text = [String(seed), String(month), purpose, String(key)].join(SEPARATOR);
  return hash53(text) / TWO_POW_53;
}
