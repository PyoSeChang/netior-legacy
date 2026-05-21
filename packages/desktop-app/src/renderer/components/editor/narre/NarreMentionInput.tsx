import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ChevronRight, CornerDownRight, Plus, Send, Square, X } from 'lucide-react';
import type { NarreMention, SkillDefinition } from '@netior/shared/types';
import { SLASH_TRIGGER_SKILLS } from '@netior/shared/constants';
import type { MentionResult } from '../../../services/narre-service';
import type { NarrePendingSkillInvocationState } from '../../../lib/narre-ui-state';
import { useI18n } from '../../../hooks/useI18n';
import { Badge } from '../../ui/Badge';
import { IconButton } from '../../ui/IconButton';
import { NarreMentionPicker } from './NarreMentionPicker';
import { PdfTocInputForm, type PdfTocFormState } from './PdfTocInputForm';
import { NarreSlashPicker } from './NarreSlashPicker';
import { logShortcut } from '../../../shortcuts/shortcut-utils';
import {
  getNarreMentionDragData,
  isNarreMentionDrag,
  NARRE_MENTION_CUSTOM_DROP_EVENT,
  type NarreMentionCustomDropDetail,
} from '../../../hooks/useNarreMentionDrag';

export interface NarreComposerSubmit {
  text: string;
  mentions: NarreMention[];
  draftHtml: string;
  pendingSkillInvocation: NarrePendingSkillInvocationState | null;
  delivery?: 'send' | 'queue' | 'steer';
}

interface NarreMentionInputProps {
  projectId: string;
  onSend: (payload: NarreComposerSubmit) => Promise<boolean | void> | boolean | void;
  disabled?: boolean;
  sendDisabled?: boolean;
  isStreaming?: boolean;
  stopDisabled?: boolean;
  placeholder?: string;
  draftHtml?: string;
  availableSkills?: readonly SkillDefinition[];
  pendingSkillInvocation?: NarrePendingSkillInvocationState | null;
  queuedCount?: number;
  scheduledMessages?: readonly string[];
  allowMentions?: boolean;
  allowSlashSkills?: boolean;
  agentMentions?: MentionResult[];
  footerLabel?: string;
  onDraftChange?: (draftHtml: string) => void;
  onPendingSkillInvocationChange?: (pendingSkillInvocation: NarrePendingSkillInvocationState | null) => void;
  onRemoveScheduledMessage?: (index: number) => void;
  onStop?: () => Promise<void> | void;
}

interface PickerState {
  isOpen: boolean;
  query: string;
  position: { bottom: number; left: number };
}

interface ComposerSnapshot {
  text: string;
  mentions: NarreMention[];
}

interface ComposerImageAttachment {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
}

const EMPTY_SNAPSHOT: ComposerSnapshot = {
  text: '',
  mentions: [],
};

