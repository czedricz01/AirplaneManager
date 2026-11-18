# Spezifikation des Rechenmodells

Entsteht in Phase 2. Diese Datei ist die einzige Quelle dafür, was das Spiel
rechnen **soll**. Der Code folgt ihr, nicht umgekehrt.

## Aufbau je Größe

```
### <Name> (Code-Name: `<bezeichner>`)
- Bedeutung: <ein Satz, was die Größe im Spiel darstellt>
- Einheit und Bereich: <z. B. Punkte 0 … 160>
- Formel: <einfach geschrieben>
- Hängt ab von: <andere Größen>
- Wirkt auf: <andere Größen, jede Wirkung nur einmal>
- Konstanten: <Name = Wert, Begründung>
- Regeln (werden als Tests geprüft): <z. B. „mehr Service senkt nie die SAT“>
- Anzeige: <wo und wie der Spieler sie sieht>
```

## 1. Grundbegriffe und Einheiten

Dieser Abschnitt legt fest, in welchen Einheiten das Modell rechnet und wie die Größen heißen.
Alle späteren Abschnitte (2–8) halten sich daran. Grundlage: E4–E14, E36, E50, R4, R5.

### 1.1 Zeit

| Begriff | Code-Name | Festlegung |
|---|---|---|
| Spielmonat | `month` | Ganze Zahl; 0 = Januar 1960, 12 = Januar 1961 (wie heute, `src/data/scenarios.ts:21`). |
| Kalenderjahr | `yearOf(month)` | 1960 + abrunden(`month` / 12). Für Tabellen, Lieferzeiträume, Texte. |
| Stetige Zeit | `timeOf(month)` | 1960 + `month` / 12 (Jahre mit Bruchteil). Für alles, was mit der Zeit wächst (Kostenindex, Nachfrage-Wachstum). Keine Sprünge am Jahreswechsel (R5). |
| Woche | – | Grundtakt jeder Strecke: Abflüge, Fluggäste, Erlös und Flugkosten werden je Woche gerechnet. |
| Wochen je Monat | `WEEKS_PER_MONTH` | 365,25 / 12 / 7 ≈ 4,348. Überall dieselbe Konstante (E5). Monatswert = Wochenwert × `WEEKS_PER_MONTH`. |
| Jahr | – | 12 Monate ≈ 52,18 Wochen. Jahreswerte (z. B. Abschreibung, E29) werden durch 12 geteilt, nie durch 48 oder 52. |
| Monatsabschluss | `closeMonth` | Einziger Zeitschritt des Spiels. Alles, was sich über die Zeit ändert (Kasse, Ruf, Zustand, Strecken-Alter), ändert sich hier, einmal je Monat. |
| Flugzeit | `blockMinutes` | Minuten (Blockzeit), ungerundet. Stunden nur in der Anzeige. |

Regeln (Tests):
- Ein Wochenwert × `WEEKS_PER_MONTH` × 12 = Wochenwert × 52,18 (Erlös und Kosten nutzen dieselbe Jahreslänge).
- `timeOf` steigt mit jedem Monat um genau 1/12.

### 1.2 Raum und Mengen

| Größe | Einheit | Hinweis |
|---|---|---|
| Entfernung | km, Großkreis | ungerundet |
| Geschwindigkeit | km/h | Reisegeschwindigkeit aus den Flugzeugdaten; die feste Bezugsgeschwindigkeit für die Marktgröße (E20) steht in Abschnitt 3. |
| Treibstoff | Liter | Tabelle in $ je Gallone (`src/data/fuelPrices.ts`); Umrechnung einmal: 1 Gallone = 3,78541 Liter. |
| Fluggäste | Fluggäste je Woche | Erwartungswert, **nicht gerundet** (R4). Obergrenze: angebotene Sitze. |
| Sitze, Flugzeuge, Abflüge je Woche, Slots | Stück | Ganze Zahlen, weil der Spieler sie so einstellt. |
| Klasse | `economy`, `premium`, `business`, `first` | Immer diese vier (Premium = Premium Economy, wie heute `src/lib/financeUtils.ts:887`); eine Klasse ohne Sitze zählt nicht mit. |

### 1.3 Geld und Kostenindex

**Spiel-Dollar ($).** Alle Beträge sind Spiel-Dollar in festen Preisen. Es gibt keine allgemeine
Inflation. Was sich über die Zeit verschiebt, regelt allein der Kostenindex.

**Kostenindex** (Code-Name: `costIndex(month)`)
- Bedeutung: Wie viel teurer Löhne, Gebühren, Preise und Einmalbeträge gegenüber 1960 sind.
- Einheit und Bereich: Faktor, 1 im Januar 1960, wächst danach stetig.
- Formel: `costIndex = (1 + COST_GROWTH) ^ (timeOf(month) − 1960)`, Zeit begrenzt auf 1960 … 2100.
- Konstanten: `COST_GROWTH = 0,012` je Jahr (Startwert von heute, `src/lib/realCosts.ts:19`);
  endgültiger Wert aus dem Balance-Skript (3.9, E7).
- Wirkt auf (E6, E7): jeden Dollar-Betrag, den das Modell als Konstante festlegt: Löhne, Flughafen-Gebühren,
  Unterhalt, Mieten, **Grundpreise der Tickets**, Einmalpreise (Slots, Verwaltungsstufen, Einrichtungen,
  Kabinen-Umbau), Belohnungen, Forschungskosten, KI-Zuschuss (solange es ihn gibt, E47),
  **Listenpreise der Flugzeuge** (E54): Kaufpreis = Listenpreis aus `src/data/aircraft.ts` × `costIndex`
  des Kaufmonats; das Wertmodell (E29) rechnet ab diesem Kaufpreis (Einzelheiten Abschnitte 5 und 8).
- Wirkt nicht auf:
  - die Treibstoff-Tabelle (echte Preise, E8),
  - Beträge, die als **Anteil einer anderen Größe** festgelegt sind (z. B. Krisen-Antworten als Anteil der
    Treibstoff-Rechnung, E6, E35; Grundüberholung als Anteil des Listenpreises, E31). Sie wachsen mit
    ihrer Bezugsgröße; ein zweiter Index würde doppelt zählen.
- Schreibweise im Modell: Feste Beträge stehen als Wert von 1960 in den Konstanten (Endung `_1960`,
  z. B. `SLOT_PRICE_NARROWBODY_1960`). Sie werden nur über eine Funktion `atCost(betrag1960, month)`
  umgerechnet. Eine zweite Stelle mit `costIndex` gibt es nicht.
- Regeln (Tests):
  - `costIndex(0) = 1`; `costIndex` sinkt nie mit der Zeit.
  - Jeder feste Betrag im Jahr 2020 = Betrag 1960 × `costIndex` 2020 (Stichprobe je Bereich).
  - Ein Betrag, der als Anteil festgelegt ist, ändert sich nicht, wenn nur der Kostenindex steigt
    und die Bezugsgröße gleich bleibt.
- Anzeige: Texte und Preise in der Oberfläche zeigen immer den Betrag des aktuellen Monats (E52, 4.1).

### 1.4 Skalen

Jede Skala hat einen Namen, einen Bereich und, wo nötig, einen Neutralpunkt. Grenzen werden einmal
gesetzt, am Ende der Funktion, die die Größe festlegt (R4).

| Größe (Oberfläche) | Code-Name | Bereich | Neutral / Bedeutung | Quelle |
|---|---|---|---|---|
| Satisfaction (je Klasse) | `satisfaction` | 0 … 160 Punkte | 100 = „wie erwartet“, 160 = Spitze | E9, E14 |
| Route satisfaction | `routeSatisfaction` | 0 … 160 Punkte | Mittel der Klassen, nach Fluggästen gewichtet | E9, E10 |
| Cabin rating | `cabinRating` | 0 … 100 Punkte | Wert der Kabine eines Flugzeugs; Erwartung je Klasse in Abschnitt 2 | E9 |
| Type appeal | `typeAppeal` | 0 … 100 Punkte | Beliebtheit des Flugzeugtyps | E9 |
| Service points | `servicePoints` | Punkte, Bereich in Abschnitt 2 | Beitrag von Essen, Getränken, Extras | E9 |
| Reputation | `reputation` | 0 … 100 Punkte | **50 = neutral** (Nachfrage-Faktor 1); Start 50 | E36 |
| Zustand (Kabine, Zelle) | `cabinCondition`, `airframeCondition` | 0 … 100 % | 100 = neu | – |
| Passenger share | `passengerShare` | 0 … 1 (Anzeige %) | Anteil an den Fluggästen eines Städtepaars | E9 |
| Departure share | `departureShare` | 0 … 1 (Anzeige %) | Anteil an den Abflügen eines Städtepaars | E9 |

**Faktoren.** Jeder Faktor ist eine Zahl ohne Einheit mit **1 = neutral**. Der Neutralpunkt ist der
übliche Zustand (Schwierigkeit Normal, Ruf 50, Satisfaction 100, keine Saison-Abweichung). Ein Faktor
wirkt an genau einer Stelle (R2); welche, steht bei der Größe in den Abschnitten 2–8.

**Prozent.** Intern immer als Anteil 0 … 1 gerechnet (Ausnahme: Zustand, wie heute in % gespeichert).
Prozent nur in der Anzeige.

### 1.5 Namen

Neue Namen nach E9. Die Oberfläche nutzt die englischen Namen; der Code dieselben Wörter in camelCase.
„SAT“, „Loyalty“ und „Market share“ gibt es nicht mehr als Sammelnamen.

| Oberfläche | Code-Name | Bedeutung | Heute |
|---|---|---|---|
| Type appeal | `typeAppeal` | Beliebtheit eines Flugzeugtyps (mit Alter, Neuheit, Forschung) | „Plane type satisfaction“, `popularity` |
| Cabin rating | `cabinRating` | Wert der eingebauten Kabine eines Flugzeugs, 0–100 | „63% SAT“, `getPlaneSat` |
| Service points | `servicePoints` | Punkte aus Essen, Getränken, Extras | `sat` in `src/data/catering.ts` |
| Satisfaction | `satisfaction` | Zufriedenheit einer Klasse auf einer Strecke, 0–160 | SAT je Klasse |
| Route satisfaction | `routeSatisfaction` | Zufriedenheit der Strecke, nach Fluggästen gewichtet | sitzgewichtete SAT |
| Established route bonus | `establishedRouteBonus` | Zuschlag für alte Strecken | „Loyalty“ in `routeMaturity.ts` |
| Frequent flyer | `frequentFlyer` | Vielflieger-Programm (Anziehung) | „Loyalty“ in `marketing.ts` |
| Passenger share | `passengerShare` | Anteil an den Fluggästen | `marketShare` |
| Departure share | `departureShare` | Anteil an den Abflügen | `departureMarketShare` |
| Reputation | `reputation` | Ruf der Gesellschaft, 0–100 | unverändert |

**Weitere Grundbegriffe** (gelten für alle Abschnitte):

| Begriff | Code-Name | Bedeutung |
|---|---|---|
| Gesellschaft | `airline` | Spieler oder KI. Alle rechnen mit denselben Regeln (E44). |
| Städtepaar / Markt | `market` | Zwei Flughäfen, ohne Richtung. Ein Markt-Modell je Paar (E13, R1). |
| Angebot | `offer` | Was eine Gesellschaft auf einem Paar anbietet: Sitze je Klasse, Abflüge je Woche, Preise, Satisfaction, Flugzeit. Auch Umsteige-Verbindungen sind Angebote. |
| Strecke | `route` | Ein Flugzeug fliegt ein Paar hin und zurück. Mehrere Strecken einer Gesellschaft auf einem Paar bilden ein Angebot (R1). |
| Abflug | `departure` | Ein Flug, der an einem Flughafen startet. Abflüge werden je Richtung gezählt. |
| Grundpreis | `baseFare` | Preis je Klasse aus Entfernung und Flugzeit, × Kostenindex (E7). |
| Marktpreis | `marketFare` | Bezugspreis des Markts, an dem jedes Angebot gemessen wird (E13); Herleitung in Abschnitt 4. |
| Fehlender Preis | – | = Marktpreis, an einer Stelle (R8). |
| Drehkreuz | `hub` | Flughafen mit Verwaltungsstufe einer Gesellschaft. |
| Rang | `rank` | Stufe der Gesellschaft; Regeln in Abschnitt 6. |
| Startwerte | `START_*` | Ruf, Kasse je Startkapital-Stufe, Startflotte als Konstanten (E11). |

### 1.6 Slot

**Slot** (Code-Name: `slot`)
- Bedeutung: Das Recht, an einem Flughafen **einmal je Woche abzufliegen** (E50).
- Einheit und Bereich: Stück, ganze Zahl, je Gesellschaft und Flughafen.
- Formel: Belegte Slots an Flughafen X = Summe der Abflüge je Woche aller Strecken der Gesellschaft,
  die in X starten. Hin- und Rückflug einer Strecke belegen je einen Slot an ihrem Abflughafen.
  Ankünfte brauchen keinen Slot.
- Hängt ab von: Flugplan (Abflüge je Woche).
- Wirkt auf: ob eine Strecke angelegt oder erweitert werden darf; Slot-Unterhalt (Abschnitt 5).
- Konstanten: Grenze je Flughafen im Modell (E50); Slot-Arten und Preise in Abschnitt 5.
- Regeln (Tests):
  - Belegte Slots ≤ gekaufte Slots, für Spieler und KI.
  - Eine Strecke mit 7 Umläufen je Woche belegt 7 Slots an jedem ihrer zwei Flughäfen.
  - Die Summe der Slots aller Gesellschaften an einem Flughafen überschreitet seine Grenze nicht.
- Anzeige: Planer und Flughafen-Ansicht lesen „belegt / gekauft / Grenze“ aus dem Modell (R2).

### 1.7 Rundung (R4)

- **Intern ungerundet.** Das Modell rechnet mit Gleitkommazahlen. Kein `Math.round`, `floor` oder `ceil`
  in Zwischenschritten. Ausnahmen nur für Stück-Größen aus 1.2 (Sitze, Flugzeuge, Abflüge, Slots) und
  für `yearOf`.
- **Einmal kappen.** Jede Skala aus 1.4 wird an genau einer Stelle auf ihren Bereich begrenzt: am Ende
  der Funktion, die sie festlegt. Leser kappen nicht noch einmal.
- **Geld ungerundet.** Auch die Kasse wird ungerundet gebucht.
- **Runden nur in der Anzeige**, über die Format-Funktionen (`src/lib/format.ts`):
  Geld auf ganze $ (bzw. k / M), Punkte-Skalen auf ganze Punkte, Anteile auf ganze %.
  Summen in Tabellen werden aus ungerundeten Werten gebildet; eine Abweichung von 1 zur Summe der
  gerundeten Zeilen ist erlaubt.
- Regeln (Tests):
  - Kleine Änderungen wirken: +0,3 Punkte in einem Teil der Satisfaction ändern das Ergebnis (heute
    oft 0, 1.1 W6).
  - Keine Modell-Funktion gibt für eine Skala einen Wert außerhalb ihres Bereichs zurück.

### 1.8 Schwierigkeit (E4)

**Schwierigkeit** (Code-Name: `difficulty`, Werte `Easy` · `Normal` · `Hard`)
- Bedeutung: Wie leicht der **Spieler** Fluggäste gewinnt.
- Formel: ein Faktor `difficultyFactor`: Normal = 1; Easy > 1; Hard < 1. Startwerte Easy 1,1 und
  Hard 0,9; endgültige Werte aus dem Balance-Skript (3.9).
- Wirkt auf: **nur die Anziehung der Spieler-Angebote** im gemeinsamen Markt (E53), an genau einer Stelle
  (Abschnitt 3), wie ein fester Zu- oder Abschlag. Die Marktgröße und die Rechnung der KI bleiben ohne
  Schwierigkeit. Ohne Rivalen wirkt der Faktor etwas schwächer als sein Wert (Wettbewerb nur gegen
  „Nicht fliegen“); die Stärke wird im Balance-Skript (3.9) eingestellt.
- Wirkt nicht auf: Preise, Marktpreis, Treibstoff, Kosten, Satisfaction, Ruf, Rang; nie auf die KI.
- Regeln (Tests):
  - Auf Normal ändert die Schwierigkeit keine Zahl im Modell.
  - KI-Ergebnisse auf einem Paar ohne Spieler sind auf Easy, Normal und Hard gleich.
  - Ein Wechsel der Schwierigkeit ändert keine Kosten und keinen Preis.

**KI-Stärke** (Code-Name: `rivalStrength`, Werte `Easy` · `Normal` · `Hard`; Oberfläche wie heute)
- Bedeutung: Wie geschickt die KI handelt. Getrennte Einstellung beim Spielstart (wie heute).
- Wirkt nur auf das **Verhalten** der KI: Startkasse, Startflotte, Suchbreite, Schätzfehler, Kaufneigung
  (heute: `bestand/6-konkurrenz.md`, Größen „Startkasse“ bis „Schätzfehler“). Werte in Abschnitt 7.
- Wirkt nie auf die Wirtschaft der KI (Nachfrage, Preise, Kosten, Treibstoff), E4, E44.

## 2. Zufriedenheit

Dieser Abschnitt legt fest, wie zufrieden die Fluggäste einer Klasse auf einer Strecke sind und wohin
diese Zufriedenheit wirkt. Grundlage: E9, E10, E14–E19, E33, E39, E44, R2–R5, R14, R16;
Bestand: `bestand/1-zufriedenheit.md` (W1–W15). Alle heutigen Fundstellen ohne Pfad liegen in
`src/lib/financeUtils.ts`.

### 2.0 Überblick

Je Klasse wird verglichen: **was geboten wird** gegen **was die Klasse bei dieser Flugzeit erwartet**.
100 heißt „genau wie erwartet“.

```
Type appeal ─┐
Interior score ─┼─► Cabin rating ──► Kabinen-Teil ─┐
Cabin condition ┘                                   │
Service points (Essen, Extras, Bordservice) ─► Service-Teil ─┤
Lounge, Stellplätze, Schalter-Art, Schalter-Last ─► Boden-Teil ─┼─► Satisfaction je Klasse (0 … 160)
Personalmoral ─► Personal-Teil ─┤
Forschung ─► Forschungs-Teil ─┘

Satisfaction je Klasse ─► Offer satisfaction ─► satisfactionFactor ─► Anziehung (Abschnitt 3)
Satisfaction je Klasse + Fluggäste ─► Route satisfaction (Anzeige)
                                   ─► Airline satisfaction ─► Ruf-Ziel (Abschnitt 6)
```

**Wirkungswege (W8, E13, E39).** Satisfaction wirkt genau auf zwei Wegen:
1. **Anziehung des Angebots** im Markt, über `satisfactionFactor` (2.10), einmal. Kein eigener
   „fairer Preis“ und keine zweite Qualitäts-Anziehung mehr.
2. **Ruf**, langsam, über `airlineSatisfaction` (2.9) im Ruf-Ziel (Abschnitt 6).

Satisfaction wirkt nicht auf: Marktgröße, Preise, Kosten, Rang direkt.

**Was entfällt** (gegenüber heute):
- Ausfall-Abzug −50 bei gestrichenen Flügen (`:1312`): gestrichene Flüge wirken nur auf den Ruf (E33).
- Schalter-Abzug für fehlende Schalter −15 (`:536`): ein Schalter ist Pflicht (E18, siehe 2.6.3).
- Selbstbedienungs-Abzug −1 (`:575-577`, R16).
- SAT-Faktor-Zweig über 200 (`:748-750`, R16) und die Qualitäts-Anziehung `(SAT/100)^0,8` (`:1122-1137`):
  beides ersetzt `satisfactionFactor`.
- Forschung über die Typ-Beliebtheit (`src/lib/research.ts:248`): wirkt direkt als Punkte (E19).

### 2.1 Flugzeit-Index (Code-Name: `flightTimeIndex`)
- Bedeutung: Wie lang ein Flug für die Erwartungen der Fluggäste zählt, als stufenloser Wert.
- Einheit und Bereich: Zahl 1 … 8, ohne Einheit.
- Formel: gerade Linie zwischen den Stützpunkten (Minuten → Index)
  30 → 1, 90 → 2, 150 → 3, 210 → 4, 300 → 5, 450 → 6, 630 → 7, 810 → 8;
  darunter 1, darüber 8 (wie heute, `:246-262`).
- Hängt ab von: `blockMinutes` der Strecke (eine Richtung).
- Wirkt auf: Kabinen-Gewicht, Service-Erwartung, Service-Höchstabzug, Mahlzeiten-Zahl, Boden-Gewicht
  (alle in diesem Abschnitt). Andere Abschnitte dürfen ihn lesen, rechnen ihn aber nicht nach.
- Konstanten: `FLIGHT_TIME_INDEX_ANCHORS` (Liste oben).
- Ersetzt: die Flugzeitklasse 1–8 in Stufen (`:222`) für alle Zwecke dieses Abschnitts (R5, W2).
- Regeln (Tests):
  - Steigt nie mit kürzerer Flugzeit; 1 Minute mehr ändert ihn um höchstens 1/60.
  - An den Stützpunkten genau die Werte der Liste.
- Anzeige: keine eigene; erklärt im Glossar (4.1).

### 2.2 Type appeal (Code-Name: `typeAppeal`)
- Bedeutung: Wie gern Fluggäste mit diesem Flugzeugtyp fliegen, abhängig vom Alter des einzelnen Flugzeugs.
- Einheit und Bereich: Punkte 0 … 100.
- Formel:
  `typeAppeal = kappen(catalogAppeal − ageDecay + launchBonus, 0, 100)`
  - `catalogAppeal`: Wert `popularity` des Typs in `src/data/aircraft.ts` (Daten, unverändert).
  - `ageDecay = kappen(age − TYPE_APPEAL_DECAY_FROM, 0, TYPE_APPEAL_DECAY_MAX)`, `age` = Alter in
    Jahren **mit Bruchteil** (Monate seit Bau / 12), keine Sprünge am Jahrestag (R5).
  - `launchBonus = LAUNCH_BONUS`, solange der Erstkunden-Zeitraum läuft (Vorbestellung, Abschnitt 8), sonst 0.
- Hängt ab von: Flugzeugtyp, Baumonat, Erstkunden-Zeitraum, `month`.
- Wirkt auf: `cabinRating` (2.4), nur dort.
- Konstanten: `TYPE_APPEAL_DECAY_FROM = 8` Jahre, `TYPE_APPEAL_DECAY_MAX = 15` Punkte
  (heute `src/lib/fleetCosts.ts:27-28`); `LAUNCH_BONUS = 5` Punkte, `LAUNCH_BONUS_MONTHS = 24`
  (heute `src/lib/preorders.ts:31-32`).
- Nicht mehr enthalten: Forschung (E19, siehe 2.6.5).
- Berechnet, nicht gespeichert: Der Wert wird bei Bedarf aus Typ, Baumonat und Monat berechnet.
  Das heutige Feld `popularity` am einzelnen Flugzeug (`src/lib/monthClose.ts:1528-1539`) entfällt (5.1).
- Regeln (Tests):
  - Ein älteres Flugzeug desselben Typs hat nie mehr Type appeal (ohne Erstkunden-Bonus).
  - Bis 8 Jahre kein Verlust; ab 23 Jahren genau −15.
  - Gleicher Typ, gleiches Alter: gleicher Wert für Spieler und KI.
- Anzeige: Flottenansicht und Kaufdialog als „Type appeal“ (Punkte von 100).

### 2.3 Interior score (Code-Name: `interiorScore`)
- Bedeutung: Wert der eingebauten Sitze und Ausstattung einer Klasse, wie im Kauf- oder Umbau-Dialog gewählt.
- Einheit und Bereich: Punkte ≥ 0, ohne Obergrenze (Zwischenwert; gekappt wird erst in `cabinRating`).
- Formel je Klasse `c` (heute nur in der Oberfläche, `src/components/ConfigurePurchaseView.tsx:402-484`;
  neu im Modell, `src/model/kabine.ts`, R3):
  ```
  interiorScore(c) = max(0,
      INTERIOR_BASE[c]
    + SEAT_TYPE_FACTOR × Sitztyp-Punkte (c)
    + (Sitzabstand(c) − PITCH_NORM[c]) × PITCH_FACTOR[c]
    + Summe der Punkte der eingebauten Ausstattung der Klasse (FEATURE_POINTS[c])
    + Summe der Punkte der kabinenweiten Extras (CABIN_EXTRA_POINTS))
  ```
  Ungerundet (R4). Ausstattung zählt nur, wenn sie im Einbaumonat lieferbar war (Lieferbarkeit = Daten,
  wie heute).
- Hängt ab von: Kabinen-Ausstattung des Flugzeugs (gespeichert beim Kauf oder Umbau).
- Wirkt auf: `cabinRating` (2.4), nur dort.
- Konstanten (Startwerte = heute):
  - `INTERIOR_BASE` Economy 50, Premium 55, Business 60, First 70.
  - `SEAT_TYPE_FACTOR = 2`.
  - `PITCH_NORM` 74 / 85 / 100 / 150, `PITCH_FACTOR` 4 / 3 / 2,4 / 1,6 (Economy / Premium / Business / First).
  - `FEATURE_POINTS` und `CABIN_EXTRA_POINTS` wie heute `FEATURE_POP`, `CABIN_EXTRA_POP`
    (`src/components/ConfigurePurchaseView.tsx:98-106`), z. B. WLAN +5, Dusche +10, „Minimal services“ −7,5.
- Gespeichert wird die **Ausstattung**, nicht die Punktzahl. Alte Flugzeuge mit nur einem Durchschnittswert
  (`baseInteriorPop`) bekommen in 5.1 diesen Wert als Punktzahl jeder Klasse.
- KI: Ausstattung je Klasse aus ihrer Strategie (Abschnitt 7), dieselbe Funktion. Bis dahin Startwert je
  Strategie wie heute 42 … 78 für jede Klasse (`src/lib/aiSimulation.ts:160-166`).
- Regeln (Tests):
  - Mehr Ausstattung oder mehr Sitzabstand senkt den Interior score nie.
  - Eine kabinenweite Extra-Ausstattung wirkt in jeder Klasse gleich stark.
  - Kaufdialog-Anzeige = Modellwert (keine zweite Formel in der Ansicht, R2).
- Anzeige: Kauf- und Umbau-Dialog, je Klasse, mit Aufschlüsselung.

### 2.4 Cabin rating (Code-Name: `cabinRating`)
- Bedeutung: Wie gut die Kabine einer Klasse eines bestimmten Flugzeugs heute ist (Typ, Ausstattung, Abnutzung).
- Einheit und Bereich: Punkte 0 … 100.
- Formel je Klasse `c`:
  `cabinRating(c) = kappen(TYPE_APPEAL_SHARE × typeAppeal + INTERIOR_SHARE × interiorScore(c) × wearFactor, 0, 100)`
  mit `wearFactor = WEAR_FLOOR + (1 − WEAR_FLOOR) × cabinCondition / 100`.
