/**
 * Obsidian-style live preview for CodeMirror 6.
 *
 * markPlugin:     Decoration.mark/line ??styling (always)
 * replacePlugin:  Decoration.replace ??conceal syntax (non-cursor lines, single-line only)
 * tableField:     StateField ??table block replace (multi-line, requires StateField)
 * checkboxPlugin: capture-phase mousedown ??toggles checkboxes before CM6 steals focus
 * linkHandler:    click handler ??opens links
 */

import {
  ViewPlugin,
  Decoration,
  type DecorationSet,
  type ViewUpdate,
  EditorView,
  WidgetType,
} from '@codemirror/view';
import { type EditorState, type Extension, type Range, StateField, type Transaction } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
//  WIDGETS
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧

class BulletWidget extends WidgetType {
  toDOM() {
    const s = document.createElement('span');
    s.className = 'md-bullet';
    s.textContent = '*';
    return s;
  }
}

class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean, readonly lineFrom: number) { super(); }
  eq(o: CheckboxWidget) { return this.checked === o.checked && this.lineFrom === o.lineFrom; }
  toDOM() {
    const w = document.createElement('span');
    w.className = 'md-checkbox-wrapper';
    w.dataset.lineFrom = String(this.lineFrom);

    const box = document.createElement('span');
    box.className = `md-checkbox ${this.checked ? 'md-checkbox-checked' : ''}`;

    if (this.checked) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '11');
      svg.setAttribute('height', '11');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '3');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', 'M20 6 9 17l-5-5');
      svg.appendChild(p);
      box.appendChild(svg);
    }

    w.appendChild(box);
    return w;
  }
  ignoreEvent() { return true; }
}

class HrWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement('hr');
    hr.className = 'md-hr-line';
    return hr;
  }
}

