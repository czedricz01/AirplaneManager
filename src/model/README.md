# `src/model/` – das neue Rechenmodell

Hier entsteht das Spielmodell nach `docs/neubau/SPEZIFIKATION.md`. Die Spezifikation ist die einzige
Quelle dafür, was gerechnet wird; der Code folgt ihr. Der alte Code in `src/lib/` bleibt, bis die
Oberfläche umgestellt ist (Phase 4) und er entfernt wird (Paket 5.2).

## Aufbau

Eine Datei je Abschnitt der Spezifikation. Code-Dateien heißen englisch wie im übrigen Projekt.

| Datei | Abschnitt | Inhalt | Stand |
|---|---|---|---|
| `constants.ts` | alle | **Alle** Konstanten des Modells, mit Abschnitt-Verweis | 3.1 |
| `basics.ts` | 1 | Zeit (`yearOf`, `timeOf`), `costIndex`, `atCost`, `clamp`, `clampScale`, `difficultyFactor` | 3.1 |
| `rng.ts` | 8.3 | Zufallsgeber `rng(seed, month, purpose, key)`; eigene Datei, weil alle Abschnitte ihn nutzen | 3.1 |
| `index.ts` | – | Öffentlicher Zugang: alles, was Oberfläche und alter Code nutzen dürfen | 3.1 |
| `satisfaction.ts` | 2 | Zufriedenheit (ohne Kabine): `flightTimeIndex`, `typeAppeal`, `menuPoints`, `mealCount`, `mealWeight`, `serviceCapability`, `servedItems` (auch für 5.7), `servicePoints` (+ `servicePointsParts`); Teile `cabinPart`, `servicePart` (+ `expectedServicePoints`), `groundPart` (+ `groundPartParts`, `deskLoad`, `deskOverloadPoints`), `staffPart`, `researchPart`; `satisfactionBreakdown`, `satisfaction`; `directOfferSatisfaction`, `connectionOfferSatisfaction`, `routeSatisfaction`, `airlineSatisfaction`, `satisfactionFactor` | 3.2a, 3.2b |
| `cabin.ts` | 2.3, 2.4, 5.13, 7.5 | `interiorScore` (+ `interiorScoreParts`), `cabinExtrasPoints`, `cabinRating`, `wearFactor`, `averageCabinRating`; Listenpreis der Kabine `cabinListPrice` (+ `cabinListPriceParts`); Platz-Regel des Kaufdialogs `deliverableExtras`, `cabinSpace`, `seatSpace`, `economySeatsLeft` (7.5) (Spezifikation nennt `kabine.ts`, F1) | 3.2a, 3.5b, 3.7a |
| `demand.ts` | 3 | Nachfrage: `distanceKm`, `blockMinutes`, `referenceBlockMinutes`, `citySize`, `worldScale`, `relativeSize`, `businessLinkage`, `tourismLinkage`, `seasonFactor`, `businessShare`, `demandGrowth`, `distanceFactor`, `eventDemandFactor`, `marketSize` (+ `marketSizeParts`), `classShare` | 3.3a |
| `marketSplit.ts` | 3.8–3.12, 3.14 | Aufteilung: `directOffer`, Faktoren der Anziehung (`frequencyFactor`, `priceFactor`, `flightTimeFactor`, `reputationFactor`, `frequentFlyerFactor`, `advertisingRegionFactor`, `advertisingFactor`, `establishedRouteBonus`), `offerAppeal` (+ `offerAppealParts`), `noFlyAppeal`, `classPotential`, `rampFactor`, `marketSplit`, `distributeToRoutes`, `passengerShare`, `departureShare` | 3.3b |
| `transfers.ts` | 3.13 | Umsteige-Verbindungen: `detourRatio`, `connectionWait`, `isFeasibleConnection`, `connections`, `hubQuality`, `connectionFactor`, `transferFare`, `transferClasses`, `transferOffer`, `allocateTransferSeats` | 3.3b |
| `fare.ts` | 4 | Preis und Erlös: `shortHaulFareFactor`, `baseFareEconomy`, `classFareRatio`, `marketFare`/`marketFares`; Preisniveau `clampFareRatio`, `fareRatioOrDefault` (R8), `fareRatioFromInput`, `routeFare`/`routeFares`, `uniformFareRatios`, `fareVsMarket`; `routeRevenue` (+ `routeRevenueParts`), `transferRevenueShare`, `monthlyRevenue`; `bestFareRatio`, `routeClassPassengers`, `bestFare`; `breakEvenFareLevel`; `loadFactor`, `fullAircraftRevenue` | 3.4 |
| `costs.ts` | 5.1–5.8 | Kosten: Faktoren `researchCostFactor`, `payFactor`, `hubFeeFactor`, `airportFeeFactor`; Treibstoff `crisisFuelShape`, `fuelTable`, `fuelPrice`, `aircraftEfficiency`, `fuelLitresPerSeat100km`, `fuelCost`; Besatzung `cabinCrew`, `crewHourlyRate`, `crewCost`; `landingFee`, `landingCost`; `checkInFee`, `handlingFee`; Verpflegung `cateringCost` (+ `cateringCostParts`); `ffpCostPerPassenger`, `departureShares`, `costPerPassenger` (+ `costPerPassengerParts`), `transferCostPerPassenger` (+ `transferCostPerPassengerParts`) | 3.5a, 3.5b |
| `airportCosts.ts` | 5.10, 5.11, 5.15 | Flughäfen: `slotLimit`, `slotPrice`, `slotResalePrice`, `slotRent`, `hasStands`, `standRent`, `isDeskTypeAvailable`, `deskRent`, `airportUpkeep` (+ `airportUpkeepParts`, mit Einrichtungen); `managementTierPrice`, `facilityPrice`, `facilityUpkeep`; `ownerFeeIncome` | 3.5b |
| `fleet.ts` | 5.12, 5.13 | Flotte: `newPrice`, `maintenanceRate`, `familyDiscount`, `varietyPenalty`, `commonalityFactor`, `fleetCommonalityFactors`, `aircraftUpkeep` (+ `aircraftUpkeepParts`); Wertmodell `valueBase`, `newAircraftPrice`, `ageFactor`, `conditionFactor`, `aircraftValue`, `ageDepreciation`, `fleetValueResult` (+ `fleetValueResultParts`) | 3.5b |
| `costTotals.ts` | 5.9, 5.14, 5.16 | Summen: `slotShare`, `routeBlockHours`, `aircraftShare`, `fixedWeeklyCost` (+ `fixedWeeklyCostParts`), `routePassengerCost`, `routeResult`; `campaignCost`, `ffpBaseCost`; `monthlyCosts`, `monthlyResult`, `unattributedWeeklyCost` | 3.5b |
| `progress.ts` | 6 | Ruf `satisfactionReputation`, `cancelledShare`, `cancellationPenalty`, `advertisingReputation`, `reputationTarget` (+ `reputationTargetParts`), `reputationChange` (mit Ursachen), `reputationBand`; Rang `rankStats`, `averageRankStats`, `qualifyingRank`, `nextRank`, `effectiveRank`, `rankDef`, `hubAllowance`, `researchSlots`, `hasUnlock`, `isAirportOpen`, `rankProgress`; Flugzeugklassen `sizeClassOf`, `classResearchOf`, `openSizeClasses`, `startingClassResearch`, `classResearchChainMonths`; Forschung `researchProject`, `researchEffects` (einzige Zusammenfassung der Felder), `researchPrice`, `startingResearch`, `researchStartBlocker`, `startResearch`, `researchProgress`, `advanceResearch`, `completedBonusResearch`, `researchEffectLines`; Meilensteine `milestoneDef`, `milestoneThreshold`, `newMilestones`, `milestonePrize`, `milestonePrizeTotal`, `milestoneSlotFactor`, `milestoneHubs`, `nextProfitStreak`, `milestoneRequirementText`; Jahresziel `isDecember`, `goalBase`, `goalReward`, `goalPenalty`, `niceDollars`, `annualGoalOffers`, `chosenGoal`, `yearSnapshot`, `goalValue`, `goalMet`, `goalFraction`, `settleGoal`; Karriere `companyValue`, `careerScore`, `fileCareer`, `splitHall` | 3.6a, 3.6b |
| `rivals.ts` | 7 | Konkurrenz (nur Entscheidungen der KI, E44): neutrale Eingaben `RIVAL_INPUTS` und Text-Liste `RIVAL_OMITTED` (7.2); `rivalStrengthDef`, `rivalStrengthOf` (7.3); `personalityDef`, `rivalPatience`, `rivalBuyChance`, `rivalCashReserve`, `rivalDeskType`, `targetWeight`, `longHaulFactor` (7.4); `seatTypeAtLevel`, `rivalCabin`, `rivalService` (7.5); `rivalTargetFareRatio`, `nextYieldPosition`, `rivalPriceFloor`, `rivalFareRatio`, `priceWarStep`, `inPriceWar` (7.6); `weightedPick`, `rivalStartCash`, `rivalStartSetup`, `fictionalRivalCount`, `mayFoundAt`, `realRivalWeight`, `fictionalHubWeights`, `shouldRefill`, `startFleetKinds`, `isOnMarket`, `startAircraftScore`, `pickStartAircraft` (7.7) | 3.7a; 7.8–7.17 folgt in 3.7b |
| `monthClose.ts` | 8 | Monatsabschluss, Ereignisse, Flottenmarkt | geplant |

