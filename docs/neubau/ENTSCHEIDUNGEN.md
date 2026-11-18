# Entscheidungen

Hier steht, was festgelegt ist und was noch zu entscheiden ist.
Claude schlägt vor, der Mensch entscheidet.

## Getroffen

| Nr. | Datum | Entscheidung | Begründung |
|---|---|---|---|
| E1 | 17.11.2026 | Kein kompletter Neuanfang. Neu gebaut wird nur das Rechenmodell; Oberfläche, Daten und Technik bleiben. | Technik ist stabil (502 Tests, strenger Typmodus); die Widersprüche liegen im Modell. |
| E2 | 17.11.2026 | Erst Spezifikation, dann Code. | Ohne festgelegte Bedeutung jeder Größe entstehen die Widersprüche neu. |
| E3 | (früher, `ANALYSE.md:34`) | Oberflächentexte im Spiel einheitlich Englisch. | – |

## Offen

Zusammenfassung aus Paket 1.9 (Stand 17.11.2026, Commit `a4648b3`).
Quelle: die acht Dateien in `bestand/`. Kurzform der Verweise: **1.2 W4** = `bestand/2-nachfrage.md`,
Abschnitt W4; **1.2 F4** = dort offene Frage 4.

Aus 56 Einzelfragen (7 je Bestandsdatei) und O1–O6 sind **49 Fragen** geworden. Doppelte Fragen
sind zusammengelegt. O1–O6 behalten ihre Nummer, neue Fragen beginnen bei O7.
Alle 103 Funde (W) der Bestandsdateien sind einer Frage oder einer Bauregel (R1–R16) zugeordnet.

Jede Frage hat eine **Empfehlung** von Claude. Wer einer Empfehlung zustimmt, schreibt nur „ja“.
Manche Fragen legen nur die **Richtung** fest; die genauen Zahlen kommen aus dem Balance-Skript
(Paket 3.9). Das steht dann in der Empfehlung.

Die Fragen sind in vier Blöcke geteilt. Jeder Block ist ein Teil von Paket 2.1 (2.1a–2.1d).

### Block A · Querschnitt (Paket 2.1a)

Diese Fragen betreffen alle Bereiche. Sie zuerst klären, weil die anderen Blöcke darauf aufbauen.