class FrontmatterWidget extends WidgetType {
  constructor(readonly entries: [string, string][]) { super(); }
  eq(o: FrontmatterWidget) {
    return this.entries.length === o.entries.length &&
      this.entries.every((e, i) => e[0] === o.entries[i][0] && e[1] === o.entries[i][1]);
  }
  toDOM() {
    const wrap = document.createElement('div');
    wrap.className = 'md-frontmatter';

    const header = document.createElement('div');
    header.className = 'md-frontmatter-header';
    header.textContent = '?띿꽦';
    wrap.appendChild(header);

    const table = document.createElement('table');
    table.className = 'md-frontmatter-table';
    const tbody = document.createElement('tbody');

    for (const [key, value] of this.entries) {
      const tr = document.createElement('tr');

      const tdKey = document.createElement('td');
      tdKey.className = 'md-frontmatter-key';
      const icon = document.createElement('span');
      icon.className = 'md-frontmatter-icon';
      icon.textContent = '\u2261'; // ??
      tdKey.appendChild(icon);
      const keyText = document.createElement('span');
      keyText.textContent = key;
      tdKey.appendChild(keyText);

      const tdVal = document.createElement('td');
      tdVal.className = 'md-frontmatter-value';
      tdVal.textContent = value;

      tr.appendChild(tdKey);
      tr.appendChild(tdVal);
      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }
  ignoreEvent() { return false; }
}

class TableWidget extends WidgetType {
  constructor(readonly text: string) { super(); }
  eq(o: TableWidget) { return this.text === o.text; }
  toDOM() {
    const rows = this.text.split('\n').filter(l => l.trim());
    if (rows.length < 2) { const s = document.createElement('span'); s.textContent = this.text; return s; }

    const parseRow = (row: string): string[] =>
      row.split('|').map(c => c.trim()).filter((c, i, a) => !(i === 0 && c === '') && !(i === a.length - 1 && c === ''));

    const table = document.createElement('table');
    table.className = 'md-table';

    const thead = document.createElement('thead');
    const tr = document.createElement('tr');
    for (const cell of parseRow(rows[0])) {
      const th = document.createElement('th');
      th.textContent = cell;
      tr.appendChild(th);
    }
    thead.appendChild(tr);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (let i = 2; i < rows.length; i++) {
      const row = document.createElement('tr');
      for (const cell of parseRow(rows[i])) {
        const td = document.createElement('td');
        td.textContent = cell;
        row.appendChild(td);
      }
      tbody.appendChild(row);
    }
    table.appendChild(tbody);

    const w = document.createElement('div');
    w.className = 'md-table-wrapper';
    w.appendChild(table);
    return w;
  }
  ignoreEvent() { return false; }
}

// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
//  REUSABLE DECORATIONS
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧

const hMark: Record<number, Decoration> = {
  1: Decoration.mark({ class: 'md-h1' }), 2: Decoration.mark({ class: 'md-h2' }),
  3: Decoration.mark({ class: 'md-h3' }), 4: Decoration.mark({ class: 'md-h4' }),
  5: Decoration.mark({ class: 'md-h5' }), 6: Decoration.mark({ class: 'md-h6' }),
};
const boldD = Decoration.mark({ class: 'md-bold' });
const italicD = Decoration.mark({ class: 'md-italic' });
const strikeD = Decoration.mark({ class: 'md-strikethrough' });
const icodeD = Decoration.mark({ class: 'md-inline-code' });
const imgAltD = Decoration.mark({ class: 'md-image-alt' });
const bqLineD = Decoration.line({ class: 'md-blockquote-line' });
const codeLineD = Decoration.line({ class: 'md-code-line' });
const hide = Decoration.replace({});

// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
//  HELPERS
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧

function focusedLines(state: EditorState): Set<number> {
  const s = new Set<number>();
  for (const r of state.selection.ranges) {
    const a = state.doc.lineAt(r.from).number, b = state.doc.lineAt(r.to).number;
    for (let i = a; i <= b; i++) s.add(i);
  }
  return s;
}

function addLineDecos(state: EditorState, from: number, to: number, d: Decoration, out: Range<Decoration>[]) {
  const a = state.doc.lineAt(from).number, b = state.doc.lineAt(to).number;
  for (let i = a; i <= b; i++) out.push(d.range(state.doc.line(i).from));
}

function getFrontmatterRange(state: EditorState): { from: number; to: number } | null {
  if (state.doc.lines < 3) return null;
  const first = state.doc.line(1);
  if (first.text.trim() !== '---') return null;
  const limit = Math.min(state.doc.lines, 50); // frontmatter won't be 50+ lines
  for (let i = 2; i <= limit; i++) {
    if (state.doc.line(i).text.trim() === '---') {
      return { from: first.from, to: state.doc.line(i).to };
    }
  }
  return null;
}

function parseFrontmatterEntries(text: string): [string, string][] {
  const lines = text.split('\n').slice(1, -1); // strip --- delimiters
  const entries: [string, string][] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\S[\w-]*):\s*(.*)$/);
    if (!m) continue;
    let val = m[2].replace(/^["']|["']$/g, '').trim();
    // YAML block scalar (> or |): collect indented continuation lines
    if (val === '>' || val === '|') {
      const parts: string[] = [];
      while (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) {
        parts.push(lines[++i].trim());
      }
      val = parts.join(val === '>' ? ' ' : '\n');
    }
    entries.push([m[1], val]);
  }
  return entries;
}

// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
//  BUILD MARK + INLINE REPLACE DECOS
//  (single-line replaces only ??safe for ViewPlugin)
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧

interface MR { marks: DecorationSet; reps: DecorationSet }
export type MarkdownLinkHandler = (href: string, event: MouseEvent) => void;

