/**
 * Strecken-Probe (siehe `probeForecasts` in `src/balance/playtest.ts`): Planer-Prognose der 20 beliebtesten offenen
 * Ziele je Flugzeugtyp im Startmonat eines neuen Spiels, ohne Monate zu spielen.
 *
 *   tsx scripts/playtest-probe.ts <Hub> <Startjahr> <free|normal> <Easy|Normal|Hard> <Typ,Typ,…> <Stil> <Preis|best> <Umläufe|max|fit>
 *   z. B. tsx scripts/playtest-probe.ts FRA 1995 free Normal 737-300,a320ceo default 1 7   (V=1 zeigt jede Strecke)
 */
import { probeForecasts, type PlaySettings } from '../src/balance/playtest';
const [hub, year, mode, diff, types, style, price, trips] = process.argv.slice(2);
const s: PlaySettings = { label: 'probe', hub, startYear: Number(year), years: 1, difficulty: diff as never, aiDifficulty: diff as never, aiCount: 6, budget1960: 50_000_000, mode: mode as never, seed: 1, strategy: {} as never };
const rows = probeForecasts(s, types.split(','), 20, style as never, price === 'best' ? 'best' : Number(price), trips === 'max' || trips === 'fit' ? trips : Number(trips));
const byType = new Map<string, typeof rows>();
for (const r of rows) byType.set(r.type, [...(byType.get(r.type) ?? []), r]);
for (const [t, rs] of byType) {
  const pos = rs.filter((r) => r.weekly > 0).length;
  console.log(`${t}: ${pos}/${rs.length} positiv · Median ${Math.round(rs.map(r=>r.weekly).sort((a,b)=>a-b)[Math.floor(rs.length/2)])} $/Wo · Auslastung ${(rs.reduce((a,r)=>a+r.load,0)/rs.length*100).toFixed(0)} % · Preisniveau Eco ${(rs.reduce((a,r)=>a+r.fareRatio,0)/rs.length).toFixed(2)}`);
  if (process.env.V) for (const r of rs) console.log('   ', r.dest, r.km, r.popularity, r.trips, Math.round(r.weekly), (r.load*100).toFixed(0));
}
