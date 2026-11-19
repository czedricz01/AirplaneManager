# Balance-Skript: Auswertung

Das Balance-Skript rechnet mit den Funktionen aus `src/model/` Beispielwerte für typische Strecken und Jahre und prüft
die Balance-Regeln der Spezifikation. Es ändert keine Konstante. Ob eine Stellschraube geändert wird, entscheidet der
Mensch (Fragen in `ENTSCHEIDUNGEN.md`, Abschnitt „Offen“).

## Aufruf und Aufbau

```bash
npm run balance
```

```bash
npm run balance -- --out docs/neubau/balance/O61-O62-bericht.md
```

Mit den Langläufen der KI (Paket 3.9b, 26 Läufe, mit 4 Prozessen etwa 45 min):

```bash
npm run balance -- --long --jobs 4 --out docs/neubau/balance/3.9b-bericht.md
```

Weitere Optionen: `--runs`, `--years`, `--strength-runs`, `--cache`, `--reuse` (siehe `scripts/balance.ts`).

| Datei | Inhalt |
|---|---|
| `scripts/balance.ts` | Aufruf (Konsole oder Datei mit `--out`) |
| `src/balance/index.ts` | alle Abschnitte zu einem Bericht |
| `src/balance/report.ts` | Aufbau (Prüfregel mit Urteil, Tabelle, Abschnitt), Zahlen-Format, Markdown |
| `src/balance/world.ts` | Beispiel-Welten: kleiner `ModelState` mit einer oder zwei Gesellschaften, gerechnet mit `monthOperations` (dieselbe Rechnung wie Planer und Abschluss, R2) |
| `src/balance/market.ts` | Abschnitte 1–3: Zeit und Geld, Zufriedenheit, Nachfrage (alle 115 440 Städtepaare) |
| `src/balance/routes.ts` | Abschnitte 4–5: typische Strecken beim gewinnbesten Preis, Empfindlichkeit der Marktgröße, Preiskampf |
| `src/balance/longRun.ts` | Langlauf ohne Spieler: Gründer je Persönlichkeit, `closeMonth` Monat für Monat, Messwerte je Jahr (3.9b) |
| `src/balance/competition.ts` | Auswertung der Langläufe: Prüfregeln B7.x und B3.13, Tabellen (3.9b) |
| `scripts/balance-run.ts` | ein Langlauf in eigenem Prozess (für `--jobs`) |
| `src/balance/balance.test.ts` | Tests des Skripts (Format, Beispiel-Welten, kurze Langläufe) |
| `docs/neubau/balance/3.9a-bericht.md` | Ausgabe des Skripts (Stand 3.9a, vor E64 und E65) |
| `docs/neubau/balance/O61-O62-bericht.md` | Ausgabe des Skripts nach E64 (`DEMAND_GROWTH_1960_2019` = 2,25) und E65 |
| `docs/neubau/balance/3.9b-bericht.md` | Ausgabe mit Langläufen (aktueller Stand: 10 ok · 0 Abweichung · 20 Info) |

Der Code liegt in `src/balance/`, damit `npm run lint` ihn prüft (`scripts/` ist davon ausgenommen). Die Oberfläche
importiert nichts von dort.

**Urteile:** **ok** = Regel der Spezifikation gilt · **Abweichung** = Regel gilt nicht, Entscheidung nötig ·
**Info** = die Spezifikation nennt keine feste Grenze; der Wert wird hier bewertet.

**Rahmen der Beispiele (F44):** Monat Mai (Saison 1,03, nahe am Jahresmittel), neue Flugzeuge, Kabine und Service nach
der Persönlichkeit (`rivalAircraft`, `rivalService`, 7.5; meist „Flag“), Ruf 50, Lohn 100 %, keine Forschung, Strecke
24 Monate alt (Anlauf vorbei), Preis = gewinnbester Preis je Klasse (4.10). „Heute“ ist 2019, weil 2020 die Pandemie
(Faktor 0,2) läuft.

## Ergebnis Paket 3.9a (Abschnitte 1–5)

Stand 3.9a: 5 ok · 2 Abweichung · 12 Info (`balance/3.9a-bericht.md`).
**Nach E64 und E65 (19.11.2026): 6 ok · 0 Abweichung · 13 Info.** Alle Zahlen: `docs/neubau/balance/O61-O62-bericht.md`.
Die Zahlen in Fund 1 und in der Tabelle „Weitere Werte“ stammen aus diesem neuen Bericht; durch die etwas kleinere
Marktgröße (E64, im Jahr 1990 −5 %) sinken beste Preise und Margen leicht.

