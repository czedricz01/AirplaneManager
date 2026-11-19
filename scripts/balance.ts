/**
 * Balance-Skript (Paket 3.9): rechnet Beispielwerte mit `src/model/` und prüft die Balance-Regeln der Spezifikation.
 *
 *   npm run balance                  → Bericht als Markdown auf die Konsole
 *   npm run balance -- --out <datei> → Bericht in eine Datei
 *
 * Die Rechnung steht in `src/balance/` (dort auch mit `npm run lint` geprüft); diese Datei ist nur der Aufruf.
 */

import { writeFileSync } from 'node:fs';
import { balanceReport, balanceSections, verdictCounts } from '../src/balance/index';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const started = Date.now();
const sections = balanceSections();
const report = balanceReport(sections);
const counts = verdictCounts(sections);
const seconds = ((Date.now() - started) / 1000).toFixed(1);

if (outIndex >= 0 && args[outIndex + 1]) {
  writeFileSync(args[outIndex + 1], `${report}\n`);
  console.log(`Bericht geschrieben: ${args[outIndex + 1]} (${seconds} s)`);
} else {
  console.log(report);
}
console.error(`Prüfregeln: ${counts.ok} ok, ${counts.abweichung} Abweichung, ${counts.info} Info (${seconds} s)`);
