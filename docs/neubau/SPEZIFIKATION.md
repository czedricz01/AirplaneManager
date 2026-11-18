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

_(offen)_

## 6. Ruf, Rang, Fortschritt

_(offen)_

## 7. Konkurrenz

_(offen)_

## 8. Monatsabschluss und Ereignisse

_(offen)_
