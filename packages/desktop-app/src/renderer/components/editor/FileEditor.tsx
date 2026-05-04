import React, { useState, useEffect, useCallback } from 'react';
import type { EditorTab } from '@netior/shared/types';
import { fsService, fileService } from '../../services';
import { useI18n } from '../../hooks/useI18n';
import { useEditorSession } from '../../hooks/useEditorSession';
import { useProjectStore } from '../../stores/project-store';
import { useEditorStore } from '../../stores/editor-store';
import {
  registerFileEditorReloadHandler,
  unregisterFileEditorReloadHandler,
} from '../../lib/file-editor-reload-registry';
import { markFileTabSaved, setKnownFileTabSignature } from '../../lib/file-tab-stale-registry';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { CodeEditor } from './CodeEditor';
import { ImageViewer } from './ImageViewer';
import { PdfViewer } from './PdfViewer';
import { UnsupportedFallback } from './UnsupportedFallback';
import { getEditorType, getMonacoLanguage, type EditorType } from './editor-utils';
import { MarkdownEditor } from './markdown/MarkdownEditor';
import { toRelativePath } from '../../utils/path-utils';

interface FileEditorProps {
  tab: EditorTab;
}

function toFileSignature(fileStat: Awaited<ReturnType<typeof fsService.statItem>>): string {
  return fileStat.exists
    ? `${fileStat.mtimeMs ?? 0}:${fileStat.size ?? 0}`
    : 'missing';
}

export function FileEditor({ tab }: FileEditorProps): JSX.Element {
  const { t } = useI18n();
  const setStale = useEditorStore((s) => s.setStale);
  const filePath = tab.targetId;
  const editorType = (tab.editorType as EditorType) ?? getEditorType(filePath);
  const isTextEditor = editorType === 'code' || editorType === 'markdown';
  const currentProject = useProjectStore((s) => s.currentProject);
  const [fileId, setFileId] = useState<string | null>(null);
  const [viewerRevision, setViewerRevision] = useState(0);
  const [reloadConfirmOpen, setReloadConfirmOpen] = useState(false);

  useEffect(() => {
    if (editorType !== 'pdf' || !currentProject) {
      setFileId(null);
      return;
    }

    let cancelled = false;
    const normalizedFilePath = filePath.replace(/\\/g, '/');
    const relativePath = toRelativePath(currentProject.root_dir, filePath);

    fileService.getByPath(currentProject.id, relativePath).then(async (entity) => {
      if (cancelled) return;
      if (entity) { setFileId(entity.id); return; }

      // Exact match failed ??try matching against all project files
      const allFiles = await fileService.getByProject(currentProject.id);
      const match = allFiles.find((f) => {
        const dbPath = f.path.replace(/\\/g, '/');
        return dbPath === normalizedFilePath || normalizedFilePath.endsWith('/' + dbPath);
      });
      if (!cancelled && match) setFileId(match.id);
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [filePath, editorType, currentProject]);

  const session = useEditorSession<string>({
    tabId: tab.id,
    load: () => {
      if (isTextEditor) {
        return fsService.readFile(filePath).catch(() => '');
      }
      return '';
    },
    save: async (content) => {
      await fsService.writeFile(filePath, content);
      const signature = toFileSignature(await fsService.statItem(filePath));
      markFileTabSaved(tab.id, signature);
      setStale(tab.id, false);
    },
    isEqual: (a, b) => a === b,
    deps: [filePath, editorType],
  });

  const syncKnownSignature = useCallback(async () => {
    const signature = toFileSignature(await fsService.statItem(filePath));
    setKnownFileTabSignature(tab.id, signature);
    return signature;
  }, [filePath, tab.id]);

  const reloadFromDisk = useCallback(async () => {
    if (isTextEditor) {
      await session.reload(true);
    } else {
      setViewerRevision((current) => current + 1);
    }
    await syncKnownSignature();
    setStale(tab.id, false);
    setReloadConfirmOpen(false);
  }, [isTextEditor, session, setStale, syncKnownSignature, tab.id]);

  const handleReloadRequest = useCallback(() => {
    if (isTextEditor && session.isDirty) {
      setReloadConfirmOpen(true);
      return;
    }
    void reloadFromDisk();
  }, [isTextEditor, reloadFromDisk, session.isDirty]);

  useEffect(() => {
    void syncKnownSignature();
  }, [syncKnownSignature, viewerRevision]);

  useEffect(() => {
    registerFileEditorReloadHandler(tab.id, handleReloadRequest);
    return () => {
      unregisterFileEditorReloadHandler(tab.id);
    };
  }, [handleReloadRequest, tab.id]);

  if (session.isLoading) {
    return <div className="flex h-full items-center justify-center text-xs text-muted">{t('common.loading')}</div>;
  }

  return (
    <div className="relative h-full min-h-0 w-full">
      {renderEditor(editorType, {
        tabId: tab.id,
        content: session.state,
        filePath,
        onChange: session.setState,
        fileId,
        revision: viewerRevision,
      })}
      <ConfirmDialog
        open={reloadConfirmOpen}
        onClose={() => setReloadConfirmOpen(false)}
        onConfirm={() => { void reloadFromDisk(); }}
        title={t('fileEditor.reloadConfirmTitle')}
        message={t('fileEditor.reloadConfirmMessage')}
        confirmLabel={t('fileEditor.reloadConfirmAction')}
        cancelLabel={t('common.cancel')}
        variant="primary"
      />
    </div>
  );
}

export function renderEditor(
  type: EditorType,
  props: { tabId: string; content: string; filePath: string; onChange: (c: string) => void; fileId?: string | null; revision?: number },
): JSX.Element {
  switch (type) {
    case 'markdown':
      return <MarkdownEditor key={`markdown:${props.revision ?? 0}`} tabId={props.tabId} content={props.content} filePath={props.filePath} onChange={props.onChange} />;
    case 'code':
      return <CodeEditor key={`code:${props.revision ?? 0}`} tabId={props.tabId} content={props.content} language={getMonacoLanguage(props.filePath)} onChange={props.onChange} />;
    case 'image':
      return <ImageViewer key={`image:${props.revision ?? 0}`} absolutePath={props.filePath} />;
    case 'pdf':
      return <PdfViewer key={`pdf:${props.revision ?? 0}`} tabId={props.tabId} absolutePath={props.filePath} fileId={props.fileId ?? undefined} />;
    default:
      return <UnsupportedFallback filePath={props.filePath} absolutePath={props.filePath} />;
  }
}
