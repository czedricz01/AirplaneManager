/**
 * Balance-Skript (Paket 3.9b): ein Langlauf in einem eigenen Prozess (damit `npm run balance -- --long` mehrere Läufe
 * gleichzeitig rechnen kann).
 *
 *   tsx scripts/balance-run.ts '<Einstellungen als JSON>' <Ergebnis-Datei>
 *
 * Schreibt das Ergebnis (`LongRunResult`) als JSON und meldet jedes Jahr auf stderr.
 */

import { writeFileSync } from 'node:fs';
import { runLong, type LongRunSettings } from '../src/balance/longRun';

const settings = JSON.parse(process.argv[2]) as LongRunSettings;
const out = process.argv[3];
const result = runLong(settings, (y) => {
  const alive = y.companies.filter((c) => c.status !== 'liquidated').length;
  const routes = y.companies.reduce((s, c) => s + c.routes, 0);
  console.error(`run ${settings.run}${settings.subsidy ? '' : ' ohne Zuschuss'} ${settings.strength}: ${y.year} · ${alive} KI · ${routes} Strecken · ${(y.ms / 1000).toFixed(1)} s`);
});
writeFileSync(out, JSON.stringify(result));
