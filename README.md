# AirlineManagerNeo

A single-player airline management simulator. You start in 1960 with a hub, a budget
and no aircraft, and build a route network month by month against AI competitors.

---


### Lokale Entwicklung

```bash
cp .env.example .env
```

Dieselben zwei Werte eintragen. Ohne sie startet der Entwicklungsserver im
lokalen Modus.

---

## Konfiguration

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
| `npm run lint` | TypeScript-Typprüfung, ohne Dateien zu schreiben |
| `npm run clean` | Löscht `dist/` |

---

## Projektaufbau

```
src/
  App.tsx              Zentrale Komponente: Spielzustand, Karte, Monatswechsel
  main.tsx             Einstiegspunkt
  components/          Ansichten (Flotte, Routen, Flughäfen, Konkurrenz, …)
  components/
    AuthGate.tsx       Anmeldung (Konten legt der Betreiber an)
  model/               Das Rechenmodell (Zufriedenheit, Nachfrage, Preis, Kosten, Ruf,
                       Konkurrenz, Monatsabschluss); siehe src/model/README.md
  lib/
    model*.ts          Brücke zwischen Spielstand/Ansichten und dem Modell
    financeUtils.ts    Kleine Helfer der Ansichten (Flugzeit, Kabinen-Klassen, Infrastruktur)
    eventSystem.ts     Historische und zufällige Weltereignisse
    imageUtils.ts      Auflösung von Flugzeugbild-URLs
    airlineRank.ts, airportAccess.ts, aircraftClasses.ts, milestones.ts, annualGoals.ts, research.ts, careerScore.ts
                       Fortschritt: Normal/Free Mode, zehn Ränge, Flughafenzugang, Flugzeugklassen,
                       Meilensteine, Jahresziele, Entwicklungsbaum, Wertung
    saveLoad.ts        Spielstand laden; nur die aktuelle Version, ältere werden gelöscht
    supabase.ts        Supabase-Client (null, wenn nicht konfiguriert)
    cloudSaves.ts      Spielstände: Cloud mit lokalem Rückfall und Abgleich
    configStore.ts     Gespeicherte Flugzeug- und Kabinen-Configs: pro Konto, gleiches Prinzip
  data/                Flughäfen, Flugzeuge, Treibstoffpreise, Catering
supabase/schema.sql    Tabellen und Zugriffsregeln
server.ts              Express-Server: Vite im Dev-Modus, Bild-Upload-API
```

Die Spielrechnung liegt vollständig in `src/model/` (Neubau, siehe `docs/neubau/`).
Ansichten und Monatsabschluss rufen sie über die Brücke `src/lib/model*.ts` auf,
damit Vorschau und Monatsabrechnung nicht auseinanderlaufen.
