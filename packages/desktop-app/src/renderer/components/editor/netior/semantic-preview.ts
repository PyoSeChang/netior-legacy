import {
  Decoration,
  EditorView,
  WidgetType,
  type DecorationSet,
} from '@codemirror/view';
import { StateField, type EditorState, type Extension, type Range, type Transaction } from '@codemirror/state';
import {
  parseSemanticEditorTokens,
  type SemanticEditorToken,
  type TargetProjection,
} from '@netior/shared';

export const NETIOR_EMBED_EDIT_EVENT = 'netior:embed-edit';

interface SemanticPreviewContext {
  getPropertyValue?: (instanceId: string, fieldId: string) => string | null | undefined;
  getContent?: (instanceId: string) => string | null | undefined;
  renderContent?: (container: HTMLElement, token: SemanticEditorToken, content: string, depth: number) => (() => void) | void;
  shouldRenderInteractiveView?: () => boolean;
  renderInteractiveView?: (container: HTMLElement, token: SemanticEditorToken) => (() => void) | void;
  getVersion?: () => unknown;
  embedDepth?: number;
  maxEmbedDepth?: number;
}

function focusedToken(state: EditorState, token: SemanticEditorToken): boolean {
  return state.selection.ranges.some((range) => {
    if (range.empty) return range.from > token.from && range.from < token.to;
    return range.from < token.to && range.to > token.from;
  });
}

function getTokenLabel(token: SemanticEditorToken): string {
  if (token.label) return token.label;
  switch (token.target.kind) {
    case 'object':
      return token.target.objectType;
    case 'instance_content':
      return 'Content';
    case 'instance_properties':
      return 'Properties';
    case 'instance_property':
      return 'Property';
    case 'interactive_view':
      return 'Interactive view';
    case 'network_view':
      return 'Network';
    case 'file_preview':
      return 'File';
  }
}

function getProjectionLabel(projection: TargetProjection | undefined): string {
  switch (projection) {
    case 'content':
      return 'content';
    case 'property_value':
      return 'property';
    case 'properties_table':
      return 'properties';
    case 'interactive_view':
      return 'view';
    case 'network_preview':
      return 'network';
    case 'file_preview':
      return 'file';
    case 'inline':
    case 'chip':
    case 'summary_card':
    default:
      return 'summary';
  }
}

function getTargetKindLabel(token: SemanticEditorToken): string {
  switch (token.target.kind) {
    case 'object':
      return token.target.objectType;
    case 'instance_content':
      return 'Instance content';
    case 'instance_properties':
      return 'Instance properties';
    case 'instance_property':
      return 'Instance property';
    case 'interactive_view':
      return 'Interactive view';
    case 'network_view':
      return 'Network view';
    case 'file_preview':
      return 'File preview';
  }
}