### Fund 1: Ein Flugzeug ist fast überall bei jedem Preis voll (B4.1, B4.5, B5.4) → entschieden: E67 (O60 = A)

Die Marktgröße eines typischen Paars ist viel größer als das, was ein Flugzeug anbietet: FRA–MAD 1990 hat
7 930 Fluggäste je Woche, ein A320ceo mit 14 Abflügen 1 876 Sitze. Ohne Rivalen hebt die Knappheit den besten Preis
(4.4, 4.10) weit über den Marktpreis:

| Strecke (allein) | Bester Preis Y | Auslastung | Marge | Kaufpreis zurück nach |
|---|---|---|---|---|
| ATR 72-200 HAM–NUE 1990 | 4,00 (Obergrenze) | 100 % | 77 % | 1,2 Jahren |
| A320ceo FRA–MAD 1990 | 3,37 | 97 % | 73 % | 1,4 Jahren |
| A330-300 FRA–JFK 1995 | 1,21 | 87 % | 70 % | 1,1 Jahren |
| 787-9 FRA–SIN 2019 | 1,26 | 97 % | 70 % | 1,4 Jahren |

- Alle 11 Strecken bringen Gewinn (E7 erfüllt, B5.5), aber mit Margen von 58–77 %; ein neues Flugzeug ist nach
  0,4–2,1 Jahren bezahlt. Zwei kurze Strecken bleiben sogar beim höchsten Preisniveau 4 voll.
- E24 („ohne Rivalen ist der Marktpreis etwa der erlösbeste Preis“) gilt nur, wenn die Sitze reichen. Das ist bei einem
  Flugzeug fast nie der Fall.
- Ursache ist nicht der Preis und nicht die Kosten: Die Gewinnschwelle liegt bei voller Maschine beim 0,3- bis
  1,2-Fachen des Marktpreises (1,2: Caravelle 1962); bei Auslastung 75 % und Marktpreis deckt eine Mittelstrecke ihre Kosten knapp. Das ist
  vernünftig. Zu groß ist der Markt je Flugzeug.
- Empfindlichkeit (B4.5, Marktgröße × Faktor, wie ein kleineres `DEMAND_SCALE`):

  | Strecke allein | × 1 | × 0,5 | × 0,25 | × 0,1 |
  |---|---|---|---|---|
  | ATR 72-200 HAM–NUE 1990: Preis / Marge | 4,00 / 77 % | 2,84 / 67 % | 1,95 / 52 % | 1,29 / 9 % |
  | A320ceo FRA–MAD 1990: Preis / Marge | 3,37 / 73 % | 2,33 / 60 % | 1,48 / 37 % | 1,31 / −38 % |
  | A330-300 FRA–JFK 1995: Preis / Marge | 1,21 / 70 % | 1,10 / 45 % | 1,10 / −4 % | 1,10 / −151 % |

  Eine einzelne Zahl passt nicht für alle Längen: Bei × 0,25 ist die Kurzstrecke noch sehr einträglich, die
  Langstrecke kaum noch. Kurze Paare sind im Verhältnis zu groß (HAM–NUE mit 10 514 Fluggästen fast so groß wie
  FRA–CDG mit 13 400; `LINK_EXP` und `distanceFactor` bestimmen das).
- Offen ist, wie stark Rivalen die Preise drücken. Zwei gleiche Gesellschaften mit je einem Flugzeug bleiben bei
  3,19 (beide voll, B4.2); mit je vier Flugzeugen fallen die Preise auf 1,36–1,74. Wie viele Angebote ein Paar im
  laufenden Spiel hat, zeigt erst der Langlauf mit KI (Paket 3.9b).

### Fund 2: Die Marktgröße wächst im Mittel stärker als × 2,5 (B3.1) → entschieden: E64 (O61 = A)

`demandGrowth` 2019 = 2,5 (wie festgelegt). Über alle 115 440 Paare wächst die Marktgröße 1960 → 2019 aber im Mittel der
Verhältnisse um × 3,36, im Median um × 2,79 und in der Summe um × 2,78. Grund: Die Weltanteile der Städte (`relativeSize`)
verschieben sich; die Summe der Stadtgrößen bleibt gleich, aber die Verflechtung ist ein Produkt zweier Städte. Wachsen
einzelne Städte stark (vor allem in Asien), wächst die Summe über alle Paare mit. Das Mittel der Verhältnisse wird von
kleinen Paaren mit großem Zuwachs gezogen und ist als Maß wenig aussagekräftig; die Summe misst, „wie viel mehr Menschen
fliegen“.