- Hängt ab von: `typeAppeal`, `interiorScore(c)`, `cabinCondition`.
- Wirkt auf: Kabinen-Teil (2.6.1), nur dort.
- Konstanten: `TYPE_APPEAL_SHARE = 0,33`, `INTERIOR_SHARE = 0,67` (heute `:523`);
  `WEAR_FLOOR = 0,4` (abgenutzte Kabine behält 40 %, heute `:499`).
- Neu: einmal gekappt, ungerundet (heute gerundet und nicht gekappt, W6); immer je Klasse.
- Regeln (Tests):
  - Besserer Kabinenzustand, höherer Type appeal oder höherer Interior score senken den Wert nie.
  - Wert liegt immer in 0 … 100.
- Anzeige: Flottenansicht, Flugzeug-Details, Planer: **je Klasse** als „Cabin rating“. Wo eine Zahl je
  Flugzeug nötig ist (Listen), das sitzgewichtete Mittel der Klassen, beschriftet „Cabin rating (avg.)“.
  Heute zwei Zahlen für dasselbe Flugzeug (Durchschnitt und je Klasse, `src/components/MyFleetView.tsx:127`).

### 2.5 Service points (Code-Name: `servicePoints`)
- Bedeutung: Was eine Klasse an Bord an Essen, Getränken und Extras bekommt, als Punkte.
- Einheit und Bereich: Punkte ≥ 0.
- Formel je Klasse:
  ```
  servicePoints = Σ_k mealWeight(k) × menuPoints(Menü k)  +  extrasPoints  +  onboardServicePoints
  ```
  - **Menü-Wert** `menuPoints` (E16, W1): Die gewählten Gerichte einer Mahlzeit nach Punkten absteigend
    sortiert, p1 ≥ p2 ≥ …:
    `menuPoints = p1 + MENU_COURSE_SHARE × p2 + MENU_COURSE_SHARE² × p3 + …`
    Das beste Gericht zählt voll, jedes weitere weniger, aber immer etwas.
  - **Mahlzeiten-Zahl** `mealCount` (R5, W2), stufenlos:
    `mealCount = 1 + (MEALS_MAX − 1) × kappen((flightTimeIndex − MEAL_RAMP_FROM) / (MEAL_RAMP_TO − MEAL_RAMP_FROM), 0, 1)`.
  - **Gewicht der Mahlzeit k** (k = 1, 2, 3): `mealWeight(k) = kappen(mealCount − (k − 1), 0, 1)`.
    Mahlzeit 1 zählt immer voll; Mahlzeit 2 und 3 wachsen mit der Flugzeit stufenlos hinein.
    Eine Mahlzeit ohne gewähltes Menü zählt 0 (keine Kopie von Mahlzeit 1, W15 löst 5.1).
  - **Extras und Bordservice:** Summe der Punkte; je Gruppe (WLAN, Kits, Alkohol …) zählt nur die beste
    gewählte Stufe (wie heute, `:432-469`). Was das Flugzeug oder der Flughafen nicht liefern kann, zählt
    nicht (heutige Prüfung `validateClassConfigs`, ins Modell).
- Hängt ab von: Auswahl je Klasse und Strecke, `flightTimeIndex`, Ausstattung von Flugzeug und Flughäfen.
- Wirkt auf: Service-Teil (2.6.2). Dieselben `mealWeight(k)` bestimmen die Catering-Kosten (Abschnitt 5);
  die Formel steht nur hier.
- Konstanten: `MENU_COURSE_SHARE = 0,5`; `MEALS_MAX = 3`; `MEAL_RAMP_FROM = 5` (300 min),
  `MEAL_RAMP_TO = 7,5` (720 min). Punkte und Kosten der Gerichte und Extras: `src/data/catering.ts`
  (Feld `sat` heißt dort künftig `points`).
- Beispiel: Wagyu (60) allein = 60; Wagyu + Butterkeks (5) = 62,5 (heute 34,9). 2 Schinkenbrote als
  Mahlzeit 1 und 2 bei 359 und 360 min: 8 × 1 + 8 × 0,31 ≈ 10,5 Punkte bei beiden (heute Sprung von 8 auf 16).
- Regeln (Tests):
  - Ein weiteres Gericht, Extra oder Bordservice senkt `servicePoints` nie.
  - Wagyu + Butterkeks > Wagyu allein.
  - 1 Minute mehr Flugzeit ändert `servicePoints` um weniger als 1 % (kein Sprung bei 360 oder 720 min).
  - Mahlzeiten-Gewichte für Satisfaction und Catering-Kosten sind dieselben Zahlen.
- Anzeige: Planer (Kabinen-Overlay) je Klasse „Service points: geliefert / erwartet“, mit Gewicht je Mahlzeit.

### 2.6 Teile der Satisfaction

Jeder Teil ist eine Zahl in Satisfaction-Punkten (positiv = besser als erwartet). Teile werden nicht
einzeln gerundet oder gekappt, außer wo eine Grenze ausdrücklich zur Form gehört (Kabine, Service-Gewinn).

#### 2.6.1 Kabinen-Teil (Code-Name: `cabinPart`)
- Formel: `cabinPart = CABIN_LIMIT × tanh((cabinRating(c) − CABIN_EXPECTATION[c]) × cabinWeight / CABIN_LIMIT)`,
  `cabinWeight = CABIN_WEIGHT_BASE + CABIN_WEIGHT_PER_INDEX × (flightTimeIndex − 1)`.
- Konstanten (heute `:779-783`): `CABIN_EXPECTATION` Economy 55, Premium 60, Business 68, First 80;
  `CABIN_WEIGHT_BASE = 0,5`, `CABIN_WEIGHT_PER_INDEX = 0,1` (0,5 bei 30 min, 1,2 ab 810 min);
  `CABIN_LIMIT = 30` (mehr als ±30 bewirkt die Kabine nie).
- Regeln: steigt mit `cabinRating`; 0 bei Erwartung; auf Langstrecke stärker als auf Kurzstrecke.

#### 2.6.2 Service-Teil (Code-Name: `servicePart`)
- Formel: `expected = SERVICE_EXPECTATION[c].base + SERVICE_EXPECTATION[c].perIndex × (flightTimeIndex − 1)`,
  `ratio = servicePoints / expected`.
  - unter Erwartung (`ratio < 1`): `servicePart = −maxShortfall × (1 − ratio)` mit
    `maxShortfall = (SHORTFALL_BASE + SHORTFALL_PER_INDEX × (flightTimeIndex − 1)) × SHORTFALL_CLASS[c]`;
  - ab Erwartung: `servicePart = SERVICE_DELIGHT × (1 − e^−(ratio − 1))`.
- Konstanten (heute `:788-799`): `SERVICE_EXPECTATION` (Grund / je Index) Economy 5 / 10, Premium 12 / 14,
  Business 25 / 21, First 40 / 33; `SHORTFALL_BASE = 6`, `SHORTFALL_PER_INDEX = 9`;
  `SHORTFALL_CLASS` 1 / 1,1 / 1,25 / 1,4; `SERVICE_DELIGHT = 25`.
- Stärke der Abzüge im Balance-Skript (3.9) prüfen, zusammen mit `satisfactionFactor` (E15, W9).
- Regeln: steigt mit `servicePoints`; 0 genau bei Erwartung; nie unter `−maxShortfall`, nie über 25.

#### 2.6.3 Boden-Teil (Code-Name: `groundPart`)
- Bedeutung: Erlebnis am Boden an beiden Enden der Strecke (beide sind Abflughäfen: Hin- und Rückflug).
- Formel (E17, W3): Jeder Bodenteil wird je Flughafen bestimmt, dann **Mittelwert beider Enden**, dann
  für alle Teile dasselbe Bodengewicht:
  ```
  groundPart = groundWeight × Σ_Teil (Teil(Start) + Teil(Ziel)) / 2
  groundWeight = GROUND_WEIGHT_BASE − GROUND_WEIGHT_PER_INDEX × (flightTimeIndex − 1)
  ```
  Teile je Flughafen (immer die eigenen Einrichtungen der Gesellschaft dort):
  - **Lounge** `loungePoints`: VIP-Lounge vorhanden → `LOUNGE_POINTS[c]`, sonst 0.
  - **Stellplätze** `standPoints`: `STAND_POINTS × min(1, Stellplätze / belegte Slots)` der Größenklasse
    des Flugzeugs; ohne belegte Slots 0.
  - **Schalter-Art** `deskTypePoints`: Premium, Business und First an einem Flughafen ohne **bedienten**
    Schalter (nur Selbstbedienung) → `DESK_TYPE_PENALTY`; Economy immer 0. *(vorläufig, O52)*
  - **Schalter-Last** `deskOverloadPoints`: aus der Auslastung der eigenen Schalter (unten), 0 … −20.
- **Schalter-Pflicht (E18):** Jede Strecke braucht an beiden Enden mindestens einen Schalter der
  Gesellschaft; der Planer legt sie sonst nicht an. Ein Abzug für „kein Schalter“ existiert nicht.
  *(Lesart „beide Enden“: O52.)*
- **Schalter-Auslastung** (Code-Name: `deskLoad`) je Gesellschaft und Flughafen:
  `deskLoad = Σ (Sitze × Abflüge je Woche) aller eigenen Strecken, die dort abfliegen / Kapazität`,
  `Kapazität = DESK_CAPACITY.normal × bediente Schalter + DESK_CAPACITY.self × Selbstbedienungs-Schalter`.
  Gezählt werden **Sitze**, nicht Fluggäste: so hängt die Satisfaction nicht von der Nachfrage ab, die
  sie selbst beeinflusst (kein Kreis). Die geplante Strecke zählt im Planer mit.
- **Überlast-Kurve** `deskOverloadPoints(deskLoad)` (heute `getDeskOverloadSat`, `:547-551`):
  bis 80 % → 0; 80 … 100 % → −0,2 je Prozentpunkt (−4 bei 100 %); darüber −4 − 1,6 je Prozentpunkt,
  höchstens −20.
- Konstanten: `GROUND_WEIGHT_BASE = 1,2`, `GROUND_WEIGHT_PER_INDEX = 0,1` (1,2 bei 30 min, 0,5 ab 810 min);
  `LOUNGE_POINTS` Economy 0, Premium 2, Business 8, First 8 (Mittel beider Enden: eine Lounge an einem
  Ende = 4 wie heute, an beiden Enden = 8 wie heute); `STAND_POINTS = 2`; `DESK_TYPE_PENALTY = −10`;
  `DESK_CAPACITY` 5 000 / 10 000 Sitze je Woche (heute `:141`); Überlast-Kurve wie oben.
- Neu gegenüber heute: Überlast als Mittel beider Enden und mit Bodengewicht (heute Summe ohne Gewicht,
  bis −40 auch auf 13-h-Flügen, W3).
- Regeln (Tests):
  - Lounge oder Stellplatz hinzufügen senkt `groundPart` nie; ein weiterer Schalter senkt ihn nie.
  - Gleiche Ausstattung an beiden Enden: Teil = Teil eines Endes × `groundWeight`.
  - `deskOverloadPoints` liegt in −20 … 0; `groundPart` aus Überlast ≥ −20 × `groundWeight`.
  - Economy hängt nicht von der Schalter-Art ab.

#### 2.6.4 Personal-Teil (Code-Name: `staffPart`)
- Formel: `staffPart = (morale − 50) × SAT_PER_MORALE_POINT`, gleich für alle Klassen.
- Konstanten: `SAT_PER_MORALE_POINT = 0,1` (−5 … +5; heute `src/lib/staff.ts:88`).
- KI: hat kein Personal-Modell (E44, Liste in Abschnitt 7), `staffPart = 0`.

#### 2.6.5 Forschungs-Teil (Code-Name: `researchPart`)
- Formel: Summe der Satisfaction-Punkte aller fertigen Forschungen, gleich für alle Klassen.
- Konstanten (E19): „Cabin design studio“ +2 (heute `src/lib/research.ts:142`); die sechs Stufen
  „Plane type satisfaction“ (`sat-1` … `sat-6`, `src/lib/research.ts:100-164`) je **+1 Punkt**
  (heute +1 Type appeal ≈ +0,2 … +0,4 Satisfaction, W12). Höchstens +8. Neue Texte aus den Konstanten
  (4.1), z. B. „Satisfaction +1 in every cabin class“.
- KI: forscht nicht (Abschnitt 7), `researchPart = 0`.

### 2.7 Satisfaction je Klasse (Code-Name: `satisfaction`)
- Bedeutung: Wie gut eine Klasse einer Strecke die Erwartung ihrer Fluggäste erfüllt.
- Einheit und Bereich: Punkte 0 … 160; 100 = wie erwartet, 160 = Spitze (E14).
- Formel:
  `satisfaction(c) = kappen(100 + cabinPart + servicePart + groundPart + staffPart + researchPart, 0, 160)`
  — **einmal gekappt, ungerundet** (R4, W6). Gilt nur für Klassen mit Sitzen.
- Hängt ab von: 2.1–2.6.
- Wirkt auf: `offerSatisfaction` (2.8), `routeSatisfaction`, `airlineSatisfaction` (2.9).
- Nicht enthalten (E33, E4): gestrichene Flüge, Schwierigkeit, Ereignisse.
- Eine Funktion für alle (R2, E44): `satisfactionBreakdown(route, airline, month)` liefert je Klasse alle
  Teile (`cabinPart`, `servicePart`, `groundPart` mit seinen vier Teilen, `staffPart`, `researchPart`),
  die Summe vor dem Kappen und `satisfaction`. Planer, Kabinen-Overlay, Streckenansicht, Bericht und
  Wirtschaft lesen nur diese Funktion (heute zwei Quellen, W5).
- Neutralpunkt (Test): Kabine genau auf Erwartung, Service genau auf Erwartung, keine Lounge, keine
  Stellplätze, Schalter ohne Überlast, Moral 50, keine Forschung → genau 100.
- Regeln (Tests):
  - Wert immer in 0 … 160.
  - Mehr bieten (Kabine, Service, Lounge, Stellplatz, Schalter, Moral, Forschung) senkt sie nie.
  - +0,3 Punkte in einem Teil ändern das Ergebnis (unterhalb der Kappe).
  - Gleiche Eingaben → gleiche Satisfaction für Spieler und KI.
  - Planer-Wert = Wert im Monatsabschluss bei gleichem Stand (W5).
  - Schwierigkeit und gestrichene Flüge ändern sie nicht.
  - Kein Sprung in der Flugzeit: 1 Minute mehr ändert sie um weniger als 0,5 Punkte.
- Anzeige: „Satisfaction“ je Klasse in %, z. B. „112%“ (Punkte = Prozent der Erwartung), mit
  Aufschlüsselung aus dem Modell.

### 2.8 Offer satisfaction (Code-Name: `offerSatisfaction`)
- Bedeutung: Satisfaction einer Klasse im **Angebot** einer Gesellschaft auf einem Städtepaar (R1).
- Formel:
  - Direktangebot: Mittel der `satisfaction(c)` aller Strecken der Gesellschaft auf dem Paar mit Sitzen
    in Klasse `c`, gewichtet nach Sitzen je Woche dieser Klasse. Da sich die Fluggäste eines Angebots
    nach Sitzen auf seine Strecken verteilen (Abschnitt 3 muss das so festlegen), ist das zugleich die
    Gewichtung nach Fluggästen (E10).
  - Umsteige-Verbindung: Mittel der `offerSatisfaction(c)` der Teilstrecken, gewichtet nach `blockMinutes`.
    Welche Klassen eine Verbindung anbietet, regelt Abschnitt 3.
- Wirkt auf: `satisfactionFactor` des Angebots (2.10).
- KI-Angebote haben ihre eigene `offerSatisfaction` (heute immer 100, W10, E44).
- Regeln (Tests): liegt zwischen kleinster und größter Satisfaction der beteiligten Strecken; eine Strecke
  allein → ihre Satisfaction.

### 2.9 Route satisfaction und Airline satisfaction
**Route satisfaction** (Code-Name: `routeSatisfaction`)
- Bedeutung: Eine Zahl für die Zufriedenheit einer Strecke.
- Einheit und Bereich: Punkte 0 … 160.
- Formel: Mittel der `satisfaction(c)` der Klassen, **gewichtet nach Fluggästen je Woche** der Klasse auf
  dieser Strecke (E10). Hat die Strecke (noch) keine Fluggäste, nach Sitzen gewichtet.
- Wirkt auf: nichts im Modell (nur Anzeige). Der Markt nutzt je Klasse `offerSatisfaction`.
- Kein Kreis: Fluggäste hängen von der Satisfaction je Klasse ab, nicht von `routeSatisfaction`.
- Anzeige: Planer, Streckenliste, Streckendetails, Live-Karte; heute sitzgewichtet (`:965-975`).

**Airline satisfaction** (Code-Name: `airlineSatisfaction`)
- Bedeutung: Wie zufrieden die Fluggäste einer Gesellschaft im Monat insgesamt waren.
- Einheit und Bereich: Punkte 0 … 160.
- Formel: Mittel der `satisfaction(c)` über alle Strecken und Klassen, gewichtet nach den **beförderten
  Fluggästen des Monats** (E10, E39). Ohne Fluggäste: 100.
- Wirkt auf: Ruf-Ziel (Abschnitt 6), über die ganze Skala 0 … 160 (E14; heute nur bis 130,
  `src/lib/monthClose.ts:153`). Gestrichene Flüge senken sie nicht (sie wirken im Ruf getrennt, E33).
- Gilt für Spieler und KI (E44).
- Anzeige: Ruf-Aufschlüsselung (Abschnitt 6), Monatsbericht.

### 2.10 Satisfaction factor (Code-Name: `satisfactionFactor`)
- Bedeutung: Wie viel mehr (oder weniger) Fluggäste für ein Angebot zu zahlen bereit sind als für ein
  Angebot mit Satisfaction 100. Das ist die einzige Wirkung der Satisfaction im Markt (E13).
- Einheit und Bereich: Faktor; 1 bei Satisfaction 100, Startwerte 0,5 bei 0, 0,75 bei 50, ≈ 1,35 bei 160.
- Formel (Startwerte; endgültige Kurve aus dem Balance-Skript 3.9, E15):
  - `s ≤ 100`: `satisfactionFactor = 1 − SAT_FACTOR_LOW_SLOPE × (100 − s)` (gerade, flacher als heute s/100);
  - `s > 100`: `satisfactionFactor = 1 + SAT_FACTOR_HIGH_A × (s − 100) − SAT_FACTOR_HIGH_B × (s − 100)²`
    (wie heute, `:740-747`).
- Hängt ab von: `offerSatisfaction(c)`.
- Wirkt auf: die **Anziehung** des Angebots in Klasse `c` (Abschnitt 3), genau einmal, und zwar als
  Zahlungsbereitschaft: Ein Angebot mit Satisfaction `s` und Preis `p` ist so anziehend wie ein sonst
  gleiches Angebot mit Satisfaction 100 und Preis `p / satisfactionFactor(s)`. Abschnitt 3 baut die
  Anziehung so; Abschnitt 4 leitet daraus ab: ohne Rivalen liegt der erlösbeste Preis bei etwa
  `marketFare × satisfactionFactor` (bei 100 also beim Marktpreis, E24).
- Wirkt nicht auf: Marktgröße, Marktpreis, Kosten.
- Ersetzt: `getSatMultiplier` mit fairem Preis `satBase` (`:740-750`, `:1410-1414`) und die
  Qualitäts-Anziehung (`:1122-1137`, `:1425-1429`), die heute beide wirken (W8).
- Konstanten: `SAT_FACTOR_LOW_SLOPE = 0,005`; `SAT_FACTOR_HIGH_A = 0,008`, `SAT_FACTOR_HIGH_B = 0,000035`.
- Regeln (Tests):
  - `satisfactionFactor(100) = 1`; steigt mit `s` auf 0 … 160 (nie fallend); stetig bei 100.
  - `satisfactionFactor(50)` liegt bei 0,75 (± Balance-Spielraum, E15).
  - Ein Angebot mit höherer Satisfaction ist bei gleichem Preis nie weniger anziehend.
- Anzeige: Planer-Preisschritt erklärt „Passengers pay up to x% more/less for this satisfaction“; Wert aus
  dem Modell, Text aus den Konstanten (E52).

### 2.11 Zuordnung der Bestandsfunde

| Fund (1.1) | Lösung in diesem Abschnitt |
|---|---|
| W1 Weiteres Gericht senkt SAT | 2.5 Menü-Wert mit abnehmendem Nutzen (E16) |
| W2 Sprung bei 6 h | 2.5 stufenlose Mahlzeiten-Gewichte (R5) |
| W3 Zwei Flughäfen verschieden | 2.6.3 Mittel beider Enden, ein Bodengewicht für alle Teile (E17) |
| W4 Selbstbedienung kostet Economy | entfällt (R16); Schalter-Art nur für Premium-Klassen (2.6.3) |
| W5 Planer ≠ Wirtschaft | 2.7 eine Funktion `satisfactionBreakdown` (R2) |
| W6 Mehrfach kappen und runden | 2.4, 2.7 einmal kappen, ungerundet (R4) |
| W7 Drei Obergrenzen | 2.7 Skala 0 … 160; 2.9 Ruf über die ganze Skala; Zweig über 200 entfällt (E14, R16) |
| W8 SAT wirkt dreifach | 2.0, 2.10 zwei Wege: Anziehung (einmal) und Ruf (E13, E39) |
| W9 Harter Preis-Hebel unter 100 | 2.10 flachere Kurve, 50 → 0,75 (E15) |
| W10 Rivalen immer SAT 100 | 2.8 eigene `offerSatisfaction` je Angebot (E44, R1) |
| W11 KI-Langstrecke eine Mahlzeit | 2.5 gilt für alle; KI füllt jede Mahlzeit (R14, Abschnitt 7) |
| W12 Forschung kaum spürbar | 2.6.5 +1 Punkt je Stufe (E19) |
| W13 Fünf Dinge heißen SAT | Namen 2.2–2.9 (E9) |
| W14 Kein Schalter = harter Abzug | 2.6.3 Schalter-Pflicht, kein Abzug (E18) |
| W15 Altes Mahlzeiten-Format | 2.5 keine Kopie; Umwandlung in 5.1 (R16) |

## 3. Nachfrage und Marktanteil

Dieser Abschnitt legt fest, wie viele Menschen zwischen zwei Städten fliegen wollen und wie sie sich auf
die Angebote verteilen. Grundlage: E4, E7, E9, E13, E20–E22, E24, E25, E33, E35–E37, E44, E50, E53,
R1, R2, R4, R5, R8, R9; Bestand: `bestand/2-nachfrage.md` (W1–W14). Alle heutigen Fundstellen ohne Pfad
liegen in `src/lib/financeUtils.ts`. Alle Mengen sind **Fluggäste je Woche, beide Richtungen zusammen**,
ungerundet (R4).

### 3.0 Überblick

Zwei Schritte, streng getrennt:

1. **Marktgröße** (3.1–3.7): Wie viele Fluggäste ein Städtepaar je Woche hat, wenn **eine** Gesellschaft
   ein Bezugsangebot macht (3.9.0). Hängt nur von Städten, Entfernung, Zeit, Saison und Ereignissen ab,
   nie von einer Gesellschaft, einem Flugzeug oder der Schwierigkeit (E13, E20, E53).
2. **Aufteilung** (3.8–3.13): Alle Angebote des Paars (eigene, KI, Umsteige-Verbindungen) und „Nicht
   fliegen“ werden **einmal gemeinsam** nach ihrer Anziehung aufgeteilt (R1). Danach Sitz-Grenze,
   Überlauf und Anlauf.

```
Stadtgrößen (Geschäft, Tourismus) ─► Verflechtung ─┐
Saison ────────────────────────────► (Tourismus) ──┤
Bezugs-Flugzeit ─► Entfernungs-Faktor ─────────────┼─► Marktgröße ─► je Klasse (Klassen-Anteil)
Zeit ─► Nachfrage-Wachstum ────────────────────────┤                      │
Ereignisse ─► Ereignis-Faktor ─────────────────────┘                      ▼
                                                                Potenzial je Klasse
Angebot: Abflüge, Preis, Satisfaction, Flugzeit,                          │
Ruf, Werbung, Frequent flyer, Forschung, Schwierigkeit ─► Anziehung ─► Aufteilung (mit „Nicht fliegen“)
                                                                          │
                                       Anlauf ─► Sitz-Grenze, Überlauf ─► Fluggäste je Angebot
                                                                          │
                                                       nach Sitzen ─► Fluggäste je Strecke (2.8)
```

**Wirkungswege.**
- Der **Preis** wirkt auf die Fluggäste genau einmal: über die Anziehung (3.9.2), gemessen am Marktpreis
  (E13). Es gibt keinen zweiten Preis-Faktor auf die Fluggäste (heute `getPriceDemandMultiplier`,
  `:1010-1019`). Mit und ohne Rivalen gilt dieselbe Formel; ohne Rivalen ist „Nicht fliegen“ der einzige
  Mitbewerber (Lesart von E13 „Preis wirkt mit und ohne Rivalen gleich“: eine Stelle, ein Bezugspreis).
- Die **Satisfaction** wirkt als Zahlungsbereitschaft in der Anziehung (2.10), einmal.
- Der **Ruf** wirkt auf die Anziehung aller Angebote seiner Gesellschaft (3.9.4), für Spieler und KI.
- Die **Schwierigkeit** wirkt nur auf die Anziehung der Spieler-Angebote (E53).

**Was entfällt** (gegenüber heute):
- Jahresbremse `eraDemandFactor` (`:622-640`): ersetzt durch eine Wachstumsregel (3.3, E7).
- Schwierigkeit in der Nachfrage (`:660`) und der „Spieler-Faktor“ auf die Marktgröße
  (`src/lib/gameState.ts:510-520`): Ruf, Werbung, Forschung, Frequent flyer wirken auf die Anziehung.
- Preis-Faktor auf die Fluggäste (`:1010-1019`, `:1468-1471`) und `MAX_DEMAND_SURPLUS` (`:1040`).
- Rechnung je Strecke mit neutralen Parallelstrecken (`:1379-1385`) und getrennte KI-Rechnung
  (`src/lib/aiSimulation.ts:768-809`): eine Aufteilung je Markt (R1).
- Umsteiger-Grenze 25 %, Umweg-Faktor und Anschluss-Verhältnis (`src/lib/transferUtils.ts:403-422`):
  Umsteige-Verbindungen sind Angebote im Markt (3.13).
- Saison-Kopie in `src/App.tsx:878` (R2).

### 3.1 Bezugs-Flugzeit (Code-Name: `referenceBlockMinutes`)
- Bedeutung: Flugzeit eines Paars mit einer festen Bezugsgeschwindigkeit; Maß für die Entfernung, das
  nicht vom eingesetzten Flugzeug abhängt (E20, W1).