function appendText(parent: HTMLElement, className: string, text: string): HTMLElement {
  const child = document.createElement('div');
  child.className = className;
  child.textContent = text;
  parent.appendChild(child);
  return child;
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
    chip.dataset.netiorTokenFrom = String(this.token.from);
    chip.dataset.netiorTokenTo = String(this.token.to);

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
  constructor(
    readonly token: SemanticEditorToken,
    readonly context: SemanticPreviewContext = {},
    readonly version: unknown = undefined,
  ) {
    super();
  }

  private cleanup: (() => void) | undefined;

  eq(other: EmbedWidget): boolean {
    return this.token.raw === other.token.raw && Object.is(this.version, other.version);
  }

  toDOM(): HTMLElement {
    const block = document.createElement('div');
    const projection = this.token.projection ?? 'summary_card';
    block.className = `netior-embed-block netior-embed-${projection.replace(/_/g, '-')}`;
    block.dataset.netiorOccurrenceType = this.token.occurrenceType;
    block.dataset.netiorRelationshipId = this.token.relationshipId ?? '';
    block.dataset.netiorMeaningId = this.token.meaningId ?? '';
    block.dataset.netiorTokenFrom = String(this.token.from);
    block.dataset.netiorTokenTo = String(this.token.to);

    const header = document.createElement('div');
    header.className = 'netior-embed-header';

    const title = document.createElement('div');
    title.className = 'netior-embed-title';
    title.textContent = getTokenLabel(this.token);
    header.appendChild(title);

    const headerActions = document.createElement('div');
    headerActions.className = 'netior-embed-header-actions';

    const projectionBadge = document.createElement('div');
    projectionBadge.className = 'netior-embed-projection';
    projectionBadge.textContent = getProjectionLabel(this.token.projection);
    headerActions.appendChild(projectionBadge);

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'netior-embed-edit-button';
    editButton.setAttribute('aria-label', 'Edit embed');
    editButton.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
    editButton.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    editButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      block.dispatchEvent(new CustomEvent(NETIOR_EMBED_EDIT_EVENT, {
        bubbles: true,
        detail: { token: this.token },
      }));
    });
    headerActions.appendChild(editButton);
    header.appendChild(headerActions);

    block.appendChild(header);

    const body = document.createElement('div');
    body.className = 'netior-embed-body';

    if (this.token.projection === 'properties_table' || this.token.target.kind === 'instance_properties') {
      const table = document.createElement('table');
      table.className = 'netior-embed-properties-grid';
      const tbody = document.createElement('tbody');
      const fieldIds = this.token.target.kind === 'instance_properties' ? this.token.target.fieldIds ?? [] : [];
      const rows = fieldIds.length > 0 ? fieldIds : ['properties'];

      for (const [index, fieldId] of rows.entries()) {
        const row = document.createElement('tr');
        const name = document.createElement('th');
        name.textContent = this.token.fieldLabels?.[index] ?? (fieldIds.length > 0 ? `Property ${index + 1}` : 'Properties');
        const value = document.createElement('td');
        value.textContent = this.token.target.kind === 'instance_properties'
          ? this.context.getPropertyValue?.(this.token.target.instanceId, fieldId) || '-'
          : '-';
        row.appendChild(name);
        row.appendChild(value);
        tbody.appendChild(row);
      }

      table.appendChild(tbody);
      body.appendChild(table);
    } else if (this.token.projection === 'interactive_view' || this.token.target.kind === 'interactive_view') {
      if (this.context.shouldRenderInteractiveView?.() === false) {
        appendText(body, 'netior-embed-kicker', 'Interactive View');
        appendText(body, 'netior-embed-copy', 'Paused while editing');
      } else {
        const mount = document.createElement('div');
        mount.className = 'netior-embed-interactive-mount';
        body.appendChild(mount);
        const cleanup = this.context.renderInteractiveView?.(mount, this.token);
        this.cleanup = typeof cleanup === 'function' ? cleanup : undefined;
      }
    } else if (this.token.projection === 'content' || this.token.target.kind === 'instance_content') {
      const embeddedContent = this.token.target.kind === 'instance_content'
        ? this.context.getContent?.(this.token.target.instanceId)
        : null;
      const content = embeddedContent?.trim() ?? '';
      if (content && this.context.renderContent) {
        const mount = document.createElement('div');
        mount.className = 'netior-embed-content-mount';
        body.appendChild(mount);
        const cleanup = this.context.renderContent(mount, this.token, content, (this.context.embedDepth ?? 0) + 1);
        this.cleanup = typeof cleanup === 'function' ? cleanup : undefined;
      } else {
        appendText(body, 'netior-embed-content-text', content || '-');
      }
    } else if (this.token.projection === 'property_value' || this.token.target.kind === 'instance_property') {
      appendText(body, 'netior-embed-kicker', 'Property');
      const value = this.token.target.kind === 'instance_property'
        ? this.context.getPropertyValue?.(this.token.target.instanceId, this.token.target.fieldId)
        : null;
      appendText(body, 'netior-embed-copy', value || '-');
    } else {
      appendText(body, 'netior-embed-kicker', getTargetKindLabel(this.token));
    }

    block.appendChild(body);

    return block;
  }

  ignoreEvent(): boolean {
    return false;
  }

  destroy(): void {
    this.cleanup?.();
    this.cleanup = undefined;
  }
}

class HiddenNestedEmbedWidget extends WidgetType {
  constructor(readonly token: SemanticEditorToken) {
    super();
  }

  eq(other: HiddenNestedEmbedWidget): boolean {
    return this.token.raw === other.token.raw;
  }

