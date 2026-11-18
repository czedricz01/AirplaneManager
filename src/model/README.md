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
| `satisfaction.ts` | 2 | Zufriedenheit (ohne Kabine): `flightTimeIndex`, `typeAppeal`, `menuPoints`, `mealCount`, `mealWeight`, `serviceCapability`, `servicePoints` (+ `servicePointsParts`); 2.6–2.10 folgen | 3.2a (Teil 1) |
| `cabin.ts` | 2.3, 2.4 | `interiorScore` (+ `interiorScoreParts`), `cabinExtrasPoints`, `cabinRating`, `wearFactor`, `averageCabinRating` (Spezifikation nennt `kabine.ts`, F1) | 3.2a |
| `demand.ts` | 3 | Nachfrage und Marktaufteilung | geplant |
| `fare.ts` | 4 | Preis und Erlös | geplant |
| `costs.ts` | 5 | Kosten, Wertmodell | geplant |
| `progress.ts` | 6 | Ruf, Rang, Fortschritt | geplant |
| `rivals.ts` | 7 | Konkurrenz (KI-Entscheidungen) | geplant |
| `monthClose.ts` | 8 | Monatsabschluss, Ereignisse, Flottenmarkt | geplant |

Wird eine Datei zu groß, wird sie nach Unterabschnitten geteilt (z. B. `costs/fleet.ts`).

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