| Nr. | Frage | Empfehlung | Quellen |
|---|---|---|---|
| O6 | **Schwierigkeit:** Wo soll sie wirken? Heute an drei Stellen mit verschiedenen Faktoren (Nachfrage Easy 1,1 / Normal 0,9 / Hard 0,75; Preis 1,12 / 1 / 0,88; Treibstoff Hard × 1,15). „Normal“ ist bei der Nachfrage nicht neutral. Die KI rechnet mit ihrer eigenen Stufe, dadurch ist Hard-KI wirtschaftlich schwächer. | Normal = Faktor 1 überall. Für den Spieler wirkt die Schwierigkeit an **einer** Stelle: auf die Nachfrage (Marktgröße). Preis und Treibstoff ohne Schwierigkeit. KI-Wirtschaft immer neutral; KI-Stärke nur über Verhalten (Startkasse, Suche, Kaufneigung). Easy-KI mit 2,25-fachen Preisen abschaffen. | 1.2 W6, W7, F4; 1.3 W10, F5; 1.4 W9, F7; 1.5 W13; 1.6 W3, F2 |
| O7 | **Monatslänge:** Heute rechnen Erlös und Strecken-Kosten mit 4 Wochen je Monat (48 Wochen im Jahr), der Flugzeug-Unterhalt mit Jahr / 12 (52 Wochen). | Eine Konstante: 365,25 / 12 / 7 ≈ 4,35 Wochen je Monat, überall. | 1.3 W6, F3; 1.4 W15; 1.7 Doppelte Rechnungen |
| O8 | **Geldwert über 60 Jahre:** Laufende Kosten wachsen mit dem Kostenindex (1,2 % je Jahr), Forschung mit eigener Rate (4 % des Werts von 1960 je Jahr). Feste Beträge (Slot-Kauf, Verwaltungsstufe, Hub-Einrichtungen, Kabinen-Ausstattung, Grundüberholung, Belohnungen, Krisen-Antworten, KI-Startkasse, Zuschuss, Vogelschlag) bleiben auf dem Stand von 1960. | **Ein** Kostenindex für alle Dollar-Beträge, auch Einmalpreise, Belohnungen und Forschung. Beträge, deren Nutzen mit der Airline wächst (Krisen-Antworten), zusätzlich als Anteil der Größe (z. B. der Treibstoff-Rechnung). | 1.4 W8, F5; 1.5 W9; 1.6 W5; 1.7 W3, W8; 1.8 W3, W4, F2 |
| O5 | **Zeitregeln und Marge:** Grundpreise bleiben von 1960 bis heute gleich, Kosten steigen real (Löhne und Gebühren × 2,05 bis 2020, Treibstoff × 2,5), die Nachfrage hat zwei Bremsen hintereinander (Hochzahl 0,448 und Jahresbremse bis 0,40; Ergebnis heute × 2,5 von 1960 bis 2019). Folge: Langstrecke verliert fast immer; 2020 lohnt sich auch Kurzstrecke kaum. | Grundpreise wachsen mit demselben Kostenindex wie Löhne und Gebühren; dann bestimmt vor allem der Treibstoff die Marge eines Jahres. **Eine** Wachstumsregel für die Nachfrage, Zielwert × 2,5 (wie heute) als Konstante. Ziel-Marge: Eine gut geführte Strecke jeder Länge soll in jedem Jahrzehnt Gewinn bringen können. Genaue Werte im Balance-Skript (3.9). | O5; 1.2 W8, F5; 1.3 W7, F4; 1.4 W1, W2, F1 |
| O9 | **Treibstoff:** Die Preistabelle enthält die Ölkrisen schon; darauf kommen die Krisen-Ereignisse (× 2,0 und × 1,8). Nach Dezember 2030 fällt der Preis auf den Ersatzwert 1,05 $ (Stand 1960). | Tabelle = echter Preis mit Krisen. Ereignisse ändern den Treibstoffpreis nicht mehr (nur Nachfrage und Krisen-Antworten). Nach 2030 gilt der letzte Tabellenwert. | 1.4 W3, W4, F2; 1.7 W14 |
| O4 | **Namen:** „SAT“ steht für fünf Dinge mit verschiedenen Skalen; „Loyalty“ und „Market share“ für je zwei. | Eigene Namen (Oberfläche Englisch): *Type appeal* (Beliebtheit des Typs), *Cabin rating* (Kabinenwert 0–100), *Service points* (Punkte von Gerichten und Extras), *Satisfaction* (Zufriedenheit je Klasse), *Route satisfaction* (Strecken-Wert). *Established route bonus* (Stammkunden-Zuschlag) und *Frequent flyer* (Vielflieger-Treue). *Passenger share* (Anteil an Fluggästen) und *Departure share* (Anteil an Abflügen). | O4; 1.1 W13; 1.2 W12, F6 |
| O3 | **Strecken-Zufriedenheit:** Die Anzeige gewichtet die Klassen nach Sitzen, der Ruf nach Fluggästen. | Überall nach Fluggästen gewichten (das haben die Gäste erlebt). | O3; 1.1 Bezug O3 |
| O10 | **Startwerte** (Startkapital-Stufen, Start-Ruf, Heimat-Flughafen mit Stufe 2): Teil der Spezifikation oder freie Einstellung? | Teil der Spezifikation, als Konstanten im Modell. Startkapital-Stufen bleiben als Einstellung beim neuen Spiel. Start-Ruf siehe O1. | 1.8 W8, F5 |
| O11 | **Bauregeln bestätigen:** Die Liste „Bauregeln“ unten (R1–R16) löst die Funde, die keine eigene Entscheidung brauchen. | Liste als Ganzes bestätigen; einzelne Punkte nur bei Einwand besprechen. | siehe unten |

### Block B · Markt: Zufriedenheit, Nachfrage, Preis (Paket 2.1b)