- Einheit und Bereich: Minuten ≥ 0, ungerundet.
- Formel: dieselbe Funktion wie `blockMinutes` einer Strecke (heute `getFlightDurationMinutes`, `:192-220`:
  Großkreis × 1,02, Beschleunigen und Bremsen), mit `REFERENCE_SPEED` statt der Reisegeschwindigkeit.
  Neu ungerundet (heute `Math.round`, `:218`).
- Wirkt auf: Entfernungs-Faktor (3.4), Klassen-Anteile (3.7), Flugzeit-Teil der Anziehung (3.9.3, als Bezug).
- Konstanten: `REFERENCE_SPEED = 800` km/h (heute für Umsteiger und Planer ohne Flugzeug,
  `src/lib/transferUtils.ts:70`).
- Regeln (Tests): gleich für alle Gesellschaften und Ansichten; ändert sich nicht mit dem Flugzeug.

### 3.2 Stadtgrößen und Verflechtung
**Stadtgröße** je Flughafen `a`: Geschäft `G(a)` und Tourismus `T(a)` aus `src/data/airports.ts:33-59`
(Daten, unverändert; nach Tabellenende fortgeschrieben wie heute).
- Neu, stetige Zeit (R5): zwischen zwei Tabellenjahren gerade Linie über `timeOf(month)` (heute Sprung am
  Jahreswechsel).
- Neu, **Weltanteil** (Code-Name: `relativeSize`): `Grel(a) = G(a) × ΣG(1960) / ΣG(jetzt)`, ebenso `Trel`,
  Summe über alle Flughäfen der Daten. Eine Stadt „wächst“ nur, wenn sie schneller wächst als die Welt.
  Das allgemeine Wachstum kommt allein aus 3.3. Im Januar 1960 gilt `Grel = G`.

**Verflechtung** (Code-Namen: `businessLinkage`, `tourismLinkage`), Formeln wie heute (`:668-675`):
- `pair(x, y) = min(x, y)^LINK_SMALL × max(x, y)^LINK_LARGE` (die kleinere Stadt zählt stärker).
- `businessLinkage = pair(Grel(A), Grel(B))`.
- `tourismLinkage = (pair(Grel(A), Trel(B)) + pair(Grel(B), Trel(A))) / 2 × seasonFactor`.
- `linkage = businessLinkage + tourismLinkage`.
- **Saison** `seasonFactor(month, south)`: Monatstabelle 0,88 … 1,15, Mittel ≈ 1; Südhalbkugel um
  6 Monate versetzt, anteilig je Ende (wie heute, `:279-302`). Sie wirkt nur hier, nur auf den Tourismus.
- **Geschäftsanteil** (Code-Name: `businessShare`): `businessLinkage / (businessLinkage + tourismLinkage
  ohne Saison)`, 0 … 1. Ohne Saison, damit die Klassen-Aufteilung nicht mit dem Monat springt.
- Konstanten: `LINK_SMALL = 1,4`, `LINK_LARGE = 0,6`.
- Regeln (Tests): `linkage` hängt nicht von der Reihenfolge A, B ab; größere Städte ergeben nie weniger.

### 3.3 Nachfrage-Wachstum (Code-Name: `demandGrowth`)
- Bedeutung: Wie viel mehr Menschen weltweit fliegen als 1960. Die **einzige** Wachstumsregel (E7, W8).
- Einheit und Bereich: Faktor, 1 im Januar 1960.
- Formel: `demandGrowth = DEMAND_GROWTH_1960_2019 ^ ((timeOf(month) − 1960) / 59)`, Zeit begrenzt auf
  1960 … 2100 (wie `costIndex`).
- Konstanten: `DEMAND_GROWTH_1960_2019 = 2,5` (E7; heute ergibt sich etwa × 2,5 aus Hochzahl und
  Jahresbremse, W8). Endgültiger Wert aus dem Balance-Skript (3.9).
- Regeln (Tests): steigt stetig; `demandGrowth` 2019 = 2,5; im Mittel aller Paare wächst die Marktgröße
  1960 → 2019 um × 2,5 (Balance-Skript; einzelne Paare mehr oder weniger, je nach Weltanteil ihrer Städte).

### 3.4 Entfernungs-Faktor (Code-Name: `distanceFactor`)
- Bedeutung: Kurze Strecken haben mehr Fluggäste je Verflechtung als lange (E22, W13).
- Einheit und Bereich: Faktor > 0; 1 bei 450 min.
- Formel: `distanceFactor = (max(referenceBlockMinutes, DISTANCE_MIN) / DISTANCE_REF) ^ (−DISTANCE_EXP)`.
  Sinkt bis zur längsten Strecke weiter, ohne Untergrenze (heute ab ≈ 758 min fest 0,4).
- Konstanten (Startwerte): `DISTANCE_REF = 450` min, `DISTANCE_MIN = 45` min, `DISTANCE_EXP = 0,5`.
  Werte: 45 min 3,16 · 90 min 2,24 · 150 min 1,73 · 300 min 1,22 · 810 min 0,75 · 1 200 min 0,61.
  Kurz : lang (45 min : 20 h) = 5,2 (heute 6,9). Endgültig aus dem Balance-Skript (3.9).
- Hängt ab von: `referenceBlockMinutes` (nie vom Flugzeug).
- Regeln (Tests): fällt streng mit der Bezugs-Flugzeit ab `DISTANCE_MIN`; 13 h und 20 h verschieden.

### 3.5 Ereignis-Faktor (Code-Name: `eventDemandFactor`)
- Bedeutung: Wie laufende Ereignisse (Krisen, Pandemie, Boom) die Reiselust auf einem Paar ändern.
- Formel: Produkt über alle laufenden Ereignisse; je Ereignis Mittel beider Enden (Ende betroffen →
  `demandMultiplier` des Ereignisses, sonst 1); weltweite Ereignisse betreffen jedes Ende
  (wie heute `src/lib/eventSystem.ts:326-351`).
- Wirkt auf: Marktgröße (3.6), also auf **alle Gesellschaften gleich** (E35; heute regionale nur für den
  Spieler). Ereignisse ändern keinen Preis und keinen Treibstoff (E8).
- Krisen-Antworten einer Gesellschaft wirken nicht hier, sondern als Faktor auf ihre Anziehung (3.9.7).
- Regeln (Tests): ohne Ereignis 1; ein Ereignis an beiden Enden wirkt voll, an einem Ende halb.

### 3.6 Marktgröße (Code-Name: `marketSize`)
- Bedeutung: Fluggäste je Woche auf einem Städtepaar, wenn **eine** Gesellschaft das Bezugsangebot (3.9.0)
  macht. Das ist die Zahl, die der Planer als „Market size“ zeigt.
- Einheit und Bereich: Fluggäste je Woche ≥ 0, ungerundet.
- Formel:
  `marketSize = DEMAND_SCALE × linkage ^ LINK_EXP × distanceFactor × demandGrowth × eventDemandFactor`.
- Hängt ab von: 3.1–3.5. **Nicht** von Flugzeug, Gesellschaft, Ruf, Preis, Satisfaction, Schwierigkeit.
- Wirkt auf: Potenzial je Klasse (3.10).
- Konstanten: `LINK_EXP = 0,448351` (heute `:683`; bestimmt nur noch den Abstand großer zu kleinen Paaren);
  `DEMAND_SCALE = 29` (heute `:683`, ohne den Normal-Abzug 0,9, E4). Endgültig aus dem Balance-Skript.
- Regeln (Tests): gleich für Spieler, KI, Planer, Umsteiger-Rechnung (W1, W9); ändert sich nicht mit der
  Schwierigkeit; größere Städte → nie kleiner; kürzere Bezugs-Flugzeit → nie kleiner.
- Anzeige: Planer Schritt 1, Flughafen- und Streckenansicht („Market size“, je Klasse aufgeschlüsselt).

### 3.7 Klassen-Anteil (Code-Name: `classShare`)
- Bedeutung: Welcher Teil der Marktgröße in Premium, Business und First reist (E21, W5).
- Einheit und Bereich: Anteil 0 … 1 je Klasse; Summe der vier = 1.
- Formel je Klasse `c` ∈ {premium, business, first}:
  ```
  classShare(c) = CLASS_BASE[c] × (1 + CLASS_BUSINESS_GAIN[c] × (businessShare − 0,5))
                                × (1 + CLASS_TIME_GAIN[c] × timeRamp)
  timeRamp      = kappen((referenceBlockMinutes − CLASS_TIME_FROM) / (CLASS_TIME_TO − CLASS_TIME_FROM), 0, 1)
  classShare(economy) = 1 − Summe der drei anderen
  ```
  Richtung (E21): mehr Geschäft → mehr Business und First; mehr Tourismus → mehr Economy; längere
  Flugzeit → mehr in allen höheren Klassen. Keine Untergrenze, kein Ableiten einer Klasse aus der anderen
  (heute Premium fast immer 9 %, W5).
- Konstanten (Startwerte; endgültig aus dem Balance-Skript 3.9):

  | Klasse | `CLASS_BASE` | `CLASS_BUSINESS_GAIN` | `CLASS_TIME_GAIN` |
  |---|---|---|---|
  | premium | 0,07 | 0,6 | 0,5 |
  | business | 0,05 | 1,6 | 0,6 |
  | first | 0,012 | 1,6 | 1,5 |

  `CLASS_TIME_FROM = 60` min, `CLASS_TIME_TO = 720` min.
  Ergebnis (Premium / Business / First / Economy): kurz, reiner Tourismus 4,9 / 1,0 / 0,2 / 93,9 %;
  kurz, gemischt (0,5) 7,0 / 5,0 / 1,2 / 86,8 %; lang, gemischt 10,5 / 8,0 / 3,0 / 78,5 %;
  lang, reines Geschäft 13,7 / 14,4 / 5,4 / 66,6 %.
- Regeln (Tests): Summe = 1; Economy ≥ 0,5 bei allen Eingaben; höherer `businessShare` senkt Economy nie
  und hebt Business und First; Premium schwankt über alle Paare spürbar (Balance-Skript: 5 %- bis
  95 %-Wert mindestens 3 Prozentpunkte auseinander).
- Kein Wechsel zwischen Klassen: Wer Business reisen will, wählt unter den Business-Angeboten oder fliegt
  nicht. Ein Angebot ohne Sitze in Klasse `c` nimmt am Markt dieser Klasse nicht teil.

### 3.8 Angebote eines Markts
Ein Markt ist ein Städtepaar mit einer Klasse. Angebote darin (R1):
- **Direktangebot** einer Gesellschaft = alle ihre Strecken auf dem Paar zusammen (1.5). Je Gesellschaft
  und Paar genau eines.
- **Umsteige-Verbindung** einer Gesellschaft über einen ihrer Drehkreuze (3.13). Je Gesellschaft und
  Umsteige-Flughafen eine.

Kennzahlen eines Angebots in Klasse `c`:

| Kennzahl | Code-Name | Festlegung |
|---|---|---|
| Sitze | `offerSeats(c)` | Summe der Sitze in `c` × Flüge je Woche aller Strecken, beide Richtungen. |
| Abflüge je Richtung | `frequency` | Abflüge je Woche auf dem Paar, beide Richtungen, geteilt durch 2. Ein Einweg-Umlauf zählt halb so viel wie Hin und Zurück (W14). Gilt für alle Klassen. |
| Preis | `offerFare(c)` | Mittel der Preise in `c` aller Strecken, nach Sitzen in `c` gewichtet. Fehlender Preis = Marktpreis (R8). Der Erlös ist damit derselbe, als zahlte jeder Gast den Preis seiner Strecke (Verteilung nach Sitzen, 3.11). |
| Satisfaction | `offerSatisfaction(c)` | aus 2.8. |
| Flugzeit | `offerBlockMinutes` | Mittel der `blockMinutes` aller Strecken, nach Sitzen gewichtet; Verbindung: 3.13. |
| Alter | `offerAgeMonths` | Monate, seit die Gesellschaft das Paar ohne Unterbrechung bedient. Wer das Paar aufgibt, beginnt beim nächsten Mal bei 0. Eine weitere Strecke auf einem bedienten Paar läuft **nicht** neu an. |

### 3.9 Anziehung (Code-Name: `offerAppeal`)
- Bedeutung: Wie stark ein Angebot Fluggäste einer Klasse anzieht, im Vergleich zu anderen Angeboten und zu
  „Nicht fliegen“.
- Einheit und Bereich: Zahl > 0 ohne Einheit; **1 = Bezugsangebot**.
- Formel je Angebot `o` und Klasse `c`, ein Produkt (jeder Faktor wirkt nur hier, R2):
  ```
  offerAppeal(o, c) = frequencyFactor × priceFactor(c) × flightTimeFactor × reputationFactor
                    × establishedRouteBonus × advertisingFactor × frequentFlyerFactor
                    × researchDemandFactor × crisisResponseFactor × difficultyFactor
                    (× connectionFactor bei Umsteige-Verbindungen, 3.13)
  ```
- Ungerundet, nicht gekappt (R4).
- Regeln (Tests): jeder Faktor = 1 im Bezugszustand; besser bieten (mehr Abflüge, niedrigerer Preis,
  höhere Satisfaction, kürzere Flugzeit, höherer Ruf) senkt die Anziehung nie; gleiche Eingaben → gleiche
  Anziehung für Spieler und KI (außer den Faktoren, die nur der Spieler hat, 3.9.4–3.9.7).

#### 3.9.0 Bezugsangebot
Ein Angebot mit 7 Abflügen je Richtung (täglich), Preis = Marktpreis, Satisfaction 100, Flugzeit =
Bezugs-Flugzeit, Ruf 50, Alter 9 … 24 Monate, ohne Werbung, Frequent flyer, Forschung, Krisen-Antwort,
auf Normal. Seine Anziehung ist 1. Allein im Markt bekommt es genau `marketSize × classShare(c)` Fluggäste
(3.10).

#### 3.9.1 Abflüge (Code-Name: `frequencyFactor`)
- Formel: `frequencyFactor = (frequency / REFERENCE_FREQUENCY) ^ FREQUENCY_EXP`.
- Konstanten: `REFERENCE_FREQUENCY = 7` je Richtung und Woche; `FREQUENCY_EXP = 0,5` (Wurzel, wie heute
  `:1134`).
- Je Gesellschaft aus der **Summe** ihrer Abflüge auf dem Paar (R1): Aufteilen derselben Flüge auf mehrere
  Strecken ändert nichts (W2).

#### 3.9.2 Preis und Satisfaction (Code-Name: `priceFactor`)
- Formel: `priceFactor(c) = (offerFare(c) / (marketFare(c) × satisfactionFactor(c))) ^ (−PRICE_SENSITIVITY[c])`.
  - `marketFare(c)`: Marktpreis des Paars (Abschnitt 4), gleich für alle Angebote.
  - `satisfactionFactor(c)`: aus `offerSatisfaction(c)` (2.10). So gilt die Vorgabe aus 2.10 wörtlich:
    Satisfaction `s` und Preis `p` ziehen so stark an wie Satisfaction 100 und Preis `p / satisfactionFactor(s)`.
- Konstanten (Startwerte): `PRICE_SENSITIVITY` Economy 2,2 · Premium 2,0 · Business 1,8 · First 1,7.
  Größer als heute (1,2 / 1,0 / 0,8 / 0,7, `:1002-1004`), weil die Zahl eine andere Bedeutung hat: Die
  Empfindlichkeit der eigenen Fluggäste ist `PRICE_SENSITIVITY × (1 − Anteil)` (Anteil an allen Reisewilligen
  einschließlich „Nicht fliegen“). Sie muss über 1 liegen, sonst brächte jeder höhere Preis mehr Erlös.
- Folge (E24): Ohne Rivalen liegt der erlösbeste Preis des Bezugsangebots genau bei
  `marketFare × satisfactionFactor` (Herleitung: Erlös steigt, solange `PRICE_SENSITIVITY × (1 − Anteil) < 1`;
  beim Bezugsangebot ist der Anteil an den Reisewilligen genau `1 − 1 / PRICE_SENSITIVITY`, 3.10).
  Ein Angebot mit mehr Anziehung aus anderen Gründen (z. B. 14 Abflüge je Richtung) hat einen etwas
  höheren erlösbesten Preis (Faktor `(übrige Anziehung)^(1 / PRICE_SENSITIVITY)`, bei 14 Abflügen
  Economy ≈ 1,17). Billiger als `marketFare × satisfactionFactor` lohnt bei voller Anziehung nur gegen
  Rivalen oder zum Füllen der Sitze (E24).
- Regeln (Tests): Bezugsangebot allein im Markt, Sitze reichen: erlösbester Preis = `marketFare × satisfactionFactor`
  (± 1 %); 10 % billiger und 10 % teurer bringen beide weniger Erlös; gegen einen gleichen Rivalen bringt
  10 % billiger mehr Erlös.

#### 3.9.3 Flugzeit (Code-Name: `flightTimeFactor`)
- Bedeutung: Kürzere Reisezeit zieht spürbar mehr an (E20). Langsame Flugzeuge verlieren Anteil, machen
  aber den Markt nicht kleiner (W1).
- Formel: `flightTimeFactor = (offerBlockMinutes / referenceBlockMinutes) ^ (−FLIGHT_TIME_EXP)`.
- Konstanten: `FLIGHT_TIME_EXP = 1,0` (Startwert; „spürbar“ nach E20, Stärke aus dem Balance-Skript 3.9).
  Beispiele: 10 % längere Flugzeit → 0,91; Turboprop auf 1 000 km (≈ 1,47-fache Zeit) → 0,68; halbe
  Flugzeit (Überschall) → 2,0.
- Regel (Test): kürzere Flugzeit senkt die Anziehung nie; halbe Flugzeit = `2 ^ FLIGHT_TIME_EXP`.

#### 3.9.4 Gesellschaft: Ruf, Forschung, Frequent flyer, Schwierigkeit
- **Ruf** `reputationFactor = 1 + REPUTATION_DEMAND_SLOPE × (reputation − 50)`; Ruf 50 = 1 (E36).
  `REPUTATION_DEMAND_SLOPE = 0,002` (0,9 bei Ruf 0, 1,1 bei Ruf 100; Spanne wie heute 0,2,
  `src/lib/gameState.ts:428`). Spieler und KI (E44). Ruf vom Monatsanfang.
- **Forschung** `researchDemandFactor`: Produkt der fertigen Nachfrage-Forschungen 1,015 × 1,025 × 1,01
  (heute `src/lib/research.ts:114`, `:143`, `:165`). Nur Spieler (KI forscht nicht, E44).
- **Frequent flyer** `frequentFlyerFactor = 1 + min(FF_MAX, FF_START + FF_PER_MONTH × (Laufmonate − 1))`,
  solange das Programm läuft, sonst 1. `FF_START = 0,05`, `FF_PER_MONTH = 0,01`, `FF_MAX = 0,20`
  (heute `src/lib/marketing.ts:192-194`). Gilt für alle Angebote der Gesellschaft (heute nur eigene Strecken
  und Parallelstrecken, `:1391`, `:1432`). Nur Spieler: zählt zu „Werbung“ (`marketing.ts`), die die KI
  bewusst auslässt (Lesart von E44).
- **Schwierigkeit** `difficultyFactor`: aus 1.8; nur Spieler-Angebote (E53), auch Umsteige-Verbindungen.

#### 3.9.5 Werbung (Code-Name: `advertisingFactor`)
- Formel: Mittel beider Enden des Werbe-Faktors ihrer Region; Werbe-Faktor je Region = `1 + Summe der
  laufenden Kampagnen` (lokal 0,05, national 0,10, global 0,18), höchstens `ADVERTISING_MAX = 1,25`
  (wie heute `src/lib/marketing.ts:74-84`, `:126-135`).
- Wirkt, solange die Kampagne läuft (E37), nur auf die Anziehung des Werbenden; der kleine Ruf-Beitrag
  steht in Abschnitt 6. Nur Spieler (E44).

#### 3.9.6 Established route bonus (Code-Name: `establishedRouteBonus`)
- Formel: `1 + ESTABLISHED_BONUS_MAX × kappen((offerAgeMonths − ESTABLISHED_FROM) / (ESTABLISHED_TO − ESTABLISHED_FROM), 0, 1)`.
- Konstanten: `ESTABLISHED_BONUS_MAX = 0,05`, `ESTABLISHED_FROM = 24`, `ESTABLISHED_TO = 48` Monate
  (heute `src/lib/routeMaturity.ts:20-24`). Spieler und KI (E44).

#### 3.9.7 Krisen-Antwort (Code-Name: `crisisResponseFactor`)
- Faktor > 1 auf die Angebote einer Gesellschaft in den Märkten, die ein Ereignis trifft, auf das sie mit
  einer Krisen-Antwort reagiert hat. Höhe und Kosten in Abschnitt 8 (E6, E35). Ohne Antwort 1.

### 3.10 Nicht fliegen und Potenzial
**Nicht fliegen** (Code-Name: `noFlyAppeal`)
- Bedeutung: Wer reisen könnte, aber keines der Angebote nimmt (zu teuer, zu selten, zu langsam), wählt
  „Nicht fliegen“. Ein eigener Mitbewerber mit fester Anziehung (E13).
- Formel: `noFlyAppeal(c) = 1 / (PRICE_SENSITIVITY[c] − 1)`: Economy 0,83 · Premium 1,0 · Business 1,25 ·
  First 1,43. Folgt aus 3.9.2: Nur mit diesem Wert ist das Bezugsangebot ohne Rivalen erlösbest am
  Marktpreis (E24). Keine eigene Stellschraube.

**Potenzial** (Code-Name: `classPotential`)
- Bedeutung: Alle Reisewilligen einer Klasse; die Obergrenze, wenn die Angebote unendlich anziehend wären.
- Formel: `classPotential(c) = marketSize × classShare(c) × PRICE_SENSITIVITY[c] / (PRICE_SENSITIVITY[c] − 1)`.
  So fliegen beim Bezugsangebot allein genau `marketSize × classShare(c)` (3.9.0).
- Regel (Test): Bezugsangebot allein, Sitze reichen → Fluggäste = `marketSize × classShare(c)`.

### 3.11 Aufteilung (Code-Name: `marketSplit`)
- Bedeutung: Wie viele Fluggäste je Woche jedes Angebot eines Markts bekommt. **Eine Funktion je Markt und
  Klasse für alle Angebote** (R1); Planer, Monatsabschluss, KI-Planung und Bericht nutzen sie (R2).
- Schritte:
  1. **Wahl.** Jedes Angebot `o` bekommt
     `Wunsch(o) = classPotential × offerAppeal(o) / (Σ offerAppeal aller Angebote + noFlyAppeal)`.
  2. **Anlauf.** `Wunsch(o) × rampFactor(o)` (3.12). Wer wegen des Anlaufs fehlt, fliegt nicht.
  3. **Sitz-Grenze und Überlauf.** Ist bei einem Angebot der Wunsch größer als seine Sitze, bekommt es so
     viele Fluggäste wie Sitze. Der Rest wählt neu unter den Angeboten mit freien Sitzen und „Nicht fliegen“,
     im Verhältnis ihrer Anziehung. Wiederholen, bis kein Angebot mehr überläuft (höchstens so oft, wie es
     Angebote gibt). Das Ergebnis hängt nicht von der Reihenfolge der Angebote ab.
     Umsteige-Verbindungen haben in diesem Schritt keine Sitz-Grenze; ihre Grenze kommt in 3.13.
  4. **Auf Strecken verteilen.** Die Fluggäste eines Direktangebots in `c` verteilen sich auf seine Strecken
     **nach Sitzen in `c` je Woche** (Vorgabe aus 2.8). Jede Strecke hat damit dieselbe Auslastung in `c`.
- Ungerundet (R4; heute `abrunden`, `:1469-1471`).
- Hängt ab von: `classPotential`, `offerAppeal` aller Angebote, `noFlyAppeal`, Sitze, `rampFactor`.
- Wirkt auf: Fluggäste je Strecke → Erlös (Abschnitt 4), Kosten je Fluggast (Abschnitt 5),
  `routeSatisfaction` und `airlineSatisfaction` (2.9), Passenger share (3.14).
- Regeln (Tests):
  - Summe der Fluggäste aller Angebote ≤ `classPotential`; kein Angebot über seinen Sitzen.
  - Anteile vor Anlauf und Sitz-Grenze (einschließlich „Nicht fliegen“) ergeben genau 1 (W3, W10).
  - Gleiche Abflüge auf eine oder mehrere eigene Strecken verteilt → gleiche Fluggäste (W2).
  - Ein weiteres Angebot senkt die Fluggäste der anderen nie über das hinaus, was es selbst bekommt.
  - Spieler und KI bekommen bei gleichen Eingaben gleich viele Fluggäste (auf Normal, ohne Spieler-Faktoren).
  - Ein voller Rivale gibt Gäste an Angebote mit freien Sitzen ab, nie an volle.
  - Planer-Wert = Wert im Monatsabschluss bei gleichem Stand (R2).
- Anzeige: Planer (erwartete Fluggäste je Klasse, Passenger share), Streckendetails, Bericht.

### 3.12 Anlauf (Code-Name: `rampFactor`)
- Bedeutung: Ein neues Direktangebot ist noch unbekannt und erreicht nur einen Teil seiner Gäste (R9, W11).
- Formel: `rampFactor = RAMP_START + (1 − RAMP_START) × kappen(offerAgeMonths / RAMP_MONTHS, 0, 1)`.
  Mit der Forschung „Route planning suite“: `RAMP_START + RAMP_RESEARCH_BONUS`.
- Wirkt in 3.11 Schritt 2, **nach** der Wahl, nicht auf die Anziehung. So bleibt der erlösbeste Preis
  während des Anlaufs derselbe (E24), und Rivalen gewinnen nicht automatisch dazu.
- Gilt je Angebot, nicht je Strecke (3.8): Eine weitere Strecke auf einem bedienten Paar läuft nicht an.
  Umsteige-Verbindungen haben keinen Anlauf (wie heute).
- Konstanten: `RAMP_START = 0,6`, `RAMP_MONTHS = 9`, `RAMP_RESEARCH_BONUS = 0,15` (heute
  `src/lib/routeMaturity.ts:17-24`, `src/lib/research.ts:123`). Spieler und KI (E44).
- Regeln (Tests): steigt nie mit weniger Alter; ab `RAMP_MONTHS` genau 1.
- Anzeige (R9): Planer zeigt erwartete Fluggäste im ersten Monat und bei voller Nachfrage; Streckendetails
  „Ramping up“ mit Monaten bis zur vollen Nachfrage.

### 3.13 Umsteige-Verbindungen
- Bedeutung: Eine Gesellschaft bietet zwischen O und D eine Reise mit Umstieg an ihrem Drehkreuz H an. Die
  Verbindung ist ein Angebot im Markt O–D und wird mit allen anderen aufgeteilt (R1, W9).
