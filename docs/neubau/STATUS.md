# Status

**Nächstes Paket: 5.1** – Spielstand-Umwandlung: `src/lib/saveMigration.ts` auf eine neue Version heben und die gesammelten
5.1-Punkte erledigen (alte Felder an Strecken entfernen, Welt-Zustand beim Verkauf vor dem ersten Abschluss, Kabine
weiterverkaufter Flugzeuge, Service-Auswahl „general“, Schalter alter Spielstände u. a.). Phase 4 ist damit abgeschlossen. Zu lesen:
`src/lib/saveMigration.ts` und die Punkte „5.1“ in den Absätzen „Offen aus …“ unten (4.7a (3), 4.6b (1)–(2), 4.6a (2), 4.5c (3),
4.5b (3), 4.4 (1), 4.3 (4), 4.2d (5), 4.2c (6), (7), 3.8b, 3.8d).

**Offene Frage O70** (kein Blocker für 5.1): Personalstreik ohne Strecken; siehe `ENTSCHEIDUNGEN.md`, Abschnitt „Offen“.

Stand: 23.11.2026 · Paket 4.8 erledigt (F71): Werbe- und Personal-Ansicht rechnen mit dem Modell. Werbung
(`src/lib/modelMarketing.ts`): Kampagnenpreis `campaignCost` mit Kostenindex statt eigener Teuerung 3 %/Jahr (national 1995
$607 265 statt $1 125 545), Laufzeit-Preis je Monat zu seinem Index, Werbe-Faktor je Region `advertisingRegionFactor`, Ruf aus Werbung
als Punkte im Ruf-Ziel (`advertisingReputation`, höchstens 3; das Programm bringt keinen Ruf mehr), Treue-Zuschlag
`frequentFlyerFactor` für alle Flüge. Personal (`src/lib/modelStaff.ts`): Vorschau wie der Übergang zu X+1 (`moraleTarget`,
`nextMorale`, `strikeChance` nur bei offenem Pech-Deckel), Lohn-Grenzen und Streik über die Modell-Funktionen, Streik-Frage ohne den
Ruf-Abzug (E38), „Crew this month“ statt „Crew & ground staff“. 17 neue Tests (1474 grün). Im Browser geprüft (neues Spiel AAL 01/1960):
Werbung „Campaign in Europe“ National $400 000/Monat, 6 Monate $2 405 975, „+1 reputation target“; nach Start einer lokalen Kampagne
„Marketing this month $150,000“, „Reputation from advertising +0.5 · +0.08 this month“, Europa +5 %; Personal „Morale 70 · 66 next month ·
target 50“, „Crew this month $0“, Satisfaction +2.0.

Offen aus 4.8 (kein Blocker): (1) O70: Das Modell würfelt einen Personalstreik auch ohne Strecken (die alte Regel nicht); die Ansicht
zeigt die Chance des Modells. (2) Die Vorschau nimmt an, dass die Gewinnserie weiterläuft (das Ergebnis steht erst am Monatsende fest);
bei einem Verlust nach mehr als 6 Gewinnmonaten liegt das Ziel 5 Punkte tiefer als gezeigt. (3) Die Streik-Chance ist eine Obergrenze:
Ein Zufallsereignis oder eine Störung im selben Übergang kann den Pech-Deckel noch schließen (8.8). (4) 5.2: In `src/lib/marketing.ts`
`campaignMonthlyCost`, `campaignTotalCost`, `marketingInflation`, `MARKETING_INFLATION`, `regionDemandFactors`, `ffpLoyaltyBonus`,
`ffpMonthlyCost`, `marketingMonthCost`, `marketingReputation`, `FFP_*`, `demandBoost` / `baseMonthlyCost` / `reputationPerMonth` in
`CAMPAIGN_SPECS`, `isCampaignActive`, `campaignMonthsLeft`, `dropExpiredCampaigns`; in `src/lib/staff.ts` alles außer den Antwort-Kennungen
(`advanceStaff`, `staffOutlook`, `buildStrikeDecision`, `targetMorale`, `stepMorale`, `moraleSatDelta`, `settleStrikeWithPayRise`, `setSalary`,
`crewCostFactor`, `labourMarketPremium`, Konstanten) haben nur noch den alten Abschluss, `buildPlayerModifiers` und `malus.ts` als Nutzer;
ebenso `moraleBonus` in `src/lib/research.ts`. (5) 5.3: Kampagnen werden mit dem Kostenindex über die Jahre deutlich billiger als bisher
(2015 national $770 882 statt $2 032 859) – Höhe mit dem Balance-Skript ansehen. (6) Frequent flyer starten und eine Kampagne in einem
späten Jahr sind mit Tests geprüft, im Browser nicht geklickt (Rang-Sperre im neuen Spiel).

Stand: 23.11.2026 · O69 entschieden (E73, Weg A) und umgesetzt (F70): Die Krisen-Antwort bleibt ohne Bezugsgröße gesperrt; ihr
Preis rechnet mit der Restdauer im Monat der Wahl (`remainingEventMonths`, `crisisResponsePrice(event, base, month)` in
`src/model/monthEvents.ts`; Band und Frage über `src/lib/modelEvents.ts` mit dem laufenden Monat). Spezifikation 8.5 nachgezogen.
2 neue Tests (1457 grün). Im Browser nicht geprüft (eine Krise mit Flügen vor ihrem Beginn wäre nötig, siehe 4.7c (1)).

Stand: 23.11.2026 · Paket 4.7c erledigt (F69): Planer Schritt 1 und Ereignis-Band laufen über das Modell; die Krisen-Frage nimmt
den Preis des Modells. Das Modell liefert den Markt eines Paars (`pairMarket`, `src/model/monthClose.ts`; `routeMarket` in
`src/lib/modelRoute.ts`), dieselbe Paar-Rechnung wie `monthOperations`. Planer: „/ WK MARKET“ = Marktgröße, Debug nur mit Werten
des Modells. Band: `eventBand` (`src/lib/modelEvents.ts`) aus `activeWorldEvents` mit Texten aus den Modell-Daten. Krisen-Frage: Preis
als Anteil der Treibstoff-Rechnung bzw. des Erlöses des letzten Berichts (8.5) statt fester 3–6 Mio. $; ohne Bezugsgröße gesperrt
(O69). 17 neue Tests (1455 grün). Im Browser geprüft (freies Spiel, Hub AAL, Start 10/1973, Debug an): Band „1973 Oil Crisis · 18
months left · Decision pending · PAX: −10 %“; Frage beim Start und nach einem Monat ohne Flüge „Hedge fuel … Priced after a month of
flying“ (gesperrt), „Ride it out · No cost“; Planer AAL–FRA „2,128 / WK MARKET“, Debug mit Entfernung 789 km, Bezugs-Flugzeit 70 min,
Ereignisse 0,90, je Klasse Fluggäste und Marktpreis (Economy 1 827 / $85 … First 29 / $284).

Offen aus 4.7c (kein Blocker): (1) Eine Krisen-Frage mit Preis (Monat mit Flügen in einer Krise) ist mit Tests geprüft, im Browser
nicht geklickt (dafür bräuchte es Flugzeug und Strecke vor 10/1973). (2) erledigt: O69 → E73 (F70). (3) Die
Erklärungen der Antworten („Recovers roughly 40% of the demand you would otherwise lose“) beschreiben den Anteil `r`; im Modell wirkt
er auf die Anziehung und holt etwas weniger zurück (8.5 Hinweis). Spezifikation 8.5 verlangt die Wirkung „in Zahlen aus dem Modell“ –
mit 5.2 nachziehen. (4) 5.2: `calculateDemand`, `calculateBasePrices`, `eventRegionalFactor`, `routeDemandFactor`,
`getFlightTimeClass` haben in den Ansichten keine Nutzer mehr (nur alte KI, alter Abschluss, `transferUtils`, `saveMigration`);
`getActiveEvents` in `App.tsx` nur noch für den gesicherten Treibstoffpreis und die Frage beim Spielstart, die Kosten der Antworten in
`src/lib/eventSystem.ts` (`cost`) nur noch als Platzhalter. (5) Die Marktgröße im Planer hängt nicht mehr vom Flugzeug ab; die Ziel-Liste
in Schritt 1 sortiert weiter nach Tourismus / Geschäft der Flughäfen (`getAirportStats`, Anzeige T / B), nicht nach Marktgröße.

Offen aus 4.7b (kein Blocker): (1) 5.2: `computeNetworkFinancials` und `src/lib/transferUtils.ts` (nur noch alter Abschluss und
Planer-Kommentar `RoutePlannerView.tsx:942`), `ffpMonthlyCost` und der FFP-Teil von `marketingMonthCost` (nur noch alter Abschluss), Feld
`aggression` an `AiAirline` und `AGGRESSION` / `SALE_TO_LIQUIDATION_MONTHS` in `src/lib/aiSimulation.ts` (alte KI) entfernen. (2) Die
Live-Karte (W7) ist mit Typprüfung und dem Test der Zahlen (`routesThisMonth`) geprüft, im Browser nicht: Flugzeuge erscheinen nur, während
sie fliegen, und ließen sich im Test-Browser nicht zuverlässig anklicken. (3) erledigt in 4.8 („Crew this month“). (4) Flughafen-Ansicht zeigt Umsteiger je
Woche, die Chronik („First transfer hub: x passengers …“) je Monat (wie der Bericht `transferPax`); bisher zeigte die Chronik Wochenwerte.
(5) Der Steckbrief „Cabin plan“ beschreibt die Einrichtung neuer Flugzeuge nach der Persönlichkeit; Commuter- und Regional-Flugzeuge
bekommen nur Economy (7.5), auch wenn dort mehr Klassen stehen. (6) Die Konkurrenz-Ansicht zeigt weiter „AI results include a fixed
operating subsidy“ (`aiMonthlySubsidy`, alt; 5.2 entfernt die Zeile, siehe 3.9e).

Offen aus 4.7a (kein Blocker): (1) erledigt in 4.7c (Band aus `eventBand`, Krisen-Frage mit Preis des Modells). `transferHubs` im Bericht: erledigt in 4.7b. (2) 5.2: `careerScore` in `src/lib/careerScore.ts`
(alte Formel, nur noch alter Abschluss; die Halle nutzt weiter `fileCareer`/`hallPosition` dort), `fleetCommonality` (nur noch alter
Abschluss), `reputationDemandFactor`, `eventReliefFactor` (nur noch alte Vorschau `playerMods`) entfernen. (3) 5.1: eine gemeinsame
Ruhmeshalle bis `splitHall` (E43); das Feld `netWorth` der Einträge trägt jetzt den Unternehmenswert (alte Einträge: Kasse +
Verkaufserlöse). (4) Berichte aus 4.2f–4.6b (Modell, aber ohne Feld `cash`) zeigen in „From profit to cash“ nur Ergebnis,
übrige Einmalausgaben und einen Rest „Other cash movements“ (ihre `capexItems` enthielten keine Flugzeuge). (5) Das Kredit-Band und
die Bankrott-Anzeige sind mit Tests geprüft, im Browser nicht (Kasse unter 0 nicht erreicht). (6) Kredit-Band und Firma zeigen die
Kreditlinie mit der Kasse von jetzt (nach Einmalzahlungen); geprüft wird am Monatsende (8.14).

Offen aus 4.6b (kein Blocker): (1) 5.1: Verkauft der Spieler ein Flugzeug, bevor der Welt-Zustand gespeichert ist (erster Monat eines
neuen Spiels, alte Spielstände bis zum ersten Abschluss), kommt es nicht in den Gebrauchtmarkt. (2) 5.1: Ein weiterverkauftes Flugzeug
des Spielers mit eigener Kabine (passt zu keiner KI-Persönlichkeit und nicht zur Standard-Kabine) wird mit seinen Sitzen, aber
Standard-Sitzen verkauft („fittings reset to standard“; Preis aus dieser Kabine, R2 gilt). Genau ginge es nur, wenn der Spielstand die
Kabine des verkauften Flugzeugs mitführt. (3) erledigt in 4.7a (Fleet value = Buchwert, Company value = `companyValue`). (4) 5.2: `src/lib/usedMarket.ts`, `src/lib/takeover.ts`, in `src/lib/preorders.ts` `quoteOrder`, `createOrder`,
`orderBalance`, `cancelRefund`, `announcedAircraft`, `settleDeliveries` (nur noch alter Abschluss), `getAircraftResaleValue`,
`monthlyOwnershipCost` / `fleetOwnershipCost` und `getPlaneSat` (nur noch alte Rechnung) entfernen; ebenso `withDevelopment` in
`App.tsx` (schreibt `popularity` / `efficiency` an das Flugzeug, das keine Ansicht mehr liest). (5) Gebraucht gekaufte Flugzeuge haben
wie bisher kein `hubId` (Anzeige „Hub None“); nur Übernahme-Flugzeuge bekommen das Drehkreuz der KI.