  toDOM(): HTMLElement {
    const block = document.createElement('div');
    block.className = 'netior-embed-block netior-embed-hidden-nested';
    block.dataset.netiorOccurrenceType = this.token.occurrenceType;
    return block;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function buildSemanticDecos(state: EditorState, context: SemanticPreviewContext): DecorationSet {
  const startedAt = performance.now();
  const decos: Range<Decoration>[] = [];
  const tokens = parseSemanticEditorTokens(state.doc.toString());
  const version = context.getVersion?.();

  for (const token of tokens) {
    if (focusedToken(state, token)) {
      decos.push(Decoration.mark({ class: 'netior-semantic-token-source' }).range(token.from, token.to));
      continue;
    }

    if (token.occurrenceType === 'embed') {
      const depth = context.embedDepth ?? 0;
      const maxDepth = context.maxEmbedDepth ?? 1;
      if (depth >= maxDepth) {
        decos.push(Decoration.replace({ widget: new HiddenNestedEmbedWidget(token), block: true }).range(token.from, token.to));
        continue;
      }
      decos.push(Decoration.replace({ widget: new EmbedWidget(token, context, version), block: true }).range(token.from, token.to));
    } else {
      decos.push(Decoration.replace({ widget: new MentionWidget(token) }).range(token.from, token.to));
    }
  }

  const result = Decoration.set(decos, true);
  const duration = performance.now() - startedAt;
  if (duration > 12) {
    console.debug('[NetiorPerf] semanticPreview.buildDecorations', {
      durationMs: Math.round(duration * 10) / 10,
      docLength: state.doc.length,
      tokenCount: tokens.length,
    });
  }
  return result;
}

function lineRangeHasSemanticSyntax(state: EditorState, from: number, to: number): boolean {
  const start = state.doc.lineAt(Math.max(0, Math.min(from, state.doc.length)));
  const end = state.doc.lineAt(Math.max(0, Math.min(to, state.doc.length)));
  const text = state.doc.sliceString(start.from, end.to);
  return text.includes('::netior-embed') || text.includes('[[') || text.includes(']]');
}

function changesTouchSemanticSyntax(tr: Transaction): boolean {
  const startedAt = performance.now();
  let touches = false;
  tr.changes.iterChangedRanges((fromA, toA, fromB, toB) => {
    if (touches) return;
    touches = lineRangeHasSemanticSyntax(tr.startState, fromA, toA)
      || lineRangeHasSemanticSyntax(tr.state, fromB, toB);
  });
  const duration = performance.now() - startedAt;
  if (duration > 8) {
    console.debug('[NetiorPerf] semanticPreview.changeCheck', {
      durationMs: Math.round(duration * 10) / 10,
      touches,
    });
  }
  return touches;
}

function createSemanticField(context: SemanticPreviewContext): StateField<DecorationSet> {
  let version: unknown = context.getVersion?.();

  return StateField.define<DecorationSet>({
    create(state) {
      version = context.getVersion?.();
      return buildSemanticDecos(state, context);
    },
    update(decos, tr) {
      const startedAt = performance.now();
      const nextVersion = context.getVersion?.();
      if (tr.docChanged && changesTouchSemanticSyntax(tr)) {
        version = nextVersion;
        const nextDecos = buildSemanticDecos(tr.state, context);
        const duration = performance.now() - startedAt;
        if (duration > 12) {
          console.debug('[NetiorPerf] semanticPreview.update.rebuild', {
            durationMs: Math.round(duration * 10) / 10,
            docChanged: tr.docChanged,
          });
        }
        return nextDecos;
      }
      if (tr.docChanged) {
        const mapped = decos.map(tr.changes);
        const duration = performance.now() - startedAt;
        if (duration > 12) {
          console.debug('[NetiorPerf] semanticPreview.update.mapOnly', {
            durationMs: Math.round(duration * 10) / 10,
          });
        }
        return mapped;
      }
      if (!Object.is(nextVersion, version)) {
        version = nextVersion;
        return buildSemanticDecos(tr.state, context);
      }
      return decos;
    },
    provide: (field) => EditorView.decorations.from(field),
  });
}

const semanticWidgetClickHandler = EditorView.domEventHandlers({
  mousedown(event, view) {
    if (event.button !== 0) return false;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest('.netior-embed-edit-button')) return false;
    const widget = target.closest<HTMLElement>('[data-netior-token-from][data-netior-token-to]');
    if (!widget) return false;

    const from = Number(widget.dataset.netiorTokenFrom);
    const to = Number(widget.dataset.netiorTokenTo);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return false;

    event.preventDefault();
    view.dispatch({ selection: { anchor: Math.min(to - 1, from + 1) } });
    view.focus();
    return true;
  },
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
    width: 'min(100%, 640px)',
    border: '1px solid var(--border-default)',
    borderRadius: '8px',
    backgroundColor: 'var(--surface-card)',
    margin: '10px auto',
    overflow: 'hidden',
    boxShadow: '0 1px 0 rgba(0, 0, 0, 0.08)',
  },
  '.netior-embed-properties-table.netior-embed-block': {
    width: 'fit-content',
    minWidth: '280px',
    maxWidth: 'min(100%, 560px)',
  },
  '.netior-embed-properties-table .netior-embed-body': {
    padding: '0',
  },
  '.netior-embed-properties-grid': {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'auto',
  },
  '.netior-embed-properties-grid th, .netior-embed-properties-grid td': {
    borderTop: '1px solid var(--border-subtle)',
    padding: '8px 12px',
    textAlign: 'left',
    verticalAlign: 'middle',
  },
  '.netior-embed-properties-grid tr:first-child th, .netior-embed-properties-grid tr:first-child td': {
    borderTop: 'none',
  },
  '.netior-embed-properties-grid th': {
    minWidth: '92px',
    maxWidth: '220px',
    borderRight: '1px solid var(--border-subtle)',
    color: 'var(--text-secondary)',
    fontWeight: '600',
    whiteSpace: 'nowrap',
  },
  '.netior-embed-properties-grid td': {
    minWidth: '128px',
    maxWidth: '360px',
    color: 'var(--text-default)',
    overflowWrap: 'anywhere',
  },
  '.netior-embed-header': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    borderBottom: '1px solid var(--border-subtle)',
    padding: '9px 14px',
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
  '.netior-embed-header-actions': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    flexShrink: 0,
  },
  '.netior-embed-projection': {
    flexShrink: '0',
    borderRadius: '999px',
    backgroundColor: 'var(--surface-hover)',
    color: 'var(--text-secondary)',
    padding: '2px 7px',
    fontSize: '0.72em',
  },
  '.netior-embed-edit-button': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '22px',
    height: '22px',
    borderRadius: '6px',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-secondary)',
    backgroundColor: 'transparent',
    cursor: 'pointer',
  },
  '.netior-embed-edit-button:hover': {
    color: 'var(--text-default)',
    backgroundColor: 'var(--surface-hover)',
    borderColor: 'var(--border-default)',
  },
  '.netior-embed-body': {
    padding: '12px 14px',
    color: 'var(--text-secondary)',
    fontSize: '0.82em',
  },
  '.netior-embed-kicker': {
    color: 'var(--text-muted)',
    fontSize: '0.76em',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  '.netior-embed-copy': {
    marginTop: '4px',
    color: 'var(--text-secondary)',
  },
  '.netior-embed-interactive-view .netior-embed-body': {
    minHeight: '96px',
    backgroundColor: 'var(--surface-panel)',
  },
  '.netior-embed-interactive-mount': {
    minHeight: '96px',
  },
  '.netior-embed-interactive-mount > *': {
    minWidth: '0',
  },
  '.netior-embed-interactive-view-panel': {
    minWidth: '0',
  },
  '.netior-embed-interactive-view-panel > div': {
    gap: '8px',
  },
  '.netior-embed-content .netior-embed-body': {
    backgroundColor: 'var(--surface-base)',
  },
  '.netior-embed-content-mount': {
    color: 'var(--text-default)',
  },
  '.netior-embed-content-mount .cm-content': {
    margin: '0',
  },
  '.netior-embed-content-mount .cm-scroller': {
    fontSize: '0.95em',
  },
  '.netior-embed-content-text': {
    color: 'var(--text-default)',
    fontSize: '0.9em',
    lineHeight: '1.65',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  },
  '.netior-embed-hidden-nested.netior-embed-block': {
    display: 'none',
  },
  '.netior-semantic-token-source': {
    backgroundColor: 'var(--accent-muted)',
    borderRadius: '4px',
  },
});

export function createNetiorSemanticPreviewPlugin(context: SemanticPreviewContext = {}): Extension[] {
  return [semanticWidgetClickHandler, createSemanticField(context), netiorSemanticPreviewTheme];
}