**Entscheidung E64:** Regel 3.3 gilt für die Summe; `DEMAND_GROWTH_1960_2019` = 2,25. Ergebnis: Summe × 2,51, Median
× 2,51, Mittel der Verhältnisse × 3,02 → B3.1 **ok**. Die Marktgröße typischer Paare sinkt dadurch 1990 um etwa 5 %,
2019 um etwa 10 % (FRA–MAD 2019: 9 966 → 8 948).

### Fund 3: Beste Antworten zweier gleicher Gesellschaften springen hin und her (B4.3) → entschieden: E65 (O62 = A)

Mit je vier A320ceo auf FRA–MAD 1990 antworten zwei Optimizer abwechselnd mit 1,74 und 1,36 (Zyklus; Stand 3.9a: 1,45); einen festen
Punkt, wie 7.6 ihn erwartet, gibt es nicht. Die Preise bleiben weit über den Kosten (Gewinnschwelle voll 0,62; B4.2 ok).
Grund: Der beste Preis springt, wenn eine Gesellschaft gerade voll wird und der Überlauf (3.11) zur anderen geht. Eine
Dämpfung (jeden Monat nur der halbe Weg zum besten Preis) beendet den Zyklus nicht; im Versuch wechselten die Preise dann
zwischen 1,44, 1,59 und 1,49 (Hilfsrechnung in Sitzung 3.9a, nicht im Projekt).

**Entscheidung E65:** Ein fester Punkt ist nicht nötig; 7.6 verlangt nur, dass die Preise über den Kosten bleiben (B4.2
ok). B4.3 ist jetzt **Info**. Ob die KI-Preise im laufenden Spiel störend springen, misst 3.9b; nur dann bekommt der
Optimizer eine Schrittgrenze `FARE_STEP`.

### Weitere Werte (Info)

| Nr. | Wert | Bewertung |
|---|---|---|
| B1.1 | Treibstoff ÷ Kostenindex: 1980 2,19; 1990 0,80; 2020 1,24 (1960 = 1) | Die Krisen-Jahre treffen Treibstoff-lastige Strecken (Langstrecke 45–68 % Treibstoff); kein Handlungsbedarf. |
| B2.2 | LCC Economy FRA–CDG Satisfaction 89 (Faktor 0,95); auf FRA–JFK 48 (0,74) | Kurz passt der Ausgleich über die Preis-Lage 0,90 (7.4); auf Langstrecke ist der Abzug ohne Service groß. Prüfung im Langlauf (3.9b, „ähnlicher Erfolg“). |
| B3.3 | Entfernungs-Faktor kurz : lang = 5,16 | wie Startwert. Zusammen mit Fund 1 (kurze Paare im Verhältnis groß) ein möglicher Hebel. |
| B3.4 | Turboprop ÷ Jet: Anziehung 0,72 (FRA–CDG), 0,65 (FRA–MAD) | „spürbar“ nach E20; passend. |
| B3.5 | Hard gegen gleichen Rivalen −5,7 %, allein −1,6 % (Easy +5,2 % / +1,4 %) | Allein wirkt die Schwierigkeit kaum, weil „Nicht fliegen“ bei vielen Abflügen schwach ist. Bei knappen Sitzen (Fund 1) wirkt sie gar nicht. Erst nach O60 einstellen. |
| B4.4 | Bester Preis gegen gleichen Rivalen beim Marktpreis: 3,19 (je ein Flugzeug), 1,74 (je vier) | Der Hinweis aus 4.10 (70 %) gilt nur ohne Sitz-Grenze; bei den Startwerten bestimmen die Sitze. |
| B5.1 | Landegebühr Kurzstrecke 28–31 % der Kosten | im Rahmen 26–40 % (ok). |
| B5.2 | Marge Langstrecke Ø 66 %, kurz/mittel Ø 70 % | Langstrecke ist nicht mehr besonders einträglich; alle sind es (Fund 1). |
| B5.3 | Check-in und Abfertigung 3–17 % der Kosten | ohne Bodenpersonal-Aufschlag vertretbar; kein Handlungsbedarf. |
| B5.4 | Kaufpreis nach 0,4–2,1 Jahren eingespielt | Folge von Fund 1. |
| B5.6 | LCC ÷ Flag mit gleichem A320ceo allein auf FRA–MAD 1990: 0,65 | Die Flag-Kabine hat weniger Sitze und verkauft sie bei Knappheit teurer. Hängt an O60; „ähnlicher Erfolg“ prüft 3.9b. |