Offen aus 4.6a (kein Blocker): (1) erledigt in 4.6b („new price“ = `newPrice` des Monats). (2) 5.1 /
5.2: Der Dialog speichert `baseInteriorPop` und `details.interiorByClass` nur noch für die alte Rechnung (`getPlaneSat`); alte Vorlagen
(`aircraft_preset`) tragen den alten Wert. (3) 5.3: Umbau kostet jetzt Sitze der neuen Kabine × $1 000 × Kostenindex (bisher Typ-Kapazität ×
$1 000 ohne Index) – Höhe mit dem Balance-Skript ansehen. (4) erledigt in 4.6b: Typ-Karten der Flotte mit Type appeal nach dem Alter; die Kaufliste
zeigt neue Flugzeuge (Alter 0, Type appeal = Katalogwert).

Offen aus 4.5c (kein Blocker): (1) erledigt in 4.7b (`playerMonth` statt `computeNetworkFinancials`; Umsteige-Ströme in der
Streckenansicht; `transferHubs` im Bericht). (2) erledigt in 4.7c (`routeMarket`). (3) 5.1: alte Spielstände tragen noch `paxByClass`, `routeSat`, `estWeekly*` an den Strecken (nur noch
unbenutzt); beim Laden entfernen (`TRANSIENT_ROUTE_FIELDS`). `paxPerWeek` an der Strecke schreibt der Abschluss (letzter Monat); die
Ansichten lesen das Modell. (4) 5.3: Der Modell-Spielstand und `monthOperations` laufen bei jeder Änderung des Spielstands
(gemessen: `monthOperations` mit 8 Gesellschaften und 168 Strecken ≈ 25 ms); mit großen Spielständen im Browser beobachten. (5) 5.2:
`toStoredRouteMetrics`, `seatWeightedSatisfaction`, `maturityNote` und `calculateRouteFinancials` haben in den Strecken-Ansichten keine
Nutzer mehr (nur noch alte KI, alter Abschluss, `transferUtils`).

Offen aus 4.5b (kein Blocker): (1) erledigt in 4.5c. (2) 5.2: `calculateClassSatisfaction`,
`getRouteClassSatisfaction`, `getDeskSim`, `expectedServicePoints` / `getFlightTimeClass` der alten Rechnung entfernen, sobald 4.5c sie
nicht mehr braucht (seit 4.5c der Fall). (3) 5.1: Die alte Regel nahm für eine Klasse ohne eigene Service-Auswahl die Auswahl „general“ (`classConfigFor`),
das Modell nicht; alte Spielstände mit fehlenden Klassen prüfen. (4) Die Punkte je Gericht im Kabinen-Fenster sind Rohpunkte; wie mehrere
Gerichte einer Mahlzeit zählen (`menuPoints`): erledigt in 4.6a (Hinweis-Zeile über den Gerichten).

Offen aus 4.5a (kein Blocker): (1) erledigt in 4.5c. (2) 5.3: Bei knappen Sitzen liegt der beste Preis weit über dem Markt (FRA–LHR 1960: 2,39 × Markt,
6 239 Fluggäste Markt gegen 320 Sitze); Regel 4.10 „Sitze knapp → bester Preis höher“, Stärke mit dem Balance-Skript ansehen. (3) Der Planer
rechnet ohne Umsteiger (F42 (6)); die alte Zeile „incl. x transfer“ entfällt. Die Transfer-Vorschau `priceDraftInNetwork` nutzt der Planer seit 4.5c
nicht mehr (5.2).

Offen aus 4.4 (kein Blocker): (1) 5.1: Der Abschluss teilt die Abflüge eines Einweg-Umlaufs für die Stand-Belegung halb auf beide Enden
(`src/model/monthClose.ts:861`); die Oberfläche zählt nach 1.6 nur den Start. Einweg-Umläufe gibt es nur in alten Spielständen. (2) 5.3: Die KI
rechnet „höchste Umläufe“ weiter mit `maxWeeklyRotations` (7 × 18 h, ohne Bodenzeit); 7.9 verlangt die Planer-Funktion, das ändert die
Balance → mit dem Balance-Skript umstellen. (3) 5.2: `rawBlockMinutes` (nur alter Abschluss) entfernen; die übrigen Zeitplan-Suchen des Planers
(„Select All“, „Max Flights“ in Schritt 2, `findOptimalConfig`) sind eigene Kopien von `findDayRunStart`, `findCommonRunStart`,
`maxFlightStarts` und könnten diese nutzen (gleiche Regeln, nur doppelter Code).

Offen aus 4.3 (kein Blocker): (1) erledigt in 4.4.
(2) Satisfaction-Aufschlüsselung im Planer erledigt in 4.5b; Transfer-Fluggäste
der Flughafen-Ansicht aus dem Modell: erledigt in 4.7b. (3) Widebody-Slots erst ab Flughafengröße 3 ist eine Regel nur der Oberfläche
(`WIDEBODY_SLOTS_FROM_SIZE`); in 5.3 prüfen, ob die KI sie auch einhält. (4) 5.1: alte Spielstände mit Stufe ≥ 1 und 0 Schaltern bekommen
einen Schalter. (5) 5.2: `getAirportUpkeep`, `getManagementUnlockCost`, `getInfraAvailability`, `getDeskSim`, `applyManagementUnlock`
(alte Preise) entfernen bzw. ins Modell.

Offen aus 4.2g (kein Blocker): (1) erledigt in 4.6b (`takeoverFleet`, Kabine der KI). (2) erledigt in 4.3. (3) 5.2: `takeoverQuote`, `withTakenSlots` (`src/lib/takeover.ts`), `getJetFuelPrice` (nur noch Planer-Ersatzwert und alter
KI-Code) entfernen. (4) erledigt in 4.3 (im Browser geklickt).

Offen aus 4.2f (kein Blocker): (1) 4.3–4.7: Ansichten, Planer und Kopfzeile zeigen die Vorschau noch aus dem alten Modell, gebucht wird
mit dem neuen (E72) – Zahlen können bis dahin abweichen. (2) erledigt (Kaufpreis 4.6a, Verkaufserlös 4.6b). (3) Spielende erledigt in 4.7a; `transferHubs` im Bericht erledigt in 4.7b.
(4) Neue Farbe des Spielers färbt `aiAirlines` und `rivals` getrennt um; mit aufgelösten KI in `rivals` können die Farben bis zum
nächsten Abschluss abweichen. (5) 5.2: alter `closeMonth` in `src/lib/monthClose.ts` wird nicht mehr aufgerufen.

Offen aus 4.2e: (1)–(3) erledigt in 4.2f (Meldungen der Oberfläche, `marketShare`, Zieltext; `transferHubs` → 4.7). (4) erledigt in 4.6b
(Anzeige aus dem Modell, `planeFigures`). (5) Prognose der Strecken bleibt bis
4.5 aus dem alten Modell (die Liste rechnet sie live, `routesWithMetrics`).

Offen aus 4.2d (kein Blocker): (1), (2) erledigt in 4.2f. (3) erledigt in 4.7b („Aggression“ = `aggression` der
Persönlichkeit mit Steckbrief aus `PERSONALITIES`; Frist bis zur Auflösung aus `rivalDistressStep`). (4) erledigt in 4.6b. (5) 5.1: `rivalRecord` und `modelWorld` in
`saveMigration.ts`. (6) Alte Zufallsereignisse, die nur den Treibstoff verteuerten, gelten im Modell nicht mehr als Pech (E8,
`isBadLuckEvent`).

Offen aus 4.2c (kein Blocker): (1) erledigt in 4.2f. (2) erledigt in 4.2d. (3) erledigt: die Charter-Antwort kostete schon keine
Sofortzahlung (Kosten 0, F58). (4) Lieferung einen Monat später als heute (Modell liefert
im Abschluss des Liefermonats, 8.12); Preis bei Lieferung aus dem Modell; Anzeige der Bestellung aus dem Modell erledigt in 4.6b. (5) Jahresziel:
Ruf-Prämie und Ruf-Strafe alter Ziele entfallen (E58); Anzeige der Geld-Strafe erledigt in 4.7a. (6) Meilensteine: Die Oberfläche behält bis 5.1
die alten Kennungen (`continents-*`, `reputation-60/80/95`); die Brücke übersetzt. (7) Szenario: Dollar-Ziele gelten als $ des
Startmonats (in 1960er $ umgerechnet); `minWeeklyFlights` (Deregulation) und die eigene Untergrenze (−5 M$, 0 $) kennt das Modell nicht
(8.15: Kreditlinie) – in 5.1 / 5.3 prüfen. (8) erledigt in 4.7a (`reportView`).

Offen aus 4.2b (kein Blocker): Lieferungen legt seit 4.2c `deliveredAircraft` an. `popularity` / `efficiency` am Flugzeug
schreibt noch der alte Abschluss; die Brücke liest sie nicht (Katalog), Anzeige aus dem Modell in 4.6. Einweg-Umläufe
zählen als ein Abschnitt; das Modell teilt die Abflüge halb auf beide Enden (wie bisher bei der KI). Vor diesem Paket umgebaute
Flugzeuge haben kein `cabinInstalledAt` und gelten als beim Kauf eingerichtet (5.1). `allModelAirports` im Balance-Skript
(`src/balance/longRun.ts:66`) wiederholt `modelAirports` (aufräumen in 5.2).

Offen aus 4.2: erledigt in 4.2g (F59).

Offen aus 4.1 (kein Blocker): Drei Glossar-Einträge bleiben alt in `InfoTooltip.tsx`, bis ihre Ansicht umgestellt ist:
`desks` (erledigt in 4.3), `utilization` (erledigt in 4.4), `breakEven` (erledigt in 4.5a). Feste Zahlen in Ansichten (`bestand/8-oberflaeche.md` Art C): Schalter-Abzug in `AirportDetailView.tsx`
erledigt in 4.3; Debug-Formel im Planer erledigt in 4.5a; Preise und
Jahre der Kabinen-Extras in `ConfigurePurchaseView.tsx` erledigt in 4.6a. Spalten-Namen „Comb. Sat“ (Flotte, erledigt in 4.6b) und „Class“
(Strecken, erledigt in 4.5c) nach E9 umbenennen. Bis dahin beschreiben einige Texte (Schalter-Last als Mittel beider Enden,
Verschleiß nur aus Flugstunden, Überholung) schon die neue Regel.

Offen aus 3.9e (kein Blocker): Nach 50–60 Jahren fällt der Optimizer auf 0,6–0,7 des Medians, der Expansionist steigt
auf 1,7–1,9 (Regel gilt nur nach 20 und 40 Jahren); KI-Stärke Normal ≈ Hard; geteilte Paare selten (Weg B aus O66).
Alles in Phase 5.3 beobachten. Phase 4: `rivalHubViable` als Hinweis beim Spieler-Start (Drehkreuz ohne mögliche
Gewinn-Strecke, z. B. SIN 1960); die Zeile „Subsidy“ (immer 0) entfernt Phase 5.2.

Offen aus 3.9c (kein Blocker): B6.7 bleibt nach E70 ok (`CLASS_RESEARCH` unverändert). Ruf-Meilenstein Gold (80) erreicht keine
KI-Ausstattung (bestes Ruf-Ziel 76,3); gewollt selten, in Phase 5.3 mit Spieler-Ausstattung ansehen.

Offen aus 3.9b (kein Blocker): KI-Stärke mit nur je 3 Läufen Easy / Hard gemessen (3.9d: Easy < Normal < Hard, Normal
und Hard nahe). Umsteiger-Regel (3.13) seit 3.9d auch vor der Sitz-Verteilung erfüllt (10–16 %).

Offen aus 3.9a (kein Blocker): Stärke der Schwierigkeit (B3.5, Hard −5,7 % Fluggäste) noch nicht eingestellt; Phase 5.3.
E65: Optimizer-Sprünge in 3.9d nicht störend (0,6–2,7 % der Strecken-Monate), keine Schrittgrenze `FARE_STEP`.

