/**
 * Schreibt die Jahreswerte Tourismus/Geschäft aus den Quelldaten in die Spieldaten:
 * `src/data/airportsRows.ts` und `src/data/moreAirportsRows.ts`. Name, Lage, Stufe und ICAO-Code bleiben.
 *
 * Aufruf: `npx tsx scripts/airport-traffic/build.ts`
 * Neu ausführen nach jeder Änderung in `scripts/airport-traffic/data-*.ts`. Herleitung: `series.ts`,
 * Quellen in den Kopfzeilen der Daten-Dateien, Erklärung in `docs/neubau/balance/D1-stadtwerte.md`.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AirportRow } from '../../src/data/airportTypes';
import { airportRows } from '../../src/data/airportsRows';
import { moreAirportRows } from '../../src/data/moreAirportsRows';
import { TRAFFIC } from './data';
import { statsRow } from './series';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const HEADER = `// Generiert von scripts/airport-traffic/build.ts -- nicht von Hand ändern.
//
// Je Flughafen: [Code, Name, Breite, Länge, Stufe, ICAO-Code, Tabelle]. Die Tabelle enthält ab 1960 je Jahr
// zwei Werte, Tourismus und Geschäft: Ziel- und Quellverkehr der Stadt in tausend Fluggästen je Jahr, aus
// realen Passagierzahlen (Quellen: scripts/airport-traffic/data-*.ts).
import type { AirportRow } from './airportTypes';
`;

function render(name: string, rows: readonly AirportRow[], comment: string): string {
  const lines = rows.map((r) => {
    const entry = TRAFFIC[r[0]];
    if (!entry) throw new Error(`keine Quelldaten für ${r[0]}`);
    const row: AirportRow = [r[0], r[1], r[2], r[3], r[4], r[5], statsRow(entry)];
    return JSON.stringify(row);
  });
  return `${HEADER}//\n// ${comment}\n\nexport const ${name}: AirportRow[] = [\n${lines.join(',\n')},\n];\n`;
}

writeFileSync(
  path.join(root, 'src/data/airportsRows.ts'),
  render('airportRows', airportRows, `${airportRows.length} Hauptflughäfen; nur sie zählen zur Weltsumme (worldScale).`),
);
writeFileSync(
  path.join(root, 'src/data/moreAirportsRows.ts'),
  render('moreAirportRows', moreAirportRows, `${moreAirportRows.length} weitere Flughäfen.`),
);
console.log(`geschrieben: ${airportRows.length} + ${moreAirportRows.length} Flughäfen`);