- Wer: alle Gesellschaften mit Drehkreuz H (E44). Keine Verbindung auf einem Paar, das die Gesellschaft
  direkt bedient (ihre Gäste nehmen den Direktflug). Keine Verbindungen über Gesellschaften hinweg.
- Bedingungen: Strecken O–H und H–D der Gesellschaft; Umweg `(Entfernung O–H + H–D) / Entfernung O–D ≤
  MAX_DETOUR`; mindestens ein machbarer Anschluss (Umstiegszeit `MIN_CONNECTION` … `MAX_CONNECTION`).
- Klassen: Klasse `c` nur, wenn beide Teilstrecken Sitze in `c` haben.
- Kennzahlen (3.8):
  - `frequency`: machbare Anschlüsse je Woche und Richtung (jeder ankommende Flug in H zählt einmal, wenn er
    einen Anschluss hat), Mittel beider Richtungen.
  - `offerFare(c) = TRANSFER_FARE_SHARE × marketFare(c)` des Paars O–D (E25); dieselbe Preisformel 3.9.2.
  - `offerSatisfaction(c)`: Mittel der Teilstrecken nach `blockMinutes` (2.8).
  - `offerBlockMinutes`: Flugzeit O–H + H–D + mittlere Umstiegszeit der machbaren Anschlüsse. Der Umweg
    kostet so über `flightTimeFactor` (heute eigener Umweg-Faktor).
- Zusätzlicher Faktor in der Anziehung:
  `connectionFactor = CONNECTION_APPEAL × hubQuality`.
  - `hubQuality = min(1, 0,4 + 0,15 × Verwaltungsstufe + 0,05 je Extra (Stufe 3, Lounge, Catering))`,
    × 1,1 mit der Forschung „Alliance“ (heute `src/lib/transferUtils.ts:156-162`, `:389`).
  - `CONNECTION_APPEAL = 0,5` (Startwert: Umsteigen ist lästig; Balance-Skript prüft, dass Umsteiger in
    Märkten mit Direktangebot typisch unter 25 % bleiben, heute feste Grenze).
- Sitze: Nach der Aufteilung aller Märkte (3.11) kommen die Umsteiger auf die **freien** Sitze derselben
  Klasse beider Teilstrecken, höchster Tarif je Sitz zuerst (wie heute, `src/lib/transferUtils.ts:438-479`).
  Wer keinen Platz findet, fliegt nicht (kein zweiter Überlauf). Direktgäste haben Vorrang.
- Erlös-Aufteilung auf die Teilstrecken: Abschnitt 4.
- Regeln (Tests): Umsteiger belegen nie mehr als die freien Sitze; Umweg über `MAX_DETOUR` → keine
  Verbindung; Umsteiger-Markt O–D hat dieselbe `marketSize` wie die Direktrechnung (W9).
- Konstanten: `MAX_DETOUR = 1,6`, `MIN_CONNECTION = 45` min, `MAX_CONNECTION = 360` min,
  `TRANSFER_FARE_SHARE = 0,9` (heute `src/lib/transferUtils.ts:37-45`).

### 3.14 Passenger share und Departure share
**Passenger share** (Code-Name: `passengerShare`)
- Formel: Fluggäste aller Angebote einer Gesellschaft auf dem Paar (alle Klassen, direkt und Umsteiger)
  / Fluggäste aller Gesellschaften auf dem Paar. „Nicht fliegen“ zählt nicht mit. Ohne Fluggäste: 0.
- Wirkt auf: nichts im Modell (Anzeige).
- Anzeige: Planer, Streckendetails, Flughafen-Ansicht.

**Departure share** (Code-Name: `departureShare`)
- Formel: Abflüge je Woche der Gesellschaft auf dem Paar / Abflüge aller Gesellschaften auf dem Paar
  (nur Direktflüge).
- Wirkt auf: nichts im Modell (Anzeige, Chronik; heute `departureMarketShare`, `src/lib/chronicle.ts:81-101`).
- Regeln (Tests): beide Anteile aller Gesellschaften eines Paars ergeben zusammen 1 (wenn jemand fliegt).

### 3.15 Beispiel
Economy, Marktgröße × Klassen-Anteil = 1 000, Marktpreis 100 $, `PRICE_SENSITIVITY` 2,2 → `noFlyAppeal` 0,83,
Potenzial 1 833. Sitze reichen, wo nicht anders genannt.

| Fall | Fluggäste Spieler | Erlös Spieler | Hinweis |
|---|---|---|---|
| Bezugsangebot allein, 100 $ | 1 000 | 100 000 $ | erlösbest (E24) |
| allein, 90 $ | 1 104 | 99 342 $ | billiger: weniger Erlös |
| allein, 110 $ | 904 | 99 454 $ | teurer: weniger Erlös |
| allein, Satisfaction 130, 100 $ | 1 183 | 118 327 $ | `satisfactionFactor` 1,21 |
| allein, Satisfaction 130, 120,85 $ | 1 000 | 120 850 $ | erlösbest bei 100 × 1,2085 |
| allein, 14 Abflüge je Richtung | 1 154 | 115 358 $ | erlösbest erst bei 117 $ |
| allein, 10 % längere Flugzeit | 957 | 95 652 $ | |
| allein, erster Monat (Anlauf 0,6) | 600 | 60 000 $ | |
| mit gleichem Rivalen, beide 100 $ | 647 (Rivale 647) | 64 706 $ | Markt wächst auf 1 294 |
| mit gleichem Rivalen, Spieler 90 $ | 747 (Rivale 593) | 67 236 $ | gegen Rivalen lohnt billiger |
| mit gleichem Rivalen, Rivale nur 500 Sitze | 727 (Rivale 500) | 72 727 $ | 80 von 147 übergelaufenen Gästen |

### 3.16 Vorgaben an andere Abschnitte
- **Abschnitt 4 (Preis):** `marketFare(c)` je Paar und Klasse, gleich für alle Angebote; er darf nicht von
  den Fluggästen aus 3.11 abhängen (sonst Kreis). Kein zweiter Preis-Faktor auf die Fluggäste. Erlös =
  Fluggäste je Strecke × Preis der Strecke; Umsteiger-Erlös auf die Teilstrecken verteilen. Planer zeigt den
  erlösbesten Preis aus diesem Modell.
- **Abschnitt 5 (Kosten):** Kosten je Fluggast aus den Fluggästen je Strecke (3.11 Schritt 4 und 3.13).
- **Abschnitt 6 (Ruf):** `reputationFactor` (3.9.4) ist die einzige Wirkung des Rufs auf die Nachfrage;
  Werbe-Beitrag zum Ruf dort.
- **Abschnitt 7 (KI):** Liste der Faktoren, die die KI nicht hat: Forschung, Werbung, Frequent flyer,
  Schwierigkeit (Personal-Teil aus 2.6.4). KI-Preise relativ zum Marktpreis (R7). KI-Planung nutzt
  `marketSplit` mit allen Angeboten.
- **Abschnitt 8 (Ereignisse):** Ereignisse wirken über `eventDemandFactor` auf die Marktgröße; Krisen-Antworten
  über `crisisResponseFactor`. Gestrichene Flüge senken die Sitze (Nachfrage höchstens auf die übrigen
  Sitze, E33), nicht die Anziehung.

### 3.17 Zuordnung der Bestandsfunde

| Fund (1.2) | Lösung in diesem Abschnitt |
|---|---|
| W1 Marktgröße hängt vom Flugzeug ab | 3.1, 3.6 Bezugs-Flugzeit; Geschwindigkeit nur in der Anziehung, 3.9.3 (E20) |
| W2 Aufteilen gewinnt Anteil | 3.8, 3.9.1 Abflüge je Gesellschaft summiert (R1) |
| W3 Parallelstrecken ≠ 100 % | 3.11 eine Aufteilung je Markt (R1) |
| W4 Preis wirkt doppelt | 3.0, 3.9.2 Preis nur in der Anziehung, ein Bezugspreis (E13) |
| W5 Premium fast immer 9 % | 3.7 neue Klassen-Anteile (E21) |
| W6 Normal nicht neutral | 3.6 ohne Schwierigkeit; 3.9.4 Faktor nur auf Spieler-Anziehung (E4, E53) |
| W7 Hard-KI schlechtere Wirtschaft | 3.9 KI ohne Schwierigkeit (E4, E44) |
| W8 Zwei Wachstumsbremsen | 3.2 Weltanteil, 3.3 eine Wachstumsregel (E7) |
| W9 Umsteiger nach anderen Regeln | 3.13 Verbindung als Angebot im selben Markt (R1, E25) |
| W10 Spieler und KI rechnen verschieden | 3.11 eine Aufteilung für alle (R1, E44) |
| W11 Planer ohne Anlauf | 3.12 Anzeige erster Monat und volle Nachfrage (R9) |
| W12 Gleiche Namen | 3.9.4 Frequent flyer, 3.9.6 Established route bonus, 3.14 Passenger / Departure share (E9) |
| W13 Langstrecken ab 12,6 h gleich | 3.4 Kurve ohne Untergrenze (E22) |
| W14 Einweg zählt wie Hin und Zurück | 3.8 Abflüge je Richtung (R1) |

## 4. Preis und Erlös

Dieser Abschnitt legt fest, was ein Ticket kostet, woran der Preis gemessen wird und wie daraus der Erlös
einer Strecke entsteht. Grundlage: E4–E7, E13, E23–E26, E32, E33, E44, E52, E54, R2, R4, R7, R8;
Vorgaben aus 3.16; Bestand: `bestand/3-preis.md` (W1–W11). Alle heutigen Fundstellen ohne Pfad liegen in
`src/lib/financeUtils.ts`; Planer = `src/components/RoutePlannerView.tsx`.

Einheiten: Preise gelten **je Fluggast und Strecke, eine Richtung**; eine Strecke hat einen Preis je Klasse,
gleich in beiden Richtungen (wie heute). Erlöse gelten **je Woche, beide Richtungen zusammen**. Alles
ungerundet (R4); ganze $ nur in der Anzeige.

### 4.0 Überblick

```
Entfernung ─────────────────────────────┐
Bezugs-Flugzeit (3.1) ─► Flugzeit-Index ┼─► Grundpreis Economy (1960) ─┐
                                        └─► Klassen-Verhältnis ────────┼─► Marktpreis je Klasse
Kostenindex (1.3) ─────────────────────────────────────────────────────┘        │
                                                                                 ▼
Eingabe: Preisniveau je Klasse ──────────────────────────────────► Preis der Strecke
                                                                                 │
                                    Anziehung (3.9.2) ◄──────────────────────────┤
                                            │                                    │
                                    Aufteilung (3.11) ─► Fluggäste je Strecke ───┴─► Erlös je Strecke
                                                                                 ▲
Marktpreis Start–Ziel × 0,9 ─► Umsteiger-Tarif ─► Umsteiger (3.13) ─► Anteil je Teilstrecke
```

**Wirkungswege.**
- Der **Marktpreis** hängt nur von Entfernung, Bezugs-Flugzeit und Kostenindex ab. Er ist für alle Angebote
  eines Paars gleich und hängt nicht von Fluggästen, Sitzen, Satisfaction, Ruf oder Schwierigkeit ab
  (3.16, E4, E13). So entsteht kein Kreis mit der Aufteilung (3.11).
- Der **eigene Preis** wirkt auf die Fluggäste genau einmal: über `priceFactor` (3.9.2). Kein zweiter
  Preis-Faktor (3.16).
- Der **Erlös** ist Fluggäste × gezahlter Preis. Nichts sonst (kein Zuschlag, keine Schwierigkeit).

**Was entfällt** (gegenüber heute):
- Schwierigkeit im Preis `difficultyFareFactor` (`:479-483`, `:1413`): E4.
- SAT-Faktor im Marktpreis `satBase` (`:1414`): Satisfaction wirkt nur als Zahlungsbereitschaft in der
  Anziehung (2.10, 3.9.2).
- Knappheits-Zuschlag `scarcityPremium` (`:1056-1063`, `:1463`): siehe 4.4.
- Preis-Faktor `getPriceDemandMultiplier` mit Obergrenze 1,5 und Zwei-Teil-Kurve (`:978-1019`): 3.9.2.
- Feste Klassen-Gewichte 1 / 1,6 / 3 / 5 (`:1518-1523`; Planer `:1039-1042`, `:3662`, `:3709`): 4.2 (E23).
- Gewinnschwellen BE75 / BE99 / BE35 mit festen Gewichten (`:1525-1527`): 4.11.
- „Volle Maschine“ (`forceFullLoad`, `:1469-1471`) als Hauptzahl des Planers: 4.12 (E26).
- Drei Ersatzpreise bei fehlendem Preis (`:1352-1357`, `:1418`; `src/lib/monthClose.ts:1452`): 4.5 (R8).
- Monat = 4 Wochen (`src/lib/monthClose.ts:473`, `:487`): 4.9 (E5).

### 4.1 Grundpreis Economy (Code-Name: `baseFareEconomy`)
- Bedeutung: Was ein Economy-Ticket auf diesem Paar „normal“ kostet, in Preisen von 1960.
- Einheit und Bereich: $ (Wert 1960) > 0, ungerundet.
- Formel:
  `baseFareEconomy = (FARE_BASE_1960 + FARE_PER_KM_1960 × Entfernung) × shortHaulFareFactor`
  mit `shortHaulFareFactor = byTimeIndex(SHORT_HAUL_FARE_FACTOR, flightTimeIndex(referenceBlockMinutes))`
  (gerade Linie zwischen den Tabellenwerten, wie heute `:721-726`).
- Neu: Der Flugzeit-Index kommt aus der **Bezugs-Flugzeit** (3.1), nicht aus der Flugzeit des eingesetzten
  Flugzeugs. Nur so ist der Marktpreis für alle Angebote eines Paars gleich (3.16). Heute hängt er am
  Flugzeug der eigenen Strecke (`:1413` über `timeClass`); KI und Umsteiger rechnen schon mit 800 km/h
  (`src/lib/transferUtils.ts:70`).
- Neu ungerundet (heute `Math.round`, `:733`).
- Hängt ab von: Entfernung (km, Großkreis), `referenceBlockMinutes`.
- Wirkt auf: `marketFare` (4.3), sonst nichts.
- Konstanten (wie heute; endgültig aus dem Balance-Skript 3.9, Ziel E7):
  `FARE_BASE_1960 = 30` $, `FARE_PER_KM_1960 = 0,05` $/km,
  `SHORT_HAUL_FARE_FACTOR` je Index 1 … 8 = 1,15 · 1,15 · 1,10 · 1,10 · 1,05 · 1 · 1 · 1.
- Regeln (Tests): längere Entfernung → nie billiger; Preis je km fällt mit der Entfernung (nie steigend);
  gleich für alle Flugzeuge und Gesellschaften; 1 Minute mehr Bezugs-Flugzeit ändert ihn stetig (kein Sprung).
- Anzeige: keine eigene; erklärt im Glossar (Paket 4.1).

### 4.2 Klassen-Verhältnis (Code-Name: `classFareRatio`)
- Bedeutung: Wie viel teurer eine Klasse als Economy auf diesem Paar ist. **Eine Funktion für alle Zwecke**
  (E23): Marktpreis, Startpreis, „Adjust All“, Gewinnschwelle, KI-Preise.
- Einheit und Bereich: Faktor ≥ 1; Economy = 1.
- Formel mit `i = flightTimeIndex(referenceBlockMinutes)` (stufenlos, 1 … 8), Werte wie heute (`:728-730`):
  ```
  classFareRatio(economy)  = 1
  classFareRatio(premium)  = 1,3 + 0,15 × (i − 1)    → 1,30 … 2,35
  classFareRatio(business) = 2,0 + 0,25 × (i − 1)    → 2,00 … 3,75
  classFareRatio(first)    = 3,0 + 0,50 × (i − 1)    → 3,00 … 6,50
  ```
- Konstanten: `CLASS_FARE_RATIO_BASE` (1 / 1,3 / 2,0 / 3,0), `CLASS_FARE_RATIO_SLOPE` (0 / 0,15 / 0,25 / 0,5).
  Endgültig aus dem Balance-Skript (3.9).
- Regeln (Tests): Economy ≤ Premium ≤ Business ≤ First bei jedem Index; steigt nie mit kürzerer Flugzeit;
  keine Stelle im Modell oder in der Oberfläche nutzt feste Klassen-Gewichte (Suche nach 1,6 / 3,0 / 5,0, W2).

### 4.3 Marktpreis (Code-Name: `marketFare`)
- Bedeutung: Der Bezugspreis einer Klasse auf einem Paar. An ihm wird jedes Angebot gemessen (3.9.2); er
  ist der erlösbeste Preis eines Bezugsangebots ohne Rivalen (E24).
- Einheit und Bereich: $ des aktuellen Monats > 0, ungerundet.
- Formel: `marketFare(c) = atCost(baseFareEconomy × classFareRatio(c), month)` (1.3, E7).
- Hängt ab von: 4.1, 4.2, Kostenindex. **Nicht** von Fluggästen, Sitzen, Satisfaction, Ruf, Saison,
  Ereignissen, Schwierigkeit, Gesellschaft oder Flugzeug (3.16, E4, E13).
- Wirkt auf: `priceFactor` (3.9.2), Preis-Eingabe (4.5), KI-Preise (4.6), Umsteiger-Tarif (4.8),
  Gewinnschwelle (4.11), Anzeigen.
- Regeln (Tests):
  - Gleich für alle Angebote eines Paars, für Spieler und KI, in Planer und Monatsabschluss (R2).
  - Unabhängig von der Reihenfolge A, B des Paars.
  - Ändert sich nicht mit Schwierigkeit, Satisfaction, Sitzen oder Fluggästen.
  - `marketFare` 2020 = `marketFare` 1960 × `costIndex` 2020 (gleiches Paar).
- Anzeige: Planer und Streckendetails „Market fare“ je Klasse; Flughafen-Ansicht je Paar.

### 4.4 Knappheit (kein eigener Zuschlag)
- Heute: Marktpreis × bis 1,10, wenn die Nachfrage der eigenen Strecke ihre Sitze übersteigt
  (`scarcityPremium`, `:1056-1063`). Das hängt an den eigenen Sitzen und Fluggästen und verstößt damit
  gegen 3.16 (Marktpreis gleich für alle, ohne Kreis).
- Neu: **entfällt.** Knappheit wirkt von selbst über die Sitz-Grenze in der Aufteilung (3.11 Schritt 3):
  Sind die Sitze knapp, verliert ein höherer Preis kaum Fluggäste, also steigt der beste Preis (4.10).
  Beispiel 4.13: 800 Sitze bei 1 000 Wunsch-Gästen → bester Preis 122 % des Marktpreises (heute +10 %).
  Der Planer zeigt diesen besten Preis; der Spieler muss ihn selbst setzen. Der Erlös steigt nicht ohne
  sein Zutun.
- Regel (Test): Mehr eigene Sitze ändern den Marktpreis nicht.

### 4.5 Preis einer Strecke (Code-Namen: `fareRatio`, `routeFare`)
**Preisniveau** `fareRatio(route, c)`: was der Spieler je Klasse einstellt, als Anteil des Marktpreises.
- Formel: `routeFare(route, c) = fareRatio(route, c) × marketFare(c)`.
- Gespeichert wird `fareRatio` (Zahl ohne Einheit), nicht der Dollar-Betrag (vorläufig, offene Frage O53).
  So bleibt ein Preis „10 % über Markt“ über die Jahre 10 % über Markt, auch wenn der Kostenindex steigt.
- Eingabe: Der Planer zeigt und nimmt **Dollar** je Klasse; aus der Eingabe wird `fareRatio = Eingabe /
  marketFare(c)` (bei Bestätigung, aktueller Monat). Ein Prozent-Wert („+10 % vs. market“) steht daneben.
- Bereich: `FARE_RATIO_MIN … FARE_RATIO_MAX` = 0,25 … 4, einmal begrenzt beim Speichern (R4). Unter
  0,25 wäre `priceFactor` riesig; über 4 kommt praktisch niemand.
- Startpreis einer neuen Strecke: `fareRatio = 1` in jeder Klasse (Marktpreis, E23). Kein fester
  Klassen-Faktor (heute Planer `:1032-1045`).
- „Adjust All Prices“: setzt **ein** Preisniveau für alle Klassen (`fareRatio(c) = r` für alle `c`); die
  Klassen-Verhältnisse kommen so aus 4.2 (E23; heute fest 1,6 / 3 / 5, Planer `:3657-3667`).
- „Set best fares“ (neu): setzt je Klasse den besten Preis aus 4.10.
- Wirksam: Ein geänderter Preis gilt ab dem **nächsten Monatsabschluss** für den ganzen nächsten Monat
  (wie heute, `src/lib/monthClose.ts:1451-1454`). Der laufende Monat rechnet mit dem Preis, der zu seinem
  Beginn galt. Der Planer zeigt die Zahlen mit dem neuen Preis und den Hinweis „from next month“.
- **Fehlender Preis** (R8): `fareRatio = 1`, an genau einer Stelle (Lese-Funktion des Modells). Gilt für
  alte Spielstände, neue Klassen nach einem Kabinen-Umbau und KI-Strecken. Keine Ansicht zeigt 0 $ (W9).
- Spielstand-Umwandlung (5.1): `fareRatio = gespeicherter Preis / marketFare` im Monat der Umwandlung.
- Regeln (Tests): `routeFare` > 0 immer; gleiche `fareRatio` → gleicher Abstand zum Marktpreis in jedem
  Jahr; Preisänderung ändert die Fluggäste des laufenden Monats nicht; fehlender Preis = Marktpreis.

### 4.6 KI-Preise (R7)
- Die KI setzt ihre Preise mit **derselben Funktion**: `routeFare = fareRatio × marketFare(c)`. Ihr
  `fareRatio` wählt sie nach ihrer Persönlichkeit und Lage (Abschnitt 7; heute `ticketPricesFor`,
  `src/lib/aiSimulation.ts:336-352`, als Faktor auf den Grundpreis ohne SAT).
- Ihr Preis wirkt in der Aufteilung wie jeder andere: über `priceFactor` aus ihrem echten Preis (3.9.2).
  Der eigene „Preis-Reiz“ `1 / (1 − Nachlass)` im Spieler-Markt entfällt (`src/lib/monthClose.ts:201`).
- Preiskampf: ein niedrigeres `fareRatio` (Abschnitt 7), keine eigene Rechnung.
- Easy-KI mit 2,25- bis 2,5-fachem Grundpreis entfällt (E4).
- Regel (Test): Spieler und KI mit gleichem `fareRatio` auf demselben Paar zahlen denselben Preis.

### 4.7 Erlös je Strecke (Code-Name: `routeRevenue`)
- Bedeutung: Was eine Strecke je Woche einnimmt.
- Einheit und Bereich: $ je Woche ≥ 0, ungerundet.
- Formel:
  ```
  routeRevenue = Σ Klassen c: directPax(route, c) × routeFare(route, c)
               + Σ Umsteiger-Flüsse über diese Strecke: transferRevenueShare (4.8)
  ```
  `directPax(route, c)`: Fluggäste der Strecke in `c` je Woche aus 3.11 Schritt 4 (beide Richtungen).
- Mehrere Strecken einer Gesellschaft auf einem Paar: Jede Strecke nimmt ihren eigenen Preis ein. Weil die
  Fluggäste nach Sitzen verteilt werden (3.11) und `offerFare` nach Sitzen gemittelt ist (3.8), gilt
  Σ Strecken = Fluggäste des Angebots × `offerFare` (Test).
- Gestrichene Flüge (E33): weniger Sitze → höchstens so viele Fluggäste wie übrige Sitze → weniger Erlös.
  Kein weiterer Abzug.
- Charter (E32): Fluggäste auf gecharterten Flügen zahlen ihren Preis wie sonst; der Erlös gehört der Strecke.
  Die Charter-Gebühr ist ein Preis je Flug (Kosten, Abschnitt 8), kein Erlösanteil.
- Gilt gleich für Spieler und KI (E44).
- Hängt ab von: 3.11, 3.13, 4.5, 4.8.
- Wirkt auf: Streckengewinn (mit Abschnitt 5), Monatserlös (4.9), Planer (4.12).
- Regeln (Tests): Erlös = 0 ohne Fluggäste; Planer-Erlös = Erlös im Monatsabschluss bei gleichem Stand (R2);
  höherer eigener Preis bei unveränderten Fluggästen → nie weniger Erlös.
- Anzeige: Streckendetails „Weekly revenue“ je Klasse, Umsteiger getrennt; die Ansicht rechnet nicht selbst
  (heute `src/components/RouteDetailView.tsx:494`, R2).

### 4.8 Umsteiger-Tarif und Aufteilung auf Teilstrecken
**Umsteiger-Tarif** (Code-Name: `transferFare`)
- Formel: `transferFare(c) = TRANSFER_FARE_SHARE × marketFare(c)` des Paars **Start–Ziel** (O–D), E25.
  Dieselbe Funktion `marketFare` wie für Direktgäste; keine Schwierigkeit, kein Zuschlag.
  `TRANSFER_FARE_SHARE = 0,9` (3.13).
- Die Gesellschaft stellt ihn nicht ein (wie heute). Er ist zugleich `offerFare` der Verbindung in 3.13.

**Aufteilung auf die Teilstrecken** (Code-Name: `transferRevenueShare`)
- Formel: Erlös eines Umsteigers in `c` = `transferFare(c)`. Er wird auf die Teilstrecken O–H und H–D
  **im Verhältnis ihrer Marktpreise** in `c` verteilt:
  `Anteil(O–H) = marketFare_OH(c) / (marketFare_OH(c) + marketFare_HD(c))`, Rest an H–D.
- Neu: nach Marktpreis statt nach Entfernung (heute `src/lib/transferUtils.ts:470-474`). Grund: Kurze
  Teilstrecken haben einen höheren Preis je km (Kurzstrecken-Zuschlag, Grundbetrag 30 $); nach Entfernung
  bekäme der Zubringer fast nichts (Beispiel 4.13: 7 % statt 15 %). So wird jede Teilstrecke im Planer
  fair bewertet.
- Die Summe der Anteile ist genau `transferFare` (Test). Umsteiger zählen als Fluggäste beider Teilstrecken
  (Kosten je Fluggast, Abschnitt 5).
- Regeln (Tests): Erlös aller Teilstrecken = Umsteiger × `transferFare`; jeder Anteil liegt zwischen 0 und 1;
  die längere (teurere) Teilstrecke bekommt nie weniger als die kürzere.

### 4.9 Monatserlös (Code-Name: `monthlyRevenue`)
- Formel: `monthlyRevenue = Σ Strecken routeRevenue × WEEKS_PER_MONTH` (1.1, E5). Mit dem Stand des Monats
  (Marktgröße mit Saison, Preise vom Monatsbeginn, gestrichene Flüge). Ablauf im Abschluss: Abschnitt 8.