Offen aus 3.2a: erledigt in 4.6a (Test „Kaufdialog-Anzeige = Modellwert“ in `src/lib/modelCabin.test.ts`).
Offen aus 3.2b (kein Blocker): „Planer-Wert = Wert im Monatsabschluss“ (2.7) erledigt in 4.5b (Test in
`src/lib/modelRoute.test.ts`). Wer `GroundSide` (Einrichtungen je Ende),
Cabin rating, Service points und Moral aus dem Spielstand baut, regeln 3.8 bzw. Phase 4 (F22). Stärke der
Service-Abzüge und Kurve von `satisfactionFactor` prüft das Balance-Skript (3.9, E15).
Offen aus 3.3a (kein Blocker): Die Balance-Regeln aus 3.3 (Marktgröße im Mittel aller Paare 1960 → 2019 × 2,5)
und 3.7 (Premium-Anteil schwankt über alle Paare um mindestens 3 Prozentpunkte) prüft das Balance-Skript (3.9).
Offen aus 3.3b (kein Blocker): Balance-Skript (3.9) prüft Umsteiger typisch unter 25 % in Märkten mit
Direktangebot (3.13) und die Stärke von `FLIGHT_TIME_EXP` (3.9.3). Die Regel „Planer-Wert = Wert im
Monatsabschluss“ (3.11, R2) wird geprüft, wenn Planer und Monatsabschluss das Modell nutzen (Phase 4 / 3.8).
Wer Angebote aus dem Spielstand baut (Strecken je Paar, Fahrpläne, Alter, Laufmonate), regelt 3.8 bzw. Phase 4.
Offen aus 3.4 (kein Blocker): Erledigt in 4.5a: Planer-Hauptzahl, Nebenzahlen, `bestFare` / `breakEvenFareLevel` mit echten Kosten, Test
„Hauptzahl = Gewinn im Monatsabschluss“ und „Hauptzahl steigt nie über den besten Preis hinaus“. Bisheriger Text: Planer-Hauptzahl „Expected weekly profit“, Nebenzahlen „First month“ und
„Full aircraft“ mit Kosten (4.12) sowie `bestFare` / `breakEvenFareLevel` mit echten Kosten: Bausteine seit 3.5b
(`costPerPassenger`, `fixedWeeklyCost`, `routeResult`), Anschluss in Phase 4. Die Regeln „Planer-Erlös = Erlös im Monatsabschluss“
(4.7, R2), „Preisänderung ändert die Fluggäste des laufenden Monats nicht“ (4.5) und „Hauptzahl = Gewinn im
Monatsabschluss“ (4.12) prüft 3.8 / Phase 4. Ob gegenseitiges Unterbieten mit `bestFare` in Grenzen bleibt
(4.10, Hinweis), prüft das Balance-Skript (3.9) mit Abschnitt 7.
Offen aus 3.5a (kein Blocker): „Planer-Kosten = Kosten im Abschluss“ (5.16, R2) prüft 3.8 / Phase 4. Höhe von Landegebühr (26–40 % der Kurzstrecken-Kosten) und Abfertigung
ohne Bodenpersonal-Aufschlag prüft das Balance-Skript (3.9). Lohn-Grenzen 80 … 130 setzt 8.7.
Offen aus 3.5b (kein Blocker): `bestFare` und `breakEvenFareLevel` nehmen `costPerPassenger` und `fixedWeeklyCost`
als Zahlen; wer sie aus dem Spielstand baut (Strecken, Flugzeuge, Blockstunden, Slots, Schalter-Last), regeln 3.8
und Phase 4, ebenso „Planer-Ergebnis = Strecken-Ergebnis im Abschluss“ (5.9, R2). Die Abschnitt-8-Posten
(`MonthEventCosts`) und die Buchung von `monthlyCosts` liefert 3.8; dort auch die Überholungs-Regel aus 5.19 (Preis ≥
Wertgewinn `CONDITION_VALUE_SPAN × AIRFRAME_VALUE_SHARE` je Zustandspunkt) und die Slot-Grenze beim Kauf (E50,
auch KI, 3.7). `milestoneSlotFactor` liefert 3.6. Höhe der Listenpreise (E54), Abschreibung (`DEPRECIATION_YEARS`,
`RESIDUAL_SHARE`) und die hohe Langstrecken-Marge aus 5.18 prüft das Balance-Skript (3.9).

Offen aus 3.6a (kein Blocker): Die Regel „keine andere Funktion schreibt den Ruf“ (6.5, R10) und die Reihenfolge
im Abschluss (6.15) prüft 3.8. Wer `cancelledShare`, die Regionen der Strecken-Enden und die Rang-Werte der letzten
3 Monate aus dem Spielstand baut, regeln 3.8 und Phase 4. Ruf-Steigungen, `CANCELLED_REPUTATION_WEIGHT`, Werbe-Beitrag,
Ruf-Schwellen der Ränge und die Bezahlbarkeit der Klassen-Forschung (6.8) prüft das Balance-Skript (3.9). E63 setzt 3.7
um (Sperre in 7.9, 7.10, 7.13).

Offen aus 3.6b (kein Blocker): Die Felder `defectFactor`, `wearFactor`, `resaleBonus`, `moralePoints` aus
`researchEffects` wendet 3.8 an (Ausfälle, Verschleiß, Verkauf, Personal); `demandFactor`, `hubQualityFactor` und
`rampBonus` reicht der Aufrufer (3.8 / Phase 4) an `offerAppeal`, `hubQuality` und `rampFactor` weiter. Wer
`MilestoneContext`, Jahres-Berichte und `companyValue` aus dem Spielstand baut und Prämien, Strafe und Forschungspreis
in der Kasse bucht (nicht im Monatsergebnis), regelt 3.8. Spielstand (5.1): alte Meilenstein-Ids `continents-*` und
`reputation-60/80/95` nach Stufe auf `regions-*` und `reputation-bronze/silver/gold`, `startedOffset` → `startMonth`,
Ruhmeshalle mit `splitHall` teilen (F37). Ziel-, Prämien- und Straf-Anteile (6.11) prüft das Balance-Skript (3.9).

Offen aus 3.7a (kein Blocker): Kaufdialog auf `cabinSpace`, `seatSpace`, `economySeatsLeft` erledigt in 4.6a; Spieler-Start
auf `START_HUB_SETUP` erledigt (4.2). Wer `RIVAL_INPUTS` an die Funktionen reicht, Lage und Preiskampf je
Paar speichert und die Zufallszahlen aus `rng` holt, regeln 3.7b / 3.8. Kabinen-Werte, `FARE_POSITION`, Preiskampf
und Optimizer-Antworten über dem Boden, KI-Stärke-Werte prüft das Balance-Skript (3.9, Prüfregel „ähnlicher Erfolg“).
Spielstand (5.1): alte KI-Stärke `Easy/Normal/Hard` über `rivalStrengthOf`, KI-Flugzeuge mit Kabine nach `rivalCabin`.

Offen aus 3.7b (kein Blocker): 3.8 setzt die Entscheidungen aus `rivalMonth.ts` in der Reihenfolge
`RIVAL_DECISION_STEPS` nach der Buchung zusammen und liefert die Zahlen dafür (Planer-Hauptzahl je Plan,
`saleProceeds`, `overhaulPrice`, `creditLimit`, Gebrauchtmarkt). Dort auch die Tests „Buchung unabhängig von der
Reihenfolge der KI“ (7.8), „Verkaufserlös KI = Spieler“, „verkaufte KI-Flugzeuge im Gebrauchtmarkt“ (7.11),
„Dividende ändert weder Ergebnis noch Ruf“ (7.13) und „Übernahme ändert das Monatsergebnis nicht“ (7.16), F39 (10).
Slot-Anteile, Dividenden-Grenze, `NEW_HUB_MIN_SEATS`, Zuschuss-Abschaffung und „ähnlicher Erfolg“ prüft das
Balance-Skript (3.9). Rivalen-Ansicht, Ticker und Meldungstexte aus dem Modell: Phase 4. Spielstand (5.1): Notlage
als `{ status, distressMonths, forSaleMonths }`.

Offen aus 3.8a (kein Blocker): 3.8b setzt die Bausteine in `closeMonth` zusammen (Reihenfolge 8.0) und prüft dort
„Buchung unabhängig von der Reihenfolge der KI“ (7.8), „Dividende ändert weder Ergebnis noch Ruf“ (7.13), „Übernahme
ändert das Monatsergebnis nicht“ (7.16), die Kassen-Gleichung (8.2), Vogelschlag und Lieferung im Bericht dieses Monats
(8.6, 8.12), „ein Test mit `closeMonth` ändert keine globalen Daten“ (8.3) und „ein halber Flugplan bringt höchstens die
Hälfte weniger Fluggäste“ mit der Marktaufteilung (8.9). `HEDGE_PRICE_SHARE`, `RECOVERY_PRICE_SHARE`, `CHARTER_MARKUP`,
Spanne, Rabatt, `OVERHAUL_PRICE_SHARE`, Verschleiß, `CREDIT_LIMIT_SHARE`, `CREDIT_RATE` prüft das Balance-Skript (3.9).
Phase 4: Fragen (Krise, Charter, Streik), Gebrauchtmarkt (Verkäufer-Text) und Kopfzeile „Credit used“ aus dem Modell.
Spielstand (5.1): Zufallsereignisse in den Spielstand, Störungen als `{ month, kind, target, share, charter? }`, Streik
als `{ month, answer?, agreedPct? }`.

Offen aus 3.8b (kein Blocker): Phase 4 / 5.1: alten Spielstand in `ModelState` umwandeln (Typ-Werte, Interior score, Service je
Klasse, Kassenbuch), Einweg-Umläufe, Störungs-Antworten des Spielers je Gesellschaft. Ein voll ausgelastetes A320 auf
FRA–MAD (14 Abflüge) bleibt bei jedem Preis voll; ob die Marktgröße zu groß ist, prüft das Balance-Skript (3.9).

Offen aus 3.8c (kein Blocker): Entscheidungen der KI stehen im Bericht X als `decisionsCash` / `decisionsValueChange`,
nicht im Ergebnis (F42). 3.8d: Eröffnungen, Wachstum, Slots, Schalter, Lounge, Zuschuss, Nachrücken, Kabinen-Umbau
und Fahrpläne der KI (ohne Fahrplan bietet auch die KI keine Umsteiger an). Phase 4: Fahrpläne der Spieler-Strecken als
`RouteSchedule`, Wahl des Jahresziels aus `goalOffers`, Meldungstexte zu `CloseNews`, Szenario-Daten in Werte von 1960
(5.1). Balance-Skript (3.9): Umsteiger-Anteil unter 25 % in Märkten mit Direktangebot (3.13), Szenario-Ziele.

Offen aus 3.8d (kein Blocker): Phase 4 füllt `ModelState.catalog` (aus `src/data/aircraft.ts`) und alle Flughäfen mit
`maxIcaoCode`, ruft `closeMonth(state, rivalDecisions, rivalRefill({ wanted, strength }))` auf und zeigt die neuen
Meldungen (`routeOpened`, `planeBought`, `modernized`, `cabinRenewed`, `slotsSold`, `loungeBuilt`, `newHub`, `newRival`)
und die Zeile „Subsidy“. Rechenzeit der KI-Planung mit allen Flughäfen (Vorauswahl über alle, Bewertung nur der
Suchbreite) prüft das Balance-Skript (3.9). Balance-Skript: Zahl der Eröffnungen und Käufe je Jahr, Slot-Anteile,
`RIVAL_TURN_MINUTES`, Zuschuss-Abschaffung (7.14), „ähnlicher Erfolg“ (7.4). Spielstand (5.1): KI-Agent mit `slotFree`,
`hubNoProfit`, `refits`; KI-Strecken mit Fahrplan; `inputs.subsidized` für die KI.

Status-Werte: `offen` · `läuft` · `erledigt` · `wartet` (auf Entscheidung)

---

## Phase 0 – Einrichtung

| Nr. | Paket | Status | Ergebnis |
|---|---|---|---|
| 0.1 | Projektstruktur anlegen | erledigt | `CLAUDE.md`, `docs/neubau/` |

## Phase 1 – Bestand aufnehmen

Je Bereich: Jede Größe mit Formel, Fundstelle (`datei:zeile`), Wirkung und Widersprüchen
erfassen. Kein Code ändern. Ergebnis nach `bestand/VORLAGE.md`.

| Nr. | Bereich | Zu lesende Dateien (Startpunkt) | Ergebnis | Status |
|---|---|---|---|---|
| 1.1 | Zufriedenheit (SAT) | `src/lib/financeUtils.ts` (Catering bis `seatWeightedSatisfaction`, ca. 307–935), `src/data/catering.ts`, `getPlaneSat`-Aufrufer | `bestand/1-zufriedenheit.md` | erledigt |
| 1.2 | Nachfrage und Marktanteil | `financeUtils.ts` (`calculateDemand`, `eraDemandFactor`, `seasonFactor`, `offerAttractiveness`, `marketShare`, `eventRegionalFactor`), `transferUtils.ts`, `routeMaturity.ts`, `marketing.ts` | `bestand/2-nachfrage.md` | erledigt |
| 1.3 | Preis und Erlös | `financeUtils.ts` (`calculateBasePrices`, `getSatMultiplier`, `getPriceDemandMultiplier`, `scarcityPremium`, `difficultyFareFactor`, Erlösteil von `calculateRouteFinancials`), Preisregler in `RoutePlannerView.tsx` | `bestand/3-preis.md` | erledigt |
| 1.4 | Kosten | `financeUtils.ts` (`getAirportUpkeep`, Landegebühren, Slots, Infrastruktur, `getJetFuelPrice`, Kostenteil von `calculateRouteFinancials`), `fleetCosts.ts`, `staff.ts`, `realCosts.ts`, `hubOwnership.ts`, `malus.ts`, `src/data/fuelPrices.ts` | `bestand/4-kosten.md` | erledigt |
| 1.5 | Ruf, Rang, Fortschritt | `monthClose.ts` (`computeReputationTarget`), `gameState.ts` (Ruf-Wirkung), `airlineRank.ts`, `milestones.ts`, `annualGoals.ts`, `careerScore.ts`, `research.ts`, `aircraftClasses.ts`, `airportAccess.ts` | `bestand/5-ruf-fortschritt.md` | erledigt |
| 1.6 | Konkurrenz (KI) | `aiSimulation.ts`, `rivalCrisis.ts`, `takeover.ts`, `buildRivalOffers` in `monthClose.ts` | `bestand/6-konkurrenz.md` | erledigt |
| 1.7 | Monatsabschluss, Ereignisse, Flottenmarkt | `monthClose.ts` (`closeMonth`), `eventSystem.ts`, `disruptions.ts`, `preorders.ts`, `usedMarket.ts`, `getAircraftResaleValue`, `invariants.ts` | `bestand/7-monat-ereignisse.md` | erledigt |
| 1.8 | Querschnitt: Doppelrechnungen in der Oberfläche | Suche in `src/components/` und `src/App.tsx` nach Formeln, die die Ansicht selbst rechnet statt `src/lib/` aufzurufen | `bestand/8-oberflaeche.md` | erledigt |
| 1.9 | Zusammenfassung | alle `bestand/*.md` | Liste aller Widersprüche und Entscheidungsfragen in `ENTSCHEIDUNGEN.md` | erledigt |

