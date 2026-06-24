import React from 'react';
import { useWorldStore, type MissingFileEntry } from '../../stores/world-store';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useI18n } from '../../hooks/useI18n';

export function MissingFilesDialog(): JSX.Element | null {
  const { t } = useI18n();
  const { missingFiles, resolveMissingFile, dismissMissingFiles } = useWorldStore();

  if (missingFiles.length === 0) return null;

  return (
    <Modal
      open={true}
      onClose={dismissMissingFiles}
      title={t('fileMetadata.missingFilesTitle') ?? 'Missing Files'}
    >
      <div className="flex flex-col gap-3 p-4">
        <p className="text-xs text-muted">
          {t('fileMetadata.missingFilesMessage') ?? 'The following files/folders could not be found on disk.'}
        </p>

        <div className="flex flex-col gap-2 max-h-[300px] overflow-auto">
          {missingFiles.map((entry) => (
            <div
              key={entry.fileEntity.id}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-surface-card border border-subtle"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm shrink-0">
                  {entry.fileEntity.type === 'directory' ? '?뱚' : '?뱞'}
                </span>
                <span className="text-xs text-default truncate">
                  {entry.fileEntity.path}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => resolveMissingFile(entry.fileEntity.id, 'delete')}
                >
                  {t('common.delete')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => resolveMissingFile(entry.fileEntity.id, 'ignore')}
                >
                  {t('fileMetadata.ignore') ?? 'Ignore'}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-subtle">
          <Button variant="ghost" size="sm" onClick={dismissMissingFiles}>
            {t('fileMetadata.ignoreAll') ?? 'Ignore All'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
