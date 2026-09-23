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
| `npm run dev` | Entwicklungsserver auf Port 3000 |
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
  lib/
    financeUtils.ts    Einzige Quelle der Wahrheit für Kosten, Nachfrage, Preise
    eventSystem.ts     Historische und zufällige Weltereignisse
    imageUtils.ts      Auflösung von Flugzeugbild-URLs
    supabase.ts        Supabase-Client (null, wenn nicht konfiguriert)
    cloudSaves.ts      Spielstände: Cloud mit lokalem Rückfall und Abgleich
  data/                Flughäfen, Flugzeuge, Treibstoffpreise, Catering
supabase/schema.sql    Tabellen und Zugriffsregeln
server.ts              Express-Server: Vite im Dev-Modus, Bild-Upload-API
```

Die Finanzsimulation liegt vollständig in `src/lib/financeUtils.ts`. Alle Ansichten
rufen dieselbe `calculateRouteFinancials`-Funktion auf, damit Vorschau und
Monatsabrechnung nicht auseinanderlaufen.