| Nr. | Frage | Empfehlung | Quellen |
|---|---|---|---|
| O12 | **Markt-Modell (Preis und SAT im Wettbewerb):** Heute wirkt SAT dreifach (fairer Preis, Marktanteil, über den Ruf auf alle Strecken). Der Preis wirkt doppelt, sobald ein Rivale da ist (Marktanteil und Nachfrage), an zwei verschiedenen Bezugspreisen. Ohne Rivale: 10 % billiger = +13,5 % Gäste, mit Rivale +20,6 %. | **Ein** Markt-Modell je Städtepaar: Die Marktgröße kommt aus Städten, Entfernung, Jahr, Saison. Jedes Angebot hat eine Anziehung aus Preis (gemessen am Marktpreis), SAT und Abflügen. „Nicht fliegen“ zählt als eigener Mitbewerber. Die Fluggäste verteilen sich nach Anziehung. So wirkt der Preis mit und ohne Rivalen gleich. SAT wirkt im Markt nur über diese Anziehung; über den Ruf wirkt sie langsam auf alle Strecken (wie heute). | 1.1 W8, F4; 1.2 W4, F2; 1.3 Bezug 1.2 W4 |
| O13 | **Skala der SAT:** Gekappt bei 160, der Ruf zählt sie nur bis 130, der SAT-Faktor ist bis über 200 gebaut. | Skala 0–160, 100 = „wie erwartet“, 160 = Spitze. Alle Wirkungen (Markt, Ruf) nutzen die ganze Skala. | 1.1 W7, F3; 1.3 W11 |
| O14 | **SAT unter 100:** Heute ist SAT 50 = halber fairer Preis. Wasser und Softdrinks (4 $ je Gast) heben auf Kurzstrecke den fairen Preis um 13 $. | Flachere Kurve unter 100, Richtung: SAT 50 ≈ 75 % des Preises. Genaue Kurve im Balance-Skript (3.9), zusammen mit den Abzügen. | 1.1 W9, F5 |
| O15 | **Mehrgang-Menü:** Ein weiteres Gericht senkt heute den Mahlzeit-Wert (Mittelwert statt Summe). Wagyu allein 60 Punkte, Wagyu + Butterkeks 34,9. | Summe mit abnehmendem Nutzen: bestes Gericht voll, jedes weitere anteilig. Mehr bieten bringt immer etwas. | 1.1 W1, F1; 1.4 W14 |
| O16 | **Zwei Flughäfen:** Schalter und Stellplätze zählen als Mittelwert beider Enden, Lounge und Überlast als Summe. Überlast zählt auch auf Langstrecke voll. | Überall Mittelwert beider Enden. Das Bodengewicht (Boden zählt auf Langstrecke weniger) gilt für alle Bodenteile, auch Überlast. | 1.1 W3, F2 |
| O17 | **Check-in-Schalter:** Ohne Schalter verliert jede Klasse bis −18 SAT, auf Kurzstrecke der größte Einzelposten. | Ein Schalter am Abflug ist Pflicht; der Planer verlangt ihn beim Anlegen der Strecke. Dann entfällt der Abzug. | 1.1 W14, F6 |
| O18 | **Forschung „Plane type satisfaction +1%“:** bringt +0,2 bis +0,4 SAT, durch Runden oft 0. | Wirkung direkt als SAT-Punkte geben (wie „Cabin design studio“); Text aus der Konstante erzeugen. | 1.1 W12, F7; 1.5 W12 |
| O19 | **Geschwindigkeit und Marktgröße:** Ein langsames Flugzeug macht heute den ganzen Markt kleiner (Frankfurt–Madrid 1990: 450 km/h 9 542 Gäste, 900 km/h 12 413). | Marktgröße mit fester Bezugsgeschwindigkeit (nur aus der Entfernung). Kürzere Flugzeit gibt einem Angebot einen kleinen Vorteil in der Anziehung (O12). | 1.2 W1, F1 |
| O20 | **Klassen-Aufteilung:** Premium liegt bei 92 % der Paare genau auf der Untergrenze 9 %. | Je Klasse ein einfacher Anteil, der mit Flugzeit und Geschäftsanteil spürbar wächst. Werte im Balance-Skript (3.9). | 1.2 W5, F3 |
| O21 | **Flugzeit-Kurve:** Ab etwa 12,6 h ist jede Langstrecke gleich; Kurz- zu Langstrecke Faktor 6,9. | Kurve sinkt bis zur längsten Strecke weiter, flacher als heute. Genaues Verhältnis im Balance-Skript (3.9). | 1.2 W13, F7 |
| O2 | **Klassen-Faktoren im Planer:** „Adjust All“, Startpreis, Gewinnschwelle und Gewichte im Rechenkern nutzen feste 1,6 / 3 / 5; die echten Verhältnisse der Strecke liegen bei 1,3–2,35 / 2,0–3,75 / 3,0–6,5. | Überall die echten Klassen-Verhältnisse der Strecke aus einer Funktion. Gewinnschwelle je Klasse liefert das Modell. | O2; 1.3 W2, F1; 1.8 W5, F3 |
| O22 | **Unter Marktpreis:** Economy bringt heute unter dem Marktpreis mehr Erlös (bis +5 %), wenn Sitze frei sind. | Nein. Ohne Rivalen soll der Marktpreis etwa der erlösbeste Preis sein. Billiger lohnt sich nur, um Anteil gegen Rivalen zu gewinnen oder Sitze zu füllen. | 1.3 W3, F2 |
| O23 | **Umsteiger-Tarif:** heute 0,9 × Grundpreis, ohne SAT, Schwierigkeit, Knappheit; auf Hard ist Umsteigen teurer als direkt. | Marktpreis der Verbindung O–D × fester Abschlag (0,9), mit derselben Funktion wie Direktgäste. | 1.3 W5, F7; 1.2 W9 |
| O24 | **Planer-Hauptzahl:** Auf Normal und Hard zeigt die große Zahl den Gewinn bei voller Maschine; sie steigt mit jedem Preis. | Hauptzahl immer der erwartete Gewinn bei heutiger Nachfrage, auf jeder Stufe. „Volle Maschine“ höchstens als Nebenzahl beim Marktpreis. (Nur Bestätigung.) | 1.3 W1, F6 |

