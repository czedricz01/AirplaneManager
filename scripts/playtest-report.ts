/**
 * Auswertung der Spieltest-Matrix (`scripts/playtest-matrix.ts`) als Markdown-Tabellen auf die Konsole.
 *
 *   tsx scripts/playtest-report.ts [--cache .playtest-runs]
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PlayResult } from '../src/balance/playtest';

const args = process.argv.slice(2);
const cache = args.indexOf('--cache') >= 0 ? args[args.indexOf('--cache') + 1] : '.playtest-runs';
const runs: PlayResult[] = readdirSync(cache).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(cache, f), 'utf8')));
const mio = (n: number) => (Number.isFinite(n) ? (n / 1e6).toFixed(n !== 0 && Math.abs(n) < 1e7 ? 1 : 0) : '–');
const pct = (n: number) => (Number.isFinite(n) ? `${Math.round(n * 100)} %` : '–');
const ym = (m: number) => `${String((m % 12) + 1).padStart(2, '0')}/${1960 + Math.floor(m / 12)}`;
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

function row(r: PlayResult): string[] {
  const m = r.months;
  const last = m[m.length - 1];
  const last12 = m.slice(-12);
  const profit12 = last12.reduce((a, x) => a + x.profit, 0);
  const minCash = Math.min(...m.map((x) => x.cash));
  const rs = r.routes.filter((x) => Number.isFinite(x.avgMonthlyAfterRamp));
  const pos = rs.filter((x) => x.avgMonthlyAfterRamp > 0).length;
  const closed = r.routes.filter((x) => x.closed !== undefined).length;
  return [
    r.bankrupt ? `**Pleite ${ym(r.bankruptMonth!)}**` : 'nein',
    mio(last?.cash ?? NaN), mio(minCash), mio(last?.companyValue ?? NaN), mio(profit12), String(last?.routes ?? 0), `${pos}/${rs.length}`, String(closed),
    pct(last?.loadFactor ?? NaN), (last?.reputation ?? 0).toFixed(0), String(last?.rank ?? 0),
  ];
}

const header = '| Strategie | Start | Pleite | Kasse Ende | tiefste Kasse | Firmenwert | Ergebnis letzte 12 M. | Strecken | Strecken mit Gewinn | geschlossen | Auslastung | Ruf | Rang |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|';
const groups = new Map<string, PlayResult[]>();
for (const r of runs) {
  const l = r.settings.label;
  if (l.startsWith('probe-')) continue;
  const key = l.split('-').slice(0, 2).join(' ');
  groups.set(key, [...(groups.get(key) ?? []), r]);
}
const order = (k: string) => ['free1995', 'normal1970', 'free2025'].indexOf(k.split(' ')[0]) * 10 + ['Easy', 'Normal', 'Hard'].indexOf(k.split(' ')[1]);
for (const key of [...groups.keys()].sort((a, b) => order(a) - order(b))) {
  console.log(`\n#### ${key} (Beträge in Mio. $ des jeweiligen Monats)\n`);
  console.log(header);
  const list = groups.get(key)!.sort((a, b) => a.settings.label.localeCompare(b.settings.label));
  for (const r of list) console.log(`| ${r.settings.strategy.name} | s${r.settings.seed} | ${row(r).join(' | ')} |`);
}

console.log('\n#### Streckenprobe: 15 beliebteste Ziele auf einmal, Standard-Kabine, Marktpreis, 1×/Tag, 3 Jahre\n');
console.log('| Zeitalter | Schwierigkeit | Flugzeug | Strecken mit Gewinn (Mittel ab Monat 4) | Median Ergebnis je Monat | schlechteste Strecke | Auslastung (Median) | Typ |\n|---|---|---|---|---|---|---|---|');
for (const r of runs.filter((x) => x.settings.label.startsWith('probe-')).sort((a, b) => a.settings.label.localeCompare(b.settings.label))) {
  const [, era, diff, plane] = r.settings.label.split('-');
  const rs = r.routes.filter((x) => Number.isFinite(x.avgMonthlyAfterRamp));
  const pos = rs.filter((x) => x.avgMonthlyAfterRamp > 0).length;
  const worst = rs.reduce((w, x) => (x.avgMonthlyAfterRamp < w.avgMonthlyAfterRamp ? x : w), rs[0]);
  console.log(`| ${era} | ${diff} | ${plane} | ${pos}/${rs.length} | ${mio(median(rs.map((x) => x.avgMonthlyAfterRamp)))} | ${worst ? `${worst.pair} ${mio(worst.avgMonthlyAfterRamp)}` : '–'} | ${pct(median(rs.map((x) => x.loadFactor)))} | ${[...new Set(rs.map((x) => x.type))].join(', ')} |${r.bankrupt ? ' Pleite' : ''}`);
}

// Prognose gegen Ergebnis: erstes Jahr nach dem Anlauf (Monate 10–21) gegen „Expected weekly profit“ × Wochen je Monat.
console.log('\n#### Prognose beim Eröffnen gegen Ergebnis im ersten Jahr nach dem Anlauf (Monate 10–21)\n');
console.log('| Gruppe | Strecken | Prognose je Monat (Median) | Ergebnis je Monat (Median) | Ergebnis ≥ 50 % der Prognose | Ergebnis < 0 bei Prognose > 0 |\n|---|---|---|---|---|---|');
const WPM = 4.348;
const acc = new Map<string, { f: number; a: number }[]>();
for (const r of runs) {
  const key = r.settings.label.startsWith('probe-') ? 'Streckenprobe' : `${r.settings.label.split('-')[0]} ${r.settings.difficulty}`;
  for (const x of r.routes) if (x.avgMonthlyYear1 !== undefined && Number.isFinite(x.forecastWeekly)) acc.set(key, [...(acc.get(key) ?? []), { f: x.forecastWeekly * WPM, a: x.avgMonthlyYear1 }]);
}
for (const [k, xs] of [...acc.entries()].sort()) {
  const half = xs.filter((x) => x.f > 0 && x.a >= 0.5 * x.f).length;
  const flip = xs.filter((x) => x.f > 0 && x.a < 0).length;
  const posF = xs.filter((x) => x.f > 0).length;
  console.log(`| ${k} | ${xs.length} | ${mio(median(xs.map((x) => x.f)))} | ${mio(median(xs.map((x) => x.a)))} | ${half}/${posF} | ${flip}/${posF} |`);
}
