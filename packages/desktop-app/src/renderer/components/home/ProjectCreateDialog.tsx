import React, { useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { fsService } from '../../services';
import { useI18n } from '../../hooks/useI18n';
import { PROJECT_ROOT_DIR_DUPLICATE_ERROR } from '../../stores/project-store';

interface ProjectCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, rootDir: string) => Promise<void> | void;
}

export function ProjectCreateDialog({ open, onClose, onCreate }: ProjectCreateDialogProps): JSX.Element {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [rootDir, setRootDir] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleClose = () => {
    if (creating) return;
    setError(null);
    onClose();
  };

  const handleSelectFolder = async () => {
    const path = await fsService.openFolderDialog();
    if (path) {
      setError(null);
      setRootDir(path);
      if (!name) {
        const folderName = path.split(/[\\/]/).pop() || '';
        setName(folderName);
      }
    }
  };

  const getCreateErrorMessage = (createError: unknown): string => {
    const message = createError instanceof Error ? createError.message : String(createError);
    if (message.startsWith(`${PROJECT_ROOT_DIR_DUPLICATE_ERROR}:`)) {
      const path = message.slice(PROJECT_ROOT_DIR_DUPLICATE_ERROR.length + 1);
      return t('project.duplicateRootDir', { path });
    }
    return message || t('project.createFailed');
  };

  const handleCreate = async () => {
    if (!name.trim() || !rootDir.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await onCreate(name.trim(), rootDir.trim());
      setName('');
      setRootDir('');
      onClose();
    } catch (createError) {
      setError(getCreateErrorMessage(createError));
    } finally {
      setCreating(false);
    }
  };

  const footer = (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" onClick={handleClose} disabled={creating}>{t('common.cancel')}</Button>
      <Button variant="primary" onClick={handleCreate} disabled={creating || !name.trim() || !rootDir.trim()}>
        {t('common.create')}
      </Button>
    </div>
  );

  return (
    <Modal open={open} onClose={handleClose} title={t('project.create')} footer={footer} width="480px">
      <div className="flex flex-col gap-4">
        {error && (
          <div className="rounded border border-status-error/40 bg-status-error/10 px-3 py-2 text-sm text-status-error">
            {error}
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs text-secondary">{t('project.name')}</label>
          <Input
            value={name}
            onChange={(e) => {
              setError(null);
              setName(e.target.value);
            }}
            placeholder={t('project.namePlaceholder')}
            autoFocus
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-secondary">{t('project.folder')}</label>
          <div className="flex gap-2">
            <Input
              value={rootDir}
              onChange={(e) => setRootDir(e.target.value)}
              placeholder={t('project.folderPlaceholder')}
              className="flex-1"
              readOnly
            />
            <Button variant="secondary" onClick={handleSelectFolder}>
              <FolderOpen size={16} />
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