### Block C · Kosten, Flottenwert, Monat, Ereignisse (Paket 2.1c)

| Nr. | Frage | Empfehlung | Quellen |
|---|---|---|---|
| O25 | **Gebühren je Fluggast:** Check-in und Abfertigung werden am Start **und** am Ziel fällig; Umsteiger zahlen am Umsteige-Flughafen doppelt. | Check-in nur am Abflug, Abfertigung je Abflug. Höhe so neu einstellen, dass die Summe je Fluggast etwa gleich bleibt. | 1.4 W5, F3 |
| O26 | **Abstellplätze ab Verwaltungsstufe 2:** werden geschenkt und kosten keinen Unterhalt mehr. | Stufe 2 kauft sie automatisch, Unterhalt bleibt. | 1.4 W7, F4 |
| O27 | **Wert eines Flugzeugs und Abschreibung:** Neu ist es sofort 10 % weniger wert; Kabine zählt nicht; Wertverlust erscheint nie als Kosten; ein Kauf für 140 Mio. $ gilt als normaler Gewinnmonat. | Ein Wertmodell: Wert neu = Kaufpreis (mit Kabine). Lineare Abschreibung je Jahr bis zu einem Restwert; Zustand als Zu- oder Abschlag. Die Abschreibung steht als Kosten im Monatsgewinn. | 1.4 W13, F6; 1.7 W10, F2 |
| O28 | **Kauf- und Verkaufsspanne:** Gebraucht kaufen und sofort verkaufen bringt +5 %; Vorbestellung kostet 80–88 % und ist sofort 90 % wert. | Händler-Spanne: Verkauf an den Markt unter Wert, Kauf vom Markt zum Wert oder darüber. Vorbestellungs-Rabatt kleiner als diese Spanne. Kaufen und sofort verkaufen bringt nie Gewinn. | 1.7 W1, W2, F1 |
| O29 | **Grundüberholung:** kostet immer 200 000 $ und hebt den Wert einer 747 um 13 Mio. $. | Preis als Anteil des Listenpreises (mit Kostenindex). Sie senkt Verschleiß und Ausfälle; der Wert steigt höchstens um den Preis. | 1.7 W3, F3 |
| O30 | **Charter:** Das eigene Flugzeug kostet weiter (Treibstoff, Besatzung, Gebühren), dazu 90 % des geretteten Erlöses. Charter ist immer 175 000–770 000 $ teurer als Streichen. | Bei Charter steht das eigene Flugzeug (keine eigenen Flugkosten). Charter-Gebühr als Preis je Flug, nicht als Erlösanteil. | 1.7 W4, F4 |
| O31 | **Gestrichene Flüge:** senken die SAT (−25 bei 50 % gestrichen) **und** den Ruf; die Nachfrage fällt unter die übrigen Sitze. | Eine Strafe: Ruf-Abzug. Kein SAT-Abzug; die Nachfrage fällt höchstens auf die übrigen Sitze. | 1.7 W5, F5 |
| O32 | **Negative Kasse:** Für den Spieler ohne Folge (keine Kredite, Zinsen, Pleite). Die KI wird nach 6 Monaten im Minus verkauft. | Kreditlinie mit Zins bis zu einer Grenze (aus Flottenwert). Darunter Warnung, nach 6 Monaten Zwangsverkauf von Flugzeugen; ohne Flugzeuge Spielende. | 1.7 W6, F6 |
| O33 | **Ereignisse:** Weltweite treffen alle, regionale nur den Spieler. Krisen-Antworten haben feste Preise (3–25 Mio. $), ihr Nutzen wächst mit der Airline. | Ereignisse gelten für alle Gesellschaften gleich, auch regionale. Krisen-Antworten kosten einen Anteil der betroffenen Größe (O8). Mehr Ereignisse mit Antworten: nicht im Neubau, später. | 1.7 W8, W13, F7 |