function buildMR(view: EditorView): MR {
  const startedAt = performance.now();
  const { state } = view;
  const fl = focusedLines(state);
  const m: Range<Decoration>[] = [];
  const r: Range<Decoration>[] = [];
  let inCode = false;
  const fmRange = getFrontmatterRange(state);

  for (const visibleRange of view.visibleRanges) syntaxTree(state).iterate({
    from: visibleRange.from,
    to: visibleRange.to,
    enter(nd) {
      const n = nd.name;

      // ?? Skip frontmatter region ??
      if (fmRange && nd.from >= fmRange.from && nd.to <= fmRange.to) return;

      // ?? Fenced code ??
      if (n === 'FencedCode') { inCode = true; addLineDecos(state, nd.from, nd.to, codeLineD, m); return; }
      if (n === 'CodeMark' && inCode) {
        const ln = state.doc.lineAt(nd.from).number;
        if (!fl.has(ln)) { const line = state.doc.line(ln); r.push(hide.range(line.from, line.to)); }
        return;
      }
      if (n === 'CodeInfo' || inCode) return;

      // ?? Table ??skip here, handled by StateField ??
      if (n === 'Table') return false;

      const ln = state.doc.lineAt(nd.from).number;
      const f = fl.has(ln);

      // ?? Heading ??
      if (/^ATXHeading\d$/.test(n)) {
        const lv = parseInt(n.charAt(n.length - 1), 10);
        if (hMark[lv]) { const line = state.doc.lineAt(nd.from); m.push(hMark[lv].range(line.from, line.to)); }
      }
      if (n === 'HeaderMark' && !f) {
        const end = state.doc.sliceString(nd.to, nd.to + 1) === ' ' ? nd.to + 1 : nd.to;
        r.push(hide.range(nd.from, end));
      }

      // ?? Bold ??
      if (n === 'StrongEmphasis') {
        m.push(boldD.range(nd.from, nd.to));
        if (!f) {
          const t = state.doc.sliceString(nd.from, nd.from + 3);
          const ml = (t.startsWith('***') || t.startsWith('___')) ? 3 : 2;
          r.push(hide.range(nd.from, nd.from + ml)); r.push(hide.range(nd.to - ml, nd.to));
        }
      }

      // ?? Italic ??
      if (n === 'Emphasis') {
        m.push(italicD.range(nd.from, nd.to));
        if (!f) { r.push(hide.range(nd.from, nd.from + 1)); r.push(hide.range(nd.to - 1, nd.to)); }
      }

      // ?? Strikethrough ??
      if (n === 'Strikethrough') {
        m.push(strikeD.range(nd.from, nd.to));
        if (!f) { r.push(hide.range(nd.from, nd.from + 2)); r.push(hide.range(nd.to - 2, nd.to)); }
      }

      // ?? Inline code ??
      if (n === 'InlineCode') {
        m.push(icodeD.range(nd.from, nd.to));
        if (!f) { r.push(hide.range(nd.from, nd.from + 1)); r.push(hide.range(nd.to - 1, nd.to)); }
      }

      // ?? Link ??
      if (n === 'Link') {
        const lm: { from: number; to: number }[] = [];
        let uF = -1, uT = -1;
        const c = nd.node.cursor();
        if (c.firstChild()) { do { if (c.name === 'LinkMark') lm.push({ from: c.from, to: c.to }); if (c.name === 'URL') { uF = c.from; uT = c.to; } } while (c.nextSibling()); }
        if (lm.length >= 2) {
          const tF = lm[0].to, tT = lm[1].from;
          if (tF < tT) {
            const url = uF >= 0 ? state.doc.sliceString(uF, uT) : '';
            m.push(Decoration.mark({ class: 'md-link', attributes: { 'data-href': url } }).range(tF, tT));
            if (!f) { r.push(hide.range(nd.from, tF)); r.push(hide.range(tT, nd.to)); }
          }
        }
      }

      // ?? Image ??
      if (n === 'Image') {
        const lm: { from: number; to: number }[] = [];
        const c = nd.node.cursor();
        if (c.firstChild()) { do { if (c.name === 'LinkMark') lm.push({ from: c.from, to: c.to }); } while (c.nextSibling()); }
        if (lm.length >= 2) {
          const aF = lm[0].to, aT = lm[1].from;
          if (aF < aT) { m.push(imgAltD.range(aF, aT)); if (!f) { r.push(hide.range(nd.from, aF)); r.push(hide.range(aT, nd.to)); } }
        }
      }

      // ?? Blockquote ??
      if (n === 'Blockquote') addLineDecos(state, nd.from, nd.to, bqLineD, m);
      if (n === 'QuoteMark' && !f) {
        const end = state.doc.sliceString(nd.to, nd.to + 1) === ' ' ? nd.to + 1 : nd.to;
        r.push(hide.range(nd.from, end));
      }

      // ?? HR ??
      if (n === 'HorizontalRule' && !f) r.push(Decoration.replace({ widget: new HrWidget() }).range(nd.from, nd.to));

      // ?? Lists ??
      if (n === 'ListMark' && !f) {
        const mt = state.doc.sliceString(nd.from, nd.to);
        const after = state.doc.sliceString(nd.to, nd.to + 5);
        const task = after.match(/^ \[([xX ])\]/);
        if (task) {
          const checked = task[1] !== ' ';
          const endOff = state.doc.sliceString(nd.to + 4, nd.to + 5) === ' ' ? 5 : 4;
          r.push(Decoration.replace({ widget: new CheckboxWidget(checked, state.doc.lineAt(nd.from).from) }).range(nd.from, nd.to + endOff));
          return;
        }
        if (mt === '-' || mt === '*' || mt === '+') {
          const end = state.doc.sliceString(nd.to, nd.to + 1) === ' ' ? nd.to + 1 : nd.to;
          r.push(Decoration.replace({ widget: new BulletWidget() }).range(nd.from, end));
          return;
        }
        m.push(Decoration.mark({ class: 'md-list-marker' }).range(nd.from, nd.to));
      }
    },
    leave(nd) { if (nd.name === 'FencedCode') inCode = false; },
  });

  const duration = performance.now() - startedAt;
  if (duration > 12) {
    console.debug('[NetiorPerf] markdownLivePreview.buildMR', {
      durationMs: Math.round(duration * 10) / 10,
      docLength: state.doc.length,
      visibleRanges: view.visibleRanges.length,
    });
  }
  return { marks: Decoration.set(m, true), reps: Decoration.set(r, true) };
}

