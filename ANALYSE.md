# AirlineManagerNeo — Analyse und Verbesserungsvorschläge

Stand: 22.09.2026 · Branch `claude/tender-faraday-vzday9`

## Auftrag

Das Spiel analysieren und Vorschläge machen, (1) es zu verbessern — bestehende
Features, Verständlichkeit, Performance — und (2) es spaßiger zu machen.

Alle Zeilenangaben unten sind im Code nachgeprüft, nicht aus der Erinnerung
zitiert. Wo eine Zahl steht, wurde sie gemessen.

Ausgangslage nach der letzten Sitzung: die Wirtschaftssimulation ist konsolidiert
(eine Quelle der Wahrheit in `src/lib/financeUtils.ts`), die groben Logikfehler
(Nachfrage-Kollaps ab 2026, leere KI-Flotten, totes Standbonus-Feld, doppeltes
Kostenmodell) sind behoben, und das Spiel läuft über GitHub Pages. Was jetzt
auffällt, ist eine andere Klasse von Problemen: das Spiel *rechnet* korrekt, aber
es *erklärt* nichts, es *erinnert* sich an nichts, und es *fordert* nichts.

Die drei Explorationen und meine eigenen Nachprüfungen fanden dabei noch vier
echte Fehler, von denen zwei die Bilanz verfälschen.

Entscheidungen des Nutzers für diesen Plan:

| Frage | Antwort |
|---|---|
| Umfang Paket 1 | Verständlichkeit + Gedächtnis (Fehler beheben, Anzeige klären, Finanzhistorie) |
| Neue Mechaniken ausarbeiten | Konkurrenz um Passagiere · Fortschritt/Ziele/Ruf · Sichtbare Krisen |
| Balancing | Darf sich ändern; alte Spielstände laden weiter, rechnen aber anders |
| Sprache | Alles auf Englisch vereinheitlichen |

Nicht ausgearbeitet (vom Nutzer nicht gewählt): Leasing, Kredite, Abschreibung,
Insolvenz. Der Befund dazu steht unten in A1.8, weil er das Balancing erklärt.

---

# Teil A — Befunde

Alle Zeilenangaben aus dem aktuellen Arbeitsbaum, alle selbst im Code nachgeprüft.

## A1 — Echte Fehler

**A1.1 `aircraft.speed` existiert nicht — NaN in der Flugdauer.**
`src/components/RouteScheduleEditView.tsx:108` rechnet `distance / aircraft.speed`.
Das Feld heißt `cruiseSpeed` (`src/data/aircraft.ts:11`); `speed` kommt im
gesamten Projekt in keiner Datenstruktur vor. Ergebnis ist `NaN`, das über
`:113` und `:220` als `durMin` in jeden **neu angelegten** Flugplaneintrag
geschrieben wird. `getFlightTimeClass(NaN)` (`src/lib/financeUtils.ts:112-121`)
vergleicht nur mit `<` — alle Vergleiche sind falsch, also fällt die Funktion auf
`return 8` durch, die Langstreckenklasse. Deren Nachfragefaktor ist der
schlechteste im Spiel: `tcDemandMultiplier = max(0.4, 3.1 − 8·0.35) = 0.4`
(`financeUtils.ts:398`). Entscheidend ist nicht dieser Wert, sondern das
Verhältnis zum richtigen: eine Kurzstrecke gehört in Klasse 1 mit Faktor 2,75.
Nachgemessen an FRA–CDG mit einer Boeing 737-100 — korrekt 45 Minuten, Klasse 1,
Faktor 2,75; mit `NaN` Klasse 8, Faktor 0,40. Wer den Flugplan einer bestehenden
Kurzstrecke nachträglich bearbeitet, drückt ihre Nachfrage damit auf **14,5 %**
des richtigen Werts und bepreist sie als 12-Stunden-Flug. Zusätzlich vergiftet
`NaN` die Zeitachsenarithmetik
(`:131`, `:137`, `:250`). Gleicher Fehler in
`src/components/RoutePlannerView.tsx:3365`.

**A1.2 Die KI zahlt keine Ölkrisen.**
`src/App.tsx:426-435` (`getFuelPriceForAi`) liest `jetFuelPrices` und multipliziert
nur den Schwierigkeitsaufschlag. Der kanonische Pfad
`getJetFuelPrice` (`financeUtils.ts:738-748`) multipliziert zusätzlich
`getEventMultipliers(offset).fuelMult`. In der Ölkrise 1973 zahlt der Spieler
also den **doppelten** Spritpreis (`eventSystem.ts:18`, `fuelMultiplier: 2.0`),
die KI den einfachen — 18 Monate lang, plus 24 Monate ab 1979 bei 1,8× und
12 Monate ab 1990 bei 1,5×. Das ist kein Detail: Sprit ist der größte variable
Kostenblock.

**A1.3 Profitable Routen werden als Minus angezeigt.**
`src/App.tsx:2635-2638` rendert im Monatsbericht `amount: -r.profit` in einer als
Ausgabe formatierten Kategorie. Der Kommentar daneben ist der unfertige Gedanke
des Autors, wörtlich im Repository: *"Negating profit to show as an expense line
or just displaying the value, but since it's an expense category we might want to
make it special. Wait, I should add a custom category for it…"*. Eine Route mit
+80.000 $ steht als −80.000 $ da.

**A1.4 Zwei Modals liegen gleichzeitig übereinander.**
`RoutePlannerView.tsx:3550` und `:3664` rendern beide den Save-Config-Dialog,
`:3592` und `:3711` beide den Load-Config-Dialog — an derselben Flag, beide
`fixed inset-0 z-[3000]`, beide mit `autoFocus`-Input auf denselben State. Ist
`showConfigSaveModal` wahr, stehen zwei identische Dialoge übereinander.
~200 Zeilen doppeltes JSX.