### Block D · Ruf, Rang, Konkurrenz, Oberfläche (Paket 2.1d)

| Nr. | Frage | Empfehlung | Quellen |
|---|---|---|---|
| O1 | **Ruf-Neutralpunkt und Start-Ruf:** Neutral ist 75 (Nachfrage-Faktor 1), Start 50 (−5 %). Typische Ziele liegen bei 60–74; viele Spieler bleiben dauerhaft unter 75. Die Firmen-Ansicht färbt ab 65 grün. | Neutral bei 50, Start bei 50. Farbstufen aus den Konstanten. | O1; 1.5 W3, F7 |
| O34 | **Werbung und Ruf:** Werbung hebt den Ruf dauerhaft um bis zu 15 Punkte. | Werbung bringt nur Bekanntheit (Nachfrage, solange sie läuft), keinen Ruf. | 1.5 W1, F1 |
| O35 | **Einmalige Ruf-Boni und -Strafen** (Meilensteine, Rang, Jahresziel, Streik, Ausfall, Übernahme +2): verfliegen in Monaten, können aber eine Rang-Schwelle überspringen. | Keine Einmal-Sprünge im Ruf. Belohnungen in Geld oder Freischaltungen. Störungen wirken über O31. Übernahme +2 entfällt. | 1.5 W2, F2; 1.8 W8, F4 |
| O36 | **Zustand im Ruf:** ungewichtetes Mittel der Flugzeuge mit Strecke; abgestellte zählen nicht; die Kabine steckt schon in der SAT. | Zustand nicht mehr im Ruf; er wirkt über die SAT (Kabine) und über Ausfälle (Zelle). Ruf kommt aus SAT (nach Fluggästen) und gestrichenen Flügen. | 1.5 W5, F5 |
| O37 | **Rang:** Bedingungen gelten für einen einzigen Monat; ein Sommermonat genügt. Der Rang geht nie verloren. | Mittel der letzten 3 Monate prüfen. Rang geht weiter nie verloren. | 1.5 W6, F3 |
| O38 | **Flugzeugklassen:** an den Rang gebunden; die Concorde ist im freien Spiel kaum erreichbar. | Klasse frei, sobald Rang **oder** Jahr erreicht ist (was zuerst kommt). Jahr je Klasse in der Spezifikation. | 1.5 W8, F4 |
| O39 | **Forschungsplätze je Rang:** Code gibt 3 / 4 / 5 bei Rang 3 / 6 / 9; Texte versprechen 3 bei National (4) und 5 bei Flag Carrier (8). | Die Texte gelten: Plätze als Feld je Rang, Text daraus erzeugt. (Nur Bestätigung.) | 1.5 W7 |
| O40 | **Karriere-Punkte:** Free und Normal in einer Ruhmeshalle; Forschung zählt fast so viel wie der höchste Rang. | Getrennte Listen für Free und Normal. Gewichte in Phase 2 festlegen; Richtung: Vermögen und Rang zählen am meisten. | 1.5 W14, F6 |
| O41 | **Gleiche Regeln für die KI:** Die KI zahlt keine Flughafen-Kosten, hat Gebühren-Rabatt überall, freie Slots, keinen Anlauf, keinen Ruf, keinen Verschleiß, keine Sperren, bekommt Zuschuss; regionale Ereignisse treffen sie nicht; im Spieler-Markt zählt sie immer mit SAT 100. | Dieselbe Wirtschaft für alle (Kosten, Slots, Anlauf, Verschleiß, Ruf, Ereignisse, SAT). Vereinfacht bleiben nur die Entscheidungen der KI. Was die KI bewusst auslässt (Forschung, Personal und Streik, Werbung), steht als Liste in der Spezifikation. | 1.6 W2, F1; 1.1 W10; 1.2 W10; 1.7 W13 |
| O42 | **Persönlichkeiten und Billigflieger:** Flag-Carrier werden bis 2000 zu 19–26 Mrd. $ Kasse, LCC und Optimizer gehen pleite, weil Kosten je Sitz nicht vom Geschäftsmodell abhängen. | Alle Persönlichkeiten im Mittel ähnlich erfolgreich. Billigflieger bekommen echte Kostenvorteile (dichtere Kabine, weniger Personal je Sitz). | 1.6 W1, F3 |
| O43 | **KI-Wachstum und Kasse:** Wachstum endet an den Drehkreuz-Slots, danach sammelt sich Geld ohne Grenze. Der Ticker-Rang zählt nach Kasse. | Größe nach Sitzen messen. KI kann weitere Drehkreuze eröffnen und modernisieren; Geld über einer Grenze geht als Dividende ab. Ticker-Rang nach Fluggästen. | 1.6 W4, F4 |
| O44 | **Zuschuss für die KI** (150 000–450 000 $ je Monat, nominal): | Abschaffen, sobald die KI-Wirtschaft nach O6, O41, O42 stimmt. Bis dahin mit Kostenindex. | 1.6 W5, F5 |
| O45 | **Übernahme:** Preis aus Flottenwert ohne Alter; die Kasse der KI verfällt; Slots des 2. Drehkreuzes landen am Heimat-Drehkreuz. | Preis = Unternehmenswert: Flottenwert mit Alter (O27) + Kasse + Wert der Slots. Slots je Flughafen übergeben. | 1.6 W6, F6 |
| O46 | **Flugzeuge aufgelöster KI:** verschwinden, die Meldung sagt „go back to the market“. | An den Gebrauchtmarkt geben. | 1.6 W8, F7; 1.7 W9 |
| O47 | **Slots:** Gemietete Rechte und KI-Abflüge je Woche werden voneinander abgezogen, als wären sie dieselbe Einheit. Die Grenze (Stufe × 300) steht nur in Ansichten; die KI prüft sie nicht. | Ein Slot = ein Abflug je Woche. Die Grenze steht im Modell; die KI belegt Slots und hält die Grenze ein. | 1.8 W2, F1 |
| O48 | **Flüge je Tag:** Der Planer zählt die freie Tageszeit des Flugzeugs, der Zeitplan-Editor den ganzen Tag. | Regel des Planers (übrige Strecken desselben Flugzeugs zählen), in einer Funktion im Modell. | 1.8 W6, F7 |
| O49 | **Erklärtexte und Debug-Anzeige:** neun Texte mit festen Zahlen; die Debug-Anzeige schreibt Formeln ab. | Alle Zahlen in Texten aus den Konstanten. Die Debug-Anzeige zeigt nur die Aufschlüsselung, die das Modell liefert, keine eigene Rechnung. | 1.8 W9, F6; 1.3 W8 |

