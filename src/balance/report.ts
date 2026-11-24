/**
 * Balance-Skript (Paket 3.9): Aufbau des Berichts und Ausgabe als Markdown.
 *
 * Ein Bericht besteht aus Abschnitten (nach der Spezifikation). Jeder Abschnitt hat Prüfregeln mit Urteil und
 * Tabellen mit Beispielwerten. Das Skript ändert keine Konstante; es zeigt nur, wie die Startwerte wirken.
 */

/**
 * Urteil einer Prüfregel:
 * - `ok`: Die Regel aus der Spezifikation gilt.
 * - `abweichung`: Die Regel gilt nicht; eine Stellschraube muss geändert werden (Entscheidung des Menschen).
 * - `info`: Die Spezifikation nennt keine feste Grenze; der Wert wird gezeigt und in `BALANCE.md` bewertet.
 */
export type Verdict = 'ok' | 'abweichung' | 'info';

/** Eine Prüfregel mit Ergebnis. */
export interface Check {
  /** Kennung im Bericht, z. B. „B3.1“. */
  readonly id: string;
  /** Fundstelle in der Spezifikation, z. B. „3.3“. */
  readonly spec: string;
  /** Die Regel in einem Satz. */
  readonly rule: string;
  /** Gemessener Wert (Text). */
  readonly value: string;
  readonly verdict: Verdict;
}

/** Eine Tabelle mit Beispielwerten. */
export interface Table {
  readonly title: string;
  readonly header: readonly string[];
  readonly rows: readonly (readonly string[])[];
  /** Erklärung unter der Tabelle. */
  readonly note?: string;
}

/** Ein Abschnitt des Berichts. */
export interface Section {
  readonly title: string;
  readonly checks: readonly Check[];
  readonly tables: readonly Table[];
}

// ---------------------------------------------------------------------------
// Zahlen-Format (nur Anzeige, R4)
// ---------------------------------------------------------------------------

/** Zahl mit festen Nachkommastellen, Dezimalkomma, Tausender mit schmalem Leerzeichen. */
export function num(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return String(value);
  const fixed = Math.abs(value).toFixed(digits);
  const [whole, frac] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const sign = value < 0 && Number(fixed) !== 0 ? '−' : '';
  return `${sign}${grouped}${frac ? `,${frac}` : ''}`;
}

/** Anteil als Prozent. */
export function pct(share: number, digits = 0): string {
  if (!Number.isFinite(share)) return '–';
  return `${num(share * 100, digits)} %`;
}

/** Dollar-Betrag, ganze Dollar. */
export function usd(value: number): string {
  return `${num(value)} $`;
}

/** Dollar-Betrag in Millionen. */
export function musd(value: number, digits = 1): string {
  return `${num(value / 1e6, digits)} Mio. $`;
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

const VERDICT_TEXT: Readonly<Record<Verdict, string>> = { ok: 'ok', abweichung: '**Abweichung**', info: 'Info' };

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');

function tableMarkdown(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const lines = [`| ${header.map(cell).join(' | ')} |`, `|${header.map(() => '---').join('|')}|`];
  for (const row of rows) lines.push(`| ${row.map(cell).join(' | ')} |`);
  return lines.join('\n');
}

/** Zählt die Urteile über alle Abschnitte. */
export function verdictCounts(sections: readonly Section[]): Readonly<Record<Verdict, number>> {
  const counts: Record<Verdict, number> = { ok: 0, abweichung: 0, info: 0 };
  for (const s of sections) for (const c of s.checks) counts[c.verdict]++;
  return counts;
}

/** Der ganze Bericht als Markdown. */
export function renderMarkdown(title: string, intro: string, sections: readonly Section[]): string {
  const counts = verdictCounts(sections);
  const out: string[] = [`# ${title}`, '', intro, ''];
  out.push(`Prüfregeln: ${counts.ok} ok · ${counts.abweichung} Abweichung · ${counts.info} Info.`, '');
  out.push('## Übersicht der Prüfregeln', '');
  out.push(
    tableMarkdown(
      ['Nr.', 'Spez.', 'Regel', 'Wert', 'Urteil'],
      sections.flatMap((s) => s.checks.map((c) => [c.id, c.spec, c.rule, c.value, VERDICT_TEXT[c.verdict]])),
    ),
    '',
  );
  for (const s of sections) {
    out.push(`## ${s.title}`, '');
    for (const t of s.tables) {
      out.push(`### ${t.title}`, '', tableMarkdown(t.header, t.rows), '');
      if (t.note) out.push(t.note, '');
    }
  }
  return out.join('\n');
}