function rangeTouches(state: EditorState, from: number, to: number, targetFrom: number, targetTo: number): boolean {
  const lineFrom = state.doc.lineAt(Math.max(0, Math.min(from, state.doc.length))).from;
  const lineTo = state.doc.lineAt(Math.max(0, Math.min(to, state.doc.length))).to;
  return lineFrom <= targetTo && lineTo >= targetFrom;
}

function changedLineTextIncludes(tr: Transaction, needle: string): boolean {
  let found = false;
  tr.changes.iterChangedRanges((fromA, toA, fromB, toB) => {
    if (found) return;
    const oldStart = tr.startState.doc.lineAt(Math.max(0, Math.min(fromA, tr.startState.doc.length)));
    const oldEnd = tr.startState.doc.lineAt(Math.max(0, Math.min(toA, tr.startState.doc.length)));
    const nextStart = tr.state.doc.lineAt(Math.max(0, Math.min(fromB, tr.state.doc.length)));
    const nextEnd = tr.state.doc.lineAt(Math.max(0, Math.min(toB, tr.state.doc.length)));
    found = tr.startState.doc.sliceString(oldStart.from, oldEnd.to).includes(needle)
      || tr.state.doc.sliceString(nextStart.from, nextEnd.to).includes(needle);
  });
  return found;
}

// ?? Cache ??
interface MrCacheEntry {
  doc: EditorState['doc'];
  head: number;
  anchor: number;
  value: MR;
}

const mrCache = new WeakMap<EditorView, MrCacheEntry>();

function getMR(v: EditorView): MR {
  const { doc, selection } = v.state;
  const { head, anchor } = selection.main;
  const cached = mrCache.get(v);
  if (cached && cached.doc === doc && cached.head === head && cached.anchor === anchor) {
    return cached.value;
  }

  const value = buildMR(v);
  mrCache.set(v, { doc, head, anchor, value });
  return value;
}

// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
//  FRONTMATTER STATE FIELD (block replace, multi-line)
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧

function buildFrontmatterDecos(state: EditorState): DecorationSet {
  const fm = getFrontmatterRange(state);
  if (!fm) return Decoration.none;

  const fmStartLine = state.doc.lineAt(fm.from).number;
  const fmEndLine = state.doc.lineAt(fm.to).number;

  // Check if cursor is intentionally inside frontmatter (not default position 0,0)
  let anyFocused = false;
  for (const range of state.selection.ranges) {
    if (range.from === 0 && range.to === 0) continue; // skip default cursor
    const a = state.doc.lineAt(range.from).number;
    const b = state.doc.lineAt(range.to).number;
    for (let i = a; i <= b; i++) {
      if (i >= fmStartLine && i <= fmEndLine) { anyFocused = true; break; }
    }
    if (anyFocused) break;
  }

  if (anyFocused) return Decoration.none;

  const text = state.doc.sliceString(fm.from, fm.to);
  const entries = parseFrontmatterEntries(text);
  if (entries.length === 0) return Decoration.none;

  return Decoration.set([
    Decoration.replace({ widget: new FrontmatterWidget(entries), block: true }).range(fm.from, fm.to),
  ]);
}

