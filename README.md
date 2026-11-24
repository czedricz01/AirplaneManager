# AirlineManagerNeo

A single-player airline management simulator. You start in 1960 with a hub, a budget
and no aircraft, and build a route network month by month against AI competitors.

---

## Lokale Entwicklung

```bash
npm install
cp .env.example .env
npm run dev
```

In `.env` die zwei Werte des Supabase-Projekts eintragen (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`;
Erklärung in `.env.example`). Ohne sie startet das Spiel im lokalen Modus: keine Konten, Spielstände nur in
diesem Browser.

---

## Konfiguration

Alle Variablen stehen mit Erklärung in `.env.example`: Supabase (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`),
`DISABLE_HMR` (Hot Reload aus) und `HOST` (Entwicklungsserver fürs Netzwerk öffnen).

> Achtung: Variablen mit dem Präfix `VITE_` landen im ausgelieferten Browser-Bundle
> und sind damit öffentlich. Niemals ein echtes Geheimnis dort ablegen.

---

## Nützliche Befehle

| Befehl | Was er tut |
|---|---|
| `npm run dev` | Entwicklungsserver auf Port 3000, nur von diesem Rechner erreichbar (`HOST=0.0.0.0` öffnet ihn fürs Netzwerk) |
| `npm run build` | Produktions-Build nach `dist/` (inkl. Server) |
| `npm run build:pages` | Nur die statische Seite nach `dist/` (für GitHub Pages) |
| `npm run build:static` | Eine einzige eigenständige HTML-Datei nach `dist-static/` |
| `npm start` | Startet den gebauten Server (braucht `NODE_ENV=production`) |
| `npm test` | Alle Tests (`src/**/*.test.ts`, Node-Testrunner über `tsx`) |
| `npm run lint` | TypeScript-Typprüfung, ohne Dateien zu schreiben |
| `npm run balance` | Balance-Bericht des Rechenmodells (`scripts/balance.ts`, Rechnung in `src/balance/`) |
| `npm run clean` | Löscht `dist/` und `dist-static/` |

---

## Projektaufbau

```
src/
  App.tsx              Zentrale Komponente: Spielzustand, Karte, Monatswechsel
  main.tsx             Einstiegspunkt
  components/          Ansichten (Flotte, Routen, Flughäfen, Konkurrenz, Karriere, …)
    AuthGate.tsx       Anmeldung (Konten legt der Betreiber an)
  model/               Das Rechenmodell (Zufriedenheit, Nachfrage, Preis, Kosten, Ruf,
                       Konkurrenz, Monatsabschluss); siehe src/model/README.md
  lib/
    model*.ts          Brücke zwischen Spielstand/Ansichten und dem Modell
                       (Monatsabschluss modelMonth*.ts, Strecken-Prognose modelRoute.ts, …)
    airlineRank.ts, airportAccess.ts, aircraftClasses.ts, milestones.ts, annualGoals.ts,
    research.ts, careerScore.ts
                       Fortschritt in der Oberfläche: Normal/Free Mode, Ränge, Flughafenzugang,
                       Flugzeugklassen, Meilensteine, Jahresziel, Entwicklung, Ruhmeshalle;
                       Regeln und Tabellen kommen aus src/model/progress.ts
    eventSystem.ts     Weltereignisse für die Oberfläche (Daten aus dem Modell)
    disruptions.ts     Betriebsstörungen und die Charter-Frage
    scheduleUtils.ts   Wochen-Fahrplan (Umläufe, Kollisionen) für Planer und Flotte
    financeUtils.ts    Kleine Helfer der Ansichten (Flugzeit, Kabinen-Klassen, Infrastruktur)
    saveLoad.ts        Spielstand laden; nur die aktuelle Version, ältere werden gelöscht
    supabase.ts        Supabase-Client (null, wenn nicht konfiguriert)
    cloudSaves.ts      Spielstände: Cloud mit lokalem Rückfall und Abgleich
    configStore.ts     Gespeicherte Flugzeug- und Kabinen-Configs: pro Konto, gleiches Prinzip
    imageUtils.ts      Auflösung von Flugzeugbild-URLs
  balance/             Balance-Rechnungen mit dem Modell (Aufruf: npm run balance)
  data/                Flughäfen, Flugzeuge, Treibstoffpreise, Catering, Szenarien, KI-Gesellschaften
docs/neubau/           Neubau des Rechenmodells: Spezifikation, Entscheidungen, Status
supabase/schema.sql    Tabellen und Zugriffsregeln
server.ts              Express-Server: Vite im Dev-Modus, Bild-Upload-API
```

Die Spielrechnung liegt vollständig in `src/model/` (Neubau, siehe `docs/neubau/`).
Ansichten und Monatsabschluss rufen sie über die Brücke `src/lib/model*.ts` auf,
damit Vorschau und Monatsabrechnung nicht auseinanderlaufen.

Ältere Analysen (`ANALYSE.md`, `SAT-ANALYSE.md`, `docs/CODE_REVIEW.md`) beschreiben das Spiel vor dem Neubau
und sind als veraltet gekennzeichnet.