- Regel (Test): 12 Monate gleicher Wochenerlös = Wochenerlös × 52,18.
- Anzeige: Monatsbericht, Finanzen.

### 4.10 Bester Preis (Code-Name: `bestFare`)
- Bedeutung: Der Preis einer Klasse, bei dem die Strecke den höchsten Wochengewinn in dieser Klasse hat,
  wenn alles andere bleibt, wie es ist. Der Planer zeigt ihn (3.16).
- Lesart von 3.16 („erlösbester Preis“): Gesucht wird der **gewinnbeste** Preis, also Erlös minus Kosten je
  Fluggast der Klasse (Abschnitt 5: Verpflegung, Gebühren je Fluggast). Ohne Kosten je Fluggast ist er
  gleich dem erlösbesten. Grund: Der Spieler will Gewinn; Kosten je Abflug ändern sich mit dem Preis nicht
  und spielen keine Rolle.
- Formel: `bestFare(route, c) = fareRatio* × marketFare(c)`, wobei `fareRatio*` in
  `FARE_RATIO_MIN … FARE_RATIO_MAX` den Wert
  `directPax(route, c; fareRatio) × (fareRatio × marketFare(c) − costPerPassenger(route, c))`
  am größten macht. Dabei:
  - `directPax` aus `marketSplit` (3.11) mit **allen** Angeboten des Markts, Anlauf = 1 (volle Nachfrage),
    Sitz-Grenze und Überlauf eingeschlossen;
  - Preise der anderen Klassen, der eigenen anderen Strecken und aller Rivalen bleiben fest (keine Reaktion);
  - Umsteiger bleiben außen vor (Näherung; die Hauptzahl 4.12 rechnet sie mit).
- Suche: Gitter über `fareRatio` in Schritten von 0,01, dann um den besten Gitterpunkt ± 0,01 in Schritten
  von 0,001. Bei Gleichstand der niedrigere Preis. Ergebnis ist damit eindeutig und für Planer und KI gleich.
- Was herauskommt (folgt aus 3.9.2, Test):
  - Bezugsangebot allein, Sitze reichen, keine Kosten je Fluggast: `bestFare = marketFare × satisfactionFactor`
    (E24, ± 0,5 %).
  - Kosten je Fluggast > 0 → bester Preis höher.
  - Sitze knapp → bester Preis höher (4.4).
  - Mehr Anziehung aus anderen Gründen (Abflüge, Ruf, Flugzeit) → bester Preis höher (3.9.2).
  - Gleich starker Rivale → bester Preis niedriger.
- Hinweis für das Balance-Skript (3.9) und Abschnitt 7: Mit den Startwerten aus 3.9.2 liegt der beste Preis
  gegen einen gleichen Rivalen bei 70 % des Marktpreises (4.13). Gehen beide so vor, sinken die Preise
  weiter (Preiskampf). Ob das gewollt ist, prüft das Balance-Skript; Stellschraube ist `PRICE_SENSITIVITY`.
- Anzeige: Planer je Klasse „Best fare“ als Marke am Preisregler und Knopf „Set best fares“ (4.5).

### 4.11 Gewinnschwelle (Code-Name: `breakEvenFareLevel`)
- Bedeutung: Welches Preisniveau (für alle Klassen gleich, wie „Adjust All“) die Kosten einer Strecke bei
  einer gegebenen Auslastung genau deckt (E23: Gewinnschwelle aus dem Modell, mit echten Klassen-Verhältnissen).
- Formel bei Auslastung `L` (0 < L ≤ 1, gleich in allen Klassen):
  ```
  breakEvenFareLevel(L) = (fixedWeeklyCost + Σ c: costPerPassenger(c) × L × seatsPerWeek(c))
                          / (L × Σ c: seatsPerWeek(c) × marketFare(c))
  ```
  `fixedWeeklyCost`: Kosten der Strecke je Woche, die nicht von den Fluggästen abhängen (Abschnitt 5);
  `seatsPerWeek(c)`: Sitze in `c` × Flüge je Woche (beide Richtungen).
  Preis je Klasse an der Schwelle = `breakEvenFareLevel(L) × marketFare(c)`.
- Ersetzt BE75 / BE99 / BE35 mit Gewichten 1 / 1,6 / 3 / 5 (`:1518-1527`).
- Regeln (Tests): höhere Auslastung → nie höhere Schwelle; bei `L` und Preisniveau = Schwelle ist der
  Gewinn der Strecke 0 (wenn alle Klassen genau `L` erreichen).
- Anzeige: Planer-Regler mit zwei Marken: Schwelle bei der **erwarteten** Auslastung (aus 3.11 beim
  eingestellten Preis) und bei voller Maschine (`L = 1`, die tiefste mögliche Schwelle).

### 4.12 Planer-Zahlen (E26, R2, R9)
Der Planer rechnet nichts selbst; er ruft dieselben Funktionen wie der Monatsabschluss (R2) mit dem
geplanten Stand (eingestellte Preise, Flugplan, Kabine) und dem aktuellen Monat.

| Zahl | Festlegung |
|---|---|
| **Hauptzahl: „Expected weekly profit“** | Erlös (4.7, mit Umsteigern) − Kosten (Abschnitt 5) je Woche, bei **heutiger Nachfrage nach dem Anlauf** (Anlauf = 1), Saison des aktuellen Monats, mit allen Rivalen (E26). Auf jeder Schwierigkeit gleich gebildet (heute auf Easy anders, W1). |
| Nebenzahl „First month“ | dieselbe Rechnung mit dem Anlauf im ersten Monat (3.12, R9); bei einer bestehenden Strecke mit ihrem Alter. |
| Nebenzahl „Full aircraft at market fare“ | Σ Sitze je Woche × `marketFare` − Kosten bei voller Maschine. Nur als Vergleich, klein, mit Hinweis „not expected“ (E26). Hängt nicht vom eingestellten Preis ab. |
| Je Klasse | Market fare (4.3), eingestellter Preis mit „±x % vs. market“, Best fare (4.10), erwartete Fluggäste und Auslastung, Hinweis aus 2.10 („Passengers pay up to x% more/less for this satisfaction“). |
| Gewinnschwelle | 4.11 bei erwarteter und voller Auslastung. |

- Regel (Test): Hauptzahl = Gewinn je Woche im Monatsabschluss bei gleichem Stand, sobald der Anlauf
  vorbei ist; die Hauptzahl steigt nie allein dadurch, dass ein Preis über den besten Preis erhöht wird
  (heute W1).

### 4.13 Beispiel
Grundpreise 1960 (Bezugs-Flugzeit mit 800 km/h; Klassen-Verhältnis in Klammern) und Economy 2020
(Kostenindex 2,05):

| Paar | km | Bezugs-Flugzeit | Index | Economy | Premium | Business | First | Economy 2020 |
|---|---|---|---|---|---|---|---|---|
| Frankfurt–Paris | 449 | 44 min | 1,24 | 60 $ | 81 $ (1,34) | 124 $ (2,06) | 188 $ (3,12) | 123 $ |
| Frankfurt–Madrid | 1 420 | 119 min | 2,48 | 114 $ | 173 $ (1,52) | 269 $ (2,37) | 425 $ (3,74) | 233 $ |
| Frankfurt–New York | 6 189 | 483 min | 6,19 | 339 $ | 705 $ (2,08) | 1 119 $ (3,30) | 1 899 $ (5,59) | 694 $ |
| London–Sydney | 17 020 | 1 312 min | 8 | 881 $ | 2 070 $ (2,35) | 3 304 $ (3,75) | 5 727 $ (6,50) | 1 802 $ |

Bester Preis, Economy, Daten wie 3.15 (Marktgröße × Klassen-Anteil 1 000, Marktpreis 100 $,
`PRICE_SENSITIVITY` 2,2), Bezugsangebot:

| Fall | Bester Preis | Fluggäste | Erlös (− Kosten je Fluggast) | Hinweis |
|---|---|---|---|---|
| allein, Sitze reichen | 100 $ | 1 000 | 100 000 $ | E24 |
| allein, nur 800 Sitze | 122 $ | 800 | 97 633 $ | beim Marktpreis nur 80 000 $ (4.4) |
| allein, 20 $ Kosten je Fluggast | 118 $ | 831 | 81 690 $ | gewinnbest, nicht erlösbest |
| gleicher Rivale zu 100 $ | 70 $ | 1 000 | 69 880 $ | beim Marktpreis 64 706 $ (3.15) |

Umsteiger Paris–New York über Frankfurt, Economy: Marktpreis O–D 322 $ → `transferFare` 290 $. Anteil
Paris–Frankfurt 60 / (60 + 339) = 15 % → 44 $; Frankfurt–New York 246 $ (nach Entfernung heute 7 % → 20 $).

Gewinnschwelle (Kosten nur zur Veranschaulichung): Frankfurt–Madrid, 150 Economy + 12 Business, 14 Flüge
je Woche, feste Kosten 150 000 $ je Woche, 15 $ je Fluggast, `L` = 0,75 → Preisniveau 0,82: Economy 94 $,
Business 221 $.

### 4.14 Vorgaben an andere Abschnitte
- **Abschnitt 5 (Kosten):** je Strecke `costPerPassenger(route, c)` (alles, was mit den Fluggästen wächst) und
  `fixedWeeklyCost(route)` (alles andere) getrennt liefern; 4.10 und 4.11 brauchen beide. Umsteiger zählen als
  Fluggäste beider Teilstrecken.
- **Abschnitt 7 (KI):** `fareRatio` je Persönlichkeit und Lage, Preiskampf als niedrigeres `fareRatio`;
  die KI darf `bestFare` (4.10) zur Planung nutzen. Prüfen, ob gegenseitiges Unterbieten in Grenzen bleibt
  (4.10, Hinweis).
- **Abschnitt 8 (Monat):** Preise vom Monatsbeginn; neue Preise ab dem nächsten Abschluss (4.5);
  Monatserlös = Wochenerlös × `WEEKS_PER_MONTH` (4.9); Charter-Gebühr je Flug als Kosten (4.7, E32).
- **Phase 4 / 5.1:** Planer-Zahlen nach 4.12; Spielstand-Umwandlung der Preise nach 4.5.

### 4.15 Zuordnung der Bestandsfunde

| Fund (1.3) | Lösung in diesem Abschnitt |
|---|---|
| W1 Planer-Hauptzahl steigt mit jedem Preis | 4.12 Hauptzahl = erwarteter Gewinn, „volle Maschine“ nur Nebenzahl beim Marktpreis (E26) |
| W2 Feste Klassen-Faktoren 1,6 / 3 / 5 | 4.2 eine Funktion `classFareRatio` für alle Zwecke (E23) |
| W3 Unter Marktpreis mehr Erlös | 3.9.2, 4.10 Marktpreis ist erlösbest ohne Rivalen (E24) |
| W4 KI-Preise ohne Marktpreis | 4.6 `fareRatio × marketFare` mit derselben Funktion (R7) |
| W5 Umsteiger nach eigenen Regeln | 4.8 `TRANSFER_FARE_SHARE × marketFare` O–D, Aufteilung nach Marktpreisen (E25) |
| W6 Monat = 4 Wochen | 4.9 `WEEKS_PER_MONTH` (E5) |
| W7 Preise fest, Kosten steigen | 4.3 Marktpreis mit Kostenindex (E7); 4.5 Preisniveau folgt ihm |
| W8 Kommentar 15 %, Code 10 % | 4.4 Zuschlag entfällt; Texte aus Konstanten (E52) |
| W9 Drei Ersatzpreise | 4.5 fehlender Preis = Marktpreis, eine Stelle (R8) |
| W10 Schwierigkeit im Preis anders als in der Nachfrage | 4.3 Preis ohne Schwierigkeit (E4) |
| W11 SAT-Faktor über 200 | 2.10 eine Kurve 0 … 160; kein SAT-Faktor im Preis (R16) |

## 5. Kosten

Dieser Abschnitt legt fest, was eine Gesellschaft für Flüge, Flughäfen, Flugzeuge und Werbung zahlt und
welche Kosten im Monatsergebnis stehen. Grundlage: E4–E8, E17, E18, E27–E29, E31, E32, E44, E45, E50, E54,
R2–R6; Vorgaben aus 3.16 und 4.14; Bestand: `bestand/4-kosten.md` (W1–W15). Alle heutigen Fundstellen
ohne Pfad liegen in `src/lib/financeUtils.ts`.

Einheiten: Strecken-Kosten gelten **je Woche, beide Richtungen zusammen** (wie der Erlös, 4.7).
Flughafen-Kosten gelten je Woche, Flugzeug- und Werbekosten je Monat. Monat = Woche × `WEEKS_PER_MONTH`
(E5), Jahr = 12 Monate. Alles ungerundet (R4).

**Geld (1.3).** Jeder feste Betrag steht als Wert von 1960 in den Konstanten (Endung `_1960`) und wird nur
über `atCost(betrag1960, month)` umgerechnet: Löhne, Gebühren, Mieten, Unterhalt, Verpflegung, Werbung,
Einmalpreise, Listenpreise der Flugzeuge (E6, E54). **Ausnahme: Treibstoff** (Tabelle, echte Preise, E8).
Beträge als Anteil einer anderen Größe (Versicherung, Wartung, Abschreibung als Anteil des Flugzeugpreises)
bekommen keinen zweiten Index.

### 5.0 Überblick

```
                                   ┌─ Treibstoff (Tabelle × Liter) ──────────┐
Flugabschnitte, Flugzeug ──────────┼─ Besatzung (Stunden × Satz × Lohn) ─────┼─► Flugbetrieb ──┐
                                   └─ Landegebühr (je Landung am Ziel) ──────┘                 │
Belegte Slots ─► Slot-Anteil ─────────────────────────────────────────────────────────────────┼─► fixedWeeklyCost
Flugzeug-Unterhalt + Abschreibung ─► Flugzeug-Anteil (nach Blockstunden) ──────────────────────┘     (je Strecke)

Fluggäste ─► Check-in (je Reise) + Abfertigung (je Abflug) + Verpflegung + Frequent flyer ─► costPerPassenger

Flughäfen: Slots, Abstellplätze, Schalter, Einrichtungen ──┐
Flotte: Versicherung, Wartung, Wertänderung (Wertmodell) ──┼─► Kosten der Gesellschaft je Monat (5.16)
Werbung, Frequent-flyer-Grundbetrag ───────────────────────┘
Einnahme eigener Flughäfen (Stufe 3) ─► mindert die Kosten
```

**Drei Ebenen.**
1. **Kosten je Fluggast** `costPerPassenger(route, c)` (5.8): wachsen mit den Fluggästen.
2. **Feste Kosten je Strecke** `fixedWeeklyCost(route)` (5.9): hängen am Flugplan, nicht an den Fluggästen.
3. **Kosten der Gesellschaft** (5.10–5.16): Flughäfen, Flotte, Werbung. Ein Teil davon wird den Strecken als
   Anteil zugerechnet (Slots, Flugzeug), der Rest bleibt „nicht zugerechnet“. Jeder Dollar zählt im
   Monatsergebnis genau einmal (5.16).

**Wirkungswege.**
- Kosten wirken auf das **Ergebnis** (Kasse, Bericht), den **besten Preis** (4.10, nur `costPerPassenger`)
  und die **Gewinnschwelle** (4.11). Sie wirken nicht auf Nachfrage, Satisfaction oder Ruf.
- Die **Schwierigkeit** wirkt auf keine Kosten (E4, 1.8). Ereignisse ändern keinen Kostensatz (E8); ihre
  Wirkung auf Kosten läuft über weniger Flüge oder Krisen-Antworten (Abschnitt 8).

**Was entfällt** (gegenüber heute):
- Hard-Zuschlag 1,15 auf Treibstoff (`:1624`, W9) und Ereignis-Faktor auf Treibstoff (`:1620-1622`, W4): E4, E8.
- Ersatzpreis 1,05 $ nach 2030 (`:1618`, W3): letzter Tabellenwert (E8).
- Bodenpersonal als 30 % der Besatzung (`:1272`, W11): in der Abfertigung enthalten (R6, 5.6).
- Gebühren je Fluggast an Start **und** Ziel (`:1510-1513`, W5): E27, 5.6.
- Flugbegleiter nach Höchstsitzen (`:1262`, W10): nach eingebauter Kabine (R6, 5.4).
- Eigene KI-Landegebühr (`src/lib/hubOwnership.ts:33-35`): dieselbe Funktion (R6, 5.15).
- Eigene Werbe-Teuerung 3 % je Jahr in Jahresstufen (`src/lib/marketing.ts:86-91`): Kostenindex (E6, R5).
- Monat = 4 Wochen bei Strecken und Flughäfen (`src/lib/monthClose.ts:487-503`, `:547`, `:550`, W15): E5.
- Wiederverkaufswert mit sofort −10 % und ohne Kabine (`:1633-1647`), Wertverlust nie als Kosten (W13): 5.13 (E29).
- Runden in Zwischenschritten (Treibstoffpreis auf 3 Stellen `:1247`, Landegebühr `Math.floor` `:1285`,
  Slot-Preis auf 50 $ `:1717`, Flugzeug-Unterhalt `src/lib/fleetCosts.ts:55`): R4.

### 5.1 Kosten-Faktoren der Gesellschaft

Drei Faktoren verändern Kostensätze. Jeder wird an genau einer Stelle gebildet und von den Kostenformeln
nur gelesen (R2; heute zwei Quellen für den Gebühren-Faktor, siehe 5.20).

**Forschungs-Faktor** (Code-Name: `researchCostFactor(airline, kind)`)
- Formel: `researchCostFactor(kind) = max(RESEARCH_COST_FLOOR, 1 − Σ Einsparungen der fertigen Forschungen dieser Art)`.
- Arten `kind`: `fuel` (Treibstoff), `crew` (Besatzung), `fees` (Flughafen-Gebühren, 5.1 unten),
  `catering` (Verpflegung), `maintenance` (Wartung), `slots` (Slot-Kaufpreis).
- Konstanten: Einsparungen wie heute (`src/lib/research.ts:42-107`): Treibstoff 3 + 3 + 1 %, Besatzung
  3 × 1 %, Gebühren 3 × 1 %, Verpflegung 2 × 2 %, Wartung 4 × 1 %, Slots 8 %;
  `RESEARCH_COST_FLOOR = 0,4` (heute `src/lib/research.ts:253`).
- KI: forscht nicht (Abschnitt 7), Faktor 1.
- Effizienz-Forschung (`eff-1` … `eff-6`, je +1 Punkt) wirkt nicht hier, sondern auf die Effizienz (5.3).

**Lohn-Faktor** (Code-Name: `payFactor(airline)`)
- Formel: `payFactor = salaryPct / 100` (80 … 130 %, heute `src/lib/staff.ts:61-64`).
- Wirkt nur auf die Besatzung (5.4). Bodenpersonal steckt in der Abfertigung (5.6) und folgt ihm nicht mehr.
- KI: kein Personal-Modell (E44, Abschnitt 7), Faktor 1.

**Flughafen-Gebühren-Faktor** (Code-Name: `airportFeeFactor(airline, airport)`)
- Bedeutung: **ein** Nachlass für alle Gebühren, die eine Gesellschaft an einen Flughafen zahlt (R6, W6).
- Formel: `airportFeeFactor = hubFeeFactor(Verwaltungsstufe dort) × researchCostFactor(fees)`.
- `hubFeeFactor`: Stufe 0 und 1 → 1; Stufe 2 → `HUB_FEE_FACTOR_TIER2 = 0,95`; Stufe 3 → `HUB_FEE_FACTOR_TIER3 = 0,85`
  (heute `src/lib/hubOwnership.ts:20-24`).
- Gilt für: Landegebühr (5.5), Check-in und Abfertigung (5.6), Slot-, Stand- und Schalter-Miete (5.10).
  Nicht für: Einrichtungen (eigene Kosten, keine Gebühr), Einmalpreise.
- Neu: Check-in bekommt auf Stufe 3 auch −15 % (heute fest −5 %, `:1294-1295`); Abfertigung und Slot-Miete
  bekommen den Nachlass (heute ohne).
- Regeln (Tests): Faktor ≤ 1; höhere Stufe → nie höherer Faktor; dieselbe Zahl in Planer, Flughafen-Ansicht
  und Monatsabschluss.

### 5.2 Treibstoffpreis (Code-Name: `fuelPrice`)
- Bedeutung: Was eine Gesellschaft in einem Monat für einen Liter Jet-Treibstoff zahlt.
- Einheit und Bereich: $ je Liter > 0, ungerundet.
- Formel:
  ```
  fuelPrice(airline, month) = fuelTable(month) / LITRES_PER_GALLON × researchCostFactor(fuel)
  fuelTable(month) = Tabellenwert „JJJJ-MM“ in $ je Gallone (src/data/fuelPrices.ts)
  ```
  Vor 1960-01 gilt der erste, nach dem letzten Eintrag (2030-12) der **letzte** Tabellenwert (E8, W3).
- Kein Kostenindex (1.3), keine Schwierigkeit (E4, W9), kein Ereignis-Faktor (E8, W4): Die Tabelle enthält
  die Krisen schon.
- Preis-Absicherung (Hedge, heute `src/App.tsx:639-650`, R3): eine Krisen-Antwort aus Abschnitt 8. Läuft
  sie, ersetzt sie `fuelTable(month)` dieser Gesellschaft für ihre Dauer durch den abgesicherten Wert;
  sonst nichts. Die Regel steht im Modell, nicht in `App.tsx`.
- Konstanten: `LITRES_PER_GALLON = 3,78541`.
- Hängt ab von: Monat, Forschung, laufende Absicherung.
- Wirkt auf: Treibstoff-Kosten (5.3), Krisen-Antworten als Anteil der Treibstoff-Rechnung (Abschnitt 8, E6).
- Regeln (Tests): Januar 2031 = Dezember 2030; gleicher Preis für Spieler und KI ohne Forschung und
  Absicherung, auf jeder Schwierigkeit; ein laufendes Ereignis ändert ihn nicht.
- Anzeige: Kopfzeile, Planer, Bericht; Wert aus dem Modell (heute holt der Planer ihn teils selbst, 5.20).

### 5.3 Treibstoff je Strecke (Code-Name: `fuelCost`)
- Bedeutung: Treibstoff-Rechnung einer Strecke je Woche.
- Formel:
  ```
  fuelLitresPerSeat100km = FUEL_BASE / (FUEL_EFF_OFFSET + efficiency / FUEL_EFF_SCALE)
  fuelCost = fuelLitresPerSeat100km × capacity × Entfernung / 100 × flownLegs × fuelPrice
  ```
  - `capacity`: Höchstsitze des Typs laut Daten (steht für Größe und Gewicht des Flugzeugs, R6, W10);
    nicht die eingebauten Sitze und nicht die Fluggäste.
  - `efficiency`: Wert des Typs in `src/data/aircraft.ts` + `EFFICIENCY_PER_RESEARCH` je fertiger
    Effizienz-Forschung, höchstens 100. **Berechnet, nicht gespeichert** (heute ins Flugzeug geschrieben,
    `src/lib/monthClose.ts:1129`; Umwandlung in 5.1).
  - Entfernung: Großkreis in km (wie heute).
  - `flownLegs`: Flugabschnitte je Woche, die das eigene Flugzeug wirklich fliegt: Hin- und Rückflug = 2,
    Einweg = 1, ohne gestrichene (E33) und gecharterte (E32) Flüge.
- Konstanten (heute `:1256`): `FUEL_BASE = 7,5`, `FUEL_EFF_OFFSET = 0,75`, `FUEL_EFF_SCALE = 70`
  (Liter je Sitz und 100 km: Effizienz 14 → 8,0; 50 → 5,1; 72 → 4,2; 96 → 3,5); `EFFICIENCY_PER_RESEARCH = 1`.
- Hängt ab von: Flugzeugtyp, Forschung, Entfernung, Flugplan, Ausfälle, `fuelPrice`.
- Wirkt auf: `fixedWeeklyCost` (5.9).
- Regeln (Tests): mehr Effizienz → nie mehr Treibstoff; gleiche Strecke, gleicher Typ → gleiche Kosten für
  Spieler und KI (ohne Forschung); hängt nicht von den Fluggästen ab; gestrichene Flüge senken ihn anteilig.

### 5.4 Besatzung (Code-Name: `crewCost`)
- Bedeutung: Löhne von Cockpit und Kabine für die geflogenen Stunden.
- Formel:
  ```
  cabinCrew = max(MIN_CABIN_CREW, Σ c: Sitze(c) / SEATS_PER_ATTENDANT[c])      (eingebaute Kabine, R6)
  hourlyRate1960 = COCKPIT_CREW × PILOT_RATE_1960 + cabinCrew × ATTENDANT_RATE_1960
  crewCost = atCost(hourlyRate1960, month) × blockMinutes × flownLegs / 60
             × payFactor × researchCostFactor(crew)
  ```
  `cabinCrew` ist eine Kommazahl (Mittel über Umläufe), ungerundet (R4); heute `aufrunden(Höchstsitze / 50)`.
- Konstanten: `COCKPIT_CREW = 2`, `PILOT_RATE_1960 = 100` $/h, `ATTENDANT_RATE_1960 = 40` $/h (heute `:1263`);
  `SEATS_PER_ATTENDANT` Economy 50 · Premium 35 · Business 20 · First 10 (neu; Economy wie heute);
  `MIN_CABIN_CREW = 1`.
- Folge (E45): Eine dichte Economy-Kabine braucht weniger Personal je Sitz als eine Kabine mit Business und
  First. Billigflieger sparen so ohne eigenen Faktor.
- Bodenpersonal: entfällt als eigener Posten (W11); es ist in der Abfertigung (5.6) enthalten.
- Hängt ab von: Kabine, `blockMinutes` (eine Richtung, 1.1), `flownLegs` (5.3), Lohn, Forschung, Kostenindex.
- Wirkt auf: `fixedWeeklyCost` (5.9).
- Regeln (Tests): mehr Sitze in einer Klasse → nie weniger Besatzung; Business-Sitz kostet mehr Besatzung als
  Economy-Sitz; KI zahlt bei gleicher Kabine dasselbe wie der Spieler mit Lohn 100 % ohne Forschung.
- Anzeige: Planer „Crew“ mit Stundensatz aus dem Modell (heute als Text nachgebaut, Planer `:3476`).

### 5.5 Landegebühr (Code-Name: `landingFee`)
- Bedeutung: Was eine Landung eines Flugzeugs an einem Flughafen kostet.
- Formel:
  ```
  landingFee(airline, airport, aircraft, month) =
      atCost(LANDING_BASE_1960[Klasse] + LANDING_PER_LEVEL_1960[Klasse] × Flughafengröße, month)
    × capacity / LANDING_REFERENCE_SEATS[Klasse]
    × (PROPELLER_FEE_SHARE, wenn Regional und Reisegeschwindigkeit < PROPELLER_MAX_SPEED; sonst 1)
    × airportFeeFactor(airline, airport)
  landingCost(route) = Σ geflogene Abschnitte: landingFee am Zielflughafen des Abschnitts
  ```
  Je **Flugabschnitt eine Landung am Ziel** (R6, W12): Hin- und Rückflug = eine Landung an jedem Ende;
  Einweg = eine Landung.
