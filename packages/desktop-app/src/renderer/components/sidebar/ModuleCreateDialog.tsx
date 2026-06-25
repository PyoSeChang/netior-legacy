import React, { useEffect, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { fsService } from '../../services';
import { useI18n } from '../../hooks/useI18n';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';

interface ModuleCreateDialogProps {
  open: boolean;
  defaultPath: string;
  onClose: () => void;
  onCreate: (data: { name: string; description: string | null; path: string }) => Promise<void> | void;
}

export function ModuleCreateDialog({
  open,
  defaultPath,
  onClose,
  onCreate,
}: ModuleCreateDialogProps): JSX.Element {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [path, setPath] = useState(defaultPath);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setDescription('');
    setPath(defaultPath);
  }, [defaultPath, open]);

  const handleClose = () => {
    if (creating) return;
    onClose();
  };

  const handleSelectFolder = async () => {
    const nextPath = await fsService.openFolderDialog();
    if (!nextPath) return;
    setPath(nextPath);
    if (!name.trim()) {
      setName(nextPath.replace(/\\/g, '/').split('/').pop() ?? '');
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !path.trim()) return;
    setCreating(true);
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || null,
        path: path.trim(),
      });
      onClose();
    } finally {
      setCreating(false);
    }
  };

  const footer = (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" onClick={handleClose} disabled={creating}>{t('common.cancel')}</Button>
      <Button variant="primary" onClick={handleCreate} disabled={creating || !name.trim() || !path.trim()}>
        {t('common.create')}
      </Button>
    </div>
  );

  return (
    <Modal open={open} onClose={handleClose} title={t('sidebar.createModule')} footer={footer} width="480px">
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-xs text-secondary">{t('sidebar.moduleName')}</label>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('sidebar.moduleName')}
            autoFocus
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-secondary">{t('sidebar.moduleDescription')}</label>
          <TextArea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t('sidebar.moduleDescriptionPlaceholder')}
            className="min-h-[92px]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-secondary">{t('sidebar.modulePath')}</label>
          <div className="flex gap-2">
            <Input
              value={path}
              onChange={(event) => setPath(event.target.value)}
              placeholder={t('sidebar.selectModulePath')}
              className="flex-1"
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