**A1.5 Zwei Listen sortieren React-State direkt.**
`RoutesView.tsx:90` (`let result = routes;`) und `:116` (`result.sort(...)`):
greift kein Filter, ist `result` dasselbe Array wie der Prop — die Sortierung
mutiert also den State von `App` und wird so gespeichert.
`AirportsView.tsx:43/57` macht dasselbe mit dem modulweiten `airports`-Array und
zerstört dessen Standardreihenfolge dauerhaft für die ganze Sitzung.
`MyFleetView.tsx:85` macht es mit `[...fleet]` richtig.

**A1.6 Drei widersprüchliche „Gesamtzufriedenheit" für dasselbe Flugzeug.**

| Ort | Formel |
|---|---|
| `financeUtils.ts:295-300` `getPlaneSat` (**maßgeblich**, fließt in die Wirtschaft) | `round(round(pop·0.33 + baseInt·0.67) · (0.4 + 0.6·cond/100))` |
| `MyFleetView.tsx:553-554` | identische Kopie, aber eigenständig |
| `AircraftDetailsModal.tsx:18-19` | `round(pop·0.33 + (baseInt·cond/100)·0.67)` — **anders** |

Flottenliste und Detailfenster zeigen für dasselbe Flugzeug verschiedene Zahlen,
und beide sind nicht die, mit der das Spiel rechnet.

**A1.7 `Age` ist fest verdrahtet.**
`AircraftDetailsModal.tsx:117` rendert die Zeichenkette `"New"`, unabhängig von
`purchasedAt`. Ab dem zweiten Monat immer falsch.

**A1.8 Ein ungenutztes Flugzeug kostet 0 $/Monat.**
Es gibt keine Abschreibung, kein Leasing, keine Versicherung, keine
Standgebühr, kein Wartungsprogramm — `grep` über `src/` findet weder `loan`,
`credit`, `interest`, `bankrupt` noch `gameOver`. Das Kapital darf beliebig
negativ werden, ohne dass irgendetwas passiert. Die einzige Ausfallbedingung ist
„kein Geld mehr für den nächsten Kauf", und davor warnt nichts. Der einzige
Grund, ein Flugzeug zu verkaufen, ist Bargeldbedarf.
*(Vom Nutzer nicht zur Ausarbeitung gewählt — hier nur als Erklärung, warum
Fehlentscheidungen im Spiel folgenlos bleiben.)*

## A2 — Verständlichkeit

**A2.1 Die einzige Fehlermeldung des Routenassistenten ist unsichtbar.**
`RoutePlannerView.tsx:1490-1493`:

```jsx
<div className="bg-[#111] text-black … text-[9px]">{validationMsg}</div>
```

Schwarzer Text auf `#111` bei 9 px — Kontrast etwa 1,1 : 1. Darüber laufen
*alle* Assistenten-Fehler, darunter `AIRCRAFT RANGE VIOLATION` (`:1221`),
`AIRCRAFT CLASS EXCEEDS PORT CAPACITY` (`:1223`), `Not enough slots` (`:954`,
`:961`) und `Could not find a valid time slot` (`:1051`). Wer ein Flugzeug ohne
ausreichende Reichweite wählt, sieht einen deaktivierten Weiter-Knopf und eine
Begründung, die er buchstäblich nicht lesen kann.

**A2.2 Kein Rot, kein Grün — im ganzen Projekt.**
`grep -o "text-red-\|bg-red-\|text-green-\|bg-green-"` über `src/` → **0 Treffer**.
Zustände werden über zwei Abstufungen desselben Gelbs codiert, und die Zuordnung
ist verkehrt herum: *schlechte* Zustände werden **dunkler und unauffälliger**
gerendert als gute.

- `MyFleetView.tsx:654` — kritischer Zustandsbalken ist `bg-[#1a1a1a]` auf
  `bg-black`: bei einem kritischen Flugzeug ist der Balken unsichtbar, bei einem
  gesunden gelb.
- `AircraftDetailsModal.tsx:186-189` — der Knopf „URGENT: Renovate" ist
  `bg-[#1a1a1a]`, der nicht-dringende `bg-white/5`. Die dringende Variante ist
  die leisere.
- `RoutePlannerView.tsx:1622` — überlasteter Check-in-Schalter: Balken
  verschwindet.
- `App.tsx:3614-3615` — positiver und negativer Trend unterscheiden sich nur
  durch Deckkraft.

**A2.3 Die zentrale Preisentscheidung ist unbeschriftet.**
`RoutePlannerView.tsx:3179-3181` berechnet `basePriceBE75/BE99/BE35` — die
Break-Even-Preise bei 75 / 99 / 35 % Auslastung. Auf dem Bildschirm
(`:3428-3450`) sieht der Spieler einen Schieberegler, zwei nackte Dollarbeträge
an den Enden und einen 1-px-Strich in der Mitte ohne Beschriftung. Die einzige
Erklärung ist ein natives `title="Break-Even at 99% LF"` — und „LF" wird
nirgends im Projekt aufgelöst. Nichts sagt: unterhalb dieser Marke machst du
Verlust, oberhalb buchen die Passagiere nicht mehr. Gleiches Muster in
`RoutePricingEditView.tsx:150-151, 201-202`.

**A2.4 Begriffe ohne Auflösung.** `Max ICAO Code: E` (`AirportDetailView.tsx:279`)
— harte Sperre dafür, welche Flugzeuge überhaupt erscheinen
(`RoutePlannerView.tsx:576-577`), erklärt wird ein einzelner Buchstabe.
`Time-Class` (`RoutesView.tsx:202`) liest sich wie Beförderungsklasse, ist aber
ein Flugdauer-Eimer. `L4` neben `Mgmt: Standard` (`AirportDetailView.tsx:242-246`)
— zwei verschiedene Stufensysteme mit ähnlichem Namen. Dazu `Eff.`,
`Comb. Sat`, `Int. Cond` (`MyFleetView.tsx:711-718`), `CHG`
(`RoutePlannerView.tsx:1719`), `T1 Management` (`:1943`), `CAPEX`
(`AirportDetailView.tsx:645`), `Desk Load`, `SAT Impact`, `62% utilized`.

