/**
 * Spieltest ohne Browser (siehe `src/balance/playtest.ts`).
 *
 *   tsx scripts/playtest.ts '<PlaySettings als JSON>' <Ergebnis-Datei>   → ein Spiel, Ergebnis als JSON
 */
import { writeFileSync } from 'node:fs';
import { play, type PlaySettings } from '../src/balance/playtest';

const settings = JSON.parse(process.argv[2]) as PlaySettings;
const out = process.argv[3];
const result = play(settings, (year, cash) => console.error(`${settings.label}: ${year} · Kasse ${(cash / 1e6).toFixed(1)} Mio. $`));
if (out) writeFileSync(out, JSON.stringify(result));
else console.log(JSON.stringify({ ...result, months: result.months.slice(-3) }, null, 1));
