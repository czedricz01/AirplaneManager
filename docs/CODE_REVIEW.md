# Code-Review AirlineManagerNeo

Stand: 10.11.2026 · Branch `claude/vibrant-pasteur-zx25o6` · Phase 1a (Bericht) und Phase 1b (Umsetzung) abgeschlossen.
Das Ergebnis der Umsetzung steht am Ende unter [Phase 1b – Ergebnis](#phase-1b--ergebnis). Die Zeilenangaben in den Fund-Tabellen beziehen sich auf den Stand vor der Umsetzung.

## Ausgangswerte

| Prüfung | Ergebnis |
|---|---|
| Typecheck / Linter (`npm run lint` = `tsc --noEmit`) | grün |
| Tests (`npm test`) | 474 von 474 bestanden |
| Build (`npm run build:pages`) | grün, Warnung: Haupt-Chunk über 900 kB |
| Haupt-Chunk `index.js` | 983 kB roh, 303 kB gzip |
| `airport-data.js` | 338 kB roh, 134 kB gzip |
| `map-vendor.js` | 168 kB roh, 49 kB gzip |
| `index.css` | 148 kB roh, 25 kB gzip |
| Startseite (lokal, ohne Netzverzögerung) | 6 Anfragen, 528 kB, FCP 250–590 ms |

## Wie geprüft wurde

- **Automatisch, ganzes Projekt:** `tsc --noUnusedLocals --noUnusedParameters`, `tsc --strict`,
  Suche nach ungenutzten Exporten und Dateien, `npm audit`, Zerlegung des Haupt-Chunks über die Source-Map,
  Mustersuche (Timer, Listener, externe Adressen, `any`, wiederholte Formeln).
- **Vollständig gelesen:** die Logik von `src/App.tsx` (Zeilen 425–3600), `server.ts`,
  `src/lib/cloudSaves.ts`, `src/lib/safeStorage.ts`, `src/index.css`, die Basis-Komponenten in `src/components/ui/`.
- **Teilweise gelesen:** `src/components/RoutePlannerView.tsx` (Zustand, Planung, Zeitplan-Automatik),
  der Ansichten-Teil von `App.tsx`.
- **Nur automatisch geprüft:** die übrigen Komponenten und `lib`-Module. Dort können weitere
  Logikfehler stecken, die nur beim Lesen auffallen. `lib` ist durch 60 Testdateien abgedeckt.

Keine offenen Secrets gefunden: `.env*` ist in `.gitignore`, der Supabase-Anon-Key ist laut
`src/lib/supabase.ts` ein öffentlicher Bezeichner, der Schutz liegt in den Zugriffsregeln (`supabase/schema.sql`).

## Funde

Sortiert nach Priorität: Bugs, Logikfehler, Performance, toter Code, Komplexität, Typen/Sicherheit.
Risiko = Risiko der **Behebung** (Gefahr, dabei etwas kaputt zu machen).

### Bugs

| Nr. | Datei:Zeile | Kategorie | Problem | Auswirkung | Vorschlag | Risiko |
|---|---|---|---|---|---|---|
| 1 | `src/lib/cloudSaves.ts:177-195` | Bug | `writeSave` merkt sich, ob das lokale Schreiben geklappt hat (`storedLocally`), wertet das aber nur im Erfolgsfall der Cloud aus. Ohne Konto oder bei Cloud-Fehler wird der Index trotzdem mit neuem Zeitstempel geschrieben. | Ist der Browser-Speicher voll, meldet das Spiel „Game saved", obwohl nichts gespeichert wurde. Der Spielstand ist beim nächsten Laden alt oder fehlt. | Wenn weder lokal noch in der Cloud gespeichert wurde: Fehler werfen. `handleSaveGame` (`src/App.tsx:2650`) zeigt dafür bereits eine Meldung. Test ergänzen. | niedrig |
| 2 | `src/App.tsx:1419-1429` | Bug | Autosave-Einstellungen werden in einem Effekt geladen, ein zweiter Effekt schreibt direkt danach die Standardwerte. Im Entwicklungsmodus (StrictMode führt Effekte doppelt aus) liest der zweite Durchlauf die Standardwerte zurück. | Im Entwicklungsmodus gehen gespeicherte Autosave-Einstellungen bei jedem Neuladen verloren. Im Produktions-Build wird nur unnötig doppelt geschrieben. | Werte direkt beim Anlegen des States lesen (wie bei `gameSettings`, `src/App.tsx:1432`), Lade-Effekt entfernen. | niedrig |
| 3 | `src/components/RouteScheduleEditView.tsx:470` | Bug | `setTimeout` (1,5 s) ruft `onClose()` auf und wird nie abgebrochen. | Schließt man den Editor von Hand und öffnet in dieser Zeit einen anderen, wird der neue geschlossen. | `createTimerBag` aus `src/lib/timerBag.ts` verwenden, wie im Routenplaner (`RoutePlannerView.tsx:259`). | niedrig |
| 4 | `src/components/SupabaseBucketModal.tsx:27` (und zweiter Aufruf weiter unten) | Bug | Gleiches Muster: `setTimeout(() => onClose(), 1200)` ohne Abbruch. | `onClose` läuft auch nach dem Schließen des Dialogs. | Wie Nr. 3. | niedrig |
| 5 | `src/App.tsx:1281` | Bug (Fehlerbehandlung) | `supabase.auth.getSession().then(...)` hat kein `catch`. | Schlägt der Aufruf fehl, entsteht eine unbehandelte Promise-Ablehnung; die Anmeldung hängt dann nur noch am zweiten Weg (`onAuthStateChange`). | `catch` ergänzen: Fehler ins Diagnose-Log, als „nicht angemeldet" weiterlaufen. | niedrig |
| 6 | `src/lib/cloudSaves.ts:209-218` | Bug (Fehlerbehandlung) | Schlägt das Löschen in der Cloud fehl, wird nur ins Konsolen-Log geschrieben. Lokal ist der Stand schon gelöscht. | Der gelöschte Spielstand taucht nach dem nächsten Abgleich wieder auf, ohne Erklärung. | Ergebnis zurückgeben und in `deleteSave` (`src/App.tsx:3144`) einen Hinweis zeigen. | niedrig |
| 7 | `src/lib/cloudSaves.ts:263` | Bug (Randfall) | Der Konflikt-Vergleich nutzt die Uhr des Geräts gegen die Uhr des Servers (`updated_at` setzt der Server, `supabase/schema.sql:72`). | Geht die Geräteuhr nach, wird ein Offline-Stand fälschlich als Konflikt behandelt und als „(offline copy)" doppelt abgelegt. Kein Datenverlust. | Beim erfolgreichen Speichern den Server-Zeitstempel in den lokalen Index übernehmen. | mittel |

### Logikfehler

| Nr. | Datei:Zeile | Kategorie | Problem | Auswirkung | Vorschlag | Risiko |
|---|---|---|---|---|---|---|
| 8 | `src/App.tsx:2191-2199` | Logik | Die Wertung in der Jubiläums-Nachricht wird ohne `free` und ohne den Abzug der Start-Projekte berechnet; die Karriere-Ansicht rechnet anders (`src/App.tsx:1183-1193`). | Im Free Mode nennt die Jubiläums-Nachricht eine andere Punktzahl als die Karriere-Ansicht. | Eine gemeinsame Hilfsfunktion für beide Stellen. | niedrig |
| 9 | `src/App.tsx:2392` | Logik | Das Szenario wird mit `capital + totalMonthlyProfit` bewertet. Prämien desselben Monatsabschlusses (`awardsCash`) fehlen, obwohl Bericht und Chronik sie mitzählen (`src/App.tsx:2344`, `2362`). | Ein Kapital-Ziel kann einen Monat zu spät als erreicht gelten. | `awardsCash` in die Bewertung aufnehmen. **Ändert das Spielverhalten leicht – braucht deine Freigabe.** | niedrig |
| 10 | 28 Stellen, z. B. `src/App.tsx:3449`, `src/components/RoutePlannerView.tsx:400`, `:1422` | Logik | Zahlen werden direkt mit `toLocaleString(...)` formatiert statt über `src/lib/format.ts`. | Die Einstellung „Dezimalzeichen" wirkt an diesen Stellen nicht; in einer Meldung stehen zwei Zahlenformate. | Überall `formatNumber` / `formatCurrency` verwenden. | niedrig |
| 11 | 17 Stellen (`key={i}`, `key={index}`) | Logik | Listen verwenden den Index als React-Schlüssel. | Bei sortierbaren oder gefilterten Listen kann React Zustand der falschen Zeile zuordnen. | Je Stelle prüfen; wo die Liste sich ändern kann, eine stabile ID verwenden. | niedrig |

### Performance

| Nr. | Datei:Zeile | Kategorie | Problem | Auswirkung | Vorschlag | Risiko |
|---|---|---|---|---|---|---|
| 12 | `src/lib/supabase.ts`, `vite.config.ts:47-55` | Performance | Der Supabase-Client macht rund 28 % der Quellen des Haupt-Chunks aus (Auth, Storage, Realtime, Functions). Er wird auch geladen, wenn kein Supabase-Projekt eingerichtet ist. | Größter Einzelposten im 983-kB-Chunk. | Stufe 1: eigener Vendor-Chunk (besseres Caching, Warnung weg). Stufe 2: nur per `import()` laden, wenn konfiguriert. | Stufe 1 niedrig, Stufe 2 mittel |
| 13 | 14 Dateien mit `motion/react` | Performance | Die Animations-Bibliothek macht rund 15 % der Quellen des Haupt-Chunks aus; genutzt wird sie vor allem für Ein-/Ausblenden. | Zweitgrößter Fremdposten. | Stufe 1: Vendor-Chunk. Stufe 2 in Phase 2 entscheiden: einfache Übergänge per CSS, Bibliothek ggf. entfernen. | Stufe 1 niedrig, Stufe 2 mittel |
| 14 | `src/App.tsx:1-420` (Importe) | Performance | Login und Hauptmenü laden bereits Flughafendaten (134 kB gzip) und Leaflet (49 kB gzip), obwohl beides erst im Spiel bzw. im Hub-Picker gebraucht wird. | 528 kB Übertragung, bevor irgendetwas gespielt wird. | Karte, Zeitung, Tutorial, Monatsbericht, Speichern/Laden und Hub-Picker per `React.lazy` nachladen. Volle Wirkung erst, wenn Menü und Spiel getrennte Komponenten sind (siehe Nr. 27). | mittel |
| 15 | `src/components/RoutePlannerView.tsx:1642`, `:2875`, `src/components/AirportDetailView.tsx:205` | Performance | Drei Hintergrundfotos von Unsplash (1600–2000 px) werden geladen und mit 2–20 % Deckkraft gezeigt. | Drei große Fremd-Downloads ohne sichtbaren Nutzen; Abhängigkeit von einem fremden Server. `ViewFrame.tsx` hat dasselbe Muster schon einmal entfernt. | Entfernen. | niedrig |
| 16 | `src/index.css:1` | Performance | Schriften kommen per CSS-`@import` von Google Fonts. | Blockiert das erste Zeichnen über eine Kette von zwei Fremd-Anfragen; überträgt die IP-Adresse an Google. | In Phase 2 mit der Schriftwahl lösen (Schriftdateien selbst ausliefern). | niedrig |
| 17 | `src/App.tsx:4726-4736`, `:4817`, `:4832`, `:4835`, `:4876` | Performance | Mehrere mit `React.memo` geschützte Ansichten bekommen bei jedem Render neue Objekte oder Funktionen (`market={{…}}`, `onOpenProgression`, `handleStartResearch`, `handleRetire`, `handleTakeover`, `handlePlaceOrder`, `handleCancelOrder`, `handleBuyUsed`). | Der `memo`-Schutz greift nicht: Die offene Ansicht rendert bei jeder Änderung in `App` mit (z. B. Toast, Menü auf/zu). | Objekte mit `useMemo`, Handler mit `useCallback` stabil halten (Muster existiert: `marketingCtx`, `src/App.tsx:2833`). | niedrig |
| 18 | `src/components/RoutePlannerView.tsx:460`, `src/components/BuyAircraftView.tsx:42` | Performance | `localStorage` wird bei jedem Render gelesen (Debug-Schalter). | Synchroner Speicherzugriff in einer Ansicht, die bei jedem Tastendruck rendert. | Wert als Prop aus `App` durchreichen (dort schon als State vorhanden). | niedrig |
| 19 | `src/components/RoutePlannerView.tsx:603-618` | Performance | Die Sortierfunktion berechnet Distanz und Flughafen-Statistik bei jedem Vergleich neu. | Unnötige Rechenarbeit bei rund 570 Flughäfen pro Tastendruck in der Suche. | Werte einmal je Flughafen berechnen, dann sortieren. | niedrig |

### Toter und überflüssiger Code

| Nr. | Datei:Zeile | Kategorie | Problem | Auswirkung | Vorschlag | Risiko |
|---|---|---|---|---|---|---|
| 20 | 84 Stellen in 19 Dateien, v. a. `RoutePlannerView.tsx` (29), `App.tsx` (15), `CompetitorsView.tsx` (7) | Toter Code | Ungenutzte Importe, Variablen, Parameter und ganze Hilfskomponenten (`ConfigBox`, `DetailMetric`, `getAirportBonus`, `openReportCategories`, `awardLines` …). | Mehr Lesestoff, irreführend. | Entfernen. Danach `noUnusedLocals` in `tsconfig.json` einschalten, damit es so bleibt. | niedrig |
| 21 | `MyFleetView.tsx` (`RouteRef`), `airlineRank.ts` (`GAME_MODES`), `debugLog.ts` (`clearLog`), `format.ts` (`getNumberLocale`), `milestones.ts` (`NEUTRAL_PERKS`), `safeStorage.ts` (`deepClone`), `theme.ts` (`personalityMeta`) | Toter Code | Sieben Exporte werden nirgends verwendet. | Wie Nr. 20. | Entfernen. | niedrig |
| 22 | `airportRegistry.ts` (`getAirport`), `hubOwnership.ts` (`rivalMayEnter`), `research.ts` (`EMPTY_RESEARCH`), `tutorial.ts` (`skipTutorial`) | Toter Code | Vier Exporte werden nur von Tests verwendet. | Code, den das Spiel nie ausführt, wird gepflegt und getestet. | **Rückfrage:** entfernen samt Tests oder behalten? | niedrig |
| 23 | `src/App.tsx:1441-1450` | Toter Code | „Fix" für Leaflet-Standard-Icons mit Adressen von cdnjs und `@ts-ignore`. Alle Marker nutzen eigene `divIcon`s oder `CircleMarker`. | Toter Code mit Fremd-Adressen. | Entfernen. | niedrig |
| 24 | `src/App.tsx:426`, `:4881-4890` | Toter Code | `'new-route'` steht im Typ `ActiveWindow`, wird aber nie gesetzt. Der Platzhalter-Zweig („AWAITING UPLINK…") ist dadurch unerreichbar. | Toter Zweig. | Typ-Mitglied und Zweig entfernen. | niedrig |
| 25 | `src/components/RoutePlannerView.tsx:319-325` | Duplikat | Der Vergleich enthält eine wörtliche Kopie von `DEFAULT_CLASS_CONFIGS` (`:213`). | Ändert man die Vorgabe, bleibt die Kopie alt. | Konstante verwenden. | niedrig |
| 26 | `tsconfig.json`, `package.json`, `metadata.json`, `vite.config.ts:21-25` | Überflüssig | `experimentalDecorators`, `useDefineForClassFields: false`, `allowJs` und der Alias `@` werden nicht benutzt. Paketname ist `react-example`. `metadata.json` stammt aus einer Vorlage und wird nirgends gelesen. | Irreführende Konfiguration. | Bereinigen. **Rückfrage zu `metadata.json`:** löschen? | niedrig |

Nicht als Fund gewertet: `src/data/raw_airports.csv` (391 kB), `raw_fuel.csv` und `scripts/*.ts` landen nicht im Build. Sie sehen nach Quelldaten und Generatoren aus und bleiben.

### Unnötige Komplexität

| Nr. | Datei:Zeile | Kategorie | Problem | Auswirkung | Vorschlag | Risiko |
|---|---|---|---|---|---|---|
| 27 | `src/App.tsx` (5 809 Zeilen, 106 `useState`) | Komplexität | Eine Komponente enthält Anmeldung, Menüs, Spielzustand, Monatsabschluss, Speichern und alle Ansichten. | Jede Zustandsänderung rendert alles; schwer zu prüfen; verhindert Nr. 14. | In Schritten zerlegen: (a) Menü-Ansichten, (b) Spielansicht, (c) Einstellungen und Speichern/Laden als eigene Dateien. Ohne Verhaltensänderung, ein Commit je Schritt. | hoch |
| 28 | `src/App.tsx:1533-2646` | Komplexität | `handleAdvanceMonth` ist rund 1 100 Zeilen lang und mischt Berechnung mit etwa 40 State-Aufrufen. | Der wichtigste Ablauf des Spiels ist nicht testbar. | Berechnung als reine Funktion nach `src/lib/` auslagern, die ein Ergebnisobjekt liefert; `App` setzt nur noch den State. Tests dafür ergänzen. | hoch |
| 29 | `src/components/RoutePlannerView.tsx` (3 963 Zeilen), `:297-343`, `:456-474` | Komplexität | Sehr große Datei; 15 fast identische Setter mit `any`. | Schwer zu ändern, keine Typprüfung an diesen Stellen. | Setter durch eine typisierte Hilfsfunktion ersetzen. Die vier Schritte des Assistenten in eigene Dateien legen. | mittel |
| 30 | 23 Stellen (Umlaufzeit `30 + dur + turn + dur + 30`), 27 Stellen (`1960 + Math.floor(offset / 12)`), 4 Stellen (`3.78541`), `RoutePlannerView.tsx:392` | Komplexität | Dieselben Formeln stehen vielfach im Code. `:392` wiederholt `turnoverForClass`. | Eine Änderung muss an vielen Stellen passieren; Abweichungen fallen nicht auf. | Je eine Hilfsfunktion in `src/lib/` (`cycleMinutes`, `yearOf`/`monthOf`, `perLitre`) und überall verwenden. | mittel |
| 31 | `src/App.tsx:879-896`, `:3344-3348`, `:5101-5106` | Komplexität | Die Regel „Flugzeug ohne Hub bekommt den Start seiner ersten Route" steht dreimal im Code. | Der Effekt (`:879`) deckt die beiden anderen Stellen bereits ab. | Auf eine Stelle reduzieren. | niedrig |
| 32 | `src/App.tsx:3412`, `:3443-3464` | Komplexität | `handlePurchase` prüft das Kapital zweimal und enthält dreimal denselben Zweig. | Schwer lesbar. | Vereinfachen, gleiches Verhalten. | niedrig |
| 33 | `src/App.tsx:596-598`, `:662-664`, `:2033`, `:2933`, `:3008` | Komplexität | Globaler Modul-Zustand (Preisfaktoren, laufende Ereignisse) wird während des Renderns bzw. an vier Stellen von Hand gesetzt; fünf `useMemo` brauchen deshalb `eslint-disable`. | Versteckte Abhängigkeit; vergisst man eine Stelle, rechnen Ansichten mit altem Stand. | Nur dokumentieren, nicht umbauen (Umbau gehört zu Nr. 28). | – |

### Typen und Sicherheit

| Nr. | Datei:Zeile | Kategorie | Problem | Auswirkung | Vorschlag | Risiko |
|---|---|---|---|---|---|---|
| 34 | `tsconfig.json` | Typen | `strict` ist aus. Mit `--strict` gibt es nur 50 Fehler außerhalb der Tests (41 davon in `RoutePlannerView.tsx`). | Fehler wie „möglicherweise `undefined`" findet der Compiler nicht. | Die 50 Stellen beheben, dann `strict: true`. | mittel |
| 35 | 194 Stellen, z. B. `src/App.tsx:694` (`reportHistory: any[]`), `:455` (`schedule?: any[]`), `:2955-2968` | Typen | Zentrale Daten sind `any`: Monatsbericht, Flugplan, geladener Spielstand. | Tippfehler in Feldnamen fallen erst zur Laufzeit auf. | Typen `MonthlyReport` und `ScheduledTrip` (existiert in `RouteScheduleEditView.tsx`) zentral definieren und verwenden. Rest schrittweise. | mittel |
| 36 | `package-lock.json` | Sicherheit | `npm audit` meldet Lücken der Stufe „hoch" in `adm-zip`, `multer`, `body-parser`, `follow-redirects`, `vite`, `source-map-js`. | Betrifft den Entwicklungs-Server und den Build, nicht die ausgelieferte statische Seite. | `npm audit fix` (bleibt in den erlaubten Versionsbereichen, keine neue Abhängigkeit). Für `adm-zip` ist ein größerer Versionssprung nötig – **Rückfrage**. | niedrig |
| 37 | `server.ts:244`, `:338`, `:357`, `:423` | Sicherheit | Die Upload-Endpunkte haben keine Anmeldung, der Server lauscht auf `0.0.0.0`. | Jeder im selben Netz kann Flugzeugbilder ersetzen; geschrieben wird auch nach `src/PlanePics`. Pfade und Dateitypen sind bereits abgesichert. | Standardmäßig nur auf `127.0.0.1` lauschen, `0.0.0.0` nur über eine Umgebungsvariable. | niedrig |

## Vorschlag zur Reihenfolge in Phase 1b

1. Bugs 1–6, je ein Commit (alle niedriges Risiko).
2. Logik 8, 10, 11; Nr. 9 nur mit Freigabe.
3. Performance 15, 17, 18, 19 und Stufe 1 von 12/13.
4. Aufräumen 20, 21, 23–26, 31, 32.
5. Typen/Sicherheit 36, 37, dann 34 und 35.
6. Mittleres Risiko: 7, 29, 30, Stufe 2 von 12, 14.
7. Hohes Risiko: 27, 28 – nur auf ausdrücklichen Wunsch; sinnvoll vor dem Redesign, weil Phase 2 jede Ansicht in `App.tsx` anfasst.

## Offene Rückfragen

- Nr. 9: Darf die Szenario-Bewertung Prämien desselben Monats mitzählen?
- Nr. 22: Nur von Tests genutzte Exporte entfernen oder behalten?
- Nr. 26: `metadata.json` löschen?
- Nr. 36: `adm-zip` auf die nächste Hauptversion heben?
- Nr. 27/28: Zerlegung von `App.tsx` jetzt, später oder gar nicht?

---

# Phase 1b – Ergebnis

Freigabe des Nutzers: ganze Liste; Nr. 9 ja, Nr. 22 entfernen, Nr. 26 löschen, Nr. 36 freigeben, Nr. 27/28 jetzt und in kleinen Schritten.

## Vorher / Nachher

| Messwert | Vorher | Nachher |
|---|---|---|
| Typecheck (`npm run lint`) | grün, ohne `strict` | grün, mit `strict`, `noUnusedLocals`, `noUnusedParameters` |
| Tests | 474 bestanden | 484 bestanden (10 neue) |
| Build | grün, Warnung „Chunk über 900 kB" | grün, keine Warnung |
| Größter Chunk (`index.js`) | 983 kB roh / 303 kB gzip | 387 kB roh / 127 kB gzip |
| Übertragung beim Start | 528 kB, 6 Anfragen | 473 kB, 8 Anfragen |
| Kartenbibliothek (45 kB gzip) | lädt mit der Anmeldeseite | lädt erst mit dem Spiel oder der Hub-Auswahl |
| Fremd-Downloads im Spiel | 3 Unsplash-Fotos, cdnjs-Adressen im Code | keine (Schriften von Google Fonts bleiben bis Phase 2) |
| `src/App.tsx` | 5 809 Zeilen | 3 026 Zeilen |
| `any`-Stellen außerhalb der Tests | 194 | 166 |
| Ungenutzte Variablen/Importe | 84 | 0 (vom Compiler erzwungen) |
| `npm audit` | Lücken der Stufe „hoch" in 6 Paketen | 0 Lücken |
| Startseite FCP (lokal, 3 Läufe, 1280 px) | 364–588 ms | 324–524 ms |

Die Summe aller JavaScript-Dateien ist praktisch gleich geblieben: Der Haupt-Chunk ist kleiner, weil React, Supabase und die
Animations-Bibliothek jetzt eigene Dateien sind. Der Gewinn liegt im Caching (ein neues Release lädt diese Dateien nicht neu)
und darin, dass Leaflet nicht mehr beim Start geladen wird. Die FCP-Werte stammen von einem lokalen Server und schwanken von Lauf zu Lauf;
der Unterschied ist dort nicht aussagekräftig.

## Wie geprüft wurde

- Nach jedem Commit: `npm run lint`, `npm test`, `npm run build:pages`.
- Zusätzlich einmal `npm run build` (mit Server) und `npm run build:static`.
- Browser-Rauchtest (Playwright gegen `vite preview`) bei 1280, 768 und 360 px: Anmeldung, Einstellungen, neues Spiel,
  alle neun Navigationsziele, Monatsabschluss. Keine Laufzeitfehler, kein horizontales Scrollen.
- Durchgespielter Ablauf bei 1280 px: Flugzeug kaufen, Route AAL–BLL planen (Slots kaufen, Stufe freischalten, vier Schritte),
  speichern, Monat abschließen. Die Zahlen passen zusammen: 672 Passagiere je Woche × 4 × 42 $ = 112 896 $ Umsatz im Bericht.
- Nicht geprüft: Anmeldung und Cloud-Spielstände gegen ein echtes Supabase-Projekt (in dieser Umgebung nicht vorhanden).
  Die Änderungen an `cloudSaves.ts` (Nr. 1, 6, 7) sind nur durch Tests des lokalen Teils und durch Lesen abgesichert.

## Status je Fund

| Nr. | Status | Was gemacht wurde |
|---|---|---|
| 1 | erledigt | `writeSave` wirft einen Fehler, wenn weder lokal noch in der Cloud gespeichert wurde; die vorhandene Fehlermeldung erscheint. Zwei Tests. |
| 2 | erledigt | Autosave-Einstellungen werden beim Anlegen des States gelesen. |
| 3 | erledigt | Der Zeitplan-Editor bricht seinen Timer beim Schließen ab. |
| 4 | erledigt (anders) | `SupabaseBucketModal` wurde nirgends angezeigt. Die Datei ist gelöscht, damit entfällt der Timer. |
| 5 | erledigt | Fehler beim Wiederherstellen der Sitzung wird geloggt und als „nicht angemeldet" behandelt. |
| 6 | erledigt | Schlägt das Löschen in der Cloud fehl, erscheint ein Hinweis. |
| 7 | erledigt | Jeder Slot merkt sich den Server-Zeitstempel der Cloud-Kopie, auf der er beruht; ein Konflikt ist eine Cloud-Kopie, die sich danach geändert hat. Ein Test. |
| 8 | erledigt | Die Jubiläums-Nachricht rechnet die Wertung wie die Karriere-Ansicht. |
| 9 | erledigt | Die Szenario-Bewertung zählt Prämien desselben Monats mit. |
| 10 | erledigt | 27 Zahlen laufen über `lib/format` (die vier Datumsangaben mit `toLocaleString` bleiben). |
| 11 | erledigt | Alle 17 Stellen geprüft. Eine geändert (Routen im Flugzeug-Dialog); die übrigen sind feste oder reine Anzeige-Listen, dort ist der Index unbedenklich. |
| 12 | Stufe 1 erledigt, Stufe 2 verworfen | Eigener Vendor-Chunk. Nachladen per `import()` bringt der echten Seite nichts: Dort ist Supabase eingerichtet und wird schon für die Anmeldung gebraucht. |
| 13 | Stufe 1 erledigt | Eigener Vendor-Chunk. Ob die Bibliothek bleibt, entscheidet Phase 2. |
| 14 | erledigt | Karte, Hub-Auswahl, Zeitung, Tutorial und Monatsbericht werden nachgeladen. Die Flughafendaten bleiben im Start, weil `App` sie selbst liest. |
| 15 | erledigt | Die drei Fotos sind entfernt. Sichtbare Änderung: Der Flughafen-Bildschirm hat keinen schwach durchscheinenden Foto-Hintergrund mehr. |
| 16 | offen | Wie geplant in Phase 2 mit der Schriftwahl. |
| 17 | erledigt | Stabile Handler über `useStableCallback`, `market` per `useMemo`. |
| 18 | erledigt | Der Debug-Schalter kommt als Prop. |
| 19 | erledigt | Sortierwert einmal je Flughafen. |
| 20 | erledigt | 84 Stellen entfernt; `noUnusedLocals` und `noUnusedParameters` sind eingeschaltet. |
| 21 | erledigt | Sieben Exporte entfernt. |
| 22 | erledigt | Vier Exporte entfernt, Tests angepasst. Dabei fiel `lockedSummary` (`airportAccess.ts`) als fünfter nur von Tests genutzter Export auf; er bleibt, weil sein Test die echten Flughafendaten prüft. |
| 23 | erledigt | Leaflet-Workaround entfernt. |
| 24 | erledigt | `'new-route'` und der Platzhalter-Zweig entfernt. |
| 25 | erledigt | Konstante statt Kopie. |
| 26 | erledigt | Konfiguration bereinigt, Paket heißt `airline-manager-neo`, `metadata.json` gelöscht. |
| 27 | erledigt | In drei Schritten: Typen und Hilfskomponenten, dann Menüs/Bericht/Einstellungen, dann obere Leiste/Navigation/Dialoge. Neue Dateien unter `src/components/app/`. In `App` bleiben Spielzustand, Handler und die Verdrahtung der Ansichten. |
| 28 | erledigt | `closeMonth()` in `src/lib/monthClose.ts`. Der Code wurde verschoben, nicht umgeschrieben: Die Funktion liefert die Setter-Aufrufe als Liste in der ursprünglichen Reihenfolge, `App` spielt sie ab. Sieben Tests. |
| 29 | teilweise | Die zwölf untypisierten Setter sind durch eine typisierte Hilfsfunktion ersetzt. Die Aufteilung der vier Schritte in eigene Dateien ist **nicht** gemacht: Sie teilen sich rund 60 lokale Werte. Das passt besser in Phase 2c, wenn jeder Schritt ohnehin neu gestaltet wird. |
| 30 | erledigt | `blockMinutes`/`rawBlockMinutes`, `yearOf`/`monthOf`, `LITRES_PER_GALLON`. Zwei Stellen im Planer mit leicht anderer Formel (`RoutePlannerView.tsx`, Suche nach `testDurMin * 2` und `exCycle`) blieben bewusst unverändert. |
| 31 | erledigt | Die Hub-Regel steht nur noch im Effekt. |
| 32 | erledigt | `handlePurchase` vereinfacht, gleiches Verhalten. |
| 33 | unverändert | Wie vorgeschlagen nur dokumentiert (Kopfkommentar von `monthClose.ts`). |
| 34 | erledigt | 50 Stellen behoben, `strict: true`. |
| 35 | teilweise | `MonthlyReport` und `ScheduledTrip` sind zentrale Typen; Bericht, Flugplan und Planer-Entwurf sind typisiert. 166 `any` bleiben, vor allem im Planer (41), in der Spielstand-Migration (35, liest unbekannte Daten) und in `financeUtils.ts` (26). |
| 36 | erledigt | `npm audit fix` und `adm-zip` 0.5 → 0.6.1; die ZIP-Aufrufe des Servers gegen die neue Version geprüft. |
| 37 | erledigt | Der Server lauscht auf `127.0.0.1`; `HOST=0.0.0.0` öffnet ihn. In `README.md` und `.env.example` vermerkt. |

## Was offen bleibt

- Nr. 16 (Schriften) und der Rest von Nr. 13: Phase 2.
- Nr. 29 (Planer in Dateien aufteilen) und der Rest von Nr. 35 (`any` im Planer): Phase 2c.
- `App.tsx` hat noch 3 026 Zeilen. Der größte verbleibende Block ist die Verdrahtung der Ansichten im Spiel (rund 500 Zeilen JSX mit vielen Handlern); er wird in Phase 2c mit der neuen Navigation neu aufgebaut.

## Nachtrag nach Phase 2 (11.11.2026)

- Nr. 13 erledigt: Das Paket `motion` ist entfernt; Einblendungen laufen über eine CSS-Animation.
- Nr. 16 erledigt: Die Schriften liegen in `src/assets/fonts/` und werden mit der App ausgeliefert; Google Fonts wird nicht mehr geladen.
- Ein viertes Unsplash-Hintergrundbild (`ConfigurePurchaseView.tsx`) war in Nr. 15 übersehen worden und ist jetzt ebenfalls entfernt.
- Offen bleiben Nr. 29 (Routenplaner in Dateien aufteilen) und der Rest von Nr. 35 (`any`).
