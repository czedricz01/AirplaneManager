# Balance-Skript: Auswertung

Das Balance-Skript rechnet mit den Funktionen aus `src/model/` Beispielwerte für typische Strecken und Jahre und prüft
die Balance-Regeln der Spezifikation. Es ändert keine Konstante. Ob eine Stellschraube geändert wird, entscheidet der
Mensch (Fragen in `ENTSCHEIDUNGEN.md`, Abschnitt „Offen“).

## Aufruf und Aufbau

```bash
npm run balance
```

```bash
npm run balance -- --out docs/neubau/balance/3.9c-bericht.md
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
| `src/balance/career.ts` | Abschnitt 6: Ruf je Ausstattung, Ausfälle, Werbung, Ruf-Schwellen, Klassen-Forschung und Jahresziel an der Rang-Schwelle (3.9c) |
| `src/balance/events.ts` | Abschnitt 8: Krisen-Antworten, Charter, Händler-Spanne, Vorbestellung, Überholung, Verschleiß, Kreditlinie, Szenario-Ziele (3.9c) |
| `src/balance/longRun.ts` | Langlauf ohne Spieler: Gründer je Persönlichkeit, `closeMonth` Monat für Monat, Messwerte je Jahr (3.9b) |
| `src/balance/competition.ts` | Auswertung der Langläufe: Prüfregeln B7.x und B3.13, Tabellen (3.9b) |
| `scripts/balance-run.ts` | ein Langlauf in eigenem Prozess (für `--jobs`) |
| `src/balance/balance.test.ts` | Tests des Skripts (Format, Beispiel-Welten, kurze Langläufe) |
| `docs/neubau/balance/3.9a-bericht.md` | Ausgabe des Skripts (Stand 3.9a, vor E64 und E65) |
| `docs/neubau/balance/O61-O62-bericht.md` | Ausgabe des Skripts nach E64 (`DEMAND_GROWTH_1960_2019` = 2,25) und E65 |
| `docs/neubau/balance/3.9b-bericht.md` | Ausgabe mit Langläufen (Abschnitte 1–5, 7: 10 ok · 0 Abweichung · 20 Info) |
| `docs/neubau/balance/3.9c-bericht.md` | Ausgabe ohne Langläufe (Stand 3.9c, Abschnitte 1–6 und 8: 15 ok · 0 Abweichung · 21 Info) |
| `docs/neubau/balance/3.9d-bericht.md` | Ausgabe ohne Langläufe nach E66 und `HEDGE_PRICE_SHARE` 0,35 (aktueller Stand: 15 ok · 0 Abweichung · 21 Info) |

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

## Ergebnis Paket 3.9c (Abschnitte 6 und 8 ohne Langlauf)

**Ergebnis: 15 ok · 0 Abweichung · 21 Info** (Abschnitte 1–6 und 8; neu: B6.1–B6.8, B8.1–B8.9). Zahlen:
`docs/neubau/balance/3.9c-bericht.md`. Die Langläufe (Abschnitt 7) stehen weiter in `3.9b-bericht.md`.

**Vorsicht:** Alle Ergebnisse und Margen stammen aus dem heutigen, zu großen Markt (Fund 1, E67). Wo sie zählen
(Klassen-Forschung, Jahresziel, Rückgewinnung, Kreditlinie), zeigt der Bericht daneben einen Fall mit 10 % Marge oder
Marktgröße × 0,25. Nach E67 (Paket 3.9d) den Bericht neu erzeugen.

### Fund 11: Die Ruf-Skala passt; die Spanne kommt aus der Ausstattung (B6.1, B6.2, B6.5, B6.6) → ok

- Median der Ruf-Ziele über 5 Ausstattungen × 2 Strecken (A320ceo FRA–MAD 1990, A330-300 FRA–JFK 1995): **46,7**, also
  „um 50“ (E36). Die Spanne ist groß: LCC auf Langstrecke 24,1 (Satisfaction 48), Flag auf Mittelstrecke 69,6 (124).
  Mit allen Satisfaction-Projekten (+8 Punkte) bis 76,3.
- Ruf-Schwellen der Ränge (B6.5 ok): Rang 5 (Ruf 50) erreicht Flag auf beiden Strecken; Rang 9 (65) Flag und Boutique
  auf Mittelstrecke schon ohne Forschung.
- Ruf-Meilensteine: Silber (70, Satisfaction 124) nur mit Forschung, **Gold (80, Satisfaction 136) mit keiner
  KI-Ausstattung** (bestes Ziel 76,3). Der Spieler hat mehr Hebel als die KI-Ausstattungen (Lounge, Stellplätze,
  Schalter, Personal). Hinweis, kein Handlungsbedarf: Gold soll selten sein.

### Fund 12: Gestrichene Flüge kosten im Mittel 1 Punkt; ein Defekt trifft kleine Gesellschaften hart (B6.3) → Info

Erwarteter Abzug im Ruf-Ziel 0,7 (neues Flugzeug) bis 1,6 Punkte (20 Jahre alt). Ein Defekt streicht 50 % der Flüge
eines Flugzeugs: Bei einer Gesellschaft mit **einem** Flugzeug fällt der Ruf im Monat um 7,5 Punkte und braucht 13
Monate, bis der Abstand unter 1 Punkt liegt; bei 10 Flugzeugen −0,75. Ein Defekt je Flugzeug kommt bei neuen Flugzeugen
etwa alle 25 Jahre vor; mit Charter zählt er nicht. Kein Handlungsbedarf.

### Fund 13: Werbung hebt den Ruf um höchstens 3 Punkte und klingt ab (B6.4) → ok

Alle drei Kampagnen zusammen: Gleichgewicht 53,0, nach 12 Monaten 52,6, 6 Monate nach dem Ende 51,0. Über den Ruf wirkt
das auf die Nachfrage nur mit +0,6 %; die Hauptwirkung der Werbung ist die Anziehung (3.9.5).

### Fund 14: Klassen-Forschung ist bezahlbar – heute (B6.7) → ok, nach E67 neu prüfen

Eine Gesellschaft genau an der Fluggast-Schwelle des Rangs bezahlt die Klassen-Forschung dieses Rangs aus 1,0–2,8
Monatsergebnissen (Grenze 12). Mit 10 % Marge (Ziel nach E67: 10–25 %) wären es 17,3 (Rang 1), 19,8 (Rang 2), 6,4
(Rang 4) und 12,5 (Rang 5, Jumbo + Überschall). **Nach E67 kann B6.7 für Rang 1, 2 und 5 kippen;** dann die Preise in
`CLASS_RESEARCH` senken (Spezifikation 6.8).

### Fund 15: Jahresziel: kleine Prämien, hohes Ziel lohnt ab 60 % Chance (B6.8) → Info

Ohne Mindestbetrag ist die Prämie 0,24 (sicher), 0,36 (andere Art) und 0,60 (hoch) Monatsergebnisse. Das hohe Ziel
bringt im Mittel mehr als ein sicher erreichtes sicheres Ziel, wenn es mit mindestens **60 %** Chance erreicht wird
(Strafe = halbe Prämie, E58); das sichere Ziel lohnt ab 33 %. Die Mindestprämie bindet in keinem Beispiel (Ergebnisse
groß, Fund 1); wo sie bindet, sind beide Prämien gleich und das hohe Ziel lohnt nie. Erst nach E67 bewerten.

### Fund 16: Krisen-Antworten lohnen sich mehrfach (B8.1, B8.2) → entschieden: E69 (O65 = C)

| Antwort | Ersparnis bzw. Mehr-Ergebnis ÷ Preis |
|---|---|
| Preis-Absicherung 1973 / 1979 / 1990 | 4,62 / 2,49 / 1,84 |
| Rückgewinnung 2001 / 2008 / 2020 (heutiger Markt) | 5,14 / 5,08 / 4,69 |
| Rückgewinnung 2001 / 2008 / 2020 (Markt × 0,25) | 3,41 / 3,49 / 2,51 |

- Die Absicherung hängt nur an der Treibstoff-Tabelle (gleiche Menge wie vor der Krise), nicht an der Marktgröße.
- Die Rückgewinnung holt 15–32 % des Ergebnis-Verlusts zurück; mit kleinerem Markt weniger (volle Flugzeuge verlieren
  zuerst nur „Knappheit“).
- Beide Antworten sind damit keine Abwägung, sondern immer richtig. Entschieden (E69): Absicherung 0,2 → 0,35;
  Rückgewinnung nach E67 neu messen und festlegen (Paket 3.9d).

### Fund 17: Charter lohnt auf jeder Strecke mit Gewinn (B8.3) → ok

Auf allen 13 Strecken mit Gewinn (11 typische, 2 mit Markt × 0,25) bringt Charter mehr als Streichen, mindestens
6 572 $ je Flug. Auf der einzigen Strecke mit Verlust (A330-300 FRA–JFK 1995 bei Markt × 0,25) ist Streichen besser
(−13 020 $), weil die Gebühr 115 % des Erlöses je Flug ist. So soll es sein (8.9).

### Fund 18: Flottenmarkt ohne Schlupfloch (B8.4, B8.5, B8.6) → ok, Hinweise

- **Händler-Spanne:** Gebraucht kaufen und sofort verkaufen bringt 83,0 % zurück (mit größter Forschung). Der Verlust
  entspricht 0,6 (Alter 20) bis 3,2 (neu) Monatsergebnissen einer A320ceo-Strecke.
- **Vorbestellung:** Sofort verkauft immer Verlust (−0,9 bis −7,9 % des Werts). Der Rabatt ist aber ein guter Ertrag
  der gebundenen Anzahlung: 23–42 % je Jahr gegen 8 % Kreditzins. Das belohnt Planung; kein Handlungsbedarf.
- **Überholung:** Preis = Wertgewinn in allen 5 Fällen; der Mindestpreis (4 % des Neupreises) bindet nie. Mit Hangar
  kostet die Überholung netto also nichts und senkt die Defekt-Chance (2,4–8 % weniger gestrichene Flüge je Jahr);
  ohne Hangar 25 % mehr. Der Mindestpreis greift nur bei kleinem Wertgewinn (fast neue Zelle).

### Fund 19: Verschleiß passt zur Nutzung (B8.7) → Info

Bei typischem Flugplan 45–452 Blockstunden je Monat. Langstrecke: Kabine −7,7, Zelle −5,3 Punkte je Jahr (Kabine 50
nach 6,5 Jahren, also etwa ein Umbau je 6–7 Jahre); Kurz- und Mittelstrecke −1,8 bis −2,9 bzw. −1,6 bis −2,3. Der
Gebrauchtmarkt nimmt −2,8 / −2,2 an, passend zur Mittelstrecke. Kein Handlungsbedarf.

### Fund 20: Kreditlinie großzügig für Kurzstrecke, knapp für frühe Langstrecke (B8.8) → Info

Die Grenze (50 % des Werts eines neuen Flugzeugs) deckt 4,5 (707 FRA–JFK 1965) bis 33,7 Monate feste Strecken-Kosten.
Der Zins bei voller Nutzung ist 2–28 % des Monatsergebnisses. Nach E67 neu ansehen.

### Fund 21: Szenario „Oil Shock“: Ruf 55 passt (B8.9) → ok

Nach 39 Monaten (Okt. 1973 bis Dez. 1976, Start 50): LCC-Kabine 30,9; Flag-Kabine im Zustand 60 ohne Umbau 52,3; nach
einem Umbau (Zustand 90) Flag 58,2 und Boutique 57,6. Das Ziel braucht also einen Kabinen-Umbau, wie der Kommentar im
Szenario sagt. Die Dollar-Beträge aller Szenarien als Wert von 1960 stehen im Bericht (für Phase 5.1).

## Ergebnis Paket 3.9d, Teil 1 (E66, Absicherung, Messung zu E67)

Umgesetzt: E66 (Vorauswahl, `PRESELECT_RIVAL_HUB_WEIGHT` = 2, `src/model/rivalMonth.ts:319`) und der erste Teil von
E69 (`HEDGE_PRICE_SHARE` 0,35, `src/model/constants.ts`). Neu im Langlauf: Auslastung und Marge je Streckenlänge und
Prüfregel B7.10 (F48). Kurzbericht ohne Langläufe: `balance/3.9d-bericht.md` (15 ok · 0 Abweichung · 21 Info).
Die Marktgröße (E67) ist **nicht** geändert: Ihr Ziel ist so nicht erreichbar (Fund 23) → Frage O66.

### Fund 22: E66 bringt die KI an fremde Drehkreuze, aber kaum auf dieselben Paare → Teil von O66

Mit E66 fliegen KI zu fremden Drehkreuzen (Lauf 0, 1965: JFK–ATL, ATL–FRA, CDG–JFK, SEA–JFK). Geteilte Paare bleiben
aber selten: 1 % (1960er) bis 3 % (1990er) statt 0 %. Grund: Die zweite KI fliegt dasselbe Paar fast nie zurück, und am
Drehkreuz hält der Besitzer fast alle Slots (JFK 1965: Flag 511, alle anderen 13). Eine Hilfsrechnung je Jahr
(Drehkreuze und Slots, Sitzung 3.9d, nicht im Projekt) zeigt das.

### Fund 23: Eine kleinere Marktgröße senkt die Marge der KI kaum; die Auslastung bleibt 100 % → O66

Kalibrier-Läufe (Hilfsrechnung in Kopien des Codes, F48): je Variante 4 Läufe × 40 Jahre (1960–1999), Normal, mit
Zuschuss, mit E66. Median je Strecke und Monat (Juli), Mittel über die Jahrzehnte:

| Marktgröße | Auslastung | Marge | Marge 1970er (Ölkrisen) | Marge kurz / mittel / lang (1990er) | Preis Y | Strecken (1990er, je Lauf und Monat) | aufgelöste Gründer |
|---|---|---|---|---|---|---|---|
| × 1 | 100 % | 47 % | 26 % | 41 / 49 / 66 % | 0,96–0,99 | 501 | 0 von 20 |
| × 0,5 | 100 % | 37 % | 20 % | 37 / 45 / 57 % | 0,99–1,04 | 471 | 2 |
| × 0,3 | 100 % | 31 % | 18 % | 33 / 37 / 53 % | 1,01–1,10 | 389 | 2 |
| × 0,3, `DISTANCE_EXP` 0,3 | 100 % | 29 % | 15 % | 30 / 36 / 51 % | 1,09–1,14 | 391 | 6 |

- Jede KI fliegt ihre Paare allein (Fund 22) und wählt so wenige Flüge (100 / 60 / 30 % der Umläufe), dass sie voll ist.
  Die Auslastung bleibt deshalb bei 100 %, gleich wie klein der Markt ist; nur Langstrecken fallen auf 84–99 %.
- Die Marge hängt dann am Preis gegen die Kosten. Eine volle Mittelstrecke deckt ihre Kosten beim 0,6-Fachen des
  Marktpreises, eine Langstrecke beim 0,3-Fachen (A330-300 FRA–JFK 1995, Fund 1, Spezifikation 5.18).
- Eine kleinere Marktgröße verschiebt die KI auf Kurzstrecken (bei × 0,3 die Hälfte der Strecken), macht sie ärmer
  (Kasse der Gründer nach 40 Jahren im Median 2 707 → 1 450 → 746 Mio. $) und löst mehr Gründer auf.
- Für die Ziele aus E67 (Auslastung 75–90 %, Marge 10–25 %) bräuchte es eine Marktgröße unter × 0,2; dann würde die KI in
  den 1970ern im Median Verlust machen.
- Typische Strecken allein (Abschnitt 4, Hilfsrechnung mit `runCase`): Ohne Rivalen hebt der beste Preis die Marge über
  die Knappheit. Für Kurz- und Mittelstrecke passt × 0,25 bis × 0,3 mit `DISTANCE_EXP` 0,3 (A320ceo FRA–MAD 1990: 70–80 %
  Auslastung, Marge 22–32 %); Langstrecken mit 14 Abflügen sind dann halb leer (A330-300 FRA–JFK 24–29 %).

### Fund 24: Preis-Absicherung ist jetzt eine Abwägung (B8.1) → E69 umgesetzt

Mit `HEDGE_PRICE_SHARE` 0,35 spart die Absicherung das 2,64- (1973), 1,42- (1979) und 1,05-Fache (1990) ihres Preises
(vorher 4,62 / 2,49 / 1,84). Die Rückgewinnung (B8.2, heute 2,5–5,1) wird erst nach O66 festgelegt.

## Noch offene Prüfregeln

Keine Prüfregel der Abschnitte 1–8 ist mehr ohne Skript. Nach O66 (Rest von Paket 3.9d) den ganzen Bericht neu
erzeugen, mit Langläufen; besonders B7.10 (Ziel aus E67), B6.7 (Klassen-Forschung), B6.8 (Jahresziel), B8.2
(Rückgewinnung) und B8.8 (Kreditlinie) hängen an Marktgröße und Marge.
