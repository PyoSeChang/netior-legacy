import React, { useEffect, useState } from 'react';
import type { TranslationKey } from '@netior/shared/i18n';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { useI18n } from '../../hooks/useI18n';

interface TypeGroupModalProps {
  open: boolean;
  title: string;
  initialValue?: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void> | void;
}

export function TypeGroupModal({
  open,
  title,
  initialValue = '',
  onClose,
  onSubmit,
}: TypeGroupModalProps): JSX.Element {
  const { t } = useI18n();
  const tk = (key: string) => t(key as TranslationKey);
  const [name, setName] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialValue);
      setIsSaving(false);
    }
  }, [open, initialValue]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setIsSaving(true);
    try {
      await onSubmit(trimmed);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} isLoading={isSaving}>
            {t('common.save')}
          </Button>
        </>
      )}
      width="min(90vw, 420px)"
    >
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-secondary">
          {tk('typeGroup.name')}
        </label>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={tk('typeGroup.namePlaceholder')}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void handleSubmit();
            }
          }}
          autoFocus
        />
      </div>
    </Modal>
  );
}