- Klassen: Regional, Narrowbody, Widebody (die einzigen in den Daten). Der Zweig „andere Klasse 2 200 $“
  (`:1215`) entfällt.
- Konstanten (heute `:1171-1217`, ausgeschrieben): `LANDING_BASE_1960` Regional und Narrowbody 2 750,
  Widebody 3 300; `LANDING_PER_LEVEL_1960` 110 / 165; `LANDING_REFERENCE_SEATS` 180 / 180 / 420;
  `PROPELLER_FEE_SHARE = 0,85`, `PROPELLER_MAX_SPEED = 700` km/h.
- Hängt ab von: Flughafengröße (1 … 7), Typ (Höchstsitze, Klasse, Geschwindigkeit), Verwaltungsstufe,
  Forschung, Kostenindex.
- Wirkt auf: `fixedWeeklyCost` (5.9); Einnahme eigener Flughäfen (5.15).
- Hinweis Balance (3.9): Landegebühren sind heute 26–47 % der Kurzstrecken-Kosten (Bestand, Beispielwerte).
  Das Balance-Skript prüft die Höhe zusammen mit dem Grundpreis (E7).
- Regeln (Tests): größerer Flughafen → nie billiger; mehr Höchstsitze → nie billiger; ein Einweg-Abschnitt
  zahlt genau eine Landung; Spieler und KI zahlen mit derselben Funktion.
- Anzeige: Flughafen-Ansicht je Flugzeugklasse, Planer; Werte aus dem Modell (heute eigene Rechnung,
  `src/components/AirportDetailView.tsx:283-287`).

### 5.6 Check-in und Abfertigung (Code-Namen: `checkInFee`, `handlingFee`)
- Bedeutung: Gebühren, die der Flughafen für jeden Fluggast nimmt (E27).
  - **Check-in** einmal **je Reise**, am Flughafen, an dem die Reise beginnt. Ein Umsteiger checkt am
    Umsteige-Flughafen nicht noch einmal ein (W5).
  - **Abfertigung** (Gepäck, Boarding, Bodenpersonal) **je Abflug**: an jedem Flughafen, an dem der Gast
    abfliegt, also auf jedem Flugabschnitt einmal, am Start des Abschnitts.
- Formel je Flughafen `x`:
  ```
  checkInFee(x)  = atCost(CHECKIN_FEE_1960, month) × airportFeeFactor(airline, x)
  handlingFee(x) = atCost(HANDLING_FEE_1960[Größenstufe von x], month) × airportFeeFactor(airline, x)
  ```
- Konstanten: `CHECKIN_FEE_1960 = 1,0` $; `HANDLING_FEE_1960` Flughafengröße 1–2: 6 $, 3–4: 8 $, ab 5: 10 $.
  Begründung (E27): Heute zahlt jeder Fluggast eines Abschnitts Check-in 0,5 $ und Abfertigung 3 / 4 / 5 $
  an **beiden** Enden (`:1294-1296`, `:1510-1513`). Neu fällt jede Gebühr nur an einem Ende an; die Sätze
  sind verdoppelt, damit die Summe je Fluggast etwa gleich bleibt. Umsteiger zahlen weniger als heute
  (kein zweiter Check-in). Das wegfallende Bodenpersonal (W11, 2–4 % der Kosten) ist nicht aufgeschlagen;
  das Balance-Skript (3.9) prüft die Höhe.
- Wirkt auf: `costPerPassenger` (5.8).
- Regeln (Tests): ein Direktgast zahlt je Reise genau einen Check-in; ein Umsteiger zahlt einen Check-in und
  zwei Abfertigungen; Stufe 3 senkt beide Gebühren um denselben Anteil wie die Landegebühr.

### 5.7 Verpflegung (Code-Name: `cateringCost`)
- Bedeutung: Was Essen, Getränke, Extras und Bordservice für einen Fluggast einer Klasse auf einem
  Flugabschnitt kosten.
- Formel je Strecke und Klasse:
  ```
  cateringCost(route, c) = atCost( Σ_k mealWeight(k) × Σ Gerichte im Menü k: Preis
                                   + Σ Extras: Preis + Σ Bordservice: Preis, month)
                           × researchCostFactor(catering)
  ```
  - `mealWeight(k)`: **dieselben** Gewichte wie für die Service points (2.5, R5, W14). Mahlzeit 2 und 3
    kosten stufenlos mehr, so wie sie stufenlos mehr Punkte bringen.
  - Jedes gewählte Gericht kostet voll, auch wenn es wegen des abnehmenden Nutzens (E16) weniger Punkte
    bringt. Mehr bieten kostet also immer mehr.
  - Extras und Bordservice: die Preise der gewählten Stufen (je Gruppe die beste, wie in 2.5).
- Konstanten: Preise in `src/data/catering.ts` (Feld `cost`) gelten als Werte von 1960 und laufen über
  `atCost` (E6; heute ohne Index). Das Balance-Skript prüft die Höhe.
- Hängt ab von: Auswahl je Klasse (dieselbe wie 2.5), `flightTimeIndex` der Strecke, Forschung, Kostenindex.
- Wirkt auf: `costPerPassenger` (5.8).
- Regeln (Tests): ein weiteres Gericht oder Extra senkt die Kosten nie; Mahlzeiten-Gewichte für Punkte und
  Kosten sind dieselben Zahlen; 1 Minute mehr Flugzeit ändert die Kosten um weniger als 1 %.

### 5.8 Kosten je Fluggast (Code-Name: `costPerPassenger`)
- Bedeutung: Alles, was eine Strecke für einen zusätzlichen Fluggast der Klasse `c` zahlt (4.14).
- Einheit: $ je Fluggast und Abschnitt, ungerundet.
- Formel für **Direktgäste** einer Strecke A–B:
  ```
  tripCost(x) = checkInFee(x) + ffpCostPerPassenger            (je Reise, Start in x)
  costPerPassenger(route, c) = cateringCost(route, c)
                             + wA × (handlingFee(A) + tripCost(A)) + wB × (handlingFee(B) + tripCost(B))
  ```
  `wA`, `wB`: Anteil der Abflüge der Strecke in A bzw. B (Hin und Zurück: je 0,5). Grund: Die Fluggäste
  einer Strecke sind beide Richtungen zusammen (3.0); wer in A abfliegt, zahlt dort.
- Formel für **Umsteiger** auf einer Teilstrecke mit Drehkreuz H und anderem Ende X
  (Code-Name: `transferCostPerPassenger(route, c)`):
  ```
  transferCostPerPassenger = cateringCost(route, c) + wX × handlingFee(X) + wH × handlingFee(H) + 0,5 × tripCost(X)
  ```
  Die Hälfte der Umsteiger beginnt ihre Reise in X (Check-in auf dieser Teilstrecke), die andere Hälfte
  am anderen Ende der Verbindung (Check-in auf der anderen Teilstrecke). In H checkt niemand ein.
- `ffpCostPerPassenger = atCost(FFP_COST_PER_PAX_1960, month)`, solange das Frequent-flyer-Programm läuft,
  sonst 0 (5.14). KI: 0.
- Umsteiger zählen als Fluggäste **beider** Teilstrecken (4.14): Verpflegung und Abfertigung auf jeder.
- Hängt ab von: 5.6, 5.7, 5.14.
- Wirkt auf: Strecken-Ergebnis (5.9), bester Preis (4.10), Gewinnschwelle (4.11).
- Regeln (Tests): Summe über alle Fluggäste = Verpflegung + Check-in + Abfertigung + FFP der Strecke; ein
  Umsteiger zahlt über beide Teilstrecken zusammen genau einen Check-in; hängt nicht vom Preis und nicht von
  der Zahl der Fluggäste ab.

### 5.9 Feste Kosten und Ergebnis je Strecke (Code-Namen: `fixedWeeklyCost`, `routeResult`)
- Bedeutung: Was eine Strecke je Woche kostet, egal wie viele Fluggäste kommen (4.14).
- Formel:
  ```
  flightOpsCost(route)  = fuelCost + crewCost + landingCost                       (5.3–5.5)
  slotShare(route)      = Σ Abflughafen x: belegte Slots der Strecke in x × slotRent(x, Klasse)   (5.10)
  aircraftShare(route)  = (aircraftUpkeep + ageDepreciation) des Flugzeugs / WEEKS_PER_MONTH
                          × Blockstunden der Strecke / Blockstunden aller Strecken des Flugzeugs
  fixedWeeklyCost(route) = flightOpsCost + slotShare + aircraftShare        (vorläufig, O54)

  routeResult(route) = routeRevenue (4.7)
                     − Σ c: directPax(c) × costPerPassenger(c)
                     − Σ c: transferPax(c) × transferCostPerPassenger(c)
                     − fixedWeeklyCost
  ```
  - Belegte Slots der Strecke in x = Abflüge der Strecke je Woche in x (1.6), nach Plan (auch gestrichene
    und gecharterte Flüge belegen ihren Slot).
  - Blockstunden nach Plan. Fliegt ein Flugzeug nur diese Strecke, trägt sie seine ganzen Kosten; ein
    wenig genutztes Flugzeug macht seine Strecke teuer (gewollt: zeigt schlechte Auslastung).
  - `ageDepreciation`: der planbare Teil der Abschreibung (5.13), ohne Zustand und Käufe.
- **Lesart (O54):** E26 verlangt als Planer-Hauptzahl den „erwarteten Gewinn“. Ohne Flugzeug-Anteil zeigt
  der Planer heute Gewinn auf Strecken, deren Flugzeug mehr kostet, als sie einbringen (Bestand W1: A350
  +64 000 $ im Monat gegen 420 000 $ Unterhalt). Darum zählen Slot- und Flugzeug-Anteil vorläufig zu den
  festen Kosten der Strecke. Der Planer zeigt zusätzlich „before aircraft costs“ (`flightOpsCost` +
  `slotShare`).
- Wirkt auf: Gewinnschwelle (4.11), Planer-Hauptzahl (4.12), Streckenliste und Bericht. Nicht auf den
  besten Preis (4.10, feste Kosten ändern sich mit dem Preis nicht).
- Regeln (Tests):
  - Σ Strecken `slotShare` + nicht zugerechnete Slot-Miete = Slot-Miete der Gesellschaft (5.16).
  - Σ Strecken `aircraftShare` eines Flugzeugs = sein Unterhalt + `ageDepreciation` je Woche.
  - Planer-Ergebnis = Strecken-Ergebnis im Monatsabschluss bei gleichem Stand (R2).
- Anzeige: Planer (Hauptzahl, Aufschlüsselung je Posten), Streckendetails, Streckenliste.

### 5.10 Slots, Abstellplätze, Schalter (Code-Name: `airportUpkeep`)
Alles je Gesellschaft und Flughafen, je Woche. Mieten sind Flughafen-Gebühren und tragen
`airportFeeFactor` (5.1).

**Slots** (Definition 1.6, E50)
- Arten: Regional, Narrowbody, Widebody. Ein Abflug braucht einen Slot der Klasse seines Flugzeugs (wie heute).
- Grenze je Flughafen: `SLOTS_PER_AIRPORT_LEVEL × Flughafengröße` Slots aller Arten und aller Gesellschaften
  zusammen (heute 300 je Stufe, nur in Ansichten, `src/components/AirportDetailView.tsx:128` u. a.).
- Kaufpreis: `slotPrice(Art) = atCost(SLOT_PRICE_1960[Art], month) × researchCostFactor(slots) × milestoneSlotFactor`
  (`milestoneSlotFactor` aus Abschnitt 6, sonst 1). Neu mit Kostenindex (E6, W8), ungerundet.
- Verkauf: `SLOT_RESALE_SHARE × slotPrice(Art)` des Verkaufsmonats.
- Miete: `slotRent(x, Art) = atCost(SLOT_RENT_1960[Art], month) × airportFeeFactor(airline, x)` je gekauftem
  Slot und Woche, belegt oder nicht.
- Konstanten (heute `:25-29`, `:1715-1719`, `:1806-1808`): `SLOT_PRICE_1960` 25 000 / 50 000 / 100 000;
  `SLOT_RENT_1960` 125 / 250 / 250; `SLOT_RESALE_SHARE = 0,5`; `SLOTS_PER_AIRPORT_LEVEL = 300`.

**Abstellplätze (Stände)**
- Nur an Flughäfen ab Größe 3 (wie heute, `:1703-1710`), je Art.
- Verwaltungsstufe 0–1: gemietet, ohne Kaufpreis; Miete `atCost(STAND_RENT_1960[Art]) × airportFeeFactor`.
- Ab Verwaltungsstufe 2: Jeder Slot hat automatisch einen Abstellplatz **ohne Miete** (E28, bewusster
  Vorteil der Stufe).
- Konstanten: `STAND_RENT_1960` 150 / 300 / 600 (heute `:31-35`).

**Check-in-Schalter**
- Pflicht an jedem Flughafen, an dem eine eigene Strecke abfliegt (E18; Lesart „beide Enden“, O52).
- Arten: bedient (immer), Selbstbedienung (ab 1995, wie heute `:1703-1710`). Ohne Kaufpreis.
- Miete je Schalter:
  `deskRent = atCost(DESK_RENT_1960[Art]) × (DESK_FIXED_SHARE + (1 − DESK_FIXED_SHARE) × min(1, deskLoad)) × airportFeeFactor`
  mit `deskLoad` aus 2.6.3 (Sitze der Abflüge je Woche / Kapazität; eine Funktion für Satisfaction und Kosten).
- Konstanten (heute `:38-64`): `DESK_RENT_1960` bedient 2 500, Selbstbedienung 1 500; `DESK_FIXED_SHARE = 0,2`.
- Regeln (Tests): `airportUpkeep` steigt nie mit weniger Slots, Ständen oder Schaltern; Stufe 2 → Stand-Miete 0;
  Slot-Preis 2020 = Preis 1960 × `costIndex` 2020 (ohne Forschung).
- Anzeige: Flughafen-Ansicht „Weekly upkeep“ mit Aufschlüsselung aus dem Modell, im Geld des aktuellen
  Monats (heute teils in Preisen von 1960, Bestand 1.8).

### 5.11 Verwaltungsstufen und Einrichtungen
**Verwaltungsstufe** (Code-Name: `managementTierPrice`)
- Einmalpreis: `atCost(Flughafengröße × TIER_PRICE_1960[Stufe], month)` (neu mit Kostenindex, E6, W8).
- Konstanten (heute `:1656-1660`): `TIER_PRICE_1960` Stufe 1: 30 000, Stufe 2: 750 000, Stufe 3: 25 000 000
  je Größenstufe des Flughafens.
- Wirkung auf Kosten: `hubFeeFactor` (5.1), freie Stände ab Stufe 2 (5.10), Einnahme ab Stufe 3 (5.15).
  Keine laufenden Kosten der Stufe selbst.

**Einrichtungen** (Code-Name: `facilityPrice`, `facilityUpkeep`)
- Hangar, VIP-Lounge, Catering-Küche je Flughafen mit eigener Verwaltungsstufe.
- Einmalpreis `atCost(FACILITY_PRICE_1960)`, Unterhalt `atCost(FACILITY_UPKEEP_1960)` je Woche; kein
  `airportFeeFactor` (eigene Anlage, keine Gebühr).
- Konstanten: `FACILITY_PRICE_1960` Hangar 250 000, Lounge 1 000 000, Küche 250 000 (heute im Klick-Handler,
  `src/components/AirportDetailView.tsx:443-554`, R3); `FACILITY_UPKEEP_1960` 10 000 / 12 500 / 10 000
  (heute `:111-113`).
- Wirkung der Einrichtungen (Satisfaction, Umsteiger, Wartung): andere Abschnitte (2.6.3, 3.13, 8).

### 5.12 Flugzeug-Unterhalt (Code-Name: `aircraftUpkeep`)
- Bedeutung: Versicherung und Wartungsprogramm eines Flugzeugs je Monat, ob es fliegt oder steht.
- Formel:
  ```
  newPrice(type, month) = atCost(LIST_PRICE_1960[type], month)          (Listenpreis aus den Daten, E54)
  aircraftUpkeep = newPrice × (INSURANCE_RATE + maintenanceRate(age) × commonalityFactor
                                × researchCostFactor(maintenance)) / 12
                   × (PARKED_SHARE, wenn das Flugzeug auf keiner Strecke eingesetzt ist; sonst 1)
  maintenanceRate(age) = MAINTENANCE_RATE_NEW + (MAINTENANCE_RATE_OLD − MAINTENANCE_RATE_NEW)
                         × kappen(age / MAINTENANCE_FULL_AGE, 0, 1)
  ```
  - `age`: Jahre mit Bruchteil seit dem **Baumonat** (wie 2.2, R13); heute seit dem Kaufmonat
    (`src/lib/fleetCosts.ts:31-35`).
  - `commonalityFactor`: Flotten-Mischung wie heute (`src/lib/fleetCosts.ts:67-121`): 1 + Zuschlag je Familie
    über 3 − Nachlass nach Größe der eigenen Familie. Für Spieler und KI (E44).
  - Bezug ist der **heutige** Neupreis des Typs: Wartung ist laufender Aufwand und wächst mit dem Kostenindex.
- Konstanten (heute `src/lib/fleetCosts.ts:14-20`, `:67-76`): `INSURANCE_RATE = 0,006`;
  `MAINTENANCE_RATE_NEW = 0,03`, `MAINTENANCE_RATE_OLD = 0,08`, `MAINTENANCE_FULL_AGE = 25`;
  `PARKED_SHARE = 0,5`; Mischung: `FREE_FAMILIES = 3`, `VARIETY_PENALTY_PER_FAMILY = 0,03`,
  `VARIETY_PENALTY_MAX = 0,3`, Nachlässe ab 3 / 6 / 12 / 25 Flugzeugen 4 / 8 / 12 / 15 %.
- Gecharterte Flüge (E32): Das Flugzeug bleibt „eingesetzt“; Unterhalt voll.
- Wirkt auf: `aircraftShare` (5.9), Kosten der Gesellschaft (5.16).
- Regeln (Tests): älter → nie billiger; geparkt = halb; gleiche Flotte → gleicher Unterhalt für Spieler und KI
  (ohne Forschung); Jahreswert = Monatswert × 12 (W15).

### 5.13 Wertmodell und Abschreibung (Code-Namen: `aircraftValue`, `fleetValueResult`)
- Bedeutung: Was ein Flugzeug wert ist und wie sein Wertverlust als Kosten im Monatsergebnis steht (E29, W13).
  **Ein** Wertmodell für Spieler, KI, Gebrauchtmarkt, Kreditlinie und Übernahme (E29, R13, E34, E48).
- Formel:
  ```
  valueBase(plane)      = atCost(LIST_PRICE_1960[type], Baumonat) + atCost(cabinListPrice(Kabine), Einbaumonat der Kabine)
  ageFactor(age)        = 1 − (1 − RESIDUAL_SHARE) × kappen(age / DEPRECIATION_YEARS, 0, 1)
  conditionFactor(plane) = 1 − CONDITION_VALUE_SPAN × (1 − (AIRFRAME_VALUE_SHARE × airframeCondition
                                                            + (1 − AIRFRAME_VALUE_SHARE) × cabinCondition) / 100)
  aircraftValue(plane, month) = valueBase × ageFactor(age) × conditionFactor
  ```
  - `cabinListPrice`: Preise der Sitze und Ausstattung aus dem Kauf- und Umbau-Dialog als Werte von 1960
    (heute nur in der Oberfläche, `src/components/ConfigurePurchaseView.tsx:391-540`; neu im Modell,
    `src/model/kabine.ts`, R3).
  - Ein neues Flugzeug (Alter 0, Zustand 100) ist genau seinen Kaufpreis wert (E29, E54): Kaufpreis =
    `valueBase` im Kaufmonat. Kein Sofort-Verlust (heute −10 %, `:1643-1646`), Kabine zählt mit.
  - **Lesart „Zustand als Zu- oder Abschlag“ (E29):** Zustand 100 ist neutral, weil „Wert neu = Kaufpreis“
    sonst nicht gilt. Ein gut gepflegtes Flugzeug verliert also weniger, ein abgenutztes mehr.
  - `valueBase` bleibt nach dem Kauf fest (kein späterer Kostenindex): Das Wertmodell rechnet ab dem
    Kaufpreis (1.3, E54). Ein Gebrauchtflugzeug hat dieselbe `valueBase` wie als Neuflugzeug (R13).
- **Abschreibung im Monatsergebnis.** Alles, was den Flottenwert ändert, steht als ein Ergebnis-Posten:
  ```
  fleetValueResult(Monat) = (Flottenwert am Monatsende − Flottenwert am Monatsanfang)
                          − Käufe − Kabinen-Umbauten − Grundüberholungen + Verkaufserlöse
  ```
  Kosten im Bericht = −`fleetValueResult`, in zwei Zeilen:
  - „Depreciation“: Wertänderung der gehaltenen Flugzeuge (Alter und Zustand);
  - „Aircraft trades“: bei Kauf, Umbau, Überholung, Verkauf die Differenz zwischen Wertänderung und
    gezahltem bzw. erhaltenem Betrag (z. B. Verkauf unter Wert durch die Händler-Spanne, E30).
  Folgen: Ein Kauf zum Wert ist ergebnisneutral; ein Umbau oder eine Überholung kostet im Ergebnis, was
  sie mehr kostet, als sie den Wert hebt (E31: Wert steigt höchstens um den Preis); Kaufen und sofort
  Verkaufen bringt nie Gewinn (E30).
- **Planbare Abschreibung** (Code-Name: `ageDepreciation`) für den Flugzeug-Anteil (5.9):
  `valueBase × (1 − RESIDUAL_SHARE) / (DEPRECIATION_YEARS × 12) × conditionFactor` je Monat bis
  `DEPRECIATION_YEARS`, danach 0.
- Konstanten (Startwerte; heute 2 % je Jahr bis 40 %, `src/lib/fleetCosts.ts:23-24`):
  `DEPRECIATION_YEARS = 25`, `RESIDUAL_SHARE = 0,2` (3,2 % je Jahr); `CONDITION_VALUE_SPAN = 0,6`,
  `AIRFRAME_VALUE_SHARE = 0,75` (heute 0,45 Zelle + 0,15 Kabine, `:1643-1644`). Endgültig aus dem
  Balance-Skript (3.9).
- Nicht hier, sondern Abschnitt 8: Händler-Spanne und Gebrauchtmarkt-Preise (E30), Vorbestellung,
  Grundüberholung (E31), Verschleiß, Forschung „Resale value“ (wirkt auf den Verkaufserlös, nicht auf den Wert).
- Regeln (Tests):
  - Neues Flugzeug: `aircraftValue` = Kaufpreis.
  - Älter oder abgenutzter → nie mehr Wert; nach `DEPRECIATION_YEARS` bei Zustand 100 genau `RESIDUAL_SHARE` × `valueBase`.
  - Über die ganze Haltezeit: Σ `fleetValueResult` = Verkaufserlös − Kaufpreis − Umbauten − Überholungen.
  - Gleiches Flugzeug → gleicher Wert für Spieler, KI und Gebrauchtmarkt.
  - Ein Kauf ändert das Monatsergebnis nicht, solange der Preis dem Wert entspricht (W13).
- Anzeige: Flottenansicht „Value“ je Flugzeug, Bericht (zwei Zeilen), Bilanz „Fleet value“.

### 5.14 Werbung und Frequent flyer (Kosten)
- **Kampagnen:** `atCost(CAMPAIGN_COST_1960[Stufe], month)` je laufendem Monat. Konstanten wie heute:
  lokal 150 000, national 400 000, global 1 000 000 (`src/lib/marketing.ts:75-77`); die eigene Teuerung
  `MARKETING_INFLATION = 0,03` in Jahresstufen entfällt (E6, R5). Wirkung: 3.9.5 und Abschnitt 6.
- **Frequent flyer:** Grundbetrag `atCost(FFP_BASE_COST_1960, month)` je Monat, solange das Programm läuft;
  dazu `ffpCostPerPassenger` je Reise in `costPerPassenger` (5.8). Konstanten wie heute
  (`src/lib/marketing.ts:187-189`): `FFP_BASE_COST_1960 = 50 000`, `FFP_COST_PER_PAX_1960 = 0,8`
  (neu mit Index, E6).
- KI: keine Werbung, kein Programm (E44, Abschnitt 7).

### 5.15 Einnahme eigener Flughäfen (Code-Name: `ownerFeeIncome`)
- Bedeutung: Wer an einem Flughafen Verwaltungsstufe 3 hat, bekommt einen Anteil der Landegebühren der
  **anderen** Gesellschaften dort.
- Formel: `ownerFeeIncome(x) = OWNER_FEE_SHARE × Σ andere Gesellschaften: landingFee × Landungen je Woche in x`
  mit **derselben** `landingFee` (5.5), die diese Gesellschaften zahlen (R6, W8; heute eigene Formel ohne
  Flugzeuggröße, Kostenindex und Nachlass, `src/lib/hubOwnership.ts:33-35`). Haben mehrere Gesellschaften
  dort Stufe 3, teilen sie sich den Anteil zu gleichen Teilen.
- Konstanten: `OWNER_FEE_SHARE = 0,5` (heute `src/lib/hubOwnership.ts:30`).
- Die zahlende Gesellschaft zahlt ihre volle Landegebühr (5.5); die Einnahme ist kein Abzug bei ihr.
- Regeln (Tests): Einnahme = 0 ohne Stufe 3; eine größere Rivalen-Maschine bringt nie weniger.

### 5.16 Kosten der Gesellschaft je Monat (Code-Name: `monthlyCosts`)
- Bedeutung: Die vollständige Liste der Kosten im Monatsergebnis. Abschnitt 8 bucht sie im Abschluss.
- Posten (Wochenwerte × `WEEKS_PER_MONTH`, E5):

  | Posten | Inhalt | Abschnitt |
  |---|---|---|
  | Fuel | Σ Strecken `fuelCost` | 5.3 |
  | Crew | Σ Strecken `crewCost` | 5.4 |
  | Landing fees | Σ Strecken `landingCost` | 5.5 |
  | Passenger fees | Σ Check-in und Abfertigung aller Fluggäste | 5.6, 5.8 |
  | Catering | Σ Verpflegung aller Fluggäste (Direkt und Umsteiger) | 5.7, 5.8 |
  | Airport upkeep | Slot-, Stand-, Schalter-Miete, Einrichtungen | 5.10, 5.11 |
  | Aircraft upkeep | Σ Flugzeuge `aircraftUpkeep` (Monatswert) | 5.12 |
  | Depreciation, Aircraft trades | −`fleetValueResult` | 5.13 |
  | Marketing | Kampagnen, FFP-Grundbetrag und FFP je Fluggast | 5.14 |
  | Abschnitt 8 | Charter-Gebühren (E32), Krisen-Antworten (E35), Zinsen der Kreditlinie (E34), Schäden aus Ereignissen | 8 |
  | − Airport income | `ownerFeeIncome` | 5.15 |

