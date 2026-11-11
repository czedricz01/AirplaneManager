# Design-System „Leitstand"

Stand: 11.11.2026. Gewählt aus drei Vorschlägen (`design-proposals/leitstand.html`).

Grundidee: dunkel und ruhig wie ein Kontrollraum. Anthrazit statt Schwarz, eine Akzentfarbe nur für
Auswahl und Hauptaktion, Grün und Rot nur für Ergebnis (Gewinn/Verlust, guter/schlechter Zustand).
Die Weltkarte als Satellitenbild bleibt die Hauptansicht; Navigation, Leisten und Dialoge liegen darum.

## Wo was definiert ist

| Was | Wo |
|---|---|
| Alle Tokens (Farben, Schriften, Größen, Radius, Schatten, Animation) | `src/index.css`, Block `@theme` |
| Breakpoints / Layout-Varianten (`rail`, `bar`, `short`, `tiny`) | `src/index.css`, `@custom-variant`; Zahlen dazu in `src/lib/layout.ts` |
| Touch-Ziele am Handy (mind. 44 × 44 px) | `src/index.css`, Abschnitt „Touch targets" |
| Farben für Karte, Canvas und SVG (als JS-Werte) | `src/lib/theme.ts`, `TOKENS` – ein Test prüft die Gleichheit mit `index.css` |
| Schriftdateien | `src/assets/fonts/` (Lizenzen in `LICENSE.md` dort) |
| Basis-Komponenten | `src/components/ui/` |
| Rahmen der App (Navigation, obere Leiste, Menüs, Dialoge) | `src/components/app/` |

Tailwinds eigene Farbpalette ist abgeschaltet (`--color-*: initial`). Eine Klasse wie `text-red-500`
erzeugt deshalb kein CSS mehr; nur die Token-Namen unten funktionieren.

## Farben

| Token | Wert | Verwendung | Kontrast auf `ground` |
|---|---|---|---|
| `ground` | `#14171A` | Seite, Fläche unter der Karte | – |
| `surface` | `#1C2024` | Panels, Navigation, Dialoge | – |
| `raised` | `#252A2F` | gewählte Zeile, Hover, Panel im Panel | – |
| `ink` | `#E8E6E1` | Text | 14,4 : 1 |
| `muted` | `#9AA1A8` | Nebentext, Beschriftungen | 6,9 : 1 (auf `raised` 5,5 : 1) |
| `line` | `#33393F` | Trennlinien zwischen Inhalten | – |
| `rule` | `#6B747D` | Umriss von Bedienelementen | 3,8 : 1 |
| `accent` | `#F2B233` | Auswahl, Hauptaktion einer Ansicht | 9,6 : 1 |
| `on-accent` | `#14171A` | Text auf `accent` | 9,6 : 1 |
| `good` | `#5CC98B` | Gewinn, guter Zustand | 8,0 : 1 (auf `surface`) |
| `bad` | `#F0766B` | Verlust, Fehler, schlechter Zustand | 5,9 : 1 (auf `surface`) |

Klassen: `bg-surface`, `text-muted`, `border-line`, `bg-accent/10` usw. Regeln:

- **Akzent sparsam.** Eine gefüllte Akzent-Schaltfläche je Ansicht; sonst nur Auswahl-Markierung (Randstrich, aktiver Tab).
- **Grün/Rot nur für Ergebnis.** Nie als Dekoration, und nie als einziger Träger der Aussage: Vorzeichen oder Wort stehen dabei.
- **Datenfarben** (Farben der Rivalen auf der Karte, Diagrammreihen, Auslastungs-Skala) sind kein Teil der Oberfläche und stehen in `src/lib/theme.ts`.
- Die **Zeitung** (`NewspaperOverlay`) ist bewusst ein eigenes Objekt mit Papierfarbe und Serifenschrift.

## Schrift

| Rolle | Schrift | Klasse |
|---|---|---|
| Text | Barlow 400 / 500 / 600 | (Standard), `font-sans` |
| Überschriften, Beschriftungen, Buttons | Barlow Semi Condensed 600 / 700 | `font-label` |
| Zahlen, Codes, Flugnummern | JetBrains Mono 400–500 | `font-mono` |

Größen: `text-2xs` 11,5 px (kleinste, nur Beschriftungen) · `text-xs` 13 · `text-sm` 14 · `text-base` 15 (Text) ·
`text-lg` 18 · `text-xl` 22 · `text-2xl` 26 · `text-3xl` 32.

- Großbuchstaben nur für kleine Beschriftungen und Buttons (`uppercase tracking-label`), nie für Sätze.
- Ziffern stehen überall in Tabellenbreite (`font-variant-numeric: tabular-nums` auf `body`).
- Keine Kursive, kein Gewicht über 700.

## Abstände, Radien, Tiefe

