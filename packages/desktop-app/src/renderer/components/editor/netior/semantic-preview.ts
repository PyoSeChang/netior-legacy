import {
  Decoration,
  EditorView,
  WidgetType,
  type DecorationSet,
} from '@codemirror/view';
import { StateField, type EditorState, type Extension, type Range } from '@codemirror/state';
import {
  getSemanticTargetDisplayFallback,
  parseSemanticEditorTokens,
  type SemanticEditorToken,
} from '@netior/shared';

function focusedToken(state: EditorState, token: SemanticEditorToken): boolean {
  return state.selection.ranges.some((range) => range.from <= token.to && range.to >= token.from);
}

function getTokenLabel(token: SemanticEditorToken): string {
  return token.label ?? getSemanticTargetDisplayFallback(token.target);
}

class MentionWidget extends WidgetType {
  constructor(readonly token: SemanticEditorToken) {
    super();
  }

  eq(other: MentionWidget): boolean {
    return this.token.raw === other.token.raw;
  }

  toDOM(): HTMLElement {
    const chip = document.createElement('span');
    chip.className = 'netior-mention-chip';
    chip.dataset.netiorOccurrenceType = this.token.occurrenceType;
    chip.dataset.netiorRelationshipId = this.token.relationshipId ?? '';

    const mark = document.createElement('span');
    mark.className = 'netior-mention-mark';
    mark.textContent = '@';
    chip.appendChild(mark);

    const label = document.createElement('span');
    label.className = 'netior-mention-label';
    label.textContent = getTokenLabel(this.token);
    chip.appendChild(label);

    if (this.token.relationshipId) {
      const rel = document.createElement('span');
      rel.className = 'netior-relationship-dot';
      chip.appendChild(rel);
    }

    return chip;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

class EmbedWidget extends WidgetType {
  constructor(readonly token: SemanticEditorToken) {
    super();
  }

  eq(other: EmbedWidget): boolean {
    return this.token.raw === other.token.raw;
  }

  toDOM(): HTMLElement {
    const block = document.createElement('div');
    block.className = 'netior-embed-block';
    block.dataset.netiorOccurrenceType = this.token.occurrenceType;
    block.dataset.netiorRelationshipId = this.token.relationshipId ?? '';

    const header = document.createElement('div');
    header.className = 'netior-embed-header';

    const title = document.createElement('div');
    title.className = 'netior-embed-title';
    title.textContent = getTokenLabel(this.token);
    header.appendChild(title);

    const projection = document.createElement('div');
    projection.className = 'netior-embed-projection';
    projection.textContent = this.token.projection ?? 'summary_card';
    header.appendChild(projection);

    block.appendChild(header);

    const body = document.createElement('div');
    body.className = 'netior-embed-body';
    body.textContent = getSemanticTargetDisplayFallback(this.token.target);
    block.appendChild(body);

    return block;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function buildSemanticDecos(state: EditorState): DecorationSet {
  const decos: Range<Decoration>[] = [];
  const tokens = parseSemanticEditorTokens(state.doc.toString());

  for (const token of tokens) {
    if (focusedToken(state, token)) {
      decos.push(Decoration.mark({ class: 'netior-semantic-token-source' }).range(token.from, token.to));
      continue;
    }

    if (token.occurrenceType === 'embed') {
      decos.push(Decoration.replace({ widget: new EmbedWidget(token), block: true }).range(token.from, token.to));
    } else {
      decos.push(Decoration.replace({ widget: new MentionWidget(token) }).range(token.from, token.to));
    }
  }

  return Decoration.set(decos, true);
}

const semanticField = StateField.define<DecorationSet>({
  create(state) {
    return buildSemanticDecos(state);
  },
  update(decos, tr) {
    if (tr.docChanged || tr.selection) return buildSemanticDecos(tr.state);
    return decos;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export const netiorSemanticPreviewTheme = EditorView.theme({
  '.netior-mention-chip': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    maxWidth: '100%',
    border: '1px solid var(--border-default)',
    borderRadius: '6px',
    backgroundColor: 'var(--accent-muted)',
    color: 'var(--text-default)',
    padding: '1px 6px',
    fontSize: '0.92em',
    lineHeight: '1.5',
    verticalAlign: 'baseline',
    cursor: 'pointer',
  },
  '.netior-mention-mark': {
    color: 'var(--accent)',
    fontWeight: '700',
  },
  '.netior-mention-label': {
    minWidth: '0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  '.netior-relationship-dot': {
    width: '6px',
    height: '6px',
    borderRadius: '999px',
    backgroundColor: 'var(--accent)',
  },
  '.netior-embed-block': {
    display: 'block',
    border: '1px solid var(--border-default)',
    borderRadius: '8px',
    backgroundColor: 'var(--surface-card)',
    margin: '8px 0',
    overflow: 'hidden',
  },
  '.netior-embed-header': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    borderBottom: '1px solid var(--border-subtle)',
    padding: '8px 10px',
  },
  '.netior-embed-title': {
    minWidth: '0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '0.9em',
    fontWeight: '600',
    color: 'var(--text-default)',
  },
  '.netior-embed-projection': {
    flexShrink: '0',
    borderRadius: '999px',
    backgroundColor: 'var(--surface-hover)',
    color: 'var(--text-secondary)',
    padding: '2px 7px',
    fontSize: '0.72em',
  },
  '.netior-embed-body': {
    padding: '10px',
    color: 'var(--text-secondary)',
    fontSize: '0.82em',
  },
  '.netior-semantic-token-source': {
    backgroundColor: 'var(--accent-muted)',
    borderRadius: '4px',
  },
});

export function createNetiorSemanticPreviewPlugin(): Extension[] {
  return [semanticField, netiorSemanticPreviewTheme];
}
