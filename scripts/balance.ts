/**
 * Balance-Skript (Paket 3.9): rechnet Beispielwerte mit `src/model/` und prüft die Balance-Regeln der Spezifikation.
 *
 *   npm run balance                  → Bericht als Markdown auf die Konsole (Abschnitte 1–6 und 8, wenige Sekunden)
 *   npm run balance -- --out <datei> → Bericht in eine Datei
 *   npm run balance -- --long        → dazu die Langläufe der KI (Abschnitt 7, 3.13; Paket 3.9b), etwa 1–2 Stunden
 *
 * Optionen der Langläufe: `--runs <n>` (Läufe je Art, Standard 10; „ohne Zuschuss“ nur, solange `RIVAL_SUBSIDY_ENABLED`), `--years <n>` (Standard 60), `--strength-runs <n>`
 * (Läufe je Stärke Easy/Hard, Standard 3, über 40 Jahre), `--jobs <n>` (gleichzeitige Prozesse, Standard 4),
 * `--cache <ordner>` (Ergebnisse je Lauf als JSON, Standard `.balance-runs`), `--reuse` (vorhandene Ergebnisse nicht
 * neu rechnen).
 *
 * Die Rechnung steht in `src/balance/` (dort auch mit `npm run lint` geprüft); diese Datei ist nur der Aufruf.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { balanceReport, balanceSections, verdictCounts } from '../src/balance/index';
import { competitionSections } from '../src/balance/competition';
import type { LongRunResult, LongRunSettings } from '../src/balance/longRun';
import { RIVAL_SUBSIDY_ENABLED } from '../src/model/constants';

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const outFile = option('--out', '');
const long = args.includes('--long');

/** Die Läufe: je Art `runs` Läufe (mit und ohne Zuschuss), dazu Easy und Hard. */
function longRunSettings(): LongRunSettings[] {
  const runs = Number(option('--runs', '10'));
  const years = Number(option('--years', '60'));
  const strengthRuns = Number(option('--strength-runs', '3'));
  const list: LongRunSettings[] = [];
  for (let run = 0; run < runs; run++) list.push({ run, startYear: 1960, years, strength: 'normal', subsidy: true });
  // Läufe ohne Zuschuss nur, solange es ihn gibt (abgeschafft nach E68, Paket 3.9e): sonst gleichen sie den Haupt-Läufen.
  if (RIVAL_SUBSIDY_ENABLED) for (let run = 0; run < runs; run++) list.push({ run, startYear: 1960, years, strength: 'normal', subsidy: false });
  for (const strength of ['easy', 'hard'] as const) {
    for (let run = 0; run < strengthRuns; run++) list.push({ run, startYear: 1960, years: Math.min(40, years), strength, subsidy: true });
  }
  return list;
}

const fileOf = (dir: string, s: LongRunSettings) => join(dir, `${s.strength}-${s.subsidy ? 'zuschuss' : 'ohne'}-${s.years}j-${s.run}.json`);

/** Rechnet die Läufe in bis zu `jobs` Prozessen gleichzeitig (`scripts/balance-run.ts`). */
async function computeRuns(): Promise<LongRunResult[]> {
  const dir = option('--cache', '.balance-runs');
  const jobs = Number(option('--jobs', '4'));
  const reuse = args.includes('--reuse');
  mkdirSync(dir, { recursive: true });
  const todo = longRunSettings().filter((s) => !(reuse && existsSync(fileOf(dir, s))));
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const s = todo[next++];
      await new Promise<void>((resolve, reject) => {
        const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/balance-run.ts', JSON.stringify(s), fileOf(dir, s)], { stdio: ['ignore', 'inherit', 'inherit'] });
        child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`Lauf ${JSON.stringify(s)} endete mit ${code}`))));
      });
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, jobs) }, worker));
  return longRunSettings().map((s) => JSON.parse(readFileSync(fileOf(dir, s), 'utf8')) as LongRunResult);
}

const started = Date.now();
const sections = [...balanceSections(), ...(long ? competitionSections(await computeRuns()) : [])];
const report = balanceReport(sections);
const counts = verdictCounts(sections);
const seconds = ((Date.now() - started) / 1000).toFixed(1);

if (outFile) {
  writeFileSync(outFile, `${report}\n`);
  console.log(`Bericht geschrieben: ${outFile} (${seconds} s)`);
} else {
  console.log(report);
}
console.error(`Prüfregeln: ${counts.ok} ok, ${counts.abweichung} Abweichung, ${counts.info} Info (${seconds} s)`);