## Ergebnis Paket 3.9b (Langläufe, Abschnitt 7 und 3.13)

**Ergebnis: 10 ok · 0 Abweichung · 20 Info** (alle Abschnitte; neu: B7.1–B7.9, B3.13). Zahlen:
`docs/neubau/balance/3.9b-bericht.md`. Rahmen (F46): 26 Läufe ab Januar 1960 ohne Spieler, je Persönlichkeit ein
Gründer, Drehkreuze in fester Rotation über JFK, LHR, FRA, ORD, CDG, LAX, HND, SIN, ATL, SYD; alle 628 Flughäfen;
10 × Normal mit Zuschuss, 10 × Normal ohne Zuschuss (60 Jahre), je 3 × Easy und Hard (40 Jahre).

### Vorarbeit: Rechenzeit und ein Fehler

- **Rechenzeit:** Mit der alten Planer-Rechnung dauerte ein Monat mit 5 KI um 1965 schon über 4 s (jedes der ~400
  Preisniveaus der Optimizer-Preissuche rechnete alle Märkte aller Gesellschaften). Jetzt rechnen die Planer-Rechnungen
  nur die gebrauchten Märkte: gleiches Ergebnis, etwa 135-mal schneller (F46). Ein Lauf über 60 Jahre dauert 6–8 min,
  um 2010 etwa 0,9 s je Monat bei ~560 KI-Strecken (B7.9). Für das Spiel (Phase 4) reicht das; mehr KI kosten
  entsprechend mehr.
- **Fehler F45:** Die KI erneuerte verbrauchte Kabinen jeden Monat zum vollen Preis (bis 2 000 Erneuerungen je Jahr).
  Behoben vor den Läufen.

### Fund 4: Ähnlicher Erfolg gilt (B7.1, 7.4) → ok

Median des Unternehmenswerts (Preise 1960) nach 40 Jahren: Expansionist 4 146, Flag 3 680, LCC 2 393, Optimizer 2 318,
Boutique 1 674 Mio. $; Median aller 2 496 Mio. $. Größtes Verhältnis 1,44 nach 20 und 1,66 nach 40 Jahren (Grenze 2).
Ordnung über die ganze Zeit: Expansionist und Flag vorn, Boutique hinten (0,65–0,73). Die Rotation der Drehkreuze
zeigt: Das Drehkreuz macht viel aus (Expansionist 4 716 in ATL bis 7 225 in LAX), aber nicht mehr als die Persönlichkeit.

### Fund 5: Der Zuschuss kann weg (B7.2, 7.14) → entschieden: E68 (O63 = B)

Ohne Zuschuss wird kein Gründer wegen Geldmangels aufgelöst (Median „nie“ bei allen); ähnlicher Erfolg gilt auch ohne
(Faktor 1,46 / 1,77). Der Zuschuss ist mit 2–5 Mio. $ je Jahr (1960) gegenüber 300–2 500 Mio. $ Ergebnis je KI ohne
Bedeutung. Die Bedingung aus 7.14 ist erfüllt. Einzige Auflösung in allen Läufen: LCC in SIN (Lauf 5, mit und ohne
Zuschuss) findet 1960 keine Strecke mit Gewinn, verkauft nach 5 Monaten Leerlauf alle Flugzeuge und wird aufgelöst;
das folgt den Regeln (Leerlauf-Verkauf 7.11, Auflösung ohne Flugzeuge) und hat mit dem Zuschuss nichts zu tun.

### Fund 6: Die KI hat keine Konkurrenz; alles ist voll (B7.3) → entschieden: E66 (O64 = B), E67 (O60 = A)

- **Jedes Paar hat genau eine Gesellschaft** (1,00 je Paar, 0 % geteilte Paare, nie ein Preiskampf in 10 Läufen über
  60 Jahre). Ursache ist die Bauart: Jede KI fliegt nur von ihren Drehkreuzen; zwei KI teilen ein Paar nur, wenn eine
  zum Drehkreuz der anderen fliegt. Das kommt nicht vor. Auch der Spieler trifft eine KI nur auf Strecken, die an einem
  KI-Drehkreuz enden.
- **Auslastung 100 %** im Median in jedem Jahrzehnt; Marge im Median 22 % (1970er, Ölkrisen) bis 54 % (1990er), über alles
  40 %. Das bestätigt Fund 1 im laufenden Spiel: Der Markt ist für die Sitze einer KI zu groß.