Wird eine Datei zu groß, wird sie nach Unterabschnitten geteilt (so Abschnitt 5: `costs.ts`, `airportCosts.ts`,
`fleet.ts`, `costTotals.ts`, F32).

## Regeln für jeden Code hier

- **R1 Ein Markt, eine Rechnung.** Alle Angebote eines Städtepaars werden einmal gemeinsam aufgeteilt;
  Spieler und KI nutzen dieselbe Rechnung.
- **R2 Eine Funktion je Größe.** Ansichten rechnen nicht selbst; sie lesen Werte aus dem Modell.
- **R3 Keine Spielregeln in `App.tsx` oder Klick-Handlern.** Sie stehen hier.
- **R4 Intern ungerundet, einmal kappen.** Kein Runden in Zwischenschritten; jede Skala (`SCALES`)
  wird einmal mit `clampScale` gekappt, am Ende der Funktion, die sie festlegt. Runden nur in der Anzeige.

Dazu:

- **Konstanten nur in `constants.ts`.** Keine Zahl mit Spielbedeutung in einer anderen Datei.
- **Feste Dollar-Beträge** als Wert von 1960 mit Endung `_1960`; umgerechnet nur mit `atCost(betrag, month)`.
  `costIndex` wird sonst nirgends mit einem Betrag multipliziert.
