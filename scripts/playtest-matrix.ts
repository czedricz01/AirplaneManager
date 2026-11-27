/**
 * Spieltest-Matrix (Strategien × Schwierigkeit × Zeitalter × Startwert) ohne Browser, siehe `src/balance/playtest.ts`.
 *
 *   tsx scripts/playtest-matrix.ts [--jobs 4] [--cache .playtest-runs] [--only <Teil des Namens>] [--reuse]
 *
 * Jedes Spiel läuft in einem eigenen Prozess (`scripts/playtest.ts`) und schreibt `<cache>/<label>.json`.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Difficulty, PlaySettings, Strategy } from '../src/balance/playtest';

const args = process.argv.slice(2);
const opt = (n: string, d: string) => (args.indexOf(n) >= 0 ? args[args.indexOf(n) + 1] : d);
const jobs = Number(opt('--jobs', '4'));
const cache = opt('--cache', '.playtest-runs');
const only = opt('--only', '');
const reuse = args.includes('--reuse');

const S = (name: string, over: Partial<Strategy>): Strategy => ({
  name, style: 'default', price: 1, pick: 'popular', plane: 'cheap', trips: 7, cutAfter: 0, reserve1960: 1_000_000,
  maxRoutes: 0, needPositiveForecast: false, buysPerMonth: 1, ...over,
});

export const STRATEGIES: Strategy[] = [
  // Spieler, der die Vorschläge von Kaufdialog und Planer übernimmt: Kabine alles Economy, kein Service, Marktpreis, 1×/Tag.
  S('standard', { plane: 'mid' }),
  // Wie „standard“, aber mit dem besten Preis des Planers und nur bei positiver Prognose; schließt Dauer-Verlierer.
  S('vorsichtig', { plane: 'mid', price: 'best', needPositiveForecast: true, cutAfter: 6 }),
  // Ryanair: dichte Kabine ohne Service, 15 % unter Markt, größter Typ bis 150 Sitze, Frequenz nach Prognose.
  S('ryanair', { style: 'lcc', price: 0.85, pick: 'forecast', plane: 'mid', trips: 'fit', cutAfter: 4, needPositiveForecast: true, buysPerMonth: 2 }),
  // Wie „ryanair“, aber mehrere Strecken je Flugzeug hintereinander am Tag (Paket 5.4f, E98: kurze Wende zählt nur so).
  S('ryanair-pack', { style: 'lcc', price: 0.85, pick: 'forecast', plane: 'mid', trips: 'fit', cutAfter: 4, needPositiveForecast: true, buysPerMonth: 2, pack: true }),
  // Wie „vorsichtig“, aber ebenfalls mehrere Strecken je Flugzeug (Vergleich zu „ryanair-pack“).
  S('vorsichtig-pack', { plane: 'mid', price: 'best', needPositiveForecast: true, cutAfter: 6, pack: true }),
  // Wie „ryanair“, aber mit dem größten Schmalrumpf (757, A321).
  S('ryanair-gross', { style: 'lcc', price: 0.85, pick: 'forecast', plane: 'narrow', trips: 'fit', cutAfter: 4, needPositiveForecast: true, buysPerMonth: 2 }),
  // Luxus: Boutique-Kabine und -Service, bester Preis (Zahlungsbereitschaft), effiziente Flugzeuge.
  S('luxus', { style: 'boutique', price: 'best', pick: 'forecast', plane: 'efficient', trips: 7, cutAfter: 4, needPositiveForecast: true }),
  // Luxus mit festem Aufschlag 35 % statt bestem Preis.
  S('luxus-fix', { style: 'boutique', price: 1.35, pick: 'popular', plane: 'mid', trips: 7, cutAfter: 6 }),
  // Optimierer: bester Preis jeden Monat, beste Prognose, Frequenz nach Prognose, schließt Verlierer schnell.
  S('optimierer', { style: 'optimizer', price: 'best', pick: 'forecast', plane: 'efficient', trips: 'fit', cutAfter: 3, needPositiveForecast: true, buysPerMonth: 2 }),
  // Flag Carrier mit großen Flugzeugen auf beliebten Zielen, Marktpreis.
  S('flag-gross', { style: 'flag', price: 1, pick: 'popular', plane: 'big', trips: 7, cutAfter: 6 }),
  // Schlecht: guter Service zu Dumpingpreisen, irgendein Ziel, so oft wie möglich, keine Reserve, 3 Käufe je Monat.
  S('schlecht-dumping', { style: 'flag', price: 0.7, pick: 'any', plane: 'big', trips: 'max', reserve1960: 0, buysPerMonth: 3 }),
  // Schlecht: billigste Flugzeuge, 60 % über Markt, zufällige beliebte Ziele, keine Reserve.
  S('schlecht-wucher', { style: 'default', price: 1.6, pick: 'random', plane: 'cheap', trips: 7, reserve1960: 0, buysPerMonth: 2 }),
];

const ERAS = [
  { id: 'free1995', hub: 'FRA', startYear: 1995, years: 10, mode: 'free' as const, budget1960: 50_000_000 },
  { id: 'normal1970', hub: 'DUS', startYear: 1970, years: 10, mode: 'normal' as const, budget1960: 50_000_000 },
];
const DIFFS: Difficulty[] = ['Easy', 'Normal', 'Hard'];

const list: PlaySettings[] = [];
for (const era of ERAS) for (const d of DIFFS) for (const st of STRATEGIES) for (const seed of [1, 2]) {
  list.push({ label: `${era.id}-${d}-${st.name}-s${seed}`, hub: era.hub, startYear: era.startYear, years: era.years, difficulty: d, aiDifficulty: d,
    aiCount: 6, budget1960: era.budget1960, mode: era.mode, seed, strategy: st });
}
// Streckenprobe: 10 beliebteste Ziele auf einmal mit einem festen Typ, Standard-Spieler, nichts schließen
// (Frage „jede beliebte Strecke profitabel?“).
const PROBE_TYPES: Record<string, string[]> = { free1995: ['atr-72-210', '737-300'], normal1970: ['f27-500', 'hs-748-series-2'] };
for (const era of ERAS) for (const d of DIFFS) for (const typeId of PROBE_TYPES[era.id]) {
  list.push({ label: `probe-${era.id}-${d}-${typeId}`, hub: era.hub, startYear: era.startYear, years: 3, difficulty: d, aiDifficulty: d, aiCount: 6,
    budget1960: 200_000_000, mode: era.mode, seed: 1, strategy: S(`probe-${typeId}`, { typeId, maxRoutes: 10, buysPerMonth: 10, reserve1960: 0, sellIdleAfter: 0 }) });
}
// Start 2025 (neue Grenze): Standard und Optimierer, 5 Jahre.
for (const d of DIFFS) for (const st of STRATEGIES.filter((x) => ['standard', 'optimierer', 'luxus'].includes(x.name))) {
  list.push({ label: `free2025-${d}-${st.name}-s1`, hub: 'FRA', startYear: 2025, years: 5, difficulty: d, aiDifficulty: d, aiCount: 6,
    budget1960: 50_000_000, mode: 'free', seed: 1, strategy: st });
}

const todo = list.filter((s) => s.label.includes(only)).filter((s) => !(reuse && existsSync(join(cache, `${s.label}.json`))));
mkdirSync(cache, { recursive: true });
console.error(`${todo.length} Spiele, ${jobs} gleichzeitig`);
let next = 0;
let done = 0;
const t0 = Date.now();
await new Promise<void>((resolve) => {
  const start = () => {
    if (next >= todo.length) {
      if (done === todo.length) resolve();
      return;
    }
    const s = todo[next++];
    const child = spawn('npx', ['tsx', 'scripts/playtest.ts', JSON.stringify(s), join(cache, `${s.label}.json`)], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => {
      done++;
      console.error(`[${done}/${todo.length}] ${s.label} ${code === 0 ? 'ok' : 'FEHLER ' + err.split('\n').filter((l) => /Error/.test(l)).slice(0, 2).join(' | ')} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
      start();
    });
  };
  for (let i = 0; i < jobs; i++) start();
});