- Raster 4 px (Tailwind-Standard): üblich sind `gap-2`, `p-3`, `p-4`.
- Radius 3 px (`rounded-sm`) für Buttons, Felder, Marken, Dialoge. Panels sind eckig.
- Tiefe entsteht durch die drei Flächentöne. Der einzige Schatten ist `shadow-pop` für Schwebendes (Dialog, Menü, Tutorial-Karte).
- Eine Animation: `animate-appear` (140 ms Einblenden). Bei „Bewegung reduzieren" im System entfällt sie.

## Breakpoints

| Variante | Bedingung | Layout |
|---|---|---|
| `rail` | ab 768 px Breite, oder Handy quer | Navigation als Spalte links |
| `bar` | Handy hochkant (unter 768 px) | Navigation als Leiste unten |
| `short` | Handy quer (Höhe bis 500 px) | Spalte nur mit Zeichen, kompakte Leisten |
| `tiny` | Handy quer mit Adressleiste (Höhe bis 340 px) | noch kompakter |

Zwischen 768 und 1280 px wird das Desktop-Layout als Ganzes verkleinert (`autoScaleFor` in `src/lib/layout.ts`);
ab 1280 px gilt die tatsächliche Breite.

## Basis-Komponenten (`src/components/ui/`)

| Komponente | Zweck | Hinweise |
|---|---|---|
| `Button` | jede Schaltfläche | `variant`: `primary` (Akzent, Hauptaktion), `secondary` (Umriss), `ghost`, `danger`; `size`: `sm`, `md`, `lg`; `active` für Umschalter |
| `TextInput`, `Select` (`Field.tsx`) | Eingabefelder | optional `label`, `hint`, `error`, `icon`; 36 px hoch, am Handy 44 px |
| `Table`, `Thead`, `Th`, `Td`, `TableScrollContainer` | Datentabelle | Zeilen 44 px, Zahlenzellen mit `font-mono` |
| `Panel` | abgegrenzter Bereich (Karte) | `inset` für Panel im Panel |
| `Modal` | Dialog | schließt mit Escape; `accent="warn"` für Fehler/Entscheidungen |
| `Badge` | kurzes Statuswort im Umriss | `tone`: `neutral`, `yellow`, `good`, `warn` |
| `StatTile` | Kennzahl mit Beschriftung | `size="sm"` für die obere Leiste |
| `ViewHeader` | Titelzeile einer Ansicht | Titel links, Bedienelemente rechts |
| `EmptyState` | Leerzustand | Titel, ein Satz, optional eine Aktion |
| `LazyFallback` | Ladezustand | wird als `Suspense`-Fallback verwendet |
| `ErrorBoundary` (`src/components/`) | Fehlerzustand | begrenzt einen Fehler auf eine Ansicht |
| `ViewFrame` | Rahmen einer Ansicht über der Karte | enthält die Fehlergrenze |
| `GameNavigation` (`src/components/app/`) | Navigation | Spalte am Desktop, Leiste mit „More" am Handy |

## Mobile

- Navigation unten in Daumenreichweite: Map, Fleet, Routes, Company und „More" (Buy aircraft, Airports, Career, Rivals, New route).
- Jede Schaltfläche, jeder Link und jedes Feld ist am Handy mindestens 44 × 44 px (eine Regel in `index.css`).
- Routen: Liste statt Tabelle (Städtepaar, eine Detailzeile, rechts Auslastung und Gewinn). Sortieren über Spaltenköpfe gibt es dort nicht.
- Flughäfen: fünf Spalten, die bei 360 px passen.
- Kennzahlen der oberen Leiste als Raster 3 × 2.
- Kein horizontales Scrollen bei 360 px.

## Checkliste der Ansichten

Geprüft im Browser (Playwright gegen den Produktions-Build) bei 1280, 768 und 360 px:
keine Laufzeitfehler, kein horizontales Scrollen der Seite, am Handy keine Bedienelemente unter 44 px.
„Ablauf" heißt: Die Ansicht wurde im gespielten Ablauf benutzt (Flugzeug kaufen, Route planen, Monat abschließen).