### Bauregeln (ohne eigene Entscheidung, Bestätigung mit O11)

Diese Funde haben eine klare Lösung. Sie werden als Regeln in die Spezifikation übernommen.

| Nr. | Regel | Löst |
|---|---|---|
| R1 | **Ein Markt, eine Rechnung.** Alle Angebote eines Städtepaars (eigene Strecken, KI, Umsteiger) werden einmal gemeinsam aufgeteilt. Abflüge je Gesellschaft auf dem Paar summiert, je Richtung gezählt. Spieler und KI nutzen dieselbe Rechnung. | 1.2 W2, W3, W9, W10, W14; 1.1 W10; 1.6 doppelte Rivalen-Angebote |
| R2 | **Eine Funktion je Größe; Ansichten rechnen nicht.** Planer, Overlay, Streckenansicht, Live-Karte, Flughafen-Ansicht und Bericht lesen nur Werte aus dem Modell. | 1.1 W5; 1.3 W1 (Umsetzung); 1.4 Doppelte Rechnungen; 1.8 W1, W6, W7 |
| R3 | **Spielregeln nicht in `App.tsx` oder Klick-Handlern.** Treibstoff-Absicherung, Überholung, Umrüstung, Kabine (`src/model/kabine.ts`), Einrichtungs-Preise, Saisontabelle stehen im Modell. | 1.8 W3, W4, W8; 1.7 Doppelte Rechnungen |
| R4 | **Intern ungerundet, einmal kappen.** Runden nur für die Anzeige. | 1.1 W6 |
| R5 | **Stufenlose Zeit.** Mahlzeiten-Zahl gleitend wie der Flugzeit-Index; keine Sprünge bei 360 und 720 Minuten. | 1.1 W2; 1.4 W14 |
| R6 | **Kosten nach der richtigen Bezugsgröße.** Landungen je Flugabschnitt am Ziel; Flugbegleiter nach eingebauter Kabine; Treibstoff und Landung nach Flugzeug; Bodenpersonal je Abflug (oder in Abfertigung enthalten); ein Nachlass-Faktor für alle Flughafen-Gebühren; KI-Landegebühr mit derselben Funktion. | 1.4 W6, W8 (Teil), W10, W11, W12 |
| R7 | **KI-Preise relativ zum Marktpreis**, mit derselben Funktion wie beim Spieler; der Preis-Reiz der KI aus ihrem echten Preis. | 1.3 W4 |
| R8 | **Fehlender Preis = Marktpreis**, an einer Stelle. | 1.3 W9 |
| R9 | **Planer zeigt den Anlauf** neuer Strecken (erster Monat und volle Nachfrage). | 1.2 W11 |
| R10 | **Ruf an einer Stelle.** Eine Funktion „Ruf-Änderung“ mit Liste der Ursachen je Monat; Grenzen 0–100 einmal. | 1.5 W4 |
| R11 | **Kasse am Monatsende** nach allen Buchungen des Abschlusses; alle Leser nutzen sie; Abbuchungen gehören in den Bericht dieses Monats. | 1.7 W7 |
| R12 | **Monatsablauf sauber:** Verschleiß aus geflogenen Flügen; Pech-Deckel nach dem ersten Pech im Abschluss schließen; Ereignisse als Teil des Spielstands, nicht als Modul-Zustand. | 1.7 W11, W12, W13 (Teil) |
| R13 | **Gebrauchtmarkt:** Alter mindestens „jetzt − Bauende“; eine Restwert-Formel für alle (mit Alter und Zustand). | 1.7 W9; 1.6 W7 |
| R14 | **KI-Einzelheiten:** Langstrecken-Ausstattung je Mahlzeit; in langer Krise geparkte Flugzeuge verkaufen; 2. Drehkreuz bevorzugt in der Heimatregion, Mindeststufe 5. | 1.1 W11; 1.6 W9, W10 |
| R15 | **Einheitliche Regeln:** überall `regionOf`; Jahresziel aus Vorjahr und Größe mit Mindest-Belohnung. | 1.5 W10, W11 |
| R16 | **Aufräumen:** Selbstbedienungs-Abzug, SAT-Zweig über 200 und `loadFactor` im Ruf-Ziel entfernen; Texte und Kommentare aus Konstanten (4.1); altes Mahlzeiten-Format in 5.1 umwandeln. | 1.1 W4, W15; 1.3 W8, W11; 1.5 W12; 1.6 W11 |

### Abhängigkeiten

- O6, O8, O5 und O12 zuerst: Sie bestimmen die Grundform des Modells.
- O14, O20, O21, O5 legen nur die Richtung fest; die Zahlen kommen aus dem Balance-Skript (3.9).
- O27 (Wertmodell) ist Grundlage für O28, O29, O32 und O45.
- O41 (gleiche Regeln) ist Grundlage für O42–O44 und O47.
- O44 (Zuschuss abschaffen) erst, wenn O6, O41 und O42 umgesetzt sind.
