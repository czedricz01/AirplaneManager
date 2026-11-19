/**
 * Balance-Skript (Paket 3.9): alle Abschnitte zu einem Bericht. Kein Spielcode; die Oberfläche importiert nichts von hier.
 *
 * Aufruf: `npm run balance` (Ausgabe als Markdown), `npm run balance -- --out <datei>` schreibt die Ausgabe in eine Datei,
 * `npm run balance -- --long` rechnet dazu die Langläufe der KI (Paket 3.9b, `longRun.ts`, `competition.ts`).
 */

import { demandSection, satisfactionSection, timeAndMoney } from './market';
import { renderMarkdown, type Section } from './report';
import { routeSections } from './routes';

export { renderMarkdown, verdictCounts, type Check, type Section, type Table, type Verdict } from './report';

/** Alle Abschnitte des Berichts (Paket 3.9a: Abschnitte 1–5 der Spezifikation). */
export function balanceSections(): Section[] {
  return [timeAndMoney(), satisfactionSection(), demandSection(), ...routeSections()];
}

/** Einleitung des Berichts. */
export const BALANCE_INTRO = [
  'Erzeugt mit `npm run balance` aus `src/balance/` (Pakete 3.9a, 3.9b; Langläufe mit `--long`). Alle Zahlen kommen aus den Funktionen in `src/model/`',
  'mit den Startwerten aus `src/model/constants.ts`; das Skript ändert keine Konstante. Bewertung und Empfehlungen:',
  '`docs/neubau/BALANCE.md`.',
  '',
  'Urteile: **ok** = Regel der Spezifikation gilt; **Abweichung** = Regel gilt nicht (Entscheidung nötig);',
  '**Info** = keine feste Grenze in der Spezifikation, Wert zur Bewertung.',
].join('\n');

/** Der ganze Bericht als Markdown. */
export function balanceReport(sections: readonly Section[] = balanceSections()): string {
  return renderMarkdown('Balance-Bericht', BALANCE_INTRO, sections);
}