| Nr. | Ansicht | Umgestellt | 1280 | 768 | 360 |
|---|---|---|---|---|---|
| 1 | Anmeldung (`AuthGate`) | ✔ neu gebaut | ✔ | ✔ | ✔ |
| 2 | Hauptmenü | ✔ neu gebaut | ✔ | ✔ | ✔ |
| 3 | Neues Spiel (mit Szenario-, Farb- und Hub-Auswahl) | ✔ | ✔ | ✔ | ✔ |
| 4 | Speichern / Laden | ✔ | ✔ Speichern | ✔ Speichern | ✔ Speichern |
| 5 | Einstellungen | ✔ neu gebaut | ✔ | ✔ | ✔ |
| 6 | Karte mit oberer Leiste und Navigation | ✔ neu gebaut | ✔ | ✔ | ✔ |
| 7 | Buy aircraft (Katalog, Bestellbuch, Gebrauchtmarkt) | ✔ | ✔ Ablauf | ✔ Ablauf | ✔ Ablauf |
| 8 | Configure purchase | ✔ | ✔ Ablauf | ✔ Ablauf | ✔ Ablauf |
| 9 | My fleet | ✔ | ✔ | ✔ | ✔ |
| 10 | Routes | ✔ Tabelle neu, am Handy Liste | ✔ | ✔ | ✔ |
| 11 | Route detail | ✔ | ✔ | ✔ | ✔ |
| 12 | Airports | ✔ | ✔ | ✔ | ✔ |
| 13 | Airport detail | ✔ | ✔ | ✔ | ✔ |
| 14 | My company (Overview, Marketing, Staff, History) | ✔ | ✔ Overview | ✔ Overview | ✔ Overview |
| 15 | Career | ✔ | ✔ | ✔ | ✔ |
| 16 | Rivals | ✔ | ✔ | ✔ | ✔ |
| 17 | Route planner, Schritte 1–4 | ✔ | ✔ Ablauf | ✔ Ablauf | ✔ Ablauf |
| 18 | Schedule-Editor | ✔ | ✔ | ✔ | ✔ |
| 19 | Kabinen- und Preis-Editor | ✔ | ✔ | ✔ | ✔ |
| 20 | Change aircraft | ✔ | ✔ | ✔ | ✔ |
| 21 | Monatsbericht | ✔ | ✔ Ablauf | ✔ Ablauf | ✔ Ablauf |
| 22 | Zeitung | ✔ (eigenes Papier-Design bleibt) | ✔ Ablauf | ✔ Ablauf | ✔ Ablauf |
| 23 | Tutorial | ✔ | ✔ erster Schritt | ✔ | ✔ |
| 24 | Dialoge (Entscheidungen, Hinweise, Ruhestand, Jahresziele, Szenario-Ergebnis) | ✔ | ✔ Hinweis, Nachricht | ✔ Hinweis, Nachricht | ✔ Hinweis, Nachricht |
| 25 | Nachrichten, Kartenoptionen, Spielmenü | ✔ neu gebaut | ✔ | ✔ | ✔ |
| 26 | Lade- und Fehlerzustand, Leerzustand | ✔ | ✔ | ✔ | ✔ |

Wo eine Zelle nur einen Teil nennt, wurde nur dieser Teil im Browser geöffnet. Nicht geöffnet wurden:
der Laden-Dialog (gleiche Komponente wie Speichern), die Tabs Marketing, Staff und History in My company und
die Dialoge, deren Auslöser im automatischen Ablauf nicht vorkommt (Streik, Betriebsstörung, Weltereignis,
Ruhestand, Jahresziele, Szenario-Ergebnis). Sie verwenden dieselben Tokens und dieselbe `Modal`-Komponente
und bauen fehlerfrei, sollten aber einmal von Hand angesehen werden.

## Tastatur

- Jede klickbare Fläche, die kein `<button>` ist (Karten, Tabellenzeilen, aufklappbare Zeilen, Zeitplan-Blöcke),
  ist mit der Tabulatortaste erreichbar und reagiert auf Enter und Leertaste (`clickOnKey` in `src/lib/a11y.ts`).
- Der Fokus ist überall sichtbar (2 px Akzent-Umriss, `:focus-visible` in `index.css`).
- Dialoge schließen mit Escape.

Ausnahme bei den Touch-Zielen: Die Flugblöcke im Wochen-Zeitplan sind am Handy rund 37 px breit, weil sieben
Tagesspalten auf 360 px passen müssen. Ihre Höhe folgt der Flugdauer.

## Reste des alten Designs

Die Suche über `src/`, `index.html` und `public/` findet keine alten Klassen und Werte mehr:
kein `aero-*`, keine Tailwind-Palettenfarben, keine alten Hex-Werte (`#FACC15`, `#0F0F0F`, `#1A1A1A`, `#141414`, …),
kein `backdrop-blur`, keine Schatten außer `shadow-pop` (und der dunklen Kontur der Flugzeug-Symbole auf der Karte), keine Pixel-Schriftgrößen, kein `motion`, keine Fremd-Adressen
für Schriften oder Bilder.

Verbleibende Inline-Styles (82) setzen nur berechnete Werte: Breiten und Positionen von Balken und Zeitplan-Blöcken,
Farben von Fluggesellschaften und Diagrammreihen, die Papierfarbe der Zeitung.

## Bewusst nicht geändert

- Der Routenplaner (`RoutePlannerView.tsx`) ist weiterhin eine Datei mit vier Schritten (Fund Nr. 29 aus `CODE_REVIEW.md`).
- Die Detailspalte neben der Routentabelle aus der Vorschau gibt es nicht; die Routendetails öffnen wie bisher als eigene Ansicht.
  Das ist die größte Abweichung von der Vorschau.
- Datenfarben (Rivalen, Diagramme, Heatmap) behalten ihre Paletten.