- **Reine Funktionen.** Kein Modul-Zustand, keine globalen Daten ändern, kein `Math.random`
  (Zufall nur über `rng`), kein Datum der Uhr.
- **Ungültige Zahlen nicht verstecken.** `clamp` lässt `NaN` durch; die Prüfung am Ende des
  Monatsabschlusses (Spezifikation 8.16) findet ihn. Kein `|| 0` als Ersatz.
- **Keine Abhängigkeit von `src/lib/`** (außer reinen Datentabellen in `src/data/`). Das neue Modell
  steht für sich; doppelte Konstanten (z. B. `LITRES_PER_GALLON`) verschwinden mit dem alten Code (5.2).

## Regeltests

Je Regel aus der Spezifikation ein Test in `<datei>.test.ts`. Der Testname beginnt mit dem Abschnitt:

```ts
describe('Abschnitt 1.3 Geld und Kostenindex', () => {
  it('1.3: costIndex(0) = 1', () => {
    assert.equal(costIndex(0), 1);
  });
});
```

- Läuft mit `npm test` (Node-Testrunner über `tsx`, wie die Tests in `src/lib/`).
- Eine Regel, die erst später prüfbar ist, bekommt ihren Test in dem Paket, das die Größe baut.
- Zahlen mit Rundungsfehlern mit einer kleinen Toleranz vergleichen, nicht mit `Math.round`.