- **Monatsergebnis** = Monatserlös (4.9) − `monthlyCosts`.
- **Nicht im Ergebnis, nur in der Kasse** (Einmalausgaben, wie heute): Slot-Kauf und -Verkauf, Verwaltungs-
  stufen, Einrichtungen, Forschung (Preis aus Abschnitt 6), Übernahme (Abschnitt 7). Flugzeuge, Umbauten
  und Überholungen gehen über das Wertmodell (5.13) und zählen nur mit ihrem Unterschied zum Wert.
  Der Bericht zeigt Ergebnis und Kassen-Änderung getrennt.
- **Zurechnung (Anzeige):** Σ Strecken-Ergebnisse (5.9) + nicht zugerechnete Kosten (freie Slots, Stände,
  Schalter, Einrichtungen, Unterhalt geparkter Flugzeuge, Abschreibung aus Zustand und Käufen, Werbung,
  Abschnitt-8-Posten, − Einnahmen) = Monatsergebnis / `WEEKS_PER_MONTH` (Test).
- Regeln (Tests): kein Dollar zählt zweimal; 12 Monate gleicher Wochenkosten = Wochenkosten × 52,18 (W15);
  Planer-Strecken-Kosten = Kosten im Abschluss bei gleichem Stand (R2).

### 5.17 Gleiche Regeln für die KI (E44, E45)
- Die KI zahlt **alle** Kosten aus 5.2–5.13 und 5.15 mit denselben Funktionen: Treibstoff, Besatzung,
  Landung, Check-in, Abfertigung, Verpflegung (sie füllt jede Mahlzeit, R14), Slots, Stände, Schalter,
  Unterhalt, Abschreibung. Heute ohne Flughafen-Kosten, mit eigener Landegebühr und Rabatten (1.6 W2).
- Was bei der KI fehlt (bewusst, Abschnitt 7): Forschung (`researchCostFactor` = 1), Personal-Modell
  (`payFactor` = 1), Werbung und Frequent flyer (keine Kosten aus 5.14).
- Unterschiede zwischen Persönlichkeiten entstehen nur aus ihren Entscheidungen (Kabine, Flotte, Flughäfen),
  nicht aus Kosten-Faktoren (E45): Eine dichte Economy-Kabine hat weniger Besatzung je Sitz (5.4) und weniger
  Verpflegung; eine einheitliche Flotte weniger Wartung (5.12).
- Regel (Test): Spieler mit Lohn 100 %, ohne Forschung, Werbung und Programm hat bei gleichem Stand dieselben
  Kosten wie eine KI.

### 5.18 Beispiel
Startwerte, Januar, alle Flughäfen Größe 7 und Verwaltungsstufe 0–1, ein neues Flugzeug je Strecke (nur diese
Strecke), volle Maschine, Preis = Marktpreis (4.3) mit `satisfactionFactor` 1, Erdnüsse (0,44 $) je Mahlzeit,
kein Frequent flyer, keine Forschung. Je Woche, in $ (Hilfsskript, nicht im Projekt).

| Fall | Erlös | Kosten | Ergebnis | Treibstoff | Landung | Je Fluggast | Besatzung | Flugzeug-Anteil |
|---|---|---|---|---|---|---|---|---|
| Caravelle III, FRA–CDG 1962, 14 Umläufe, 80 Y | 138 373 | 118 610 | **+19 764** | 19 % | 38 % | 22 % (11,72 $) | 5 % | 11 % |
| ATR 72-200, FRA–CDG 1990, 14 Umläufe, 68 Y | 164 258 | 131 298 | **+32 960** | 10 % | 40 % | 24 % (16,36 $) | 8 % | 16 % |
| A320ceo, FRA–MAD 1990, 7 Umläufe, 150 Y + 12 J | 406 377 | 252 074 | **+154 303** | 20 % | 29 % | 15 % (16,36 $) | 5 % | 30 % |
| A320ceo, FRA–MAD 2020 | 581 226 | 399 516 | **+181 710** | 27 % | 26 % | 13 % (23,40 $) | 5 % | 27 % |
| A330-300, FRA–JFK 1995, 7 Umläufe, 250 Y + 30 J | 2 517 187 | 914 924 | **+1 602 263** | 53 % | 11 % | 8 % (17,89 $) | 8 % | 20 % |
| A330-300, FRA–JFK 2020 | 3 391 784 | 1 707 833 | **+1 683 952** | 66 % | 8 % | 6 % (24,10 $) | 6 % | 14 % |

Slot-Anteil jeweils 0–6 %. Lesart:
- Mit Marktpreis × Kostenindex (E7) und Treibstoff ohne Hard-Zuschlag bringt jede Länge in jedem Jahrzehnt
  bei voller Maschine Gewinn (heute 2020 beide Strecken im Minus, W1, W2). Volle Maschinen sind aber nicht
  der Normalfall; die Marge bei erwarteter Auslastung prüft das Balance-Skript (3.9).
- Langstrecke ist jetzt sehr einträglich (Ergebnis 64 % des Erlöses 1995). Grund: Der Marktpreis wächst mit
  dem Kostenindex, Treibstoff nicht im selben Maß, und `satisfactionFactor` 1 ist mit Erdnüsse auf 7 Stunden
  unrealistisch. Hinweis für 3.9: Grundpreis je km für Langstrecke und Treibstoff-Formel gemeinsam prüfen.
- Die Landegebühr bleibt auf Kurzstrecke der größte Posten (26–40 %).
- Gewinnschwelle (4.11), A320ceo FRA–MAD 1990: feste Kosten 214 965 $, je Fluggast 16,36 $ →
  Preisniveau 0,62 bei voller Maschine, 0,80 bei 75 % Auslastung.

### 5.19 Vorgaben an andere Abschnitte
- **Abschnitt 6 (Fortschritt):** Forschungs-Einsparungen je Art (5.1) und Effizienz-Punkte (5.3) als Felder je
  Forschung, Texte daraus (E52); Slot-Nachlass aus Meilensteinen als `milestoneSlotFactor` (5.10), sonst 1;
  Forschungspreise mit `atCost` (E6).
- **Abschnitt 7 (KI):** KI zahlt alle Kosten (5.17); Liste der fehlenden Teile (Forschung, Personal, Werbung,
  Frequent flyer); KI-Planung nutzt `costPerPassenger` und `fixedWeeklyCost` wie der Planer; KI kauft Slots
  und Schalter und hält die Slot-Grenze ein (5.10, E50).
- **Abschnitt 8 (Monat, Ereignisse, Flottenmarkt):**
  - bucht `monthlyCosts` (5.16) einmal im Abschluss; Kasse nach allen Buchungen (R11);
  - Händler-Spanne, Gebrauchtpreise und Vorbestellung als Preis relativ zu `aircraftValue` (5.13, E30);
  - Grundüberholung: Preis als Anteil des Listenpreises × `atCost` (E31) und so hoch, dass die Wertsteigerung
    aus 5.13 (`CONDITION_VALUE_SPAN × AIRFRAME_VALUE_SHARE` je Zustandspunkt) den Preis nie übersteigt;
  - Charter-Gebühr je Flug (E32); gecharterte und gestrichene Flüge senken `flownLegs` (5.3);
  - Krisen-Antworten als Anteil der betroffenen Kosten (z. B. Treibstoff-Rechnung, E6, E35), Preis-Absicherung (5.2);
  - Kreditlinie aus dem Flottenwert `aircraftValue` (E34), Zinsen als Kosten (5.16);
  - Verschleiß (Zustand) wirkt über `conditionFactor` auf den Wert (5.13).
- **Phase 4:** Flughafen-Ansicht, Planer, Streckendetails und Bericht lesen alle Kosten aus dem Modell (R2);
  Texte (Stundensatz, Gebühren, Nachlass, Forschung) aus den Konstanten (E52).
- **Phase 5.1:** gespeicherte Effizienz und Type appeal am Flugzeug entfallen (berechnet); Baumonat für
  Flugzeuge ohne Angabe = Kaufmonat; Kabinen-Einbaumonat = Baumonat.

### 5.20 Zuordnung der Bestandsfunde

| Fund (1.4) | Lösung in diesem Abschnitt |
|---|---|
| W1 Langstrecke verliert fast immer | 5.2 Treibstoff nur aus der Tabelle (E8); Marktpreis mit Kostenindex (4.3, E7); Beispiel 5.18; Marge im Balance-Skript (3.9) |
| W2 2020 lohnt kaum eine Strecke | wie W1; Beispiel 5.18 |
| W3 Treibstoff 2031 wie 1960 | 5.2 letzter Tabellenwert (E8) |
| W4 Krisen doppelt | 5.2 kein Ereignis-Faktor (E8) |
| W5 Fluggast-Gebühren an beiden Flughäfen | 5.6 Check-in je Reise, Abfertigung je Abflug (E27) |
| W6 Drehkreuz-Nachlass ungleich | 5.1 ein `airportFeeFactor` für alle Flughafen-Gebühren (R6) |
| W7 Abstellplätze ab Stufe 2 gratis | 5.10 bleibt, bewusst (E28) |
| W8 Einmalpreise ohne Index, KI-Landegebühr | 5.10, 5.11 `atCost` (E6); 5.15 dieselbe `landingFee` (R6) |
| W9 Hard verteuert Treibstoff der KI | 5.2 ohne Schwierigkeit (E4) |
| W10 Kosten nach Höchstsitzen | 5.3, 5.5 nach Flugzeug; 5.4 Flugbegleiter nach Kabine (R6) |
| W11 Bodenpersonal an Flugstunden | 5.6 in der Abfertigung enthalten (R6) |
| W12 Einweg zahlt zwei Landungen | 5.5 je Abschnitt eine Landung am Ziel (R6) |
| W13 Kauf nicht als Kosten | 5.13 Wertmodell, Abschreibung im Ergebnis (E29) |
| W14 Mahlzeiten in Stufen | 5.7 dieselben `mealWeight` wie 2.5 (R5) |
| W15 Jahreswerte uneinheitlich | 5.16 `WEEKS_PER_MONTH` (E5) |

Doppelte Rechnungen (Bestand 1.4) → eine Funktion im Modell (R2): Gebühren-Faktor `mods.feeFactor` und
`getFeeFactor()` → `airportFeeFactor` (5.1); Gebühren in `AirportDetailView.tsx:283-287` → 5.5, 5.6;
KI-Landegebühr `hubOwnership.ts:33-35` → 5.15; Stundensatz-Text Planer `:3476` → 5.4; Sitze für Schalter
doppelt gezählt (`:66-87`, `:162-178`) → `deskLoad` (2.6.3); Treibstoffpreis im Planer `:873-877` → 5.2.

## 6. Ruf, Rang, Fortschritt

Dieser Abschnitt legt fest, wie der Ruf einer Gesellschaft entsteht und wirkt, wie der Spieler im Rang aufsteigt
und was Forschung, Meilensteine, Jahresziel und Karriere-Punkte bringen. Grundlage: E6, E11, E19, E33, E36–E43,
E52, R10, R15, R16; Vorgaben aus 3.16 (Ruf wirkt nur über `reputationFactor`) und 5.19 (Forschungs-Felder,
`milestoneSlotFactor`, Preise mit `atCost`); Bestand: `bestand/5-ruf-fortschritt.md` (W1–W14). Alle heutigen
Fundstellen ohne Pfad liegen in `src/lib/monthClose.ts`.

**Wer was hat.** Den **Ruf** haben alle Gesellschaften, mit derselben Funktion (E44). **Rang, Forschung,
Meilensteine, Jahresziel und Karriere-Punkte** hat nur der Spieler; sie regeln, was er darf und was er
gewinnt. Die KI hat keine Freischaltungen (Abschnitt 7).

**Geld (1.3).** Jeder feste Betrag dieses Abschnitts (Forschungspreise, Prämien, Kassen-Schwellen, Mindest-Ziele)
steht als Wert von 1960 in den Konstanten und wird nur über `atCost(betrag1960, month)` umgerechnet (E6).
Die eigene Teuerung der Forschung (4 % des Werts von 1960 je Jahr, `src/lib/research.ts:196-199`) entfällt.

### 6.0 Überblick

```
Satisfaction aller Fluggäste (2.9) ─► Ruf aus Satisfaction ──┐
Gestrichene Sitze des Monats (Abschnitt 8) ─► Abzug ─────────┼─► Ruf-Ziel ─► Ruf-Änderung (je Monat, eine Funktion)
Laufende Werbekampagnen ─► Werbe-Beitrag (klein) ────────────┘                     │
                                                                                   ▼
                                       Ruf ─► reputationFactor (3.9.4): einzige Wirkung auf die Nachfrage
                                           ─► Rang-Bedingung, Meilensteine, Jahresziel, Karriere-Punkte (nur Spieler)

Rang-Werte im Mittel von 3 Monaten ─► Rang (nie Abstieg) ─► Flughäfen, Drehkreuze, Werbung, Lounge,
                                                             Forschungsplätze, Forschungsprojekte, Übernahmen
Forschung ─► Felder je Projekt ─► Kostenfaktoren (5.1), Effizienz (5.3), Satisfaction (2.6.5), Anziehung (3.9.4),
                                  Umsteiger (3.13), Anlauf (3.12), Ausfälle, Verschleiß, Wiederverkauf (8)
Meilensteine, Jahresziel ─► Geld, Slot-Nachlass, Drehkreuze (keine Ruf-Punkte, E38)
```

**Was entfällt** (gegenüber heute):
- Zustand der Flugzeuge im Ruf-Ziel (`:154`, W5): E39. Der Zustand wirkt über die Satisfaction (Kabine, 2.4)
  und über Ausfälle (Zelle, Abschnitt 8).
- Ruf-Zuschlag der Werbung **nach** dem Monatsschritt (`:606`, W1): Werbe-Beitrag im Ziel, klein (E37, 6.3).
- Alle Einmal-Sprünge (W2, E38): Meilensteine (`:650-655`), Rang-Aufstieg +3 (`:680`), Jahresziel ±
  (`:1042`), Streik −3 (`src/lib/staff.ts:177`, `src/App.tsx:457`), Ausfall bis −4
  (`src/lib/disruptions.ts:97-100`, `src/App.tsx:475-476`), Übernahme +2 (`src/App.tsx:1867`).
- Ruf-Teil des Frequent-flyer-Programms (0,3 je Monat, `src/lib/marketing.ts:190`): Das Programm wirkt nur
  über `frequentFlyerFactor` (3.9.4); es ist keine Kampagne (Lesart von E37).
- SAT-Kappe 130 im Ruf (`:153`): ganze Skala 0 … 160 (E14).
- `loadFactor` im Ruf-Ziel (`:149-150`, `:453`, `:515`, `:600`, W12): R16.

### 6.1 Ruf aus Satisfaction (Code-Name: `satisfactionReputation`)
- Bedeutung: Welchen Ruf die Fluggäste einer Gesellschaft auf Dauer verbreiten, wenn nichts anderes geschieht.
- Einheit und Bereich: Punkte 0 … 100.
- Formel (stückweise gerade, stetig bei 100):
  ```
  s ≤ 100:  satisfactionReputation = REPUTATION_NEUTRAL × s / 100
  s > 100:  satisfactionReputation = REPUTATION_NEUTRAL + (100 − REPUTATION_NEUTRAL) × (s − 100) / 60
  ```
  mit `s = airlineSatisfaction` (2.9: alle Strecken und Klassen, nach beförderten Fluggästen des Monats, E10, E39).
  Satisfaction 100 („wie erwartet“) ergibt genau den Neutralpunkt 50 (E36: Das Ruf-Ziel liegt bei üblicher
  Satisfaction um 50). Satisfaction 160 (Spitze) ergibt 100.
- Ohne Fluggäste im Monat: `airlineSatisfaction = 100` (2.9), also 50. Der Ruf läuft dann langsam zur Mitte
  (heute bleibt er stehen, `:590-603`). Wer nicht fliegt, wird vergessen, weder gelobt noch getadelt.
- Konstanten: `REPUTATION_NEUTRAL = 50` (E36). Die beiden Steigungen (0,5 je Punkt unter 100, 0,83 darüber)
  sind Startwerte; endgültig aus dem Balance-Skript (3.9).
- Regeln (Tests): `satisfactionReputation(100) = 50`; steigt mit `s` (nie fallend); stetig; Wert in 0 … 100.

### 6.2 Gestrichene Flüge (Code-Name: `cancellationPenalty`)
- Bedeutung: Die einzige Strafe für gestrichene Flüge (E33). Streik, technische Ausfälle und Ereignisse wirken
  auf den Ruf **nur** hierüber (E38).
- Formel: `cancellationPenalty = CANCELLED_REPUTATION_WEIGHT × cancelledShare`
  mit `cancelledShare = gestrichene Sitze des Monats / geplante Sitze des Monats` (alle Strecken, alle Klassen,
  Sitze × Abflüge). Welche Flüge gestrichen werden, legt Abschnitt 8 fest.
- Gecharterte Flüge (E32) gelten **nicht** als gestrichen: Die Fluggäste fliegen.
- Konstanten: `CANCELLED_REPUTATION_WEIGHT = 100` (Startwert: 1 % gestrichene Sitze senkt das Ziel um 1 Punkt).
- Regeln (Tests): keine gestrichenen Flüge → 0; mehr gestrichene Sitze → nie kleinerer Abzug; Charter → 0.

### 6.3 Werbe-Beitrag (Code-Name: `advertisingReputation`)
- Bedeutung: Werbung macht die Gesellschaft ein wenig angesehener, solange sie läuft (E37). Die Hauptwirkung der
  Werbung ist die Anziehung (3.9.5).
- Formel: `advertisingReputation = min(ADVERTISING_REPUTATION_MAX, Σ laufende Kampagnen: CAMPAIGN_REPUTATION[Stufe])`.
- Der Beitrag steht **im Ruf-Ziel** (6.4), nicht als Zuschlag danach. Darum schaukelt er sich nicht auf (heute
  Gleichgewicht = Zuschlag / 0,15, bis +15, W1) und **klingt nach Ende der Kampagne ab**: Das Ziel fällt zurück,
  der Ruf folgt mit derselben Trägheit wie bei jeder anderen Änderung (6.5; Halbwertszeit ≈ 4,3 Monate).
  Ein eigener Speicherwert ist nicht nötig.
- Konstanten (Startwerte, endgültig aus 3.9): `CAMPAIGN_REPUTATION` lokal 0,5, national 1, global 2 (Zahlen wie
  heute je Monat, `src/lib/marketing.ts:75-77`, jetzt als Punkte im Ziel); `ADVERTISING_REPUTATION_MAX = 3`.
- KI: keine Werbung (E44), Beitrag 0.
- Regeln (Tests): ohne Kampagne 0; nie über `ADVERTISING_REPUTATION_MAX`; eine laufende Kampagne hebt den Ruf im
  Gleichgewicht um höchstens ihren Beitrag (nicht um ein Vielfaches).

### 6.4 Ruf-Ziel (Code-Name: `reputationTarget`)
- Bedeutung: Wohin sich der Ruf bewegt, wenn alles so bleibt wie in diesem Monat.
- Einheit und Bereich: Punkte 0 … 100.
- Formel: `reputationTarget = kappen(satisfactionReputation − cancellationPenalty + advertisingReputation, 0, 100)`.
- Hängt ab von: 6.1–6.3. **Nicht** von Zustand der Flugzeuge (E39), Auslastung (R16), Schwierigkeit (E4),
  Rang, Meilensteinen, Jahresziel (E38).
- Regeln (Tests): mehr Satisfaction → nie niedrigeres Ziel; mehr gestrichene Sitze → nie höheres Ziel;
  Satisfaction 100, nichts gestrichen, keine Werbung → genau 50.

### 6.5 Ruf-Änderung (Code-Name: `reputationChange`)
- Bedeutung: **Die einzige Stelle, an der sich der Ruf ändert** (R10). Einmal je Monat im Abschluss.
- Formel:
  ```
  reputation(neu) = reputation + REPUTATION_STEP × (reputationTarget − reputation)
  ```
  Weil Ruf und Ziel in 0 … 100 liegen, bleibt das Ergebnis im Bereich; die Grenzen werden nur am Ziel einmal
  gesetzt (R4, W4).
- Ergebnis der Funktion: neuer Ruf, Ziel und eine **Liste der Ursachen** für die Anzeige (R10, E52):
  | Ursache | Anteil an der Änderung |
  |---|---|
  | Passenger satisfaction | `REPUTATION_STEP × (satisfactionReputation − reputation)` |
  | Cancelled flights | `−REPUTATION_STEP × cancellationPenalty` |
  | Advertising | `REPUTATION_STEP × advertisingReputation` |
  | Limit (nur wenn das Ziel gekappt wurde) | Rest bis zur Summe |
  Die Summe der Anteile = Änderung (Test).
- Konstanten: `REPUTATION_STEP = 0,15` (wie heute `REPUTATION_INERTIA`, `:143`; Halbwertszeit 4,3 Monate).
- Wirkt ab dem nächsten Monat: Nachfrage und Planer rechnen mit dem Ruf vom Monatsanfang (3.9.4).
- Spieler und KI (E44).
- Regeln (Tests):
  - Keine andere Funktion im Modell oder in der Oberfläche schreibt den Ruf (Suche nach Zuweisungen, W4).
  - Ruf bewegt sich nie über das Ziel hinaus; gleiches Ziel → Abstand schrumpft je Monat um genau 15 %.
  - Meilensteine, Rang-Aufstieg, Jahresziel, Streik-Entscheidung und Übernahme ändern den Ruf im selben Monat
    nicht (E38).

### 6.6 Wirkung und Anzeige des Rufs
- **Einzige Wirkung auf die Nachfrage:** `reputationFactor` in der Anziehung (3.9.4, 3.16), Ruf 50 = 1.
- Weitere Leser (nur Spieler, keine Rechenwirkung auf Markt, Preis oder Kosten): Rang-Bedingung (6.7),
  Meilensteine (6.10), Fokus-Ziel „Reputation“ (6.11), Karriere-Punkte (6.12), Szenario-Ziele (Abschnitt 8),
  Chronik und Zeitung (Anzeige).
- **Farbstufen** (E36) aus denselben Konstanten: „hoch“ ab `REPUTATION_NEUTRAL + REPUTATION_DISPLAY_BAND`,
  „niedrig“ bis `REPUTATION_NEUTRAL − REPUTATION_DISPLAY_BAND`, sonst neutral; `REPUTATION_DISPLAY_BAND = 10`
  (heute eigene Stufen 65 / 40, `src/components/MyCompanyView.tsx:250`).
- Anzeige: Firmen-Ansicht „Reputation“ mit Ziel, Nachfrage-Wirkung („Demand +x%“ aus `reputationFactor`) und der
  Ursachen-Liste aus 6.5; Monatsbericht.

### 6.7 Rang (Code-Name: `rank`)
- Bedeutung: Stufe der Gesellschaft des Spielers, 0 (Startup) … 9 (Global Player). Öffnet Flughäfen, Drehkreuze
  und Werkzeuge. Wird **nie verloren** (E40).
- **Rang-Werte** (Code-Name: `rankStats`): je Monat am Ende des Abschlusses gespeichert:
  | Wert | Festlegung |
  |---|---|
  | `routes` | Strecken am Monatsende |
  | `monthlyPax` | Fluggäste des Monats, jede Teilstrecke gezählt (Umsteiger doppelt, wie heute), = Fluggäste je Woche × `WEEKS_PER_MONTH` (E5) |
  | `reputation` | Ruf nach der Ruf-Änderung (6.5) |
  | `regions` | Regionen mit mindestens einem Strecken-Ende, über `regionOf` (R15) |
  | `years` | volle Jahre seit Spielstart (zählt nicht im Mittel) |
- **Prüfung** (E40): Für `routes`, `monthlyPax`, `reputation`, `regions` zählt das **Mittel der letzten 3 Monate**.
  Monate vor Spielstart zählen als 0. Rang = höchste Stufe, deren Bedingungen alle erfüllt sind, Stufen der
  Reihe nach; neuer Rang = max(alter Rang, Prüfung).
- **Eine Funktion** `rankStats` für Abschluss und Karriere-Ansicht (heute zwei Wege, `:674` und
  `src/App.tsx:794-801`).
- **Tabelle der Ränge** (Code-Name: `RANKS`, je Stufe ein Datensatz; alle Texte daraus erzeugt, E42, E52):

  | Stufe | Strecken | Fluggäste / Monat | Ruf | Regionen | Jahre | Drehkreuze | Flughafen-Größe bis | Forschungsplätze | Klassen-Forschung erscheint | Weitere Freischaltungen |
  |---|---|---|---|---|---|---|---|---|---|---|
  | 0 Startup | 0 | 0 | 0 | 0 | 0 | 1 | 4 | 2 | (Commuter offen) | lokale Werbung |
  | 1 Local | 3 | 8 000 | 30 | 1 | 0 | 1 | 5 | 2 | Regional | – |
  | 2 Regional | 6 | 25 000 | 35 | 1 | 1 | 2 | 5 | 2 | Narrowbody | Frequent flyer |
  | 3 Domestic | 12 | 70 000 | 40 | 1 | 3 | 2 | 6 | 2 | – | nationale Werbung |
  | 4 National | 24 | 170 000 | 45 | 1 | 6 | 3 | 7 | **3** | Widebody | VIP-Lounge |
  | 5 Continental | 40 | 350 000 | 50 | 2 | 10 | 4 | 7 | 3 | Jumbo, Überschall | – |
  | 6 International | 65 | 700 000 | 53 | 3 | 15 | 5 | 7 | **4** | – | globale Werbung, Übernahme in der Krise |
  | 7 Intercontinental | 95 | 1 200 000 | 56 | 4 | 22 | 6 | 7 | 4 | – | – |
  | 8 Flag Carrier | 135 | 2 000 000 | 60 | 5 | 30 | 8 | 7 | **5** | – | Verwaltungsstufe 3 |
  | 9 Global Player | 190 | 3 500 000 | 65 | 6 | 40 | 12 | 7 | 5 | – | Übernahme eines gesunden Rivalen |

  - Strecken, Fluggäste, Regionen, Jahre, Drehkreuze, Flughafen-Größen und weitere Freischaltungen wie heute
    (`src/lib/airlineRank.ts:42-103`, `:187-197`); Startwerte, endgültig aus dem Balance-Skript (3.9).
    Hinweis: Mit `WEEKS_PER_MONTH` statt 4 Wochen sind die Fluggast-Schwellen gleich hoher Nachfrage rund 9 %
    leichter erreichbar.
  - **Ruf-Schwellen neu** (heute 40 … 80): Der Neutralpunkt sinkt von 75 auf 50 (E36), und der Zustand zählt
    nicht mehr (E39). Ruf 50 heißt jetzt „Fluggäste im Mittel wie erwartet zufrieden“ (Satisfaction 100);
    Ruf 65 heißt Satisfaction ≈ 118. Die alten Werte wären mit der neuen Skala für die oberen Ränge kaum
    erreichbar.
  - **Forschungsplätze** (E42): 3 ab National (4), 4 ab International (6, wie der heutige Text dort), 5 ab Flag
    Carrier (8). Feld `researchSlots` je Rang; ersetzt `2 + abrunden(Rang / 3)` (`src/lib/research.ts:177-179`, W7).
  - **Klassen-Forschung** (E41): Ränge gesenkt, siehe 6.8.