## Phase 2 – Spezifikation

| Nr. | Paket | Status |
|---|---|---|
| 2.1a | Block A (Querschnitt: O3–O11) aus `ENTSCHEIDUNGEN.md` mit dem Menschen klären, inkl. Bauregeln R1–R16 | erledigt |
| 2.1b | Block B (Markt: O2, O12–O24) klären | erledigt |
| 2.1c | Block C (Kosten, Flottenwert, Monat, Ereignisse: O25–O33) klären | erledigt |
| 2.1d | Block D (Ruf, Rang, Konkurrenz, Oberfläche: O1, O34–O49) klären | erledigt |
| 2.2 | Grundbegriffe und Einheiten festlegen (Namen, Skalen, Rundung, Schwierigkeit) | erledigt |
| 2.3 | Soll-Zustand Zufriedenheit (`SPEZIFIKATION.md` Abschnitt 2) | erledigt |
| 2.4 | Soll-Zustand Nachfrage und Marktanteil (`SPEZIFIKATION.md` Abschnitt 3) | erledigt |
| 2.5 | Soll-Zustand Preis und Erlös (`SPEZIFIKATION.md` Abschnitt 4) | erledigt |
| 2.6 | Soll-Zustand Kosten (`SPEZIFIKATION.md` Abschnitt 5) | erledigt |
| 2.7 | Soll-Zustand Ruf, Rang, Fortschritt (`SPEZIFIKATION.md` Abschnitt 6) | erledigt |
| 2.8 | Soll-Zustand Konkurrenz (`SPEZIFIKATION.md` Abschnitt 7) | erledigt |
| 2.9 | Soll-Zustand Monatsabschluss, Ereignisse, Flottenmarkt (`SPEZIFIKATION.md` Abschnitt 8) | erledigt |

## Phase 3 – Modell neu bauen

| Nr. | Paket | Status |
|---|---|---|
| 3.1 | Gerüst `src/model/`, zentrale Konstanten, Regeltest-Muster | erledigt |
| 3.2a | Zufriedenheit Teil 1 (`SPEZIFIKATION.md` 2.1–2.5): Flugzeit-Index, Type appeal, Interior score, Cabin rating, Service points | erledigt |
| 3.2b | Zufriedenheit Teil 2 (2.6–2.10): Teile der Satisfaction, Satisfaction je Klasse, Offer/Route/Airline satisfaction, `satisfactionFactor` | erledigt |
| 3.3a | Nachfrage Teil 1 (3.1–3.7): Bezugs-Flugzeit, Verflechtung, Wachstum, Entfernung, Ereignisse, Marktgröße, Klassen-Anteil | erledigt |
| 3.3b | Nachfrage Teil 2 (3.8–3.14): Anziehung, „Nicht fliegen“, Aufteilung, Anlauf, Umsteiger; `satisfactionFactor` als Eingabe, solange 3.2b wartet | erledigt |
| 3.4 | Preis und Erlös (Abschnitt 4) | erledigt |
| 3.5a | Kosten Teil 1 (5.1–5.8): Kosten-Faktoren, Treibstoffpreis mit Krisen (E61), Treibstoff, Besatzung, Landung, Check-in und Abfertigung, Verpflegung, Kosten je Fluggast | erledigt |
| 3.5b | Kosten Teil 2 (5.9–5.18): feste Kosten je Strecke (E57), Flughäfen, Verwaltungsstufen, Einrichtungen, Unterhalt, Wertmodell, Werbung, Einnahme, Kosten der Gesellschaft, Beispiel 5.18 | erledigt |
| 3.6a | Fortschritt Teil 1 (6.1–6.8): Ruf aus Satisfaction, gestrichene Flüge, Werbe-Beitrag, Ruf-Ziel, Ruf-Änderung mit Ursachen, Farbstufen, Rang mit 3-Monats-Mittel, Flugzeugklassen | erledigt |
| 3.6b | Fortschritt Teil 2 (6.9–6.14): Forschung mit Feldern, Meilensteine, Jahresziel, Karriere-Punkte | erledigt |
| 3.7a | Konkurrenz Teil 1 (7.1–7.7): neutrale Eingaben, fehlende Teile, KI-Stärke, Persönlichkeiten, Kabine und Service, Preise mit Preiskampf, Gründung | erledigt |
| 3.7b | Konkurrenz Teil 2 (7.8–7.17): Monat der KI, Planung, Slots/Schalter/Drehkreuze (E63), Flotte, Krise, Wachstum, Dividende, Zuschuss, Notlage, Übernahme, Ticker | erledigt |
| 3.8a | Monatsabschluss Teil 1 (8.3–8.14): Zufall und Spielstand, Ereignisse, Krisen-Antworten, Störungen, Personal, Pech-Deckel, gestrichene/gecharterte Flüge, Verschleiß, Händler-Spanne und Gebrauchtmarkt, Vorbestellung, Überholung, Kreditlinie | erledigt |
| 3.8b | Monatsabschluss Teil 2 (8.0–8.2, 8.16): `closeMonth` für Spieler und KI in einer Rechnung, Kasse am Monatsende mit Kassen-Gleichung, Bericht, Lieferungen, Kreditlinie, Prüfung, Übergang, offene R2-Regeln | erledigt |
| 3.8c | Monatsabschluss Teil 3 (7.8–7.16 im Abschluss, 3.13, 6.9–6.11, 8.15): KI-Entscheidungen `rivalDecisions`, Umsteiger im Abschluss, Forschung, Meilensteine, Rang, Jahresziel, Szenario-Ziele | erledigt |
| 3.8d | Monatsabschluss Teil 4 (7.7, 7.9–7.11, 7.13, 7.14 im Abschluss): KI-Eröffnungen, Wachstum (Kauf, Modernisierung, neues Drehkreuz), Slots, Schalter, Lounge, Zuschuss, Nachrücken, Kabinen-Umbau und Fahrpläne der KI | erledigt |
| 3.9a | Balance-Skript Teil 1: Gerüst, Abschnitte 1–5 ohne Langlauf (Zeit und Geld, Zufriedenheit, Nachfrage über alle Paare, Preis und Kosten typischer Strecken, Preiskampf) | erledigt |
| 3.9b | Balance-Skript Teil 2: Langläufe mit `closeMonth` ohne Spieler (Abschnitt 7, Umsteiger 3.13) | erledigt |
| 3.9c | Balance-Skript Teil 3: Abschnitte 6 und 8 ohne Langlauf (Ruf, Rang, Forschung, Jahresziel, Szenario, Krisen-Antworten, Charter, Flottenmarkt, Kreditlinie) | erledigt |
| 3.9d | E66–E70 umsetzen: KI an fremden Drehkreuzen, Marktgröße und Preise per Skript einstellen, Langläufe neu, Zuschuss-Prüfung, Preise der Krisen-Antworten | erledigt |
| 3.9e | Persönlichkeiten nachstellen („ähnlicher Erfolg“ 7.4), Gründung nur an Drehkreuzen mit Gewinn-Strecke, Langläufe neu, Zuschuss abschalten (E68) | erledigt |

## Phase 4 – Oberfläche anbinden

| Nr. | Paket | Status |
|---|---|---|
| 4.1 | Glossar und Erklärtexte aus den Konstanten erzeugen (Startpunkt: `src/components/InfoTooltip.tsx`, `bestand/8-oberflaeche.md` Abschnitt „Texte mit festen Zahlen“, `src/model/constants.ts`) | erledigt |
| 4.2 | Regeln aus `App.tsx` ins Modell (`src/App.tsx`; `bestand/8-oberflaeche.md` W8, Art D „Jahre im Geschäft“) | erledigt |
| 4.2b | Brücke Teil 1: Welt und Betrieb des Spielers (`src/lib/modelBridge.ts`: Flughäfen, Katalog, Flugzeuge mit Kabine, Strecken, Bestand an Flughäfen; E72, F54) | erledigt |
| 4.2c | Brücke Teil 2: Eingaben, Kasse, Vorbestellungen, Fortschritt und Berichte des Spielers; Lieferungen in die Flotte (`src/lib/modelBridgeCompany.ts`; F55) | erledigt |
| 4.2d | Brücke Teil 3: KI und Welt-Zustand (KI im Modell-Format speichern, alte `AiAirline` umwandeln, Ansicht der Konkurrenz daraus; Zufall, Ereignisse, Störungen, Pech, Gebrauchtmarkt; `src/lib/modelBridgeWorld.ts`; F56) | erledigt |
| 4.2e | Zusammensetzung der Brücke (`src/lib/modelMonth.ts`: `modelGame`, `runModelMonth` mit `rivalDecisions`/`rivalRefill`, Meldungstexte; F57) | erledigt |
| 4.2f | `App.tsx` bucht mit `runModelMonth` (Monatsabschluss, neue Spielstand-Felder, `withTradeValue`, Fragen, Charter, Übernahme, Zeitung, Chronik; F57, F58) | erledigt |
| 4.2g | Offene Punkte aus 4.2 (× 4 → `WEEKS_PER_MONTH`, Überholungs-Preis, Treibstoff unter der Absicherung, Ereignis-Faktor der Kopfzeile, Übernahme-Preis) | erledigt |
| 4.3 | Flughafen und Infrastruktur (`AirportDetailView.tsx`, `AirportsView.tsx`, Infrastruktur-Teil im Planer; W1–W3, Gebühren; Glossar `desks`, Schalter- und Überholungs-Texte) | erledigt |
| 4.4 | Zeitplan (Planer Schritt 2, `RouteScheduleEditView.tsx`; W6, Umlaufzeit, E51; Glossar `utilization`) | erledigt |
| 4.5a | Preis der Strecke: Brücke `src/lib/modelRoute.ts` (Prognose, bester Preis, Gewinnschwelle), Planer Schritt 4 (W5, Klassen-Faktoren, Debug-Anzeige; Glossar `breakEven`; F62) | erledigt |
| 4.5b | Satisfaction der Strecke: Planer Schritt 3, `RouteConfigOverlay.tsx` (`satisfactionBreakdown` statt `getRouteClassSatisfaction` / `getDeskSim`; F63) | erledigt |
| 4.5c | Strecken-Ansichten: `RouteDetailView.tsx`, `RoutesView.tsx` (Prognose aus `modelRoute.ts` statt `routesWithMetrics` / `toStoredRouteMetrics`; Spalte „Class“ nach E9) | erledigt |
| 4.6a | Kauf und Umbau: `ConfigurePurchaseView.tsx` (Platz, Interior score, Cabin rating, Preise aus `src/lib/modelCabin.ts`; W4, Texte der Kabinen-Extras), Neupreis in `BuyAircraftView.tsx` (F65) | erledigt |
| 4.6b | Flotte und Gebrauchtmarkt: `MyFleetView.tsx` („Comb. Sat“ nach E9), `AircraftDetailsModal.tsx` (Art D Alter und Wiederverkauf), `AircraftMarketPanel.tsx` (`usedOffers`), Übernahme-Kabine, Vorbestellungs-Preis | erledigt |
| 4.7a | Kennzahlen Teil 1: Kopfzeile (Ereignis-Abschwächung, Kreditlinie), Firma (Fleet value, Company value, Karriere-Punkte), Monatsbericht (`reportView`), Spielende (F67) | erledigt |
| 4.7b | Kennzahlen Teil 2: `LiveTraffic.tsx` (W7), `CompetitorsView.tsx` („Aggression“, Frist bis zur Auflösung), `computeNetworkFinancials` in `App.tsx` (Frequent flyer, Personal-Kosten, Umsteige-Ströme, Transfer-Fluggäste der Flughafen-Ansicht, `transferHubs`) | erledigt |
| 4.7c | Kennzahlen Teil 3: Planer Schritt 1 (Marktgröße „/ WK MARKET“, Debug aus `marketSizeParts` / `marketFares`; 4.5c (2)); Ereignis-Band und Krisen-Frage (4.7a (1), F69) | erledigt |
| 4.8 | Werbung und Personal: `MarketingPanel.tsx`, `StaffPanel.tsx` (Kampagnenpreis mit Kostenindex, Ruf aus Werbung, Treue, Moral, Streik, Lohn aus dem Modell; F68 (1)) | erledigt |