- **Preise:** Median Preisniveau Economy 0,94–0,98; die KI nimmt die Knappheit nicht mit (Flag ≈ 1,07, LCC 0,85,
  Expansionist 0,88, Boutique 1,03). Nur der Optimizer (bester Preis) liegt bei 1,3–1,75.
- **Folge für O60:** Die Empfehlung in O60 sagte „A, wenn die Marge typischer Strecken über 40 % liegt“; das ist der
  Fall. Dass Rivalen die Preise drücken (O60 B), findet ohne geteilte Paare nicht statt.

### Fund 7: Optimizer-Preise springen selten (B7.4, E65) → kein `FARE_STEP` nötig

Monatliche Änderung im Median 0,02, p90 0,08–0,10; Schritte ≥ 0,25 in 0,5–2,6 % der Strecken-Monate (andere
Persönlichkeiten 0–0,1 %). Ohne geteilte Paare gibt es keinen Zyklus wie in Fund 3. Nach E65 bekommt der Optimizer
damit keine Schrittgrenze. Neu zu prüfen, wenn O64 Konkurrenz unter der KI bringt.

### Fund 8: Umsteiger-Regel erfüllt, aber nur, weil kein Sitz frei ist (B3.13) → ok, Hinweis

Platzierte Umsteiger in Märkten mit Direktangebot: Median 0 %, p90 unter 2 %. Grund: Alle Flugzeuge sind voll, die
Umsteiger finden keinen freien Sitz (3.13: Direktgäste zuerst). Vor der Sitz-Verteilung („Wunsch“) läge der Anteil bei
15–34 %, ab 1995 über 25 %. Ändert O60 die Marktgröße, wird diese Regel wieder wichtig; dann `CONNECTION_APPEAL` prüfen.

### Fund 9: Wachstum endet um 1995; das Geld geht in Dividenden (B7.5–B7.7) → Teil von O64, entschieden: E66 (B, keine zusätzlichen Drehkreuze)

- Eröffnungen je KI und Jahr: 4,6 (1960er) → 3,6 (1980er) → 0,2 (2010er); Flugzeuge je KI 27 → 110.
- Ursache: Jede KI erreicht die Höchstzahl ihrer Drehkreuze (`maxHubs` der Persönlichkeit: 1–4) und dort ihren
  Slot-Anteil (25 %). Neue Drehkreuze: 8 je Lauf über 60 Jahre, fast alle bis 1990.
- Fast das ganze Ergebnis geht in die Dividende (ab den 1980ern 1,5–2,4 Mrd. $ je KI und Jahr in Preisen von 1960); die Kasse
  bleibt bei 1–2,6 Mrd. $. Slot-Haltungen an der eigenen Grenze nur 2–3 % (die Grenze bindet nur an den Drehkreuzen);
  größter Anteil aller KI an einem Flughafen 30 %.
- Nachrücker gibt es fast nie (nur nach der einen Auflösung), weil keine KI pleitegeht.

### Fund 10: KI-Stärke wirkt nur zwischen Easy und Normal (B7.8)

Median Unternehmenswert der Gründer nach 40 Jahren: Easy 1 535, Normal 2 496, Hard 2 379 Mio. $ (3 / 10 / 3 Läufe).
Hard kauft mehr (120 statt 106 Flugzeuge je Gründer), verdient aber nicht mehr: Wachstum endet an Drehkreuzen und Slots
(Fund 9), nicht am Geschick. Mit nur 3 Läufen je Stärke ist das ein Hinweis, kein Beweis; erst nach O60 / O64 neu messen.

## Noch offene Prüfregeln

**Paket 3.9c – Abschnitte 6 und 8 ohne Langlauf:** Ruf-Steigungen (6.1), `CANCELLED_REPUTATION_WEIGHT`, Werbe-Beitrag,
Ruf-Schwellen der Ränge, Klassen-Forschung aus höchstens 12 Monatsergebnissen (6.8), Ziel-, Prämien- und Straf-Anteile
(6.11), Szenario-Ziele (Ruf 55, 8.15); `HEDGE_PRICE_SHARE`, `RECOVERY_PRICE_SHARE`, `CHARTER_MARKUP`, Händler-Spanne,
Vorbestell-Rabatt, `OVERHAUL_PRICE_SHARE`, Verschleiß mit `WEEKS_PER_MONTH`, `CREDIT_LIMIT_SHARE`, `CREDIT_RATE` (8.5–8.14).