- Free Mode: Rang 9 vom ersten Monat an, nichts gesperrt (wie heute).
- Ausnahmen beim Flughafen-Zugang wie heute (`src/lib/airportAccess.ts:31-44`): Heimat, Flughäfen mit eigener
  Verwaltungsstufe ≥ 1, Enden bestehender Strecken.
- Rang-Aufstieg: Meldung mit den Freischaltungen aus der Tabelle; **keine Ruf-Punkte** (E38), kein Geld.
- Schwierigkeit: wirkt hier nicht (E4, 1.8, W13); Hard macht den Aufstieg nur über weniger Fluggäste schwerer.
- Fortschrittsbalken: Mittel der Anteile (Mittelwert / Schwelle, je höchstens 1) über die Bedingungen > 0, aus
  denselben 3-Monats-Mitteln wie die Prüfung (heute aus einem Monat, `src/lib/airlineRank.ts:166-182`).
- Regeln (Tests):
  - Ein einzelner starker Monat zwischen zwei schwachen hebt den Rang nicht, wenn das Mittel nicht reicht (W6).
  - Rang sinkt nie, auch wenn die Werte fallen.
  - Forschungsplätze, Drehkreuze und Texte der Rang-Meldung stammen aus demselben Datensatz (W7).
  - Jede Stufe verlangt in jeder Spalte mindestens so viel wie die Stufe davor.

### 6.8 Flugzeugklassen und Erreichbarkeit (E41)
- Klassen wie heute (`src/lib/aircraftClasses.ts:48-58`): Commuter (bis 60 Sitze, offen), Regional, Narrowbody,
  Widebody, Jumbo (über 500 Sitze), Überschall (über 1 000 km/h). Eine Klasse ist offen, wenn ihre Forschung
  fertig ist; Klassen der eigenen Flotte bleiben offen; Free Mode: alle.
- Klassen-Projekte (Startwerte; Preis in $ von 1960 über `atCost`):

  | Projekt | Erscheint ab Rang (heute) | Braucht (heute) | Dauer | Preis 1960 (heute) |
  |---|---|---|---|---|
  | Regional | 1 (1) | – | 6 Monate | 3 Mio. $ (3) |
  | Narrowbody | **2** (3) | Regional | 9 Monate | 12 Mio. $ (12) |
  | Widebody | **4** (5) | Narrowbody | 12 Monate | **40** Mio. $ (60) |
  | Jumbo | **5** (7) | Widebody | 18 Monate | **80** Mio. $ (200) |
  | Überschall | **5** (8) | **Widebody** (Jumbo) | 24 Monate | **60** Mio. $ (500) |

  - Überschall braucht Widebody statt Jumbo: So liegen beide Projekte auf Rang 5 nebeneinander, und die
    Concorde (Narrowbody-Rumpf) hängt nicht an der 747.
  - Preise gesenkt, damit die Klasse im Zeitraum auch bezahlbar ist: 500 Mio. $ von 1960 sind für eine
    Gesellschaft auf Rang 5 um 1975 mehrere Jahresergebnisse (Prüfregel unten).
- **Prüfung der Erreichbarkeit** (Start Januar 1960, schnellster Weg; Rang frühestens nach den Jahren der Tabelle):

  | Klasse | Rang erreicht frühestens | Forschung fertig frühestens | Lieferzeitraum (Daten) | Spielraum |
  |---|---|---|---|---|
  | Regional | Rang 1: April 1960 (3-Monats-Mittel) | Okt. 1960 | ab 1960 | offen |
  | Narrowbody | Rang 2: Jan. 1961 | Okt. 1961 | ab 1960 (707) | offen |
  | Widebody | Rang 4: Jan. 1966 | Jan. 1967 | ab Mitte 1971 (DC-10) | offen |
  | Jumbo | Rang 5: Jan. 1970 | Juli 1971 | ab 1970 (747-100), bis heute | offen |
  | Überschall | Rang 5: Jan. 1970 | Jan. 1972 | Concorde 1976,0 bis 1980,4 | Rang 5 bis spätestens Juni 1978 (Forschung muss bis Monat 221 starten) |

  Lieferzeiträume aus `src/data/aircraft.ts` (`firstDeliveryOffset`, `lastDeliveryOffset`), ausgewertet mit
  `classOfAircraft` (Hilfsskript, nicht im Projekt). Für die Concorde bleiben rund 8,4 Jahre Spielraum (Januar 1970 bis Juni 1978).
- Spielstart nach 1960 oder Szenario: Klassen-Projekte bis zum Startrang gelten als fertig (wie heute,
  `src/lib/research.ts:191-193`).
- Regeln (Tests):
  - Für jede Klasse gilt: Jahre-Bedingung ihres Rangs + Dauer aller nötigen Projekte (nacheinander) <
    letzter Liefermonat der Klasse (bei Start 1960).
  - Balance-Skript (3.9) prüft: Eine Gesellschaft, die die Bedingungen des Rangs gerade erfüllt, bezahlt die
    Klassen-Forschung dieses Rangs aus höchstens 12 Monatsergebnissen (5.16).

### 6.9 Forschung (Code-Name: `research`)
- Bedeutung: Projekte, die einmal Geld und einige Monate kosten und danach dauerhaft wirken.
- **Projekte**: 45 wie heute (`src/lib/research.ts:100-164`): 5 Klassen-Projekte (6.8), 40 Bonus-Projekte.
  Ränge und Ketten der Bonus-Projekte wie heute.
- **Preis**: `researchPrice(project, month) = atCost(RESEARCH_PRICE_1960[project], month)`, bezahlt beim Start
  (Kasse, nicht im Monatsergebnis, 5.16). Bonus-Projekte ohne eigenen Preis:
  `RESEARCH_PRICE_1960 = (1,2 + 1,3 × Rang) Mio. $` (wie heute, `src/lib/research.ts:80-89`), ungerundet (R4).
- **Dauer**: wie heute; Bonus-Projekte ohne eigene Dauer `3 + aufrunden(Rang / 2)` Monate. Fertig, wenn zu
  Monatsbeginn die Monate seit Start ≥ Dauer (wie heute, `src/lib/research.ts:312-323`).
- **Start-Sperre** wie heute (`src/lib/research.ts:286-298`): fertig, läuft schon, Rang zu klein, Vorgänger fehlt,
  alle Plätze belegt (`researchSlots`, 6.7), zu wenig Geld (Preis des aktuellen Monats).
- **Wirkungen als Felder je Projekt** (5.19). Jedes Feld wirkt an genau einer Stelle; der Text des Projekts wird
  aus den Feldern erzeugt (E52):

  | Feld | Einheit | Projekte (Werte wie heute) | Zusammenfassen | Wirkt in |
  |---|---|---|---|---|
  | `costSaving.fuel` | Anteil | fuel-1 0,03 · fuel-2 0,03 · fuel-3 0,01 | `researchCostFactor` = max(0,4; 1 − Σ) | 5.1 → 5.2 |
  | `costSaving.crew` | Anteil | crew-1 … crew-3 je 0,01 | wie oben | 5.1 → 5.4 |
  | `costSaving.fees` | Anteil | fees-1 … fees-3 je 0,01 | wie oben | 5.1 `airportFeeFactor` |
  | `costSaving.catering` | Anteil | catering-1, catering-2 je 0,02 | wie oben | 5.1 → 5.7 |
  | `costSaving.maintenance` | Anteil | maint-1 … maint-4 je 0,01 | wie oben | 5.1 → 5.12 |
  | `costSaving.slots` | Anteil | slots 0,08 | wie oben | 5.1 → 5.10 |
  | `efficiencyPoints` | Punkte | eff-1 … eff-6 je 1 | Summe | 5.3 |
  | `satisfactionPoints` | Punkte | sat-1 … sat-6 je 1 (E19), cabin 2 | Summe | 2.6.5 |
  | `demandFactor` | Faktor | yield-1 1,015 · yield-2 1,025 · yield-3 1,01 | Produkt | 3.9.4 `researchDemandFactor` |
  | `hubQualityFactor` | Faktor | alliance 1,1 | Produkt | 3.13 `hubQuality` |
  | `rampBonus` | Anteil | planning 0,15 | Summe | 3.12 `RAMP_RESEARCH_BONUS` |
  | `defectSaving` | Anteil | maintenance 0,3 | max(0,4; 1 − Σ) | Abschnitt 8 (Ausfälle) |
  | `wearSaving` | Anteil | wear-1, wear-2 je 0,03 | max(0,4; 1 − Σ) | Abschnitt 8 (Verschleiß) |
  | `resaleBonus` | Anteil | resale-1 0,01 · resale-2 0,015 | Summe | Abschnitt 8 (Verkaufserlös) |
  | `moralePoints` | Punkte | academy 5 | Summe | Moral (2.6.4; Personal in Abschnitt 8) |

  - Die Stufen „Plane type satisfaction“ (sat-1 … sat-6) heißen neu z. B. „Satisfaction +1 in every cabin class“
    und wirken als Satisfaction-Punkte, nicht mehr auf Type appeal (E19, 2.2, 2.6.5).
  - „Aircraft efficiency +1 point“ statt „+1%“ (W12).
- KI: forscht nicht (Abschnitt 7); alle Felder neutral.
- Regeln (Tests): ohne fertige Projekte ist jede Wirkung neutral; ein weiteres fertiges Projekt verschlechtert nie
  etwas; jeder Kostenfaktor ≥ 0,4; Preis 2020 = Preis 1960 × `costIndex` 2020 (W9); jeder Projekt-Text enthält die
  Zahl aus seinem Feld.
- Anzeige: Karriere > Development mit Preis des aktuellen Monats, Dauer, Plätzen „belegt / Rang-Grenze“.

### 6.10 Meilensteine (Code-Name: `milestones`)
- Bedeutung: Einmalige Auszeichnungen, im Abschluss geprüft, je einmal vergeben (wie heute, 31 Stück in Spuren
  Bronze / Silber / Gold und Sonderleistungen, `src/lib/milestones.ts:85-134`).
- **Belohnung** nur in Geld und Freischaltungen (E38), **ohne Ruf-Punkte**:
  | Stufe | Prämie (Wert 1960, über `atCost`) | Slot-Nachlass | Drehkreuze |
  |---|---|---|---|
  | Bronze | 0,5 Mio. $ | – | – |
  | Silber | 3 Mio. $ | 2 % | – |
  | Gold | 15 Mio. $ | 3 % | einzelne +1 (wie heute) |
  | Sonderleistung | 2 Mio. $ | 1 % | „Empire builder“ +1 (wie heute) |

  Die heutigen Ruf-Werte je Stufe und die Sonder-Ruf-Werte (z. B. Überschall +8, `src/lib/milestones.ts:68-73`,
  `:129-133`) entfallen. Die Prämie geht in die Kasse, nicht ins Monatsergebnis (wie Einmalbeträge in 5.16), damit
  Gewinnserie und Jahresziel nur den Flugbetrieb messen.
- **Slot-Nachlass** (Code-Name: `milestoneSlotFactor`, Vorgabe 5.19):
  `milestoneSlotFactor = 1 − min(MILESTONE_SLOT_DISCOUNT_MAX, Σ Slot-Nachlässe der erreichten Meilensteine)`;
  `MILESTONE_SLOT_DISCOUNT_MAX = 0,3` (heute `src/lib/milestones.ts:137`). Wirkt nur im Slot-Kaufpreis (5.10).
- **Schwellen** wie heute, mit diesen Änderungen:
  - Kassen-Meilensteine: Kasse am Monatsende (R11) ≥ `atCost(100 Mio. / 1 Mrd. / 10 Mrd. $)` (E6, W9).
  - Ruf-Meilensteine: Ruf ≥ 60 / 70 / 80 (heute 60 / 80 / 95). Neue Skala (E36, 6.7): 60 = Satisfaction ≈ 112,
    80 = Satisfaction 136; 95 wäre nur mit Satisfaction ≈ 154 erreichbar. Texte „Reputation 60 or more“ (heute
    „above“, prüft aber ≥, W12).
  - „Kontinente“ → „Regionen“ über `regionOf` (R15, W11): 2 / 4 / 6 Regionen.
  - Gewinnserie: Monat mit Monatsergebnis (5.16) > 0 → +1; Verlust → 0; ohne Strecken unverändert (wie heute `:611`).
- Prüfreihenfolge: nach Ruf-Änderung und Monatsergebnis; Meilensteine ändern weder Ruf noch Rang-Werte, die
  Reihenfolge zu 6.7 ist daher gleichgültig.
- Regeln (Tests): jeder Meilenstein höchstens einmal; keine Ruf-Änderung durch Meilensteine;
  `milestoneSlotFactor` in 0,7 … 1; Prämie im Jahr 2020 = Wert 1960 × `costIndex` 2020.
- Anzeige: Karriere > Milestones; Texte und Prämien aus den Konstanten (E52).

### 6.11 Jahresziel (Code-Name: `annualGoal`)
- Bedeutung: Jeden Dezember bietet der Vorstand drei Ziele für das neue Jahr an: ein sicheres Gewinnziel, ein
  Ziel anderer Art, ein hohes Gewinnziel (wie heute, `src/lib/annualGoals.ts:115-121`). Ohne Wahl gilt im Januar
  das sichere.
- **Bezugsgröße** (R15: aus Vorjahr und Größe):
  ```
  goalBase = max(Vorjahresergebnis, GOAL_MIN_MARGIN × Vorjahreserlös, atCost(GOAL_PROFIT_FLOOR_1960))
  ```
  Vorjahresergebnis = Σ Monatsergebnisse (5.16), Vorjahreserlös = Σ Monatserlöse (4.9).
  Nach einem Verlustjahr zählt die Größe (Mindest-Marge auf den Erlös), nicht mehr der feste Mindestwert (W10).
- **Ziele**:
  - sicher: Gewinn ≥ `GOAL_STEADY_FACTOR × goalBase`;
  - hoch: Gewinn ≥ `GOAL_STRETCH_FACTOR × goalBase`;
  - andere Art, reihum nach Jahreszahl wie heute (`src/lib/annualGoals.ts:81-107`): Strecken + max(3, 20 %),
    Regionen + 1 (über `regionOf`), Ruf + 6 (höchstens 90), Fluggäste × 1,2, kein Verlustmonat.
  - Das Ziel wird beim Angebot **einmal** auf eine glatte Zahl gesetzt und so gespeichert (wie heute
    `niceDollars`); es ist ein fester Wert wie ein eingestellter Preis, keine Zwischenrechnung (R4).
- **Belohnung** nur in Geld (E38): `Prämie = max(atCost(GOAL_MIN_REWARD_1960), GOAL_REWARD_SHARE[Art] × goalBase)`,
  ungerundet (heute auf 50 000 $ gerundet, beim sicheren Ziel oft 0, W10). In die Kasse, nicht ins Monatsergebnis.
- **Verfehlt**: keine Strafe (E38 nimmt den Ruf-Abzug weg; vorläufig nach Empfehlung zu O55). Das Wagnis liegt in
  der Wahl: Das hohe Ziel zahlt mehr, wird aber seltener erreicht.
- **Messung** im Dezember-Abschluss: Gewinn und Fluggäste aus den Monatsberichten des Jahres; Strecken, Regionen,
  Ruf nach der Ruf-Änderung des Dezembers (es gibt keine Dezember-Boni mehr, W2). Eine Funktion
  `yearSnapshot` für Abschluss und Fortschrittsbalken.
- Konstanten (Startwerte, endgültig aus 3.9): `GOAL_MIN_MARGIN = 0,05`; `GOAL_PROFIT_FLOOR_1960 = 2 000 000`;
  `GOAL_STEADY_FACTOR = 1,1`, `GOAL_STRETCH_FACTOR = 1,35` (wie heute); `GOAL_REWARD_SHARE` sicher 0,02 · andere
  Art 0,03 · hoch 0,05; `GOAL_MIN_REWARD_1960 = 250 000`.
- Regeln (Tests): Ziel nach einem Verlustjahr hängt vom Vorjahreserlös ab; Prämie nie unter dem Mindestbetrag;
  hohes Ziel ≥ sicheres Ziel und hohe Prämie ≥ sichere Prämie; kein Ziel ändert den Ruf.

### 6.12 Karriere-Punkte und Ruhmeshallen (Code-Name: `careerScore`)
- Bedeutung: Bewertung einer Laufbahn beim Ruhestand (E43). Richtung: Vermögen und Rang zählen am meisten,
  Forschung weniger.
- Formel (Summe ungerundet, Anzeige ganze Punkte):

  | Teil | Formel | Heute (`src/lib/careerScore.ts:39-54`) |
  |---|---|---|
  | Vermögen | `150 × log10(max(1, companyValue / atCost(1 Mio. $)))` | 100 × log10(nominal in Mio. $) |
  | Rang | 80 × Rang (nur Normal) | gleich |
  | Meilensteine | 10 je Meilenstein | gleich |
  | Ruf | 2 × Ruf | gleich |
  | Übernahmen | 25 je Übernahme | gleich |
  | Forschung | **5** je fertiges **Bonus**-Projekt (Klassen zählen nicht) | 15 je Projekt |
  | Jahre | 5 je volles Jahr, höchstens 60 | gleich |

  - `companyValue` = Unternehmenswert wie bei der Übernahme (E48): Kasse + Σ `aircraftValue` (5.13) + Wert der
    Slots (Verkaufswert, 5.10). Durch `atCost` bekommt ein späterer Start für dieselbe Leistung nicht mehr Punkte (W9).
  - Klassen-Projekte zählen nicht, weil sie im Free Mode offen sind und im Normal Mode schon im Rang stecken.
- **Zwei Ruhmeshallen** (E43): getrennt für Normal und Free Mode, je die besten 10 (`HALL_SIZE`). Einträge ohne
  Angabe gehören zu Normal (wie heute, `src/lib/careerScore.ts:98`).
- Szenario-Sterne unverändert (`src/lib/careerScore.ts:114-118`).
- Regeln (Tests): mehr Vermögen, höherer Rang, mehr Meilensteine → nie weniger Punkte; Forschung bringt höchstens
  200 Punkte (heute bis 675); gleiche Leistung 1960 und 1990 gestartet → gleiche Vermögens-Punkte bei gleichem
  `companyValue / costIndex`; ein Free-Eintrag erscheint nie in der Normal-Halle.

### 6.13 Startwerte (E11)
- `START_REPUTATION = 50` für Spieler und KI (E36; heute Spieler 50, KI rechnet immer neutral).
- Startrang: Normal 0 oder die Untergrenze des Szenarios; Free Mode 9 (wie heute).
- Start-Forschung: Klassen-Projekte bis zum Startrang fertig (6.8); sonst nichts.
- Keine Meilensteine, kein Jahresziel im ersten Jahr (das erste Angebot kommt im ersten Dezember).
- Rang-Werte vor Spielstart: 0 (6.7).

### 6.14 Beispiel
Ruf-Ziel aus Satisfaction (6.1), ohne gestrichene Flüge und Werbung:

| Airline satisfaction | 50 | 80 | 90 | 100 | 110 | 120 | 130 | 145 | 160 |
|---|---|---|---|---|---|---|---|---|---|
| Ruf-Ziel | 25 | 40 | 45 | **50** | 58,3 | 66,7 | 75 | 87,5 | 100 |
| `reputationFactor` (3.9.4) | 0,95 | 0,98 | 0,99 | 1 | 1,017 | 1,033 | 1,05 | 1,075 | 1,10 |

- Weg zum Ziel (Start 50, Satisfaction 120, Ziel 66,7): nach 1 Monat 52,5 · 3: 56,4 · 6: 60,4 · 12: 64,3 · 24: 66,3.
- Globale Kampagne (Beitrag 2) bei Satisfaction 100: nach 12 Monaten Ruf 51,7; 6 Monate nach dem Ende 50,6;
  12 Monate danach 50,2 (heute dauerhaft +13,3).
- Ruf 60 im Gleichgewicht, ein Monat mit 10 % gestrichenen Sitzen: Ziel 50 → Ruf 58,5; danach 1 Monat 58,7 ·
  3: 59,1 · 6: 59,4.
- Karriere (60 Jahre, Unternehmenswert 5 000 Mio. $ von 1960, Rang 9, 25 Meilensteine, Ruf 70, 2 Übernahmen,
  40 Bonus-Projekte): Vermögen 555 + Rang 720 + Meilensteine 250 + Ruf 140 + Übernahmen 50 + Forschung 200 +
  Jahre 300 = **2 215**. Forschung 9 % der Summe (heute 25 %, W14).

(Hilfsskript, nicht im Projekt.)

### 6.15 Vorgaben an andere Abschnitte
- **Abschnitt 7 (KI):** KI hat Ruf mit `reputationChange` (6.5), Start 50, Werbe-Beitrag 0; `airlineSatisfaction`
  aus ihren eigenen Strecken (E44). KI hat keinen Rang, keine Forschung, keine Meilensteine, kein Jahresziel;
  Abschnitt 7 legt fest, ob für die KI Klassen- oder Flughafen-Sperren gelten. Übernahmen: Rang 6 (in der Krise)
  und 9 (gesund) wie in 6.7; Preis über denselben Unternehmenswert wie `companyValue` (6.12, E48).
- **Abschnitt 8 (Monat, Ereignisse):**
  - Reihenfolge im Abschluss: Forschung fertig zu Monatsbeginn (6.9); nach Erlös und Kosten: Ruf-Änderung (6.5),
    Meilensteine (6.10), Rang-Werte speichern und Rang prüfen (6.7); im Dezember Jahresziel messen und neues
    Angebot (6.11).
  - `cancelledShare` des Monats liefern (gestrichene und geplante Sitze); Streik, technische Ausfälle und Ereignisse
    ändern den Ruf nur darüber (E33, E38); Charter zählt nicht als gestrichen (E32).
  - Prämien aus Meilensteinen und Jahresziel in die Kasse, nicht ins Monatsergebnis (R11).
  - Felder `defectSaving`, `wearSaving`, `resaleBonus`, `moralePoints` (6.9) dort anwenden.
  - Szenario-Ziele mit Ruf auf die neue Skala setzen: „Reputation of 60 or more“ (`src/data/scenarios.ts:176`)
    → Startwert 55; prüfen im Balance-Skript (3.9).
- **Balance-Skript (3.9):** Ruf-Steigungen (6.1), `CANCELLED_REPUTATION_WEIGHT`, Werbe-Beitrag, Ruf-Schwellen der
  Ränge, Preise der Klassen-Forschung (Prüfregel 6.8), Ziel- und Prämien-Anteile (6.11).
- **Phase 4:** Ruf-Aufschlüsselung (6.5), Farbstufen (6.6), Rang-Tabelle, Forschungs- und Meilenstein-Texte aus den
  Feldern (E42, E52).
- **Phase 5.1 (Spielstand):** Ruf übernehmen (er läuft zum neuen Ziel); Rang bleibt; Rang-Werte der letzten 3 Monate
  aus den Monatsberichten, sonst der aktuelle Stand für alle 3 Monate; fertige Projekte bleiben (auch Überschall
  ohne Jumbo); erreichte Meilensteine bleiben; Ruhmeshalle nach `mode` in zwei Listen teilen; ein laufendes
  Jahresziel behält sein Ziel, Prämie nach 6.11, keine Strafe.

### 6.16 Zuordnung der Bestandsfunde

| Fund (1.5) | Lösung in diesem Abschnitt |
|---|---|
| W1 Werbung kauft Ruf dauerhaft | 6.3 kleiner Beitrag im Ziel, höchstens 3, klingt nach dem Ende ab (E37) |
| W2 Einmal-Boni verfliegen | keine Einmal-Sprünge; Belohnungen in Geld und Freischaltungen: 6.5, 6.7, 6.10, 6.11 (E38) |
| W3 Start-Ruf und Neutralpunkt | 6.1 Satisfaction 100 → Ruf 50; 6.6 Farbstufen aus `REPUTATION_NEUTRAL`; 6.13 Start 50 (E36) |
| W4 Ruf an neun Stellen | 6.5 eine Funktion mit Ursachen-Liste, Grenzen einmal (R10) |
| W5 Zustand im Ruf | 6.4 Zustand zählt nicht mehr (E39) |
| W6 Rang an einem Monat | 6.7 Mittel der letzten 3 Monate, nie Abstieg (E40) |
| W7 Texte zu Forschungsplätzen | 6.7 Feld `researchSlots` je Rang, Texte daraus: 3 / 4 / 5 ab Rang 4 / 6 / 8 (E42) |
| W8 Überschall kaum erreichbar | 6.8 Rang 5, Voraussetzung Widebody, Preis gesenkt; Prüfung der Erreichbarkeit (E41) |
| W9 Feste Dollar-Beträge | `atCost` für Forschung (6.9), Prämien und Kassen-Schwellen (6.10), Ziele (6.11), Vermögens-Punkte (6.12) (E6) |
| W10 Stetiges Ziel ohne Geld | 6.11 Bezugsgröße aus Vorjahr und Erlös, Mindest-Prämie (R15) |
| W11 Zwei Erdteil-Einteilungen | 6.7, 6.10, 6.11 überall `regionOf` (R15) |
| W12 Texte weichen ab | 6.9 „+1 point“, 6.10 „or more“; alle Texte aus Konstanten (E52); `loadFactor` entfernt (R16) |
| W13 Schwierigkeit wirkt hier nicht | bleibt so (E4, 1.8); 6.7 |
| W14 Karriere-Punkte | 6.12 zwei Ruhmeshallen, Forschung 5 statt 15, Vermögen mit Kostenindex (E43) |

Doppelte Rechnungen (Bestand 1.5) → eine Funktion im Modell (R2): Rang-Werte (`:674` und `src/App.tsx:794-801`)
→ `rankStats` (6.7); Jahres-Stand (`:1022-1026` und `src/App.tsx:823-827`) → `yearSnapshot` (6.11);
`continentOf` / `regionOf` → `regionOf`; Ruf-Grenzen an acht Stellen → 6.5; Farbstufen der Firmen-Ansicht → 6.6.

## 7. Konkurrenz

_(offen)_

## 8. Monatsabschluss und Ereignisse

_(offen)_
