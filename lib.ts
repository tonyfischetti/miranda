// Pure helpers for Miranda.  Nothing here touches the Obsidian API, so the
// file can be exercised directly with bun (see the test in the zix repo
// notes) and shares its task-line format with the `tasks` CLI.

export type DueChoice = 'today' | 'tomorrow' | 'nextweek' | 'none' | 'custom';

export interface TaskParts {
  text:      string;
  tags:      string[];                       // "#life", "#nypl"
  priority?: string | null;
  due:       string | null;                  // YYYY-MM-DD
}

const LIST_ITEM_RE    = /^\s*(?:[-*+]|\d+[.)])\s/;
const INLINE_FIELD_RE = /\s*\[\w+::/;
// An Obsidian tag: letters, digits, _ - /, with at least one letter or _
const TAG_RE          = /(?<=^|\s)#([\p{L}\p{N}_\/-]*[\p{L}_][\p{L}\p{N}_\/-]*)/gu;
const ISO_DATE_RE     = /^\d{4}-\d{2}-\d{2}$/;


/***************************************************************
 * dates
 */

const two = (n: number): string => (n < 10 ? '0' : '') + n;

export const isoDate = (d: Date): string =>
  `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;

export const addDays = (d: Date, n: number): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// What the due-date row's choice means on a given day
export const dueFor = (choice: DueChoice, custom: string, today: Date): string | null => {
  switch (choice) {
    case 'today':    return isoDate(today);
    case 'tomorrow': return isoDate(addDays(today, 1));
    case 'nextweek': return isoDate(addDays(today, 7));
    case 'custom':   return ISO_DATE_RE.test(custom) ? custom : null;
    default:         return null;
  }
};


/***************************************************************
 * task lines
 */

// ["life", "#nypl", "a,b", ""] -> ["#life", "#nypl", "#a", "#b"]
export const normalizeTags = (raw: string[]): string[] => {
  const tags: string[] = [];
  for (const chunk of raw) {
    for (const piece of chunk.split(/[,\s]+/)) {
      const tag = piece.trim().replace(/^#+/, '');
      if (tag && tags.indexOf(`#${tag}`) === -1) tags.push(`#${tag}`);
    }
  }
  return tags;
};

// "- [ ] text #tags  [priority:: x]  [due:: YYYY-MM-DD]", the way the Tasks
// plugin's dataview format writes it (two spaces before each field)
export const buildTaskLine = ({ text, tags, priority, due }: TaskParts): string => {
  let body = text.trim();
  if (!body) throw new Error('the task has no text');

  const present = new Set((body.match(TAG_RE) || []).map((t) => t.toLowerCase()));
  const extra   = tags.filter((t) => !present.has(t.toLowerCase()));
  if (extra.length) {
    // keep any [field:: ...] already typed at the end, where Tasks wants it
    const field = INLINE_FIELD_RE.exec(body);
    body = field
      ? `${body.slice(0, field.index)} ${extra.join(' ')}${body.slice(field.index)}`
      : `${body} ${extra.join(' ')}`;
  }

  let line = `- [ ] ${body}`;
  if (priority)                         line += `  [priority:: ${priority}]`;
  if (due && !/\[due::/.test(body))     line += `  [due:: ${due}]`;
  return line;
};

// Append a block to a note's text: trailing blank lines go, tasks stay
// together, and prose or front matter gets a blank line before the block
export const appendBlock = (existing: string, block: string): string => {
  const body = existing.replace(/\s+$/, '');
  if (!body) return `${block}\n`;
  const lastLine = body.slice(body.lastIndexOf('\n') + 1);
  return body + (LIST_ITEM_RE.test(lastLine) ? '\n' : '\n\n') + block + '\n';
};


/***************************************************************
 * daily-note template
 */

// {{date}}, {{time}}, {{title}}, with an optional offset and format,
// e.g. {{date+1d:YYYY-MM-DD}} -- what the core Daily Notes plugin supports.
// `format` is handed in (moment, in the plugin) so this file stays pure.
const TEMPLATE_VAR_RE = /\{\{\s*(date|time|title)\s*(?:([+-]\d+)\s*([dw]))?\s*(?::([^}]*))?\s*\}\}/g;

export const renderTemplate = (
  text: string,
  title: string,
  format: (fmt: string, offsetDays: number) => string,
  dateFormat: string,
): string =>
  text.replace(TEMPLATE_VAR_RE, (_m: string, kind: string, offset: string, unit: string, fmt: string) => {
    if (kind === 'title') return title;
    const days = offset ? Number(offset) * (unit === 'w' ? 7 : 1) : 0;
    return format(fmt || (kind === 'date' ? dateFormat : 'HH:mm'), days);
  });