function createAttachmentId(): string {
  return `image-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getImageFiles(fileList: FileList | null | undefined): File[] {
  return Array.from(fileList ?? []).filter((file) => file.type.startsWith('image/'));
}

function readImageAttachment(file: File): Promise<ComposerImageAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Failed to read image attachment'));
        return;
      }

      resolve({
        id: createAttachmentId(),
        name: file.name || 'Pasted image',
        mimeType: file.type || 'image/png',
        dataUrl: reader.result,
      });
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image attachment'));
    reader.readAsDataURL(file);
  });
}

function imageAttachmentsFromHtml(html: string): ComposerImageAttachment[] {
  if (!html.includes('<img')) {
    return [];
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  return Array.from(doc.querySelectorAll('img'))
    .map((image, index) => {
      const src = image.getAttribute('src')?.trim();
      if (!src) {
        return null;
      }

      return {
        id: createAttachmentId(),
        name: image.getAttribute('alt')?.trim() || `Pasted image ${index + 1}`,
        mimeType: src.startsWith('data:image/')
          ? src.slice(5, src.indexOf(';')) || 'image'
          : 'image',
        dataUrl: src,
      };
    })
    .filter((attachment): attachment is ComposerImageAttachment => attachment !== null);
}

function NarreImagePreviewOverlay({
  attachment,
  onClose,
}: {
  attachment: ComposerImageAttachment | null;
  onClose: () => void;
}): JSX.Element | null {
  useEffect(() => {
    if (!attachment) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [attachment, onClose]);

  if (!attachment) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-[92vw] overflow-hidden rounded-xl border border-subtle bg-surface-modal shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-subtle px-3 py-2">
          <span className="truncate pr-4 text-sm text-secondary">{attachment.name}</span>
          <IconButton label="Close" className="h-7 w-7" onClick={onClose}>
            <X size={15} />
          </IconButton>
        </div>
        <div className="max-h-[calc(90vh-44px)] overflow-auto bg-surface-base p-3">
          <img
            src={attachment.dataUrl}
            alt={attachment.name}
            className="max-h-[calc(90vh-68px)] max-w-[calc(92vw-24px)] object-contain"
          />
        </div>
      </div>
    </div>
  );
}

function serializeContentEditable(el: HTMLDivElement): {
  text: string;
  mentions: NarreMention[];
} {
  const mentions: NarreMention[] = [];
  let text = '';

  function walk(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      text += (node.textContent || '').replace(/\u200B/g, '');
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const elem = node as HTMLElement;
      if (elem.dataset.mentionType) {
        const type = elem.dataset.mentionType as NarreMention['type'];
        const id = elem.dataset.mentionId;
        const path = elem.dataset.mentionPath;
        const display = elem.dataset.mentionDisplay || elem.textContent || '';

        text += `[${type}:id=${id || path}, title="${display}"]`;
        mentions.push({ type, id, path, display });
      } else if (elem.tagName === 'BR') {
        text += '\n';
      } else if (elem.tagName === 'DIV' || elem.tagName === 'P') {
        // Block elements get newlines
        if (text.length > 0 && !text.endsWith('\n')) {
          text += '\n';
        }
        elem.childNodes.forEach(walk);
        return;
      } else {
        elem.childNodes.forEach(walk);
        return;
      }
      return;
    }
    if (node.childNodes) {
      node.childNodes.forEach(walk);
    }
  }

  walk(el);
  return { text: text.trim(), mentions };
}

function createMentionChip(mention: MentionResult): HTMLSpanElement {
  const chip = document.createElement('span');
  chip.contentEditable = 'false';
  chip.dataset.mentionType = mention.type;
  chip.dataset.mentionId = mention.id;
  chip.dataset.mentionDisplay = mention.display;
  // Store path from meta for file mentions (and module mentions)
  if (typeof mention.meta?.path === 'string') {
    chip.dataset.mentionPath = mention.meta.path;
  }
  chip.className =
    'mx-0.5 inline-flex items-center gap-1 rounded-md border border-accent bg-accent-muted px-1.5 py-0.5 text-xs font-medium text-accent shadow-sm cursor-default select-none';
  chip.textContent = mention.display;
  // Make the chip respond to selection correctly
  chip.setAttribute('data-chip', 'true');
  return chip;
}

function getDropRange(event: React.DragEvent, fallback: HTMLDivElement): Range {
  const doc = fallback.ownerDocument;
  const maybeDocument = doc as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  const pointRange = maybeDocument.caretRangeFromPoint?.(event.clientX, event.clientY);
  if (pointRange) return pointRange;

  const caretPosition = maybeDocument.caretPositionFromPoint?.(event.clientX, event.clientY);
  if (caretPosition) {
    const range = doc.createRange();
    range.setStart(caretPosition.offsetNode, caretPosition.offset);
    range.collapse(true);
    return range;
  }

  const range = doc.createRange();
  range.selectNodeContents(fallback);
  range.collapse(false);
  return range;
}

function insertMentionChipAtRange(el: HTMLDivElement, mention: MentionResult, range: Range): void {
  const chip = createMentionChip(mention);
  const spacer = document.createTextNode('\u200B');

  range.deleteContents();
  range.insertNode(spacer);
  range.insertNode(chip);

  const nextRange = document.createRange();
  nextRange.setStart(spacer, 1);
  nextRange.collapse(true);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(nextRange);
  el.focus();
}

function getSlashSkillByName(skillName: string, skills: readonly SkillDefinition[]): SkillDefinition | null {
  return skills.find((skill) =>
    skill.name === skillName || skill.trigger?.name === skillName,
  ) ?? null;
}

function createPendingSkillInvocationState(skill: SkillDefinition): NarrePendingSkillInvocationState {
  const triggerName = skill.trigger?.type === 'slash' ? skill.trigger.name : skill.name;
  if (triggerName === 'index') {
    return {
      name: triggerName,
      indexArgs: {
        startPage: 1,
        endPage: 1,
        overviewPagesText: '',
      },
    };
  }

  return { name: triggerName };
}

function isPdfMention(mention: NarreMention): boolean {
  const candidate = mention.path ?? mention.display;
  return candidate.toLowerCase().endsWith('.pdf');
}

function placeCaretAtEnd(el: HTMLDivElement): void {
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function NarreMentionInput({
  projectId,
  onSend,
  disabled = false,
  sendDisabled = false,
  isStreaming = false,
  stopDisabled = false,
  placeholder,
  draftHtml = '',
  availableSkills = SLASH_TRIGGER_SKILLS,
  pendingSkillInvocation = null,
  queuedCount = 0,
  scheduledMessages = [],
  allowMentions = true,
  allowSlashSkills = true,
  agentMentions = [],
  footerLabel,
  onDraftChange,
  onPendingSkillInvocationChange,
  onRemoveScheduledMessage,
  onStop,
}: NarreMentionInputProps): JSX.Element {
  const { t } = useI18n();
  const editorRef = useRef<HTMLDivElement>(null);
  const [snapshot, setSnapshot] = useState<ComposerSnapshot>(EMPTY_SNAPSHOT);
  const [isEmpty, setIsEmpty] = useState(true);
  const [pickerCategory, setPickerCategory] = useState('all');
  const [picker, setPicker] = useState<PickerState>({
    isOpen: false,
    query: '',
    position: { bottom: 0, left: 0 },
  });
  const [slashPicker, setSlashPicker] = useState<PickerState>({
    isOpen: false,
    query: '',
    position: { bottom: 0, left: 0 },
  });
  const [imageAttachments, setImageAttachments] = useState<ComposerImageAttachment[]>([]);
  const [previewAttachmentId, setPreviewAttachmentId] = useState<string | null>(null);
  const mentionSearchStart = useRef<number | null>(null);
  const mentionReplaceRange = useRef<{ node: Text; atPos: number; cursorPos: number } | null>(null);
  const previousDisabled = useRef(disabled);
  const selectedSkill = pendingSkillInvocation ? getSlashSkillByName(pendingSkillInvocation.name, availableSkills) : null;
  const fileMention = snapshot.mentions.find((mention) => mention.type === 'file');
  const previewAttachment = imageAttachments.find((attachment) => attachment.id === previewAttachmentId) ?? null;

  const addImageFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    const attachments = await Promise.all(files.map(readImageAttachment));
    setImageAttachments((current) => [...current, ...attachments]);
  }, []);

  const removeImageAttachment = useCallback((id: string) => {
    setImageAttachments((current) => current.filter((attachment) => attachment.id !== id));
    setPreviewAttachmentId((current) => current === id ? null : current);
  }, []);

  const syncComposerState = useCallback((): ComposerSnapshot => {
    const el = editorRef.current;
    if (!el) {
      setSnapshot(EMPTY_SNAPSHOT);
      setIsEmpty(true);
      return EMPTY_SNAPSHOT;
    }

    const nextSnapshot = serializeContentEditable(el);
    const text = (el.textContent || '').replace(/\u200B/g, '').trim();
    setSnapshot(nextSnapshot);
    setIsEmpty(text.length === 0 && nextSnapshot.mentions.length === 0);
    return nextSnapshot;
  }, []);

  const resetEditor = useCallback(() => {
    const el = editorRef.current;
    if (el) {
      el.innerHTML = '';
    }

    setSnapshot(EMPTY_SNAPSHOT);
    setIsEmpty(true);
    setPicker((p) => ({ ...p, isOpen: false }));
    setSlashPicker((p) => ({ ...p, isOpen: false }));
    setImageAttachments([]);
    setPreviewAttachmentId(null);
    mentionSearchStart.current = null;
    mentionReplaceRange.current = null;
    onDraftChange?.('');
    onPendingSkillInvocationChange?.(null);
  }, [onDraftChange, onPendingSkillInvocationChange]);

  const skillValidationMessage = (() => {
    if (!pendingSkillInvocation || pendingSkillInvocation.name !== 'index') {
      return null;
    }

    if (!fileMention) {
      return t('pdfToc.noFile');
    }

    if (!isPdfMention(fileMention)) {
      return t('pdfToc.noPdfFile');
    }

    if (!pendingSkillInvocation.indexArgs || pendingSkillInvocation.indexArgs.endPage < pendingSkillInvocation.indexArgs.startPage) {
      return t('pdfToc.invalidRange');
    }

    return null;
  })();

  const canSubmit = pendingSkillInvocation ? skillValidationMessage === null : !isEmpty || imageAttachments.length > 0;

  const handleSend = useCallback(async (delivery: NarreComposerSubmit['delivery'] = 'send') => {
    const el = editorRef.current;
    if (!el || disabled || !canSubmit) return;
    if (!isStreaming && sendDisabled) return;

    const { text, mentions } = serializeContentEditable(el);
    if (!pendingSkillInvocation && !text.trim() && imageAttachments.length === 0) return;

    const attachmentText = imageAttachments.map((attachment) => `[Image: ${attachment.name}]`).join('\n');
    const outboundText = [text, attachmentText].filter(Boolean).join('\n');

    const result = await onSend({
      text: outboundText,
      mentions,
      draftHtml: el.innerHTML,
      pendingSkillInvocation,
      delivery,
    });
    if (result === false) return;

    logShortcut('shortcut.narreChat.sendMessage');
    resetEditor();
  }, [canSubmit, disabled, imageAttachments, isStreaming, onSend, pendingSkillInvocation, resetEditor, sendDisabled]);

  const handleSlashSelect = useCallback((skill: SkillDefinition) => {
    const el = editorRef.current;
    if (el) {
      el.innerHTML = '';
      setSnapshot(EMPTY_SNAPSHOT);
      setIsEmpty(true);
      onDraftChange?.('');
      el.focus();
      placeCaretAtEnd(el);
    }

    setSlashPicker((p) => ({ ...p, isOpen: false }));
    onPendingSkillInvocationChange?.(createPendingSkillInvocationState(skill));
  }, [onDraftChange, onPendingSkillInvocationChange]);

  const handleSlashPickerClose = useCallback(() => {
    setSlashPicker((p) => ({ ...p, isOpen: false }));
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (picker.isOpen || slashPicker.isOpen) {
      // Let the picker handle these keys
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'].includes(e.key)) {
        return; // picker's document listener will handle
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && sendDisabled) return;
      void handleSend(isStreaming ? 'queue' : 'send');
      return;
    }
    if (e.key === 'Enter' && e.shiftKey) {
      logShortcut('shortcut.narreChat.insertNewline');
    }

    // Backspace: check if we're right after a chip
    if (e.key === 'Backspace') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (range.collapsed) {
          const node = range.startContainer;
          const offset = range.startOffset;

          // If we're at the start of a text node, check previous sibling
          if (node.nodeType === Node.TEXT_NODE && offset === 0) {
            const prev = node.previousSibling;
            if (prev && (prev as HTMLElement).dataset?.chip) {
              e.preventDefault();
              prev.parentNode?.removeChild(prev);
              syncComposerState();
              onDraftChange?.(editorRef.current?.innerHTML ?? '');
              return;
            }
          }

          // If we're in the editor div and the previous child is a chip
          if (node === editorRef.current && offset > 0) {
            const child = node.childNodes[offset - 1];
            if (child && (child as HTMLElement).dataset?.chip) {
              e.preventDefault();
              child.parentNode?.removeChild(child);
              syncComposerState();
              onDraftChange?.(editorRef.current?.innerHTML ?? '');
              return;
            }
          }
        }
      }
    }
  }, [picker.isOpen, slashPicker.isOpen, handleSend, isStreaming, onDraftChange, sendDisabled, syncComposerState]);

  const handleInput = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    syncComposerState();
    onDraftChange?.(editor.innerHTML);

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) {
      // Close picker if not in text
      if (picker.isOpen) {
        setPicker((p) => ({ ...p, isOpen: false }));
        mentionSearchStart.current = null;
        mentionReplaceRange.current = null;
      }
      if (slashPicker.isOpen) {
        setSlashPicker((p) => ({ ...p, isOpen: false }));
      }
      return;
    }

    const text = node.textContent || '';
    const cursorPos = range.startOffset;

    // Check for "/" at the start of input (slash-triggered skill)
    const fullText = (editor.textContent || '').replace(/\u200B/g, '');
    if (allowSlashSkills && !pendingSkillInvocation && fullText.startsWith('/')) {
      const slashBody = fullText.slice(1);
      const slashQuery = slashBody.split(/\s+/, 1)[0] ?? '';

      if (!/\s/.test(slashBody)) {
        const rect = editor.getBoundingClientRect();
        setSlashPicker({
          isOpen: true,
          query: slashQuery,
          position: {
            bottom: window.innerHeight - rect.top + 4,
            left: rect.left,
          },
        });
      } else if (slashPicker.isOpen) {
        setSlashPicker((p) => ({ ...p, isOpen: false }));
      }
    } else if (slashPicker.isOpen) {
      setSlashPicker((p) => ({ ...p, isOpen: false }));
    }

    // Look backward from cursor for @
    let atPos = -1;
    for (let i = cursorPos - 1; i >= 0; i--) {
      const ch = text[i];
      if (ch === '@') {
        atPos = i;
        break;
      }
      if (ch === ' ' || ch === '\n') break;
    }

    if (allowMentions && atPos >= 0) {
      const query = text.slice(atPos + 1, cursorPos);
      mentionSearchStart.current = atPos;
      mentionReplaceRange.current = { node: node as Text, atPos, cursorPos };

      // Get caret position in viewport coordinates for fixed-positioned picker
      const caretRange = document.createRange();
      caretRange.setStart(node, atPos);
      caretRange.setEnd(node, atPos);
      const caretRect = caretRange.getBoundingClientRect();

      setPicker({
        isOpen: true,
        query,
        position: {
          bottom: window.innerHeight - caretRect.top + 4,
          left: caretRect.left,
        },
      });
    } else {
      if (picker.isOpen) {
        setPicker((p) => ({ ...p, isOpen: false }));
        mentionSearchStart.current = null;
        mentionReplaceRange.current = null;
      }
    }
  }, [allowMentions, allowSlashSkills, pendingSkillInvocation, picker.isOpen, slashPicker.isOpen, onDraftChange, syncComposerState]);

  const handleMentionSelect = useCallback((mention: MentionResult) => {
    const el = editorRef.current;
    if (!el) return;

    const sel = window.getSelection();
    const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    const selectedNode = range?.startContainer ?? null;
    const storedRange = mentionReplaceRange.current;
    const canUseSelection = Boolean(
      selectedNode
      && selectedNode.nodeType === Node.TEXT_NODE
      && el.contains(selectedNode),
    );
    const node = canUseSelection ? selectedNode as Text : storedRange?.node;
    if (!node || !node.isConnected) return;

    const text = node.textContent || '';
    const cursorPos = canUseSelection && range ? range.startOffset : storedRange?.cursorPos ?? text.length;
    const atPos = canUseSelection ? mentionSearchStart.current : storedRange?.atPos ?? mentionSearchStart.current;

    if (atPos === null || atPos < 0) return;

    // Remove @query text
    const before = text.slice(0, atPos);
    const after = text.slice(cursorPos);

    const chip = createMentionChip(mention);
    const beforeNode = document.createTextNode(before);
    const afterNode = document.createTextNode(after || '\u200B'); // zero-width space if empty

    const parent = node.parentNode!;
    parent.insertBefore(beforeNode, node);
    parent.insertBefore(chip, node);
    parent.insertBefore(afterNode, node);
    parent.removeChild(node);

    // Place cursor after chip
    const newRange = document.createRange();
    newRange.setStart(afterNode, after ? 0 : 1);
    newRange.collapse(true);
    const nextSelection = window.getSelection();
    nextSelection?.removeAllRanges();
    nextSelection?.addRange(newRange);

    setPicker((p) => ({ ...p, isOpen: false }));
    mentionSearchStart.current = null;
    mentionReplaceRange.current = null;
    syncComposerState();
    onDraftChange?.(el.innerHTML);
    el.focus();
  }, [onDraftChange, syncComposerState]);

  const handlePickerClose = useCallback(() => {
    setPicker((p) => ({ ...p, isOpen: false }));
    mentionSearchStart.current = null;
    mentionReplaceRange.current = null;
    setPickerCategory('all');
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    const hasImageFiles = getImageFiles(e.dataTransfer.files).length > 0;
    if (disabled || (!hasImageFiles && (!allowMentions || !isNarreMentionDrag(e)))) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, [allowMentions, disabled]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    const hasImageFiles = getImageFiles(e.dataTransfer.files).length > 0;
    if (disabled || (!hasImageFiles && (!allowMentions || !isNarreMentionDrag(e)))) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, [allowMentions, disabled]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    if (disabled) return;

    const imageFiles = getImageFiles(e.dataTransfer.files);
    if (imageFiles.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      void addImageFiles(imageFiles);
      return;
    }

    if (!allowMentions || !isNarreMentionDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();

    const payload = getNarreMentionDragData(e);
    const el = editorRef.current;
    if (!payload || !el) return;

    const range = getDropRange(e, el);
    if (!el.contains(range.startContainer)) {
      range.selectNodeContents(el);
      range.collapse(false);
    }
    insertMentionChipAtRange(el, payload.mention, range);
    setPicker((p) => ({ ...p, isOpen: false }));
    setSlashPicker((p) => ({ ...p, isOpen: false }));
    mentionSearchStart.current = null;
    mentionReplaceRange.current = null;
    syncComposerState();
    onDraftChange?.(el.innerHTML);
  }, [addImageFiles, allowMentions, disabled, onDraftChange, syncComposerState]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    if (disabled) return;

    const imageFiles = getImageFiles(e.clipboardData.files);
    if (imageFiles.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      void addImageFiles(imageFiles);
      return;
    }

    const htmlAttachments = imageAttachmentsFromHtml(e.clipboardData.getData('text/html'));
    if (htmlAttachments.length === 0) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    setImageAttachments((current) => [...current, ...htmlAttachments]);
  }, [addImageFiles, disabled]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el || disabled || !allowMentions) return;

    const handleCustomDrop = (event: Event) => {
      const customEvent = event as CustomEvent<NarreMentionCustomDropDetail>;
      event.preventDefault();
      event.stopPropagation();

      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      insertMentionChipAtRange(el, customEvent.detail.mention, range);
      setPicker((p) => ({ ...p, isOpen: false }));
      setSlashPicker((p) => ({ ...p, isOpen: false }));
      mentionSearchStart.current = null;
      mentionReplaceRange.current = null;
      syncComposerState();
      onDraftChange?.(el.innerHTML);
    };

    el.addEventListener(NARRE_MENTION_CUSTOM_DROP_EVENT, handleCustomDrop);
    return () => el.removeEventListener(NARRE_MENTION_CUSTOM_DROP_EVENT, handleCustomDrop);
  }, [allowMentions, disabled, onDraftChange, syncComposerState]);

  const openMentionPickerFromMenu = useCallback((category: 'all' | 'agent') => {
    if (!allowMentions || disabled) return;

    const el = editorRef.current;
    if (!el) return;

    el.focus();
    const currentText = (el.textContent || '').replace(/\u200B/g, '');
    const needsSpace = currentText.length > 0 && !/\s$/.test(currentText);
    const triggerText = `${needsSpace ? ' ' : ''}@`;
    const triggerNode = document.createTextNode(triggerText);
    el.appendChild(triggerNode);

    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(triggerNode, triggerText.length);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);

    mentionSearchStart.current = triggerText.length - 1;
    mentionReplaceRange.current = {
      node: triggerNode,
      atPos: triggerText.length - 1,
      cursorPos: triggerText.length,
    };
    const rect = el.getBoundingClientRect();
    setPickerCategory(category);
    setPicker({
      isOpen: true,
      query: '',
      position: {
        bottom: window.innerHeight - rect.top + 4,
        left: rect.left,
      },
    });
    syncComposerState();
    onDraftChange?.(el.innerHTML);
  }, [allowMentions, disabled, onDraftChange, syncComposerState]);

  // Focus editor on mount
  useEffect(() => {
    editorRef.current?.focus();
  }, []);


  useEffect(() => {
    const wasDisabled = previousDisabled.current;
    previousDisabled.current = disabled;
    if (!wasDisabled || disabled) {
      return;
    }

    const el = editorRef.current;
    if (!el) {
      return;
    }

    el.focus();
    placeCaretAtEnd(el);
  }, [disabled]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el || el.innerHTML === draftHtml) {
      return;
    }

    el.innerHTML = draftHtml;
    syncComposerState();
  }, [draftHtml, syncComposerState]);

  return (
    <div className="mx-auto w-full max-w-[860px]">
      <div className="relative rounded-2xl border border-input bg-surface-input px-3 pb-2 pt-2 shadow-sm transition-colors hover:border-strong focus-within:border-accent">
        {scheduledMessages.length > 0 && (
          <div className="-mx-3 -mt-2 mb-2 overflow-hidden rounded-t-2xl border-b border-subtle bg-surface-panel">
            <div className="px-3 py-2 text-xs text-secondary">
              {t('narre.scheduledMessages' as never, { count: scheduledMessages.length } as never)}
            </div>
            <div className="divide-y divide-subtle">
              {scheduledMessages.map((summary, index) => (
                <div key={`${index}:${summary}`} className="flex min-w-0 items-center gap-2 px-3 py-2 text-xs">
                  <ChevronRight size={13} className="shrink-0 text-muted" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-default">{summary}</span>
                  {onRemoveScheduledMessage && (
                    <IconButton
                      label={t('narre.removeScheduledMessage' as never)}
                      className="h-6 w-6 text-muted hover:enabled:text-default"
                      onClick={() => onRemoveScheduledMessage(index)}
                    >
                      <X size={13} />
                    </IconButton>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {imageAttachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {imageAttachments.map((attachment) => (
              <div
                key={attachment.id}
                className="group relative h-20 w-20 overflow-hidden rounded-lg border border-subtle bg-surface-card"
              >
                <button
                  type="button"
                  className="block h-full w-full"
                  onClick={() => setPreviewAttachmentId(attachment.id)}
                >
                  <img
                    src={attachment.dataUrl}
                    alt={attachment.name}
                    className="h-full w-full object-cover"
                  />
                </button>
                <button
                  type="button"
                  aria-label={t('narre.removeImageAttachment' as never)}
                  className="absolute right-1 top-1 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full border border-default bg-surface-modal text-default shadow-sm transition-colors hover:bg-surface-hover"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeImageAttachment(attachment.id);
                  }}
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div
          ref={editorRef}
          data-narre-mention-drop-target="true"
          contentEditable={!disabled}
          role="textbox"
          className={[
            'min-h-[44px] max-h-[140px] overflow-y-auto rounded-md bg-transparent px-0 py-1 text-sm text-default outline-none',
            'data-[narre-mention-drop-active=true]:rounded-md data-[narre-mention-drop-active=true]:bg-accent-muted data-[narre-mention-drop-active=true]:ring-2 data-[narre-mention-drop-active=true]:ring-accent',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onPaste={handlePaste}
          suppressContentEditableWarning
        />
        {isEmpty && imageAttachments.length === 0 && !disabled && (
          <div className="pointer-events-none absolute left-3 top-3 text-sm text-muted">
            {placeholder || t('narre.inputPlaceholder')}
          </div>
        )}
        {selectedSkill && !disabled && (
          <div className="mt-2 rounded-md border border-subtle bg-surface-card px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Badge variant="accent">
                  /{pendingSkillInvocation?.name ?? selectedSkill.trigger?.name ?? selectedSkill.name}
                </Badge>
                <span className="text-xs text-default">
                  {selectedSkill.source === 'builtin' ? t(selectedSkill.description as any) : selectedSkill.description}
                </span>
                {skillValidationMessage ? (
                  <Badge variant="warning">{skillValidationMessage}</Badge>
                ) : (
                  selectedSkill.name === 'index'
                    && fileMention
                    && isPdfMention(fileMention)
                    && <Badge variant="success">@{fileMention.display}</Badge>
                )}
              </div>
              <button
                type="button"
                className="rounded p-1 text-muted transition-colors hover:bg-state-hover hover:text-default"
                onClick={() => onPendingSkillInvocationChange?.(null)}
              >
                <X size={14} />
              </button>
            </div>
            {selectedSkill.hint && (
              <p className="mt-2 text-xs text-muted">
                {selectedSkill.source === 'builtin' ? t(selectedSkill.hint as any) : selectedSkill.hint}
              </p>
            )}
            {pendingSkillInvocation?.name === 'index' && pendingSkillInvocation.indexArgs && (
              <div className="mt-3">
                <PdfTocInputForm
                  value={pendingSkillInvocation.indexArgs as PdfTocFormState}
                  fileDisplay={fileMention?.display}
                  disabled={disabled || sendDisabled}
                  onChange={(nextValue) => {
                    onPendingSkillInvocationChange?.({
                      ...pendingSkillInvocation,
                      indexArgs: nextValue,
                    });
                  }}
                />
              </div>
            )}
          </div>
        )}
        <div className="mt-2 flex items-center gap-2">
          <IconButton
            label={t('narre.composer.addContext' as never)}
            disabled={disabled || !allowMentions}
            className="h-7 w-7 rounded-md"
            onClick={() => openMentionPickerFromMenu('all')}
          >
            <Plus size={15} />
          </IconButton>
          {footerLabel && (
            <span className="truncate text-xs text-muted">{footerLabel}</span>
          )}
          {queuedCount > 0 && (
            <Badge variant="accent">
              {t('narre.queuedMessages' as never, { count: queuedCount } as never)}
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-2">
            {allowMentions && (
              <span className="text-xs text-muted">@</span>
            )}
            {isStreaming ? (
              <>
                <IconButton
                  label={t('narre.steerMessage' as never)}
                  disabled={disabled || !canSubmit || Boolean(pendingSkillInvocation)}
                  className="h-8 w-8 rounded-full bg-accent text-on-accent hover:enabled:bg-accent-hover disabled:bg-surface-hover disabled:text-muted"
                  onClick={() => { void handleSend('steer'); }}
                >
                  <Send size={15} />
                </IconButton>
                <IconButton
                  label={t('narre.queueMessage' as never)}
                  disabled={disabled || !canSubmit}
                  className="h-8 w-8 rounded-full bg-surface-hover text-default hover:enabled:bg-state-hover disabled:text-muted"
                  onClick={() => { void handleSend('queue'); }}
                >
                  <CornerDownRight size={15} />
                </IconButton>
                <IconButton
                  label={t('narre.stopMessage' as never)}
                  disabled={stopDisabled || !onStop}
                  className="h-8 w-8 rounded-full bg-surface-hover text-default hover:enabled:bg-state-hover"
                  onClick={() => { void onStop?.(); }}
                >
                  <Square size={14} />
                </IconButton>
              </>
            ) : (
              <IconButton
                label={t('narre.sendMessage')}
                disabled={disabled || sendDisabled || !canSubmit}
                className="h-8 w-8 rounded-full bg-accent text-on-accent hover:enabled:bg-accent-hover disabled:bg-surface-hover disabled:text-muted"
                onClick={() => { void handleSend(); }}
              >
                <Send size={16} />
              </IconButton>
            )}
          </div>
        </div>
      </div>
      <NarreImagePreviewOverlay
        attachment={previewAttachment}
        onClose={() => setPreviewAttachmentId(null)}
      />
      {allowMentions && picker.isOpen && (
        <NarreMentionPicker
          query={picker.query}
          projectId={projectId}
          position={picker.position}
          initialCategory={pickerCategory}
          agentMentions={agentMentions}
          onSelect={handleMentionSelect}
          onClose={handlePickerClose}
        />
      )}
      {allowSlashSkills && slashPicker.isOpen && !picker.isOpen && !pendingSkillInvocation && (
        <NarreSlashPicker
          query={slashPicker.query}
          position={slashPicker.position}
          skills={availableSkills}
          onSelect={handleSlashSelect}
          onClose={handleSlashPickerClose}
        />
      )}
    </div>
  );
}