**A2.5 Kein Einstieg.** `tutorial|onboard|how to play|getting started|glossary`
→ 0 Treffer in Oberflächentexten. Nach *Start Game* steht der Spieler vor einer
Weltkarte mit leerer Flotte, leerer Routenliste und einem `Next Month`-Knopf.
Der richtige erste Zug (Flugzeug kaufen → Route planen) wird nirgends genannt;
der auffälligste Knopf ist der, der nichts bringt. Die einzige Willkommens­nachricht
(`App.tsx:1094-1105`) hat eine **deutsche** Vorschauzeile
(`"Herzlich willkommen bei Neo Airlines!"`) über englischem Text und nennt vier
Untersysteme, ohne eines zu erklären.

**A2.6 Klicks, die stumm nichts tun.** Sieben Stellen prüfen eine Bedingung und
kehren ohne Rückmeldung zurück: `App.tsx:2094` (Kauf bestätigen),
`App.tsx:3236` (T1 freischalten), `RoutePlannerView.tsx:1136-1137, 1156`,
`AirportDetailView.tsx:677, 686`. `RoutePlannerView.tsx:1131-1134` **kürzt**
zusätzlich still: Shift-Klick auf 10 Slots kauft ggf. 3. Dabei existiert mit
`setAppAlert` (`App.tsx:2185-2200`, 14 Aufrufstellen) längst ein funktionierender
Hinweisdialog — er ist an keiner dieser Stellen verdrahtet.

**A2.7 Das Spiel hat kein Gedächtnis.**
`latestReport` ist ein einzelnes State-Objekt (`App.tsx:1133`), das jeden Monat
überschrieben wird und **nicht im Spielstand steht** (`App.tsx:1944-1962`). Nach
dem Laden zeigt „My Company" also *„No financial report generated yet."*
Es gibt keine Zeitreihe, keine Routenhistorie, keine Bilanz (Flottenwert und
Infrastrukturwert kommen nirgends vor, nur Bargeld), und keine Abstimmung
zwischen Monatsgewinn und Kapitalveränderung — Flugzeugkäufe, Umrüstungen,
Checks und Management-Freischaltungen erscheinen in keinem Bericht.
Die Ironie: die **KI** bekommt eine echte 12-Monats-Historie
(`App.tsx:614`, `:937`), die in `CompetitorsView` als Balkendiagramm läuft. Die
Historie des *Spielers* an derselben Stelle ist erfunden:
`CompetitorsView.tsx:165` schreibt `[capital·0.08, capital·0.09, capital·0.11]`.

**A2.8 Weitere Anzeigefehler.** `RoutesView.tsx:194-206` hat **keine
Geldspalte** — aus der Routenliste ist nicht ablesbar, welche Route sich lohnt.
`:209` nutzt `colSpan={7}` bei 9 Spalten. `:156-157` bietet tote Filteroptionen
`Competitor A` / `Competitor B`, die zu keiner erzeugten KI-Airline gehören.

**A2.9 Barrierefreiheit.** `aria-*`: 0. `role=`: 0. `tabIndex`: 0. `onKeyDown`: 1.
44 interaktive `<div onClick>`, darunter die **komplette Hauptnavigation**
(`App.tsx:3597-3611`) und die Assistentenschritte
(`RoutePlannerView.tsx:1474-1484`) — per Tastatur unerreichbar. Kein einziger
`<button>` hat einen Fokusstil; `focus:outline-none` steht an 13 Stellen. Über
500 Verwendungen von Schrift unter 11 px, die Erklärung der Zufriedenheit
steht auf 7 px (`RoutePlannerView.tsx:3079`).