## Phase 5 – Abschluss

| Nr. | Paket | Status |
|---|---|---|
| 5.1 | Spielstand-Umwandlung (`saveMigration.ts`, neue Version) | offen |
| 5.2 | Alten Rechencode entfernen, Dokumentation aufräumen | offen |
| 5.3 | Spieltest-Durchlauf mit Balance-Skript, Feinabstimmung | offen |

---

## Verlauf

| Datum | Paket | Ergebnis |
|---|---|---|
| 17.11.2026 | 0.1 | Projektstruktur angelegt |
| 17.11.2026 | 1.1 | SAT-Bestand aufgenommen: 35 Größen, 15 Auffälligkeiten (u. a. Zusatzgericht senkt SAT, Planer zeigt andere SAT als Wirtschaft, Rivalen immer SAT 100), 7 offene Fragen |
| 17.11.2026 | 1.2 | Nachfrage-Bestand aufgenommen: 37 Größen, 14 Auffälligkeiten (u. a. Marktgröße hängt vom Flugzeug ab, Aufteilen auf Parallelstrecken gewinnt Anteil, Premium fast immer 9 %, Hard-KI mit schlechterer Wirtschaft), 7 offene Fragen |
| 17.11.2026 | 1.3 | Preis-Bestand aufgenommen: 29 Größen, 11 Auffälligkeiten (u. a. Planer-Hauptzahl „volle Maschine“ steigt mit jedem Preis, feste Klassen-Faktoren 1,6/3/5, Economy unter Marktpreis bringt mehr Erlös, KI-Preise ohne Marktpreis, Monat = 4 Wochen), 7 offene Fragen |
| 17.11.2026 | 1.4 | Kosten-Bestand aufgenommen: 47 Größen, 15 Auffälligkeiten (u. a. Langstrecke verliert bei fast jedem Treibstoffpreis, 2020 kaum eine Strecke mit Gewinn, Treibstoff fällt 2031 auf 1960, Fluggast-Gebühren an beiden Flughäfen, Hard verteuert KI-Treibstoff), 7 offene Fragen |
| 17.11.2026 | 1.5 | Ruf-, Rang- und Fortschritts-Bestand aufgenommen: 46 Größen, 14 Auffälligkeiten (u. a. Werbung hebt Ruf dauerhaft um bis zu 15, Meilenstein-Boni nach einem Jahr fast weg, Rang-Texte zu Forschungsplätzen falsch, Concorde im freien Spiel kaum erreichbar, feste Dollar-Beträge über 60 Jahre), 7 offene Fragen |
| 17.11.2026 | 1.6 | Konkurrenz-Bestand aufgenommen: 63 Größen, 11 Auffälligkeiten (u. a. Persönlichkeit entscheidet über Reichtum, Flag-Carrier mit 20+ Mrd. $ Kasse, KI ohne Flughafen-Kosten, Anlauf und Verschleiß, Hard-KI rechnet schlechter, Easy-KI lebt vom Zuschuss, Übernahme ohne Alter und Kasse), 7 offene Fragen |
| 17.11.2026 | 1.7 | Monatsabschluss-, Ereignis- und Flottenmarkt-Bestand aufgenommen: 59 Größen, 14 Auffälligkeiten (u. a. Gebrauchtkauf mit Sofortverkauf +5 %, Vorbestellung unter Wiederverkaufswert, Grundüberholung 200 000 $ hebt Wert um Millionen, Charter immer teurer als Streichen, Spieler-Kasse ohne Folge negativ, Bericht-Kasse ohne Lieferungen), 7 offene Fragen |
| 17.11.2026 | 1.8 | Oberflächen-Bestand aufgenommen: 13 Regeln nur in der Oberfläche, 12 Kopien von Modell-Formeln, 9 Texte mit festen Zahlen, 5 doppelte Quellen; 9 Auffälligkeiten (u. a. Planer zeigt Schalter- und Standmieten in Preisen von 1960, Slot-Grenze nur in Ansichten, Preise von Hub-Einrichtungen im Klick-Handler); Vorschlag für die Pakete 4.2–4.7, 7 offene Fragen |
| 17.11.2026 | 1.9 | Zusammenfassung: 56 Einzelfragen und O1–O6 zu 49 Fragen (O1–O49) mit Empfehlung in 4 Blöcken zusammengelegt, 16 Bauregeln (R1–R16) für Funde ohne Entscheidung; alle 103 Funde zugeordnet; Paket 2.1 in 2.1a–2.1d geteilt |
| 18.11.2026 | 2.1a | Block A entschieden: alle 9 Empfehlungen übernommen (E4–E12): Schwierigkeit nur auf Spieler-Nachfrage, Normal = 1, KI-Wirtschaft neutral; Monat = 4,35 Wochen; ein Kostenindex für alle Beträge inkl. Grundpreise; Treibstoff nur aus Tabelle; neue Namen statt „SAT“; Gewichtung nach Fluggästen; Startwerte als Konstanten; Bauregeln R1–R16 bestätigt |
| 18.11.2026 | 2.1b | Block B entschieden (E13–E26): 12 Empfehlungen übernommen; Abweichungen: Geschwindigkeit wirkt spürbar stärker in der Anziehung (E20), Klassen-Aufteilung mit Richtung Tourismus → Economy, Geschäft → Business/First (E21) |
| 18.11.2026 | 2.1c | Block C entschieden (E27–E35): 8 Empfehlungen übernommen (u. a. Wertmodell mit Abschreibung als Kosten, Händler-Spanne, Charter ohne eigene Flugkosten, Kreditlinie mit Zwangsverkauf und Spielende, Ereignisse für alle); Abweichung: Abstellplätze ab Stufe 2 bleiben ohne Unterhalt (E28) |
| 18.11.2026 | 2.1d | Block D entschieden (E36–E52): 15 Empfehlungen übernommen (u. a. Ruf neutral 50, keine Einmal-Sprünge, Rang über 3 Monate, gleiche Wirtschaft für die KI, Übernahme zum Unternehmenswert, Slot = Abflug je Woche); Abweichungen: Werbung behält einen kleinen, abklingenden Ruf-Beitrag (E37), Flugzeugklassen bleiben an den Rang gebunden, mit niedrigeren Schwellen (E41) |
| 18.11.2026 | 2.2 | Grundbegriffe in `SPEZIFIKATION.md` Abschnitt 1: Zeit (Spielmonat, stetige Zeit, 4,348 Wochen je Monat), Mengen, Spiel-Dollar mit einem Kostenindex über `atCost`, Skalen mit Neutralpunkten, Namen (E9), Slot = Abflug je Woche, Rundung nur in der Anzeige, Schwierigkeit getrennt von KI-Stärke; 2 neue Fragen (O50 Schwierigkeit im gemeinsamen Markt, O51 Listenpreise mit Kostenindex) |
| 18.11.2026 | 2.3 | Zufriedenheit in `SPEZIFIKATION.md` Abschnitt 2: 16 Größen von Flugzeit-Index bis `satisfactionFactor`; Satisfaction wirkt nur noch über die Anziehung (als Zahlungsbereitschaft) und den Ruf; Menü mit abnehmendem Nutzen, stufenlose Mahlzeiten, Bodenteile als Mittel beider Enden, Forschung +1 je Stufe, kein Ausfall-Abzug; alle 15 Funde aus 1.1 zugeordnet. O50 → E53 (Schwierigkeit über die Anziehung), O51 → E54 (Listenpreise mit Kostenindex); 1.2 auf vier Klassen berichtigt; neue Frage O52 (Schalter) |
| 18.11.2026 | 2.4 | Nachfrage und Marktanteil in `SPEZIFIKATION.md` Abschnitt 3: Marktgröße ohne Flugzeug und Schwierigkeit (Bezugs-Flugzeit 800 km/h, Weltanteil der Städte + eine Wachstumsregel × 2,5, Entfernungs-Kurve ohne Untergrenze), neue Klassen-Anteile nach Geschäftsanteil und Flugzeit, eine Aufteilung je Markt mit „Nicht fliegen“ (Anziehung aus Abflügen, Preis/Satisfaction, Flugzeit, Ruf u. a.), Bezugsangebot ohne Rivalen erlösbest am Marktpreis (E24), Anlauf nach der Wahl, Umsteiger als Angebote im selben Markt; alle 14 Funde aus 1.2 zugeordnet; keine neue offene Frage |
| 18.11.2026 | 2.5 | Preis und Erlös in `SPEZIFIKATION.md` Abschnitt 4: Marktpreis nur aus Entfernung, Bezugs-Flugzeit und Kostenindex (gleich für alle Angebote, ohne Schwierigkeit und SAT), eine Funktion für die Klassen-Verhältnisse, Knappheits-Zuschlag entfällt (Knappheit hebt den besten Preis), Preis als Preisniveau × Marktpreis, Erlös = Fluggäste × Preis × 4,348 Wochen, Umsteiger-Erlös nach Marktpreisen der Teilstrecken, gewinnbester Preis und Gewinnschwelle aus dem Modell, Planer-Hauptzahl = erwarteter Gewinn; alle 11 Funde aus 1.3 zugeordnet; neue Frage O53 (Preis speichern) |
| 18.11.2026 | 2.6 | Kosten in `SPEZIFIKATION.md` Abschnitt 5: drei Ebenen (Kosten je Fluggast, feste Kosten je Strecke, Kosten der Gesellschaft); Treibstoff nur aus der Tabelle (nach 2030 letzter Wert); Flugbegleiter nach Kabine; Landung je Abschnitt am Ziel; Check-in je Reise, Abfertigung je Abflug (Bodenpersonal darin); ein Gebühren-Nachlass; alle festen Beträge über `atCost` (auch Verpflegung, Slots, Stufen, Werbung); Wertmodell mit Abschreibung als Ergebnis-Posten (Kauf zum Wert ergebnisneutral); KI zahlt alles; alle 15 Funde aus 1.4 zugeordnet; neue Frage O54 (Flugzeug- und Slot-Anteil in den Strecken-Kosten) |
| 18.11.2026 | 2.7 | Ruf, Rang, Fortschritt in `SPEZIFIKATION.md` Abschnitt 6: Ruf-Ziel aus Airline satisfaction (100 → 50, 160 → 100), Abzug für gestrichene Sitze und kleinem Werbe-Beitrag im Ziel (höchstens 3, klingt mit dem Ruf ab); eine Funktion `reputationChange` mit Ursachen-Liste; keine Einmal-Sprünge; Rang im 3-Monats-Mittel mit neuen Ruf-Schwellen 30 … 65, Forschungsplätze 3 / 4 / 5 ab Rang 4 / 6 / 8; Klassen-Forschung gesenkt (Narrowbody 2, Widebody 4, Jumbo und Überschall 5, Überschall braucht Widebody, Preise gesenkt) mit Prüfung: Concorde ab 1972 erforschbar; Forschungs-Wirkungen als 15 Felder; Meilensteine und Jahresziel nur Geld und Freischaltungen, alle Beträge über `atCost`; Karriere-Punkte mit zwei Ruhmeshallen, Forschung 5 statt 15; alle 14 Funde aus 1.5 zugeordnet; neue Frage O55 (Jahresziel verfehlt) |
| 18.11.2026 | 2.8 | Konkurrenz in `SPEZIFIKATION.md` Abschnitt 7: KI rechnet mit denselben Funktionen (Tabelle 7.1), Liste der bewusst fehlenden Teile mit neutralen Werten (Forschung, Personal, Werbung, Frequent flyer, Schwierigkeit, Rang, Krisen-Antworten, Charter); KI-Stärke nur Verhalten; Persönlichkeiten nur als Entscheidungen mit echten Kostenvorteilen über die Kabine (LCC 202 statt 134 Sitze im A320ceo) und Prüfregel „ähnlicher Erfolg“; KI-Preise = Preis-Lage × `satisfactionFactor`, Anpassung nach Auslastung, Preiskampf einmal −12 % mit Boden über den Kosten; KI kauft Slots (Anteil je Flughafen), Schalter, Flugzeuge zum Wert; Größe in Sitzen, weitere Drehkreuze ab Größe 5, Dividende über 12 Monatskosten; Zuschuss mit `atCost` bis zur Prüfung; Notlage „in Folge“, Flotte aufgelöster KI in den Gebrauchtmarkt; Übernahme zum Unternehmenswert mit Kasse und Slots je Flughafen; Ticker nach Fluggästen; Rückschlag entfällt; alle 11 Funde aus 1.6 zugeordnet; neue Fragen O56 (Preiskampf gegen wen) und O57 (Stufe 3 und KI) |
| 18.11.2026 | 2.9 | Monatsabschluss, Ereignisse, Flottenmarkt in `SPEZIFIKATION.md` Abschnitt 8: `closeMonth` als reine Funktion mit Zufallsgeber im Spielstand, eine Rechnung für Spieler und KI, Kasse am Monatsende nach allen Buchungen mit Kassen-Gleichung; Ereignisse nur über die Marktgröße (8 Zufalls-Vorlagen), Krisen-Antworten als Anteil von Treibstoff-Rechnung bzw. Erlös; Defekte je Flugzeug, Flughafen-Streik und Wetter für alle, Vogelschlag als Anteil des Neupreises; Charter = 1,5 × eigene Flugkosten je Flug (lohnt jetzt), nur `cancelledShare` als Strafe; Verschleiß aus geflogenen Stunden; Händler-Spanne −15 % / +5 %, Vorbestell-Rabatt bis 12 %, Überholung mindestens so teuer wie ihr Wertgewinn; Kreditlinie 50 % des Flottenwerts, 8 % Zins, Zwangsverkauf nach 6 Monaten, Spielende ohne Flugzeuge; alle 14 Funde aus 1.7 zugeordnet; Fund: Treibstoff-Tabelle ohne Krisen → neue Fragen O58 und O59 (Überholung ohne Hangar). Phase 2 abgeschlossen |
| 18.11.2026 | 3.1 | Gerüst `src/model/`: `constants.ts` (Zeit, Liter je Gallone, Kostenindex, 10 Skalen mit Neutralpunkten, Schwierigkeit), `basics.ts` (`yearOf`, `timeOf`, `costIndex`, `atCost`, `clamp`, `clampScale`, `difficultyFactor`), `rng.ts` (zustandsloser Zufallsgeber nach 8.3), `README.md` (Aufbau, R1–R4, Testmuster); 32 Regeltests zu 1.1–1.8 und 8.3; Bau-Festlegungen F1–F4; Pakete 3.2–3.8 aufgeteilt (3.2a/3.2b), 3.2b wartet auf O52 |
| 18.11.2026 | 3.2a | Zufriedenheit Teil 1: `src/model/satisfaction.ts` (`flightTimeIndex`, `typeAppeal`, `menuPoints`, `mealCount`, `mealWeight`, `serviceCapability`, `servicePoints`) und `src/model/cabin.ts` (`interiorScore`, `cabinRating`, `averageCabinRating`); Kabinen-Tabellen mit Lieferbarkeit und alle Konstanten 2.1–2.5 in `constants.ts`; 42 Regeltests (578 grün); Bau-Festlegungen F5–F8; Paket 3.3 in 3.3a/3.3b geteilt |
| 18.11.2026 | 3.3a | Nachfrage Teil 1: `src/model/demand.ts` (`distanceKm`, `blockMinutes`, `referenceBlockMinutes`, `citySize` stetig, `worldScale`, `relativeSize`, `businessLinkage`, `tourismLinkage`, `seasonFactor`, `southernShare`, `businessShare`, `demandGrowth`, `distanceFactor`, `eventDemandFactor`, `marketSize` + `marketSizeParts`, `classShare`/`classShares`); alle Konstanten 3.1–3.7 in `constants.ts`; 37 Regeltests (615 grün); Bau-Festlegungen F9–F13 (F13: Schreibfehler in Spezifikation 3.7 berichtigt) |
| 18.11.2026 | 3.3b | Nachfrage Teil 2: `src/model/marketSplit.ts` (`directOffer`, `offerAppeal` mit 11 Faktoren, `noFlyAppeal`, `classPotential`, `rampFactor`, `marketSplit` mit Anlauf, Sitz-Grenze und Überlauf, `distributeToRoutes`, `passengerShare`, `departureShare`) und `src/model/transfers.ts` (Anschlüsse, Umweg, Drehkreuz-Güte, `transferOffer`, `allocateTransferSeats`); alle Konstanten 3.9–3.13 in `constants.ts`; Beispiel 3.15 genau nachgerechnet; 61 Regeltests (676 grün); Bau-Festlegungen F14–F20 (u. a. F17 Anlauf auch im Überlauf, F19 Anschlüsse je Ankunft) |
| 18.11.2026 | 3.2b | O52 → E55 (Schalter Pflicht an beiden Enden, −10 für Premium-Klassen ohne bedienten Schalter), O53 → E56 (Preisniveau `fareRatio` speichern). Zufriedenheit Teil 2 in `src/model/satisfaction.ts`: `cabinPart`, `servicePart`, `groundPart` (Lounge, Stellplätze, Schalter-Art, Schalter-Last als Mittel beider Enden × Bodengewicht; `deskLoad` auch für 5.10), `staffPart`, `researchPart`, `satisfactionBreakdown`/`satisfaction` (einmal gekappt, ungerundet), `directOfferSatisfaction`, `connectionOfferSatisfaction`, `routeSatisfaction`, `airlineSatisfaction`, `satisfactionFactor` (an `offerAppeal` angeschlossen); alle Konstanten 2.6–2.10 in `constants.ts`; 32 Regeltests (708 grün); Bau-Festlegungen F21–F23 |
| 18.11.2026 | 3.4 | Preis und Erlös in `src/model/fare.ts`: `baseFareEconomy` (Kurzstrecken-Zuschlag stufenlos, Index aus der Bezugs-Flugzeit), `classFareRatio`, `marketFare` (nur Entfernung und Monat), Preisniveau `fareRatio` mit einer Lese-Stelle für fehlende Preise (R8), `routeFare(s)`, „Adjust All“, `routeRevenue` je Klasse mit Umsteigern, `transferRevenueShare` nach Marktpreisen, `monthlyRevenue` mit 4,348 Wochen, `bestFare` (Gitter 0,01 / 0,001, gewinnbest, eigener Anlauf 1), `breakEvenFareLevel`, `fullAircraftRevenue`; Konstanten 4.1–4.10 in `constants.ts`; Beispiel 4.13 nachgerechnet; 46 Regeltests (754 grün); Bau-Festlegungen F24–F26 |
| 18.11.2026 | – | O54–O59 entschieden: O54 → E57 (Slot- und Flugzeug-Anteil in den festen Kosten der Strecke), O55 → E58 (verfehltes Jahresziel kostet die halbe Prämie; Abweichung von der Empfehlung), O56 → E59 (Preiskampf gegen jede Gesellschaft), O57 → E60 (KI höchstens Stufe 2, Spieler-Stufe 3 ohne Sperre gegen die KI; Abweichung), O58 → E61 (Ölkrisen in der Treibstoff-Tabelle), O59 → E62 (Überholung überall, ohne Hangar 25 % teurer); `SPEZIFIKATION.md` 5.2, 5.9, 6.11, 6.15, 7.1, 7.2, 7.6, 7.7, 7.9, 7.10, 7.12, 7.13, 8.1, 8.2, 8.4, 8.13, 8.17–8.19 angepasst |
| 18.11.2026 | 3.5a | Kosten Teil 1 in `src/model/costs.ts`: `researchCostFactor`, `payFactor`, `hubFeeFactor`, `airportFeeFactor` (ein Gebühren-Nachlass); `crisisFuelShape`, `fuelTable` (Krisen-Form über den Rohdaten, letzter Wert nach 2030), `fuelPrice` mit Absicherung; `aircraftEfficiency`, `fuelCost`; `cabinCrew` nach Kabine, `crewHourlyRate`, `crewCost`; `landingFee` je Landung am Ziel, `landingCost`; `checkInFee` je Reise, `handlingFee` je Abflug; `cateringCost` mit denselben Mahlzeiten-Gewichten wie 2.5 (`servedItems` gemeinsam); `costPerPassenger`, `transferCostPerPassenger`; Konstanten 5.1–5.8 in `constants.ts`; Beispiel 5.18 (Kosten je Fluggast, Anteile) nachgerechnet; 50 Regeltests (804 grün); Bau-Festlegungen F27–F31 (F28: Paket 3.5 geteilt) |
| 18.11.2026 | 3.5b | Kosten Teil 2: `src/model/airportCosts.ts` (`slotLimit`, `slotPrice`, `slotResalePrice`, `slotRent`, `standRent` mit freien Ständen ab Stufe 2, `deskRent` nach `deskLoad`, `airportUpkeep` mit Einrichtungen, `managementTierPrice`, `facilityPrice`/`facilityUpkeep`, `ownerFeeIncome`), `src/model/fleet.ts` (`aircraftUpkeep` mit Flotten-Mischung, Wertmodell `valueBase`/`aircraftValue`, `ageDepreciation`, `fleetValueResult` in „Depreciation“ und „Aircraft trades“), `src/model/costTotals.ts` (`slotShare`, `aircraftShare`, `fixedWeeklyCost` mit „before aircraft costs“, `routeResult`, `campaignCost`, `ffpBaseCost`, `monthlyCosts`, `unattributedWeeklyCost`), `cabinListPrice` in `cabin.ts`, Kosten je Fluggast nach Posten in `costs.ts`; Konstanten 5.10–5.15 in `constants.ts`; Beispiel 5.18 ganz nachgerechnet (Erlös, Kosten, Ergebnis, Anteile, Gewinnschwelle); 69 Regeltests (873 grün); Bau-Festlegungen F32–F35 |
| 19.11.2026 | – | O54–O59 erneut abgefragt: O57 → E63 (Spieler-Stufe 3 sperrt neue KI-Strecken und -Drehkreuze; ersetzt E60), O54, O55, O56, O58, O59 bestätigt (E57, E58, E59, E61, E62); `SPEZIFIKATION.md` 7.0, 7.2, 7.7, 7.9, 7.10, 7.13 angepasst |
| 19.11.2026 | 3.6a | Ruf, Rang, Flugzeugklassen in `src/model/progress.ts`: Ruf-Ziel aus Airline satisfaction (100 → 50), Abzug für gestrichene Sitze, Werbe-Beitrag im Ziel (höchstens 3), eine Ruf-Änderung mit Ursachen-Liste, Farbstufen; Rang-Tabelle `RANKS` mit neuen Ruf-Schwellen und Forschungsplätzen, Prüfung im 3-Monats-Mittel ohne Abstieg, Freischaltungen, Flughafen-Zugang, Fortschritt; 6 Flugzeugklassen (`SizeClass`) mit `CLASS_RESEARCH` und Erreichbarkeits-Test gegen die Flugzeugdaten; Paket 3.6 geteilt (F36); 43 neue Tests, 916 grün |
| 19.11.2026 | 3.6b | Forschung, Meilensteine, Jahresziel, Karriere in `src/model/progress.ts`: Forschungs-Tabelle `RESEARCH_PROJECTS` (45 Projekte mit 15 Feldern, ersetzt `RESEARCH_SATISFACTION_POINTS`, `RESEARCH_COST_SAVINGS`, `EFFICIENCY_RESEARCH_IDS`), `researchEffects` als einzige Zusammenfassung, Preis über `atCost` ungerundet, Start-Sperre, Fortschritt, Texte aus den Feldern; 31 Meilensteine als Daten ohne Ruf-Punkte, `milestoneSlotFactor`, Drehkreuz-Zuschläge, Gewinnserie; Jahresziel mit Bezugsgröße aus Vorjahr und Erlös, Mindest-Prämie, Strafe = halbe Prämie (E58), `yearSnapshot`; Karriere-Punkte mit `companyValue` und zwei Ruhmeshallen; Bau-Festlegung F37; 51 neue Tests, 967 grün |
| 19.11.2026 | 3.7a | Konkurrenz Teil 1 in `src/model/rivals.ts`: `RIVAL_INPUTS` (neutrale Eingaben statt „ist das eine KI?“, Test über alle Modell-Dateien) und `RIVAL_OMITTED` als Text; `RIVAL_STRENGTH` (Easy/Normal/Hard nur Verhalten); `PERSONALITIES` mit Preis-Lage, Boden, Zielgewichten, Geduld, Kaufneigung, Reserve, Drehkreuzen, Schalter-Art, Kabine und Service; `rivalCabin` nach Platz-Regel (Beispiel 7.18 genau: LCC 202 Sitze, Boutique 59/25/20/8) und `rivalService` mit Menü je Mahlzeit; `rivalFareRatio` mit Zielniveau × `satisfactionFactor`, Lage ± 15 %, Preiskampf einmal −12 % über dem Boden; Gründung (Startkasse mit `atCost`, Startausstattung wie der Spieler, Drehkreuz-Wahl ohne Spieler-Stufe 3, Startflugzeuge, Nachrücken); Platz-Regel des Kaufdialogs in `cabin.ts`; Bau-Festlegung F38 (Paket 3.7 geteilt); 43 neue Tests, 1010 grün |
| 19.11.2026 | 3.7b | Konkurrenz Teil 2 in `src/model/rivalMonth.ts`: geglätteter Gewinn, Verlierer (ausdünnen oder streichen, Kernnetz 2), Feinabstimmung mit +2 %-Regel; Planung mit Vorauswahl (Suchbreite + 2 zufällige), 100/60/30 % der Umläufe, Planer-Hauptzahl mit Schätzfehler; Slots mit Anteil 0,25/0,10 der Grenze und Verkauf nach 6 freien Monaten, Schalter mit `deskLoad ≤ 0,8`, Stufe 2 an Drehkreuzen, Lounge (Feld `buildsLounge`), Sperre durch Spieler-Stufe 3 (E63); Kauf-Bedingungen, Typ nach Planer-Hauptzahl je Preis, Modernisierung, Überholung, Not- und Leerlauf-Verkauf; Krisenstärke aus Weltereignissen und Treibstoff-Tabelle (Juni 1974 Krise), Krisen-Fahrplan; Größe in Sitzen, neues Drehkreuz, Dividende; Zuschuss mit `atCost` (Beispiel 7.18); Notlage in Folge, Auflösung, Übernahme zum Unternehmenswert (Beispiel 7.18: 198,7 Mio. $); Ticker nach Fluggästen, Meldungs-Regel; `departuresAt`/`departuresOnPair` in `airportCosts.ts`; Paket 3.8 in 3.8a/3.8b geteilt; Bau-Festlegung F39; 58 neue Tests, 1068 grün |
| 19.11.2026 | 3.8a | Monatsabschluss Teil 1: `src/model/monthEvents.ts` (17 geschichtliche Ereignisse und 8 Zufalls-Vorlagen als Daten, nur über `eventDemandFactor`; Krisen-Antworten als Anteil von Treibstoff-Rechnung bzw. Erlös, `hedgedFuelTable`, `crisisResponseFactor`; Defekt je Flugzeug, Flughafen-Streik und Winterwetter für alle, Vogelschlag 0,5 % des Neupreises; Moral, Streik, Lohn-Untergrenze; Pech-Deckel mit fester Wurf-Reihenfolge und neutralem Merkmal `badLuckCap`; `disruptionShares`, `companyCancelledShare`, Charter je Flug; Verschleiß aus geflogenen Stunden) und `src/model/fleetMarket.ts` (Händler-Spanne −15 % / +5 %, Gebrauchtmarkt bis Bauende mit Weiterverkauf, Vorbestellung mit Rabatt bis 12 %, Überholung `max(4 % Neupreis, Wertgewinn)` mit Werft-Zuschlag, Umbau mit `atCost`, Kreditlinie, Zwangsverkauf, Pleite); `saleCandidate` gemeinsam mit dem Notverkauf der KI; Beispiel 8.17 (Flottenmarkt, Charter, Rückgewinnung, Kreditlinie, Defekt, Verschleiß) nachgerechnet; Spezifikation 8.9 „Folge“ berichtigt; Bau-Festlegung F40; 74 neue Tests, 1142 grün |
| 19.11.2026 | 3.8b | Monatsabschluss Teil 2 in `src/model/monthClose.ts`: Modell-Spielstand (`ModelState`, `CompanyState` mit neutralen `CompanyInputs`, Kassenbuch `MonthLedger`, Vorbestellungen), `monthOperations` (eine Marktaufteilung je Paar und Klasse für alle, Satisfaction, Erlös, Kosten mit Abschnitt-8-Posten, Verschleiß, Wert, Vogelschlag, Einnahmen der Stufe 3) als Abschluss und Vorhersage, `closeMonth(state, decisions)` in der Reihenfolge 8.0 (Buchung, Ruf, Entscheidungen von außen, Lieferungen, Kreditlinie, Zwangsverkauf, Spielende, Gewinnserie, Bericht, Prüfung 8.16, Übergang mit Preisen, Moral, Würfen, Gebrauchtmarkt), `buyAircraft`/`sellAircraft`/`spend` für Einmalausgaben; `RIVAL_INPUTS` um `staffModel`, `forcedSale`, Krisen-Antworten ergänzt; 22 Regeltests (Kassen-Gleichung, Reihenfolge der Gesellschaften, Lieferung und Vogelschlag im Bericht, keine globalen Daten, halber Flugplan, Charter, Kreditlinie, Vorhersage = Abschluss, Preise ab X+1), 1164 grün; Paket 3.8 weiter geteilt (F41) |
| 19.11.2026 | 3.8d | Monatsabschluss Teil 4 in `src/model/rivalMonth.ts`: Eröffnungen freier Flugzeuge mit Planer-Hauptzahl einer neuen Strecke und Slot-Kauf an beiden Enden (fairer Anteil je KI, F43), Kauf mit Strecke (Bezugs-Typ, dann bester Typ je Kaufpreis), Modernisierung, Kabinen-Erneuerung mit derselben Kabine, neues Drehkreuz, VIP-Lounge, Verkauf 6 Monate freier Slots, Schalter, Fahrpläne `rivalSchedule`; Zuschuss als Zeile „Subsidy“ (`costTotals.ts`); Gründung `foundRivalCompany` und Nachrücken `rivalRefill` als letzter Schritt von `closeMonth`; `rivalAircraft` in `rivals.ts`; 21 neue Tests (1206 grün) |
| 19.11.2026 | 3.9a | Balance-Skript Teil 1: `npm run balance` (`src/balance/`, `scripts/balance.ts`), Beispiel-Welten mit `monthOperations`, bester Preis je Klasse, Preiskampf zweier gleicher Gesellschaften, Empfindlichkeit der Marktgröße über ein Ereignis im Beispiel-Spielstand; 19 Prüfregeln zu Abschnitten 1–5 (5 ok, 2 Abweichung, 12 Info), Bericht `balance/3.9a-bericht.md`, Bewertung `BALANCE.md`; Funde: ein Flugzeug fast überall bei jedem Preis voll (Margen 59–77 %), Marktgröße aller Paare wächst × 2,78 statt × 2,5, Preiskampf ohne festen Punkt → O60–O62; Paket 3.9 in 3.9a–c geteilt (F44); 9 neue Tests (1215 grün) |
| 19.11.2026 | – | O61 → E64 (Wachstum 1960 → 2019 als Summe aller Paare, `DEMAND_GROWTH_1960_2019` 2,5 → 2,25; Summe jetzt × 2,51), O62 → E65 (Preiskampf ohne festen Punkt; B4.3 nur Info, Schrittgrenze erst bei Sprüngen in 3.9b); `SPEZIFIKATION.md` 3.3, 7.6 angepasst; Prüfregeln B3.1, B4.3 umgestellt; Bericht `balance/O61-O62-bericht.md` (6 ok, 0 Abweichung, 13 Info); `BALANCE.md` mit neuen Zahlen |
| 19.11.2026 | 3.9b | Balance-Skript Teil 2: Langläufe ohne Spieler (`src/balance/longRun.ts`, `competition.ts`, `scripts/balance-run.ts`, `npm run balance -- --long`), 26 Läufe; Bericht `balance/3.9b-bericht.md` (10 ok, 0 Abweichung, 20 Info), Funde 4–10 in `BALANCE.md`; Planer-Rechnungen nur auf gebrauchten Märkten (F46, ~135-mal schneller, gleiches Ergebnis), Fehler KI-Kabinen-Erneuerung (F45); neue Fragen O63, O64, O60 mit neuer Empfehlung A. |
| 19.11.2026 | – | O60, O63, O64 entschieden: E66 (KI an fremden Drehkreuzen), E67 (Marktgröße kleiner, Faktor per Skript), E68 (Zuschuss nach E66/E67 abschalten); neues Paket 3.9d |
| 19.11.2026 | 3.9c | Balance-Skript Teil 3: Abschnitte 6 und 8 ohne Langlauf (`src/balance/career.ts`, `events.ts`), 17 neue Prüfregeln B6.1–B6.8, B8.1–B8.9; Bericht `balance/3.9c-bericht.md` (15 ok, 0 Abweichung, 21 Info), Funde 11–21 in `BALANCE.md`: Ruf-Skala, Werbung, Charter, Flottenmarkt, Szenario-Ruf 55 ok; Klassen-Forschung heute ok, nach E67 neu prüfen; Krisen-Antworten lohnen sich 1,8- bis 5-fach → neue Frage O65; Bau-Festlegung F47; 9 neue Tests (1233 grün). |
| 19.11.2026 | – | O65 entschieden: E69 (`HEDGE_PRICE_SHARE` 0,2 → 0,35; `RECOVERY_PRICE_SHARE` nach E67 neu messen); Umsetzung in Paket 3.9d |
| 20.11.2026 | 3.9d (Teil 1) | E66 umgesetzt (`TargetCandidate.otherRivalHub`, `PRESELECT_RIVAL_HUB_WEIGHT` = 2, Spezifikation 7.9), `HEDGE_PRICE_SHARE` 0,35 (E69, Spezifikation 8.5); Langlauf mit Auslastung / Marge je Länge und Prüfregel B7.10 (F48); 16 Kalibrier-Läufe zu E67: Auslastung bleibt bei jeder Marktgröße 100 %, Marge × 1 47 %, × 0,5 37 %, × 0,3 31 %; E66 teilt nur 1–3 % der Paare → neue Frage O66, `DEMAND_SCALE` unverändert; Kurzbericht `balance/3.9d-bericht.md` (15 ok, 0 Abweichung, 21 Info); 2 neue Tests (1235 grün) |
| 20.11.2026 | – | O66 entschieden: E70 (Marge der KI über Preis gegen Kosten: Grundpreis senken, Langstrecke stärker, Marktgröße kleiner) |
| 20.11.2026 | 3.9d (Rest) | E70 umgesetzt: `DEMAND_SCALE` 29 → 14,5, `DISTANCE_EXP` 0,5 → 0,3, `FARE_TIME_FACTOR` 1,04 … 0,50 (Kalibrierung mit 8 Varianten), `RECOVERY_PRICE_SHARE` 0,25 (E69); Spezifikation 3.4, 3.6, 4.1, 4.8, 4.13, 5.18, 8.5, 8.17; Balance-Skript mit gewinnbester Abflugzahl; Langläufe neu: Marge KI 23 %, Auslastung 100 %, ähnlicher Erfolg kippt (Faktor 2,5–2,7), Zuschuss bleibt (E68); neue Frage O67 |
| 20.11.2026 | – | O67 entschieden: E71 (A, Paket 3.9e „Persönlichkeiten“) |
| 20.11.2026 | 3.9e | E71 umgesetzt: Gründung nur mit möglicher Gewinn-Strecke (`rivalHubViable`), Überschall nie Startflugzeug (F50), LCC Preis-Lage 0,95, Boutique Kaufneigung 0,9 und 2 Drehkreuze, Startflugzeug-Gewichte (Kalibrierung mit 4 Varianten, F51); Langläufe: ähnlicher Erfolg 1,36 / 1,60 (ohne Zuschuss 1,81 / 1,70), 0 Auflösungen; Zuschuss abgeschaltet (E68); Bericht `balance/3.9e-bericht.md` (20 ok, 0 Abweichung, 28 Info); 3 neue Tests (1238 grün). Phase 3 abgeschlossen |
| 20.11.2026 | 4.1 | Glossar und Erklärtexte aus den Konstanten: `src/model/glossary.ts` (18 Einträge, `loungeEffectText`, Zahlen-Texte), `InfoTooltip.tsx` übernimmt sie (3 Einträge bleiben bis 4.3–4.5), Lounge- und Stand-Text in `AirportDetailView.tsx`, Flotten-Spalte erklärt Cabin rating; Pakete 4.2–4.7 eingetragen; Bau-Festlegung F52; 9 neue Tests (1247 grün) |
| 20.11.2026 | 4.2 | Regeln aus `App.tsx`: gleiche Werte aufs Modell umgestellt (`overhaulPoints`, `refitCabinCondition`, `START_REPUTATION`, `START_HUB_SETUP`, `seasonFactor`, neu `yearsPlayed`, `hedgeLockMonth`, `startCapital` mit `START_CAPITAL_TIERS_1960`), Ruf + 2 bei Übernahme entfernt (E38), Trend-Text `formatTrend`; Bau-Festlegung F53; neue Frage O68 (Monatsabschluss vor den Ansichten umstellen); 5 neue Tests (1252 grün) |
| 20.11.2026 | – | O68 entschieden: E72 (A, erst der Monatsabschluss, dann die Ansichten) |
| 20.11.2026 | 4.2b | Brücke Teil 1 in `src/lib/modelBridge.ts`: Welt (`modelAirports`, `modelCatalog`), Kabine (Schalter des Kaufdialogs → `interiorScore`, `cabinListPrice`), Flugzeuge (`aircraftState`, neues Feld `cabinInstalledAt`), Bestand (`holdingState`), Strecken (`routeState`: Flugabschnitte, Fahrplan in Minuten, Preisniveau aus $, Alter, Service), Zurückschreiben nach `closeMonth` (Zustand, Preise in $ des neuen Monats, verkaufte Flugzeuge); Teilung 4.2b–4.2e (F54); 19 neue Tests (1271 grün) |
| 20.11.2026 | 4.2c | Brücke Teil 2 in `src/lib/modelBridgeCompany.ts`: Eingaben (Forschung, Lohn, Moral, Kampagnen, Frequent flyer, Schwierigkeit, Krisen-Antworten aus `eventChoices`, Streik), Kassenbuch aus `capital` und `monthlyCapex` mit `LedgerValues`, Vorbestellungen (Standard-Kabine) und Lieferungen als Flugzeuge der Flotte, Fortschritt (Rang-Werte aus Berichten, Forschung, Meilensteine mit Kennungs-Übersetzung, Jahresziel, Szenario mit neuen Feldern `floorStreak`/`met`), Berichte in beide Richtungen; ein Monat mit `closeMonth` über die Brücke; F55; 18 neue Tests (1289 grün) |
| 20.11.2026 | 4.2d | Brücke Teil 3 in `src/lib/modelBridgeWorld.ts`: KI als `RivalRecord` (`CompanyState` mit `agent`, Name, Kürzel, Farbe), Umwandlung alter `AiAirline` (Kennung `rival-<Kürzel>`, Kabine nach `rivalCabin`, Slots und Schalter wie bei einer Eröffnung, Gedächtnis, Notlage, Berichte), Ansicht `rivalView`, Namen und Farben neu gegründeter KI (BOAC/British Airways nach Jahr); Welt als `WorldState` (Startwert, Ereignisse ohne Treibstoff-Faktor, Störungen je Flugzeug, Pech, Weiterverkauf), Ansicht der Störungen, Charter-Antwort, neue Kennungen gelieferter Flugzeuge; `plainReport` in Teil 2; F56; 15 neue Tests (1304 grün) |
| 20.11.2026 | 4.2e | Zusammensetzung in `src/lib/modelMonth.ts`: `modelGame` (ganzer Spielstand → `ModelState`, Spieler mit Drehkreuzen Heimat + Stufe 2/3, KI, Welt mit Charter-Antworten), `runModelMonth` (`closeMonth` mit `rivalDecisions`/`rivalRefill`, alle Felder für X+1, Lieferungen mit Kennzeichen, neues Feld `overdrawnMonths`), `closeNewsMessages` (Texte, KI-Meldungen nach 7.17); Teilung 4.2e/4.2f/4.2g (F57); 13 neue Tests (1317 grün) |
| 20.11.2026 | 4.2f | `App.tsx` bucht den Monat mit dem Modell: `src/lib/modelMonthClose.ts` (`modelMonthClose` über `runModelMonth`, dazu Ereignis-Meldungen, Krisen-, Streik- und Störungs-Fragen, Vogelschlag-Hinweise, Chronik, Zeitung mit Marktanteil, Szenario-Sterne, Jahresziel-Dialog, Autosave), neue Spielstand-Felder `rivals`, `modelWorld`, `ledgerValues`, `overdrawnMonths`, `withTradeValue` bei allen Geschäften, Fragen ohne Ruf-Sprung (E38), Übernahme auch aus `rivals`; Fund im Browser: Zeitung meldete beim ersten Abschluss jede KI als aufgelöst und neu (behoben, `rivalViewsBefore`); F58; 11 neue Tests (1328 grün) |
| 20.11.2026 | 4.2g | Geschäfte und Kopfzeile nach dem Modell in `src/lib/modelTrades.ts`: „× 4“ → `WEEKS_PER_MONTH` (3 Stellen), Treibstoff des Spielers aus `fuelPrice` mit `hedgedFuelTable` (ohne Hard-Zuschlag, ohne Ereignis-Faktor; auch für die Vorschau), Ereignis-Faktor der Kopfzeile aus `worldEventDemandFactor`, Grundüberholung mit `overhaulQuote` und Hangar an den Strecken des Flugzeugs (`GENERAL_CHECK_COST` entfernt, Preis in der Flughafen-Ansicht), Übernahme mit `takeoverPrice`, Kasse der KI, Slots und Schaltern je Flughafen (`takeoverHoldings` im Modell), Angebot in der Konkurrenz-Ansicht; Fehler: Übernahme buchte den Flugzeugwert als Gewinn (jetzt Kauf zum Wert + Rest); F59; 12 neue Tests (1340 grün) |
| 21.11.2026 | 4.3 | Flughafen und Infrastruktur nach dem Modell in `src/lib/modelAirport.ts`: `AirportPricing` (Monat, Forschung, Meilensteine, gekaufte Slots der KI) aus `App.tsx` an Flughafen-Ansicht, -Liste und Planer; Slot-Grenze aller Gesellschaften in Slots (E50); Slot-, Stufen- und Einrichtungs-Preise mit Kostenindex (W1, W3), Verkauf zu `slotResalePrice`; Mieten, Unterhalt, Gebühren und Schalter-Last wie der Abschluss (Test gegen `monthOperations`); Schalter-Pflicht mit einem Schalter beliebiger Art (E18, E55, macht den Premium-Abzug erreichbar); Grundüberholung an jedem Flughafen (E62); Texte der Stufen, des Hangars, der Küche und der Drehkreuz-Güte aus den Konstanten; `getSlotPurchaseCost` und globaler Slot-Faktor entfernt; F60; 15 neue Tests (1355 grün) |
| 21.11.2026 | 4.4 | Zeitplan nach dem Modell in `src/model/schedule.ts` (F61): Konstanten Bodenzeit, Wende je Bauart, 5-Minuten-Raster; `tripBlockMinutes` ersetzt alle Kopien der Umlaufzeit im Planer; `tripsPerDay` (E51) für Planer und Zeitplan-Editor mit den übrigen Strecken des Flugzeugs (Editor bisher ganzer Tag, W6); Slots je Ende nach 1.6 (`tripSlotsAt`, `scheduleSlotsAt`; Einweg nur am Start) in `getUsedWeeklySlots`, Planer, Editor und Flugzeugwechsel; `getFlightDurationMinutes` aus `blockMinutes` (3.1); Auslastung `weeklyUtilization` einheitlich; Glossar `utilization` ins Modell (Tooltip an „% USE“ und „Trips / day“); 10 neue Tests (1365 grün); im Browser Planer und Editor mit zwei Strecken auf einem Flugzeug geprüft |
| 21.11.2026 | 4.5a | Preis-Schritt des Planers nach dem Modell in `src/lib/modelRoute.ts` (F62): `routeForecast` (Entwurf über `withPlannedRoute` im Spielstand aus `modelGame`, `plannerRouteFigures` nach dem Anlauf und im ersten Monat), `routeBestFares`, `pricesAtLevel`; `App.tsx` baut `plannerModel` nur bei offenem Planer; Schritt 4 mit Hauptzahl, Nebenzahlen (First month, before aircraft costs, Full aircraft), Kosten nach Posten, Gewinnschwelle erwartet / voll je Klasse, Startpreis = Marktpreis, „Adjust All“ als Preisniveau, „Market fares“, „Set best fares“, Debug nur mit Modellwerten (E52); BE99/75/35 und 1 / 1,6 / 3 / 5 entfernt (W5, E23); Glossar `breakEven` aus dem Modell; Paket 4.5 in 4.5a/b/c geteilt; 11 neue Tests (1376 grün); im Browser neue Strecke und Preis-Editor geprüft |
| 22.11.2026 | 4.5b | Satisfaction der Strecke im Planer nach dem Modell (F63): `routeSatisfactionSetup` (eine Vorbereitung für Abschluss und Planer) und `routeSatisfactionDetail` in `src/model/monthClose.ts`, Brücke `plannedSatisfaction` in `src/lib/modelRoute.ts`; Planer Schritt 3 (Satisfaction je Klasse ohne %, Route satisfaction nach 2.9, Tabelle der Teile, Boden je Ende, Verpflegung je Woche aus `routeForecast` ab Schritt 3) und `RouteConfigOverlay.tsx` (Flugzeit-Index, `mealCount`, Gerichte-Stufen und Ausstattung aus `serviceCapability`, Preise des Monats) ohne `getRouteClassSatisfaction` / `getDeskSim`; 5 neue Tests (1381 grün); im Browser FRA–LHR 1960 geprüft |
| 22.11.2026 | 4.5c | Strecken-Ansichten nach dem Modell (F64): `routesThisMonth` in `src/lib/modelRoute.ts` (aus `monthOperations`, R2); `App.tsx` baut den Modell-Spielstand im ganzen Spiel, Liste, Streckenansicht und Karte (`routesWithMetrics`, `routeHeat`) lesen ihn; Liste mit „Time index“ (E9), „Forecast / Month“ und „Last month“; Streckenansicht mit Satisfaction 0–160, Service erwartet / geliefert, Erlös je Klasse, Fluggast- und feste Kosten, Planer-Hauptzahl; Planer speichert keine alten Kennzahlen mehr; 5 neue Tests (1386 grün); im Browser FRA–LHR 1960 geprüft (Liste = Planer = Streckenansicht) |
| 22.11.2026 | 4.6a | Paket 4.6 geteilt; Kauf- und Umbau-Dialog nach dem Modell (F65): `cabinQuote` und Listen der Teile in `src/lib/modelCabin.ts` (Platz 7.5, Interior score mit Teilen 2.3, Type appeal und Cabin rating 2.2/2.4, Kabinen-Listenpreis 5.13, Kaufpreis = Wert 8.12, Umbau-Preis mit Lohn 8.13); `ConfigurePurchaseView.tsx` ohne eigene Tabellen, Preise in $ des Monats, Anzeige nach E9 mit Preis in Teilen; Kaufliste „New Price“ mit Kostenindex; Hinweis zu `menuPoints` im Kabinen-Fenster der Strecke; 8 neue Tests (1394 grün); im Browser geprüft (A330-300 2010: Kauf und Umbau buchen genau den angezeigten Preis). |
| 22.11.2026 | 4.6b | Flotte, Flugzeug-Details, Gebrauchtmarkt, Übernahme-Kabine und Vorbestellung nach dem Modell (F66): `src/lib/modelFleet.ts` (`planeFigures`, `planeUpkeep`, `usedMarket`, `stateCabin`, `takeoverFleet`, `preorderQuote`); Flotte mit „Cabin rating (avg.)“ und Type appeal (E9), Detail-Fenster mit Alter, Cabin rating je Klasse, Unterhalt und Marktwert aus dem Modell (Art D „Alter“, „Wiederverkauf“); Verkauf zu `saleProceeds`, verkaufte Flugzeuge im Gebrauchtmarkt; Gebrauchtkauf mit Kabine und Baumonat; Übernahme mit der Kabine der KI; Vorbestellung mit Rabatt, Anzahlung und Rest des Modells; 13 neue Tests (1407 grün); im Browser geprüft (alle Beträge = Buchung) |
| 23.11.2026 | 4.7a | Paket 4.7 geteilt; Kopfzeile, Firma, Monatsbericht und Spielende nach dem Modell (F67): `src/lib/modelReport.ts` (`reportView`: Posten aus 5.16, Weg vom Ergebnis zur Kasse 8.2, Kreditlinie), `src/lib/modelCompany.ts` (`playerWorth`, `creditStatus`, `playerScore`, `eventEffect`, `fleetMix`, `goalMissPenalty`); Bericht speichert alle Einmalzahlungen und `cash`; Firma mit Buchwert und Unternehmenswert; Kredit-Band in der Kopfzeile; Bankrott trägt die Laufbahn ein; 17 neue Tests (1424 grün) |
| 23.11.2026 | 4.7b | Paket 4.7b geteilt (4.7c Planer Schritt 1, neu 4.8 Werbung und Personal); Live-Karte, Konkurrenz und Netz nach dem Modell (F68): Modell liefert Umsteige-Ströme (`CompanyOperations.transferFlows`); `src/lib/modelNetwork.ts` (`playerMonth`, `hubTransfers`, `ffpForecast`) ersetzt `computeNetworkFinancials` in `App.tsx` (Flughafen „Transfer Hub“, Ströme in der Streckenansicht, Besatzung, Frequent flyer); Live-Karte mit der Auslastung des Modells (W7); `src/lib/modelRivalProfile.ts` (Steckbrief aus `PERSONALITIES`, Frist bis zur Auflösung); `transferHubs` im Bericht und Chronik; 14 neue Tests (1438 grün) |
| 23.11.2026 | 4.7c | Planer Schritt 1, Ereignis-Band und Krisen-Frage nach dem Modell (F69): `pairMarket` / `routeMarket` (Marktgröße mit allen Teilen, Klassen-Anteile, Fluggäste je Klasse, Marktpreise); „/ WK MARKET“ und Debug aus dem Modell; `src/lib/modelEvents.ts` (`eventBand`, `crisisBase`, `pricedChoices`) für Band und Frage; Preis der Krisen-Antwort nach 8.5 statt fester Beträge, ohne Bezugsgröße gesperrt; neue offene Frage O69; 17 neue Tests (1455 grün) |
| 23.11.2026 | O69 | Entscheidung E73 (Weg A) umgesetzt (F70): Preis der Krisen-Antwort × Restdauer im Monat der Wahl (`remainingEventMonths`), ohne Bezugsgröße weiter gesperrt; Spezifikation 8.5 nachgezogen; 2 neue Tests (1457 grün) |
| 23.11.2026 | 4.8 | Werbung und Personal nach dem Modell (F71): `src/lib/modelMarketing.ts` (Kampagnenpreis `campaignCost` mit Kostenindex, Laufzeit-Preis, Werbe-Faktor je Region, Ruf aus Werbung im Ruf-Ziel, Treue `frequentFlyerFactor`), `src/lib/modelStaff.ts` (Vorschau wie der Übergang zu X+1 mit Pech-Deckel, Lohn-Grenzen, `settleStrike`, `strikeQuestion` ohne Ruf-Abzug); Werbe- und Personal-Ansicht, `App.tsx`, Abschluss-Frage und Chronik umgestellt; neue Frage O70; 17 neue Tests (1474 grün) |