const frontmatterField = StateField.define<DecorationSet>({
  create(state) { return buildFrontmatterDecos(state); },
  update(decos, tr) {
    const fm = getFrontmatterRange(tr.startState) ?? getFrontmatterRange(tr.state);
    if (!fm) {
      if (tr.docChanged && changedLineTextIncludes(tr, '---')) return buildFrontmatterDecos(tr.state);
      return tr.docChanged ? decos.map(tr.changes) : decos;
    }
    if (tr.docChanged) {
      let touches = false;
      tr.changes.iterChangedRanges((fromA, toA, fromB, toB) => {
        if (touches) return;
        touches = rangeTouches(tr.startState, fromA, toA, fm.from, fm.to)
          || rangeTouches(tr.state, fromB, toB, fm.from, fm.to);
      });
      return touches ? buildFrontmatterDecos(tr.state) : decos.map(tr.changes);
    }
    if (tr.selection) return buildFrontmatterDecos(tr.state);
    return decos;
  },
  provide: f => EditorView.decorations.from(f),
});

// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
//  TABLE STATE FIELD (block replace, multi-line)
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧

function buildTableDecos(state: EditorState): DecorationSet {
  const fl = focusedLines(state);
  const decos: Range<Decoration>[] = [];

  syntaxTree(state).iterate({
    enter(nd) {
      if (nd.name !== 'Table') return;
      const ts = state.doc.lineAt(nd.from).number;
      const te = state.doc.lineAt(nd.to).number;
      let anyFocused = false;
      for (let i = ts; i <= te; i++) { if (fl.has(i)) { anyFocused = true; break; } }

      if (!anyFocused) {
        const text = state.doc.sliceString(nd.from, nd.to);
        decos.push(Decoration.replace({ widget: new TableWidget(text), block: true }).range(nd.from, nd.to));
      }
      return false; // skip children
    },
  });

  return Decoration.set(decos, true);
}

const tableField = StateField.define<DecorationSet>({
  create(state) { return buildTableDecos(state); },
  update(decos, tr) {
    if (tr.docChanged) {
      return changedLineTextIncludes(tr, '|') ? buildTableDecos(tr.state) : decos.map(tr.changes);
    }
    if (tr.selection) return buildTableDecos(tr.state);
    return decos;
  },
  provide: f => EditorView.decorations.from(f),
});

// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
//  CHECKBOX CLICK (capture phase)
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧

const checkboxPlugin = ViewPlugin.fromClass(class {
  view: EditorView;
  handler: (e: MouseEvent) => void;

  constructor(view: EditorView) {
    this.view = view;
    this.handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const w = t.closest('.md-checkbox-wrapper');
      if (!w) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const lineFrom = parseInt(w.getAttribute('data-line-from') ?? '', 10);
      if (isNaN(lineFrom)) return;
      const line = this.view.state.doc.lineAt(lineFrom);
      const text = line.text;
      const ui = text.indexOf('[ ]');
      const ci = text.search(/\[[xX]\]/);
      if (ui >= 0) this.view.dispatch({ changes: { from: line.from + ui, to: line.from + ui + 3, insert: '[x]' } });
      else if (ci >= 0) this.view.dispatch({ changes: { from: line.from + ci, to: line.from + ci + 3, insert: '[ ]' } });
    };
    view.dom.addEventListener('mousedown', this.handler, true); // CAPTURE phase
  }

  update() {}
  destroy() { this.view.dom.removeEventListener('mousedown', this.handler, true); }
});

// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
//  LINK CLICK
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧

function createLinkHandler(onLinkClick?: MarkdownLinkHandler): Extension {
  return EditorView.domEventHandlers({
    click(e) {
      const el = (e.target as HTMLElement).closest('.md-link');
      if (!el) return false;
      const href = el.getAttribute('data-href');
      if (!href) return false;

      e.preventDefault();
      if (onLinkClick) {
        onLinkClick(href, e);
      } else {
        void import('../../../lib/open-external').then(({ openExternal }) => openExternal(href));
      }
      return true;
    },
  });
}

// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
//  MARK + REPLACE PLUGINS
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧

const markPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(v: EditorView) { this.decorations = getMR(v).marks; }
    update(u: ViewUpdate) { if (u.docChanged || u.selectionSet || u.viewportChanged) { this.decorations = getMR(u.view).marks; } }
  },
  { decorations: v => v.decorations },
);

const replacePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(v: EditorView) { this.decorations = getMR(v).reps; }
    update(u: ViewUpdate) { if (u.docChanged || u.selectionSet || u.viewportChanged) { this.decorations = getMR(u.view).reps; } }
  },
  { decorations: v => v.decorations },
);

// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
//  EXPORT
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧

export function createLivePreviewPlugin(onLinkClick?: MarkdownLinkHandler): Extension[] {
  return [markPlugin, replacePlugin, frontmatterField, tableField, checkboxPlugin, createLinkHandler(onLinkClick)];
}

// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
//  THEME
// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧

export const livePreviewTheme = EditorView.theme({
  '.md-h1': { fontSize: '1.8em', fontWeight: '700', lineHeight: '1.4' },
  '.md-h2': { fontSize: '1.5em', fontWeight: '700', lineHeight: '1.4' },
  '.md-h3': { fontSize: '1.25em', fontWeight: '600', lineHeight: '1.4' },
  '.md-h4': { fontSize: '1.1em', fontWeight: '600', lineHeight: '1.4' },
  '.md-h5': { fontSize: '1.05em', fontWeight: '600', lineHeight: '1.4' },
  '.md-h6': { fontSize: '1em', fontWeight: '500', opacity: '0.7', lineHeight: '1.4' },

  '.md-bold': { fontWeight: '700' },
  '.md-italic': { fontStyle: 'italic' },
  '.md-strikethrough': { textDecoration: 'line-through', opacity: '0.5' },
  '.md-inline-code': {
    fontFamily: 'var(--font-code)',
    fontSize: '0.9em', backgroundColor: 'var(--surface-card)', borderRadius: '3px', padding: '1px 4px',
  },

  '.md-link': { color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer' },
  '.md-image-alt': { color: 'var(--accent)', fontStyle: 'italic' },

  '.md-blockquote-line': { borderLeft: '3px solid var(--border-default)', paddingLeft: '12px', opacity: '0.85' },

  '.md-code-line': {
    backgroundColor: 'var(--surface-card)',
    fontFamily: 'var(--font-code)',
    fontSize: '0.9em',
  },

  '.md-hr-line': { border: 'none', borderTop: '1px solid var(--border-default)', margin: '0.5em 0' },

  '.md-list-marker': { color: 'var(--text-muted)' },
  '.md-bullet': { color: 'var(--text-muted)', paddingRight: '4px' },

  '.md-checkbox-wrapper': {
    display: 'inline-flex', alignItems: 'center', paddingRight: '6px',
    cursor: 'pointer', verticalAlign: 'middle',
  },
  '.md-checkbox': {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: '16px', height: '16px', borderRadius: '3px',
    border: '1px solid var(--border-subtle)', backgroundColor: 'transparent',
    color: 'transparent', transition: 'all 150ms',
  },
  '.md-checkbox:hover': { borderColor: 'var(--border-default)' },
  '.md-checkbox-checked': { backgroundColor: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--text-on-accent)' },

  '.md-frontmatter': {
    border: '1px solid var(--border-subtle)',
    borderRadius: '6px',
    marginBottom: '12px',
    overflow: 'hidden',
  },
  '.md-frontmatter-header': {
    fontSize: '0.8em',
    fontWeight: '600',
    color: 'var(--text-muted)',
    padding: '6px 12px',
  },
  '.md-frontmatter-table': {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.85em',
  },
  '.md-frontmatter-table td': {
    padding: '4px 12px',
    borderTop: '1px solid var(--border-subtle)',
    verticalAlign: 'top',
  },
  '.md-frontmatter-key': {
    color: 'var(--text-muted)',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    width: '1%',
  },
  '.md-frontmatter-value': {
    color: 'var(--text-default)',
  },
  '.md-frontmatter-icon': {
    marginRight: '6px',
    opacity: '0.5',
  },

  '.md-table-wrapper': { overflow: 'auto', margin: '4px 0' },
  '.md-table': { width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' },
  '.md-table th, .md-table td': { border: '1px solid var(--border-subtle)', padding: '6px 12px', textAlign: 'left' },
  '.md-table th': { fontWeight: '600', backgroundColor: 'var(--surface-card)' },
});