**A2.10 Sprachmischung.** Deutsch in einer sonst englischen Oberfläche:
`App.tsx:1096`, `MyCompanyView.tsx:32-35` („Flugumsatz", „Direkte Flugausgaben"),
`catering.ts:53` („Luxus" zwischen Basic/Standard/Premium),
`RouteConfigOverlay.tsx:217`, `RoutePricingEditView.tsx`, `RouteDetailView.tsx`,
`BuyAircraftView.tsx`.

## A3 — Performance

**A3.1 Kein einziges `React.memo` im Projekt.** Jede der ~70 `useState` in `App`
rendert sämtliche montierten Kindansichten neu, und alle Kinder bekommen frisch
allozierte Inline-Pfeilfunktionen als Props (`App.tsx:3009-3101`). Das ist die
Ursache der meisten folgenden Punkte.

**A3.2 `getDeskSim` läuft ~28× pro Render in Schritt 3 des Assistenten** — mit
**identischen Argumenten**. `financeUtils.ts:302-341` legt dabei jedes Mal eine
`new Map()` über die gesamte Flotte an und durchläuft alle Routen. Aufrufstellen:
`RoutePlannerView.tsx:3053` (4×), `:3057` (4×), `:3040`, `:3041`, `:2746`,
`:2895`, `:3071-3072` und indirekt `:2714`, `:3367`.
`calculateClassSatisfaction` (57 Zeilen) läuft ~32–40× pro Render;
`:2924` und `:2926` sind derselbe Aufruf zweimal hintereinander.

**A3.3 `AirportsView` rechnet O(562 × alle KI-Routen) pro Render.**
`AirportsView.tsx:141-149` reduziert für jede der 562 Zeilen über alle KI-Airlines
und deren Routen — bei 6 Gegnern mit je ~25 Routen rund 85.000 Iterationen, bei
jedem Elternzustand neu. Keine Virtualisierung: 562 Zeilen × 8 Knoten ≈ 4.500
DOM-Knoten.

**A3.4 `airports.ts` ist 1,73 MB und besteht zu 81 % aus Zahlen, die einzeln
gelesen werden.** 500 Flughäfen (plus 70 in `more_airports.ts`, davon 8
Überschneidungen) × 66 Jahrgänge × 2 Werte = **33.000 Jahres-Einträge**, die beim
Laden geparst und als ~74.000 Objekte alloziert werden. Der gebaute Chunk
`airport-data-*.js` ist **1.231.192 Byte = 48 % des gesamten JavaScripts**.
Einziger Leser ist `getAirportStats(airport, year)` (`airports.ts:34058-34080`),
das pro Aufruf **genau einen** Jahrgang liest.

Die Daten sind erzeugt, nicht historisch. Nachgemessen an den
Jahr-zu-Jahr-Verhältnissen: drei stückweise konstante Wachstumsregime
(≈5 %/Jahr 1960–1980, ≈3 % 1981–2000, ≈1,5 % 2001–2025) plus ±0,3 % Rauschen.
Zwischen Flughäfen unterscheiden sich die Raten sehr wohl (DXB 2000–2025:
12,05 %/Jahr; DTW: 1,50 %), der *Verlauf* ist aber immer derselbe. Damit lässt
sich die Tabelle verlustarm durch Basiswert + 3 Wachstumsraten pro Flughafen
ersetzen — Faktor ~30 kleiner.

**A3.5 Weitere Redundanz.**
`App.tsx:2413` sortiert 562 Flughäfen mit `localeCompare` **inline im JSX** des
Startmenüs — bei jedem Tastendruck im Airline-Namen. Der Leaflet-Block
(`App.tsx:2833-2915`) ist eine nicht memoisierte IIFE und erzeugt spät im Spiel
~750 Polyline-/Marker-Elemente pro Render, auch wenn eine Overlay-Ansicht die
Karte verdeckt und auch beim 20-Sekunden-`realTime`-Tick, den nur `LiveTraffic`
liest. `AircraftImage.tsx:68` rendert `<img>` ohne `loading="lazy"` — das
Aufklappen von Boeing lädt 40–60 Bilder gleichzeitig, auch die außerhalb des
Bildschirms.

**A3.6 Doppelte und tote Implementierungen.**
Zwei Flugzeitmodelle: `RoutePlannerView.tsx:474-499` (Beschleunigungsmodell mit
1,02-Krümmungsfaktor) gegen `RouteScheduleEditView.tsx:104-108`
(`distance / speed · 60 + 20`, siehe A1.1). Drei Spritpreis-Funktionen (siehe
A1.2). Zwei byte-identische Großkreis-Implementierungen mit *verschieden
geschlüsselten* Caches (`App.tsx:114-150/161` gegen
`LiveTraffic.tsx:17-54/59`) — derselbe Pfad wird zweimal berechnet und in zwei
Maps gelegt, die einander nie sehen. **Sieben** `formatCurrency`-Varianten mit
zwei verschiedenen Locale-Verhalten. **Vier** getrennt aufgebaute
Flughafen-Maps, von denen nur die in `App.tsx:52-80` die Ost/West-Anpassung
enthält — die Flughafentabelle zeigt also andere Nachfragewerte als der
Routenplaner, und die 8 doppelten IDs (`SKG HER RHO AYT ADB ESB BJV DLM`) haben
je nach Ansicht anderes `level`/`maxIcaoCode`.
Tot: `src/data/aircraftVisuals.ts` (264 Zeilen, nie importiert),
`Aircraft.wingspan` und `Aircraft.imageUrl` (0 Lesezugriffe),
`isImageUrlFailed` und `getAircraftImageUrl` (`imageUtils.ts:47`, `:202-211`),
`getDistance` (`RouteScheduleEditView.tsx:93-102`), `Stat`/`NavButton`/`LogEntry`
(`App.tsx:3639-3668`).

## A4 — Warum das Spiel sich leer anfühlt

Der Ablauf ist: Route planen → der Planer zeigt **exakt** den Gewinn an → „Next
Month" → derselbe Wert erscheint im Bericht → Kapital ändert sich. Es gibt keinen
Zufall, keine Verzögerung, keine Überraschung. Der Monatswechsel
(`App.tsx:1613-1898`) ist eine deterministische Neuberechnung derselben Formel.
Daraus folgt:

- **Der Bericht ist überflüssig**, weil er nichts sagt, was der Planer nicht schon
  gesagt hat.
- **Die Konkurrenz ist Dekoration.** `calculateDemand` (`financeUtils.ts:368-427`)
  hat keinen Wettbewerbsterm; zwei identische Parallelrouten bekommen jede 100 %
  der Nachfrage. Die KI fliegt den Spielerhub sogar ausdrücklich nie an
  (`App.tsx:872`: `a.id !== playerHubId`). Einziger Berührungspunkt sind
  Slotkontingente.
- **Die Krisen sind unsichtbar.** Die sechs historischen Ereignisse
  (`eventSystem.ts:10-59`) lösen **keine Nachricht** aus — nur die zufälligen tun
  das (`App.tsx:1805-1815`). Im März 2020 multipliziert das Spiel die Nachfrage
  still mit **0,20**; der Spieler sieht nur, dass der Umsatz einbricht. Es gibt
  keine Ereignisübersicht, keine Restlaufzeit und keine Handlung, mit der man
  reagieren kann.
- **Es gibt keinen Fortschritt.** `reputation|achievement|milestone|prestige|goal`
  → keine Treffer. Nach 30 Spieljahren hat man mehr Geld und neuere Flugzeuge —
  aber dieselben fünf Klicks, dieselben Bildschirme, kein Rang, keine
  Freischaltkette, kein Ziel, kein Ende.

---

# Teil B — Vorschlag: Umsetzungspaket 1

Rein additiv oder korrigierend; keine neuen Spielsysteme. Reihenfolge ist
Umsetzungsreihenfolge.

### B1 — Die vier Fehler mit Bilanzwirkung

1. `RouteScheduleEditView.tsx:104-108` löschen und stattdessen die
   Beschleunigungs-Formel aus `RoutePlannerView.tsx:474-499` verwenden. Beide nach
   `src/lib/financeUtils.ts` als `getFlightDurationMinutes(origin, dest, aircraft)`
   heben, damit es nur noch ein Flugzeitmodell gibt. `RoutePlannerView.tsx:3365`
   mitziehen. Die tote `getDistance` (`RouteScheduleEditView.tsx:93-102`) entfernen.
   *Nebenwirkung:* bestehende Spielstände mit `NaN`-Flugplänen müssen beim Laden
   repariert werden — in `loadGame` jeden Eintrag mit `!Number.isFinite(durMin)`
   neu berechnen.
2. `App.tsx:426-435` (`getFuelPriceForAi`) durch `getJetFuelPrice` aus
   `financeUtils.ts:738` ersetzen. Auch `getFuelData` (`App.tsx:1275-1309`) darauf
   umstellen und nur die Trendzeichenkette dort behalten.
3. `App.tsx:2635-2638`: `-r.profit` → `r.profit`, und die Kategorie als eigene,
   neutral formatierte Sektion rendern statt als Ausgabenblock. Den
   zurückgelassenen Autorenkommentar entfernen.
4. `RoutesView.tsx:116` → `[...result].sort(...)`; `AirportsView.tsx:43/57`
   ebenso, nach dem Muster von `MyFleetView.tsx:85`.

### B2 — Ein einziger Zufriedenheitswert

`getPlaneSat` (`financeUtils.ts:295`) in `MyFleetView.tsx:553-554` und
`AircraftDetailsModal.tsx:18-19` importieren statt zweimal neu zu schreiben.
`AircraftDetailsModal.tsx:117` (`Age`) aus `purchasedAt` und `currentDateOffset`
berechnen — der Prop muss dafür durchgereicht werden.

### B3 — Sichtbarkeit: Fehler, Zustände, Farben

- `RoutePlannerView.tsx:1491`: `text-black` → heller Warnton auf dunklem Grund,
  Schriftgröße auf ≥ 11 px, und ein Warnsymbol davor.
- Eine Farbrolle einführen. Vorschlag ohne Bruch mit der Gestaltung: zwei
  Tokens in `src/index.css` (`--aero-warn`, `--aero-good`) und Tailwind-Aliase
  `aero-warn` / `aero-good`. Dann die Umkehrung an den vier belegten Stellen
  korrigieren — `MyFleetView.tsx:654`, `AircraftDetailsModal.tsx:186-189`,
  `RoutePlannerView.tsx:1622`, `App.tsx:3614-3615` — sodass schlechte Zustände
  **auffälliger** sind als gute, nicht unauffälliger.
- Die sieben stillen `return` (A2.6) auf `setAppAlert` (`App.tsx:2185-2200`)
  umstellen; für die stille Kürzung in `RoutePlannerView.tsx:1131-1134` eine
  Meldung im Stil „Only 3 of 10 slots available at FRA — 3 purchased."

### B4 — Erklär-Tooltips

`SeatInfoTooltip` (`ConfigurePurchaseView.tsx:8-37`) ist das beste Muster im
Projekt: Hover-`Info`-Symbol, 250-px-Portalkarte mit Titel und
`whitespace-pre-wrap`-Text, Randkollisionsbehandlung (`:29`). Es ist ein lokales
`const` und wird nur in dieser einen Datei benutzt.

Nach `src/components/InfoTooltip.tsx` heben (mit Tastaturfokus und `role="tooltip"`,
damit es nicht dieselbe Barrierefreiheitslücke erbt) und an die tragenden
Begriffe hängen: **SAT**, **Break-Even / Load Factor** (BE75/BE99/BE35),
**Time-Class**, **Max ICAO Code**, **Airport Level (L4) vs. Management (T1)**,
**Efficiency**, **Interior/General Condition**, **Slot / Stand / Desk**,
**Desk Load**, **Business/Tourism**, **CAPEX vs. Miete**.

Der Schieberegler in `RoutePlannerView.tsx:3428-3450` und
`RoutePricingEditView.tsx:130-151` bekommt außerdem echte Beschriftungen:
„Break-even at 99 % full" / „Break-even at 35 % full" / eine benannte Marke
„Break-even at 75 % full" und einen Satz, der sagt, was jenseits der Marken
passiert.

### B5 — Gedächtnis: Finanzhistorie und Bilanz

Das Kernstück des Pakets. Die Infrastruktur existiert bereits für die KI
(`App.tsx:614`, `:937`) und muss nur für den Spieler gespiegelt werden.

1. **State:** `reportHistory: MonthlyReport[]` neben `latestReport`
   (`App.tsx:1133`). In `handleAdvanceMonth` (`:1691-1713`) anhängen, auf die
   letzten 120 Monate begrenzen.
2. **Persistenz:** `reportHistory` in das `saveObj` in `App.tsx:1944-1962`
   aufnehmen und beim Laden zurücklesen; `latestReport` daraus ableiten
   (`history.at(-1)`). Damit verschwindet das „No financial report generated yet."
   nach dem Laden.
3. **Einmalausgaben erfassen.** Flugzeugkauf (`App.tsx:2095`), Umrüstung,
   General Check (`:3290`), Management-Freischaltung (`:3237`, `:3311`), Schalter
   und Standplätze (`:3257`, `:3352`) laufen derzeit an jedem Bericht vorbei. Nach
   dem Muster des bereits vorhandenen `pendingSlotBills` sammeln und als
   Capex-Zeile ausweisen, damit Monatsgewinn und Kapitalveränderung endlich
   zusammenpassen.
4. **`MyCompanyView` ausbauen** (aktuell 85 Zeilen): Umsatz-/Gewinn-/Kapitalkurve
   über die Historie, Vergleich zum Vormonat mit Pfeil und Prozent, und eine
   einfache Bilanz — Bargeld + Flottenwert (Restwertformel aus `App.tsx:2077`
   wiederverwenden) + Infrastrukturwert = Firmenwert. Das Balkendiagramm aus
   `CompetitorsView.tsx:593-604` lässt sich direkt übernehmen.
5. **`CompetitorsView.tsx:165`**: die erfundene Historie durch die echte
   `reportHistory` ersetzen.
6. **Routen-Historie:** pro Route Umsatz/Gewinn des Monats im Bericht mitführen
   (steht in `latestReport.routes` bereits zur Verfügung) und in `RouteDetailView`
   als Verlauf zeigen — damit ist zum ersten Mal beantwortbar, ob eine
   Preisänderung gewirkt hat.
7. **`RoutesView`**: Spalte „Profit / month" ergänzen (`:194-206`), `colSpan`
   auf 9 korrigieren (`:209`), die toten Filteroptionen `Competitor A/B`
   (`:156-157`) durch die tatsächlichen KI-Namen ersetzen.

### B6 — Einstieg

Keine aufwändige Führung, sondern drei kleine Dinge:

- Die Willkommensnachricht (`App.tsx:1094-1105`) neu schreiben: Vorschauzeile auf
  Englisch, Text als **drei nummerierte erste Schritte** („1. Buy an aircraft —
  Fleet ▸ Market · 2. Plan a route from your hub · 3. Advance the month").
- Leerzustände mit nächstem Schritt versehen. `MyFleetView.tsx:385-392` hat schon
  den richtigen Ton; `RoutesView.tsx:209-214` und die leere Flugzeugspalte in
  `RoutePlannerView.tsx:1658` haben gar nichts. Bei letzterer zusätzlich
  begründen, *warum* ein besessenes Flugzeug nicht in der Liste steht (Hub passt
  nicht `:572`, ICAO-Code zu groß `:576-577`).
- Der `debugMode` (`App.tsx:2455-2475`) schaltet bereits zwei Panels frei, die das
  Modell tatsächlich erklären — die Nachfrageprognose
  (`RoutePlannerView.tsx:1864-1900`) und die Preisherleitung (`:3343-3411`). Sie
  in Klartext umschreiben und als **„Explain the numbers"** statt „Debug"
  anbieten. Das liefert den größten Teil des besseren Verständnisses ohne neue
  Oberfläche.

### B7 — Sprache und Barrierefreiheit

- Deutsche Reststrings ins Englische (A2.10).
- `SidebarIcon` (`App.tsx:3597-3611`) und die Assistentenreiter
  (`RoutePlannerView.tsx:1474-1484`) auf echte `<button>` umstellen, sichtbarer
  Fokusring in `src/index.css`; die Tabellenzeilen in `RoutesView`/`AirportsView`
  tastaturbedienbar machen.
- Erklärenden Text von 7–9 px auf ≥ 11 px heben — vor allem
  `RoutePlannerView.tsx:3079`.

### B8 — Performance (der billige Teil)

Nur was ohne Umbau geht; das Große steht in Teil D.

- Die ~28 identischen `getDeskSim`-Aufrufe und die ~35
  `calculateClassSatisfaction`-Aufrufe in Schritt 3 in je ein `useMemo` ziehen
  (`RoutePlannerView.tsx:2744-3151`); den Doppelaufruf `:2924`/`:2926` entfernen.
- Den 562-Einträge-Sort aus dem JSX (`App.tsx:2413`) in ein `useMemo` heben.
- Den O(562 × KI-Routen)-Reduce in `AirportsView.tsx:141-149` durch eine einmal
  vorberechnete Map ersetzen.
- `loading="lazy" decoding="async"` in `AircraftImage.tsx:68`.
- Die doppelten Config-Modals (`RoutePlannerView.tsx:3550/3592` **oder**
  `:3664/3711`) löschen — ~200 Zeilen.
- Toten Code löschen (A3.6, letzter Absatz).

---

# Teil C — Designs für neue Mechaniken

Ausgearbeitet, aber nicht Teil von Paket 1. Reihenfolge nach Wirkung pro Aufwand.

## C1 — Konkurrenz um Passagiere

**Das Problem:** `calculateDemand` kennt keinen Wettbewerb. Zwei identische
Routen auf derselben Städteverbindung bekommen jede die volle Nachfrage. Die
Konkurrenzansicht ist deshalb eine Rangliste, kein Gegner.

**Der Haken ist schon da:** `calculateRouteFinancials` bekommt `allRoutes`
bereits als Parameter (`financeUtils.ts:539`), benutzt es aber nur für die
Schalterauslastung (`:597-598`). Die Signatur muss also nicht geändert werden —
nur die KI-Routen müssen mit hineingereicht werden.

**Modell.** Für eine Städteverbindung alle Angebote sammeln (eigene und fremde)
und die Nachfrage nach einem Attraktivitätswert aufteilen:

```
attractiveness_i = frequency_i^0.5 · (satBasePrice_i / price_i)^1.2 · (SAT_i / 100)^0.8
share_i          = attractiveness_i / Σ attractiveness
pax_i            = min(seats_i · legs_i, totalDemand · share_i)
```

Die Exponenten bilden ab, was Fluggesellschaften tatsächlich erfahren:
Frequenz wirkt mit abnehmendem Ertrag, Preis stärker als Frequenz, Service
schwächer als Preis. Der bestehende `getPriceDemandMultiplier`
(`financeUtils.ts:522-527`) bleibt als *Marktgrößen*-Effekt erhalten — billiger
macht den Kuchen größer —, der neue Term teilt ihn auf.

**Was sich dadurch ändert:**
- Der Erste auf einer Verbindung hat einen echten Vorteil, den man verteidigen muss.
- Preiskampf wird eine Option statt einer Rechenaufgabe.
- `App.tsx:872` (`a.id !== playerHubId`) muss fallen — die KI darf den Spielerhub
  anfliegen. Sonst ist der Hub ein Schutzraum.
- Die KI braucht eine Reaktion: in `simulateAiAirlinesTurn` (`App.tsx:415-944`)
  eine Regel, die auf verlorenen Marktanteil mit Preis oder Frequenz antwortet.
  Die `aggression`-Eigenschaft der KI-Persönlichkeiten existiert bereits und wird
  bislang kaum genutzt.

**Kosten:** die Gewinne fallen breitflächig; die Balance muss nachgezogen werden.
Deshalb hängt das an der Zustimmung „Balance darf sich ändern" (liegt vor).

**Anzeige:** in `RouteDetailView` und im Planer eine Zeile „Competing on this
route: Skyward Air (3×/week, $412)". Das macht aus `CompetitorsView` zum ersten
Mal einen Bildschirm, den man im Spiel konsultiert.

## C2 — Sichtbare Krisen und Entscheidungen

**Das Problem:** die sechs historischen Ereignisse lösen keine Nachricht aus. Der
Spieler erlebt März 2020 als unerklärlichen Umsatzeinbruch auf ein Fünftel.

**Drei Stufen, aufsteigend im Aufwand:**

1. **Ankündigung und Abschluss.** Die Nachrichtenerzeugung, die es für zufällige
   Ereignisse schon gibt (`App.tsx:1805-1815`, inklusive expliziter ±%-Angaben),
   auch für `historicalEvents` auslösen — plus eine Nachricht am Ende der
   Laufzeit. Rein additiv, sehr klein.
2. **Ereignisleiste.** `getActiveEvents(offset)` (`eventSystem.ts:67-71`) liefert
   bereits alles Nötige. Oben in der Statusleiste (`App.tsx:2670-2786`) neben
   „Global Demand"/„Fuel" die aktiven Ereignisse mit Restmonaten anzeigen, beim
   Anklicken die Beschreibung.
3. **Entscheidungen.** `HistoricalEvent` um ein optionales `choices` erweitern:

   ```ts
   choices?: { label: string; cost: number; effect: Partial<EventEffect>;
               durationMonths: number }[]
   ```

   Beispiel Ölkrise: *„Hedge fuel for 12 months — $2 M upfront, fuel price fixed
   at today's rate"* gegen *„Ride it out — no cost"*. Beispiel Pandemie:
   *„Ground half the fleet — no revenue on those routes, but crew cost drops
   80 %"*. Damit ist zum ersten Mal eine Entscheidung im Spiel, die man später
   bereut oder feiert — das, was der Simulation heute vollständig fehlt.

**Zusatz mit wenig Aufwand:** regionale statt nur globaler Ereignisse. Ein
`regions?: string[]`-Feld auf `HistoricalEvent` und ein Regionsfeld je Flughafen
würden „Streik in Frankreich" oder „Tourismusboom in Südostasien" möglich machen.
Die Ost/West-Anpassung in `App.tsx:52-80` zeigt, dass die Geografie schon
ansatzweise gruppiert ist.

## C3 — Fortschritt, Ziele und Ruf

**Das Problem:** es gibt keinen Airline-Wert, der wächst. Nach 30 Jahren sind es
dieselben fünf Klicks.

**Ruf (`reputation`, 0–100), ein persistenter State neben `capital`.**
Monatlich fortgeschrieben aus Dingen, die das Spiel bereits berechnet:

```
target = 0.5 · Ø(SAT aller Routen, gewichtet nach Pax)
       + 0.3 · Ø(conditionInterior der eingesetzten Flotte)
       + 0.2 · Pünktlichkeits-/Auslastungsproxy
reputation += (target − reputation) · 0.15      // träge, wirkt über Monate
```

Träge Anpassung ist der Punkt: Ruf lässt sich nicht kaufen, nur über Monate
aufbauen — und schnell verlieren. Wirkung zurück ins Spiel: ein kleiner
Nachfragefaktor (±10 %) und ein Rabatt auf Slotpreise bei hohem Ruf. Damit
bekommt `conditionGeneral` endlich eine Funktion; heute beeinflusst es nur den
Wiederverkaufswert und einen roten Balken, d. h. die 200.000-$-Checks sind ein
reiner Geldabfluss.

**Meilensteine.** Eine Tabelle geprüfter Bedingungen, ausgewertet am Monatsende,
Belohnung als Nachricht + Ruf-Bonus:
erste Route · 10 Flugzeuge · erste Interkontinentalstrecke · alle sechs
Kontinente bedient · 100 Mio. Kapital · ein Jahr ohne Verlustmonat · Marktführer
auf einer Verbindung (setzt C1 voraus).

**Jahresziele.** Im Januar ein Ziel ausgeben („Reach $40 M revenue this year"),
im Dezember abrechnen. Gibt dem Kalender zum ersten Mal einen Rhythmus.

**Rangliste.** `CompetitorsView` sortiert bereits nach Kapital
(`CompetitorsView.tsx:60-227`). Mit echter Spielerhistorie (B5) und Ruf wird
daraus eine Tabelle, in der man steigen und fallen kann.

---

# Teil D — Später, mit Begründung

**D1 Karte aus `App` herauslösen und `React.memo` einführen.** Größte
Hebelwirkung aller Performance-Maßnahmen (A3.1, A3.5), aber sie verlangt, alle
Inline-Callbacks in `App.tsx:3009-3101` zu stabilisieren — ein eigener Umbau, der
sich schlecht mit inhaltlichen Änderungen mischt. Danach: `realTime`
(`App.tsx:1122`) nach `LiveTraffic` verschieben, denn nur dort wird es gelesen.

**D2 `RoutePlannerView` nach Assistentenschritten zerlegen.** 3.774 Zeilen,
Schritt 2 allein 715 (`:2029-2743`). Die Zustände der vier Schritte sind fast
disjunkt. Nach dem Löschen der doppelten Modals (B8) der nächste sinnvolle
Schnitt.

**D3 `airports.ts` umbauen.** 1,15 MB für Werte, die einzeln gelesen werden
(A3.4). Empfehlung: Basiswert je Flughafen plus die drei Wachstumsraten
speichern und in `getAirportStats` interpolieren — die Funktion und ihr
WeakMap-Cache (`airports.ts:34019-34047`) bleiben unverändert, nur die
Datenquelle wechselt. Der App-Shell fällt damit um ~48 % des JavaScripts.
*Vorher zu klären:* ob die Rekonstruktion exakt genug ist — die Rauschanteile
gehen verloren, was spielerisch irrelevant, aber messbar ist.

**D4 Vier Flughafen-Maps auf eine reduzieren.** Heute zeigt die Flughafentabelle
andere Nachfragewerte als der Routenplaner, und 8 doppelte IDs haben je nach
Ansicht andere Eigenschaften (A3.6). Eine exportierte Map in einem eigenen Modul,
die die Ost/West-Anpassung enthält.

**D5 `AirportsView` virtualisieren.** 562 Zeilen fester Höhe — der klarste
Kandidat, aber er zieht eine neue Abhängigkeit nach sich.

**D6 Flugzeug-Fixkosten, Leasing, Kredite, Insolvenz** (A1.8). Vom Nutzer für
jetzt nicht gewählt. Ohne dieses System bleibt „zu viele Flugzeuge kaufen"
folgenlos und es gibt keine Verlustbedingung.

---

# Verifikation

Nach jedem Teilschritt, nicht erst am Ende:

1. **Typen:** `npm run lint` (`tsc --noEmit`) — muss 0 Fehler melden.
2. **Build:** `npm run build` und `npm run build:pages`. Die Chunk-Größen mit dem
   heutigen Stand vergleichen (`airport-data` 1.231.192 B, `index` 1.105.006 B).
3. **Rechenkerne gegen den Ist-Zustand messen.** Vor der Änderung ein
   Node-Skript in der Zwischenablage, das `calculateRouteFinancials` für drei
   feste Routen (Kurz-/Mittel-/Langstrecke) in drei Jahren (1965, 1975, 2024)
   aufruft und die Zahlen festhält. Nach der Änderung erneut. Für B1–B4 müssen
   sich die Werte **nicht** ändern, außer in den Fällen, die B1.1 und B1.2
   ausdrücklich korrigieren — dort ist die Abweichung der Beweis, dass der Fehler
   weg ist.
4. **Browserlauf mit Playwright/Chromium** (`/opt/pw-browsers`, bereits
   eingerichtet), pro Paketschritt:
   - Neues Spiel starten, Flugzeug kaufen, Route planen, drei Monate vorspielen.
   - **B1.1:** Flugplan einer Kurzstrecke nachträglich bearbeiten, einen Eintrag
     hinzufügen, prüfen dass `durMin` endlich ist und die Time-Class 1–3 bleibt
     (heute: 8).
   - **B1.2:** auf Oktober 1973 vorspielen und prüfen, dass der KI-Spritpreis dem
     des Spielers entspricht.
   - **B1.3:** Monatsbericht öffnen, eine profitable Route muss positiv stehen.
   - **B3:** ein Flugzeug mit zu kurzer Reichweite wählen — die Meldung muss
     lesbar sein; T1 ohne Kapital freischalten — es muss ein Hinweis erscheinen.
   - **B5:** speichern, Seite neu laden, Spielstand laden — „My Company" muss die
     Historie zeigen statt „No financial report generated yet.".
   - **B8:** Schritt 3 des Planers öffnen, ein Catering-Menü umschalten; mit dem
     React-Profiler gegen die heutige Renderdauer vergleichen.
5. **Speicherstände:** ein vor der Änderung erzeugter Spielstand muss danach
   laden. Für B1.1 explizit einen Spielstand mit kaputtem Flugplan erzeugen und
   die Reparatur beim Laden prüfen.
6. **Kein `git push`**, bevor 1–5 durchlaufen sind. Zielbranch bleibt
   `claude/tender-faraday-vzday9`.

## Zu berührende Dateien (Paket 1)

| Datei | Warum |
|---|---|
| `src/lib/financeUtils.ts` | Flugzeitmodell aufnehmen, `getPlaneSat` als einzige Quelle |
| `src/App.tsx` | KI-Spritpreis, Berichtsvorzeichen, `reportHistory` + Persistenz, Capex-Erfassung, Willkommensnachricht, `setAppAlert`-Verdrahtung, Startmenü-`useMemo`, Sidebar als `<button>` |
| `src/components/RouteScheduleEditView.tsx` | NaN-Flugdauer, tote `getDistance` |
| `src/components/RoutePlannerView.tsx` | Fehlermeldung sichtbar, Preis-Slider beschriften, doppelte Modals, `useMemo` für `getDeskSim`/`calculateClassSatisfaction`, Leerzustand, Reiter als `<button>` |
| `src/components/MyCompanyView.tsx` | Verlauf, Bilanz, Vormonatsvergleich, englische Labels |
| `src/components/RoutesView.tsx` | Profit-Spalte, `colSpan`, tote Filter, Sortier-Mutation |
| `src/components/CompetitorsView.tsx` | erfundene Spielerhistorie ersetzen |
| `src/components/MyFleetView.tsx`, `AircraftDetailsModal.tsx` | `getPlaneSat`, `Age`, Farbumkehr |
| `src/components/AirportsView.tsx` | Sortier-Mutation, vorberechnete KI-Slot-Map |
| `src/components/AircraftImage.tsx` | `loading="lazy"` |
| `src/components/InfoTooltip.tsx` | **neu** — aus `ConfigurePurchaseView.tsx:8-37` gehoben |
| `src/index.css` | Warn-/Gut-Farbtokens, Fokusring |
| `src/data/aircraftVisuals.ts` u. a. | toter Code (A3.6) |
