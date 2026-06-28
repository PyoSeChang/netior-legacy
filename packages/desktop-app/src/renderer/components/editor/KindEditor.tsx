import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { NETIOR_RPC_METHODS, type KindRecord, type PropertyRecord } from '@netior/shared';
import type { EditorTab } from '../../types/editor';
import { useDomainStore } from '../../stores/domain-store';
import { useEditorStore } from '../../stores/editor-store';
import { domainService } from '../../services/domain-service';
import { useI18n } from '../../hooks/useI18n';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { IconButton } from '../ui/IconButton';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { TextArea } from '../ui/TextArea';
import { Toggle } from '../ui/Toggle';
import {
  EditorHeader,
  EditorScroll,
  ErrorBanner,
  Field,
  FormGrid,
  isValidKey,
  makeKey,
} from './domain-editor-shared';

interface KindEditorProps {
  tab: EditorTab;
}

interface PropertyDraft {
  id: string;
  key: string;
  name: string;
  valueType: string;
  requiredPolicy: 'optional' | 'required';
  description: string;
}

interface KindDraftData {
  mode: 'create';
  modelId: string;
  rootId: string;
}

function getKindDraftData(value: unknown): KindDraftData | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Partial<KindDraftData>;
  return data.mode === 'create' && typeof data.modelId === 'string' && typeof data.rootId === 'string'
    ? { mode: 'create', modelId: data.modelId, rootId: data.rootId }
    : null;
}

export function KindEditor({ tab }: KindEditorProps): JSX.Element {
  const { t } = useI18n();
  const snapshot = useDomainStore((s) => s.snapshot);
  const refreshCurrentWorld = useDomainStore((s) => s.refreshCurrentWorld);
  const draft = getKindDraftData(tab.draftData);
  const kind = snapshot?.kinds.find((item) => item.id === tab.targetId && item.status !== 'archived') ?? null;
  const properties = useMemo(
    () => (snapshot?.properties ?? []).filter((item) => item.kind_id === tab.targetId && item.status !== 'archived'),
    [snapshot?.properties, tab.targetId],
  );

  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [propertyName, setPropertyName] = useState('');
  const [propertyKey, setPropertyKey] = useState('');
  const [propertyKeyTouched, setPropertyKeyTouched] = useState(false);
  const [propertyDescription, setPropertyDescription] = useState('');
  const [valueType, setValueType] = useState('text');
  const [requiredPolicy, setRequiredPolicy] = useState<'optional' | 'required'>('optional');
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [propertyToDelete, setPropertyToDelete] = useState<PropertyRecord | null>(null);
  const [propertyDrafts, setPropertyDrafts] = useState<PropertyDraft[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!kind) return;
    setName(kind.name);
    setKey(kind.key);
    setDescription(kind.description ?? '');
  }, [kind]);

  const valueTypeOptions = useMemo(() => [
    { value: 'text', label: t('domainEditor.option.text' as never) },
    { value: 'number', label: t('domainEditor.option.number' as never) },
    { value: 'boolean', label: t('domainEditor.option.boolean' as never) },
    { value: 'date', label: t('domainEditor.option.date' as never) },
    { value: 'datetime', label: t('domainEditor.option.datetime' as never) },
    { value: 'resource-ref', label: t('domainEditor.option.resourceRef' as never) },
    { value: 'option', label: t('domainEditor.option.option' as never) },
  ], [t]);

  const displayTitle = name.trim() || (draft ? t('domainEditor.newKind' as never) : kind?.name || t('domainEditor.kind' as never));
  const isDirty = draft
    ? name.trim().length > 0 || key.trim().length > 0 || description.trim().length > 0 || propertyDrafts.length > 0 || propertyName.trim().length > 0
    : Boolean(kind && (
      name !== kind.name
      || key !== kind.key
      || description !== (kind.description ?? '')
    ));

  useEffect(() => {
    useEditorStore.getState().setDirty(tab.id, isDirty);
  }, [isDirty, tab.id]);

  function handleNameChange(nextName: string): void {
    setName(nextName);
    if (draft && !keyTouched) setKey(makeKey(nextName));
    useEditorStore.getState().updateTitle(tab.id, nextName.trim() || (draft ? t('domainEditor.newKind' as never) : t('domainEditor.kind' as never)));
  }

  function handlePropertyNameChange(nextName: string): void {
    setPropertyName(nextName);
    if (!propertyKeyTouched) setPropertyKey(makeKey(nextName));
  }

  function resetPropertyDraftForm(): void {
    setPropertyName('');
    setPropertyKey('');
    setPropertyKeyTouched(false);
    setPropertyDescription('');
    setValueType('text');
    setRequiredPolicy('optional');
    setEditingPropertyId(null);
  }

  function addDraftProperty(): void {
    if (!propertyName.trim()) return;
    const nextKey = propertyKey.trim() || makeKey(propertyName);
    if (!isValidKey(nextKey)) {
      setError(t('domainEditor.keyInvalid' as never));
      return;
    }
    if (propertyDrafts.some((property) => property.key.toLocaleLowerCase() === nextKey.toLocaleLowerCase())) {
      setError(t('domainEditor.keyDuplicate' as never));
      return;
    }
    setPropertyDrafts((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        key: nextKey,
        name: propertyName.trim(),
        valueType,
        requiredPolicy,
        description: propertyDescription.trim(),
      },
    ]);
    resetPropertyDraftForm();
    setError(null);
  }

  async function saveKind(): Promise<void> {
    if ((!kind && !draft) || !name.trim() || !key.trim()) return;
    if (!isValidKey(key.trim())) {
      setError(t('domainEditor.keyInvalid' as never));
      return;
    }
    const invalidProperty = propertyDrafts.find((property) => !isValidKey(property.key));
    if (invalidProperty) {
      setError(t('domainEditor.keyInvalid' as never));
      return;
    }
    setSaving('kind');
    setError(null);
    try {
      if (draft) {
        const created = await domainService.rpc<KindRecord>(NETIOR_RPC_METHODS.kindCreate, {
          modelId: draft.modelId,
          name: name.trim(),
          key: key.trim(),
          description: description.trim() || null,
        });
        for (const property of propertyDrafts) {
          await domainService.rpc<PropertyRecord>(NETIOR_RPC_METHODS.propertyCreate, {
            kindId: created.id,
            name: property.name,
            key: property.key,
            description: property.description || null,
            valueType: property.valueType,
            cardinality: 'single',
            requiredPolicy: property.requiredPolicy,
          });
        }
        await refreshCurrentWorld();
        useEditorStore.getState().updateTitle(tab.id, created.name);
        useEditorStore.getState().setDirty(tab.id, false);
        useEditorStore.getState().openTab({
          type: 'kind',
          targetId: created.id,
          title: created.name,
          rootNetworkId: draft.rootId,
        });
        return;
      }
      if (!kind) return;
      let current: KindRecord = kind;
      if (name.trim() !== kind.name) {
        current = await domainService.rpc<KindRecord>(NETIOR_RPC_METHODS.kindRename, {
          id: kind.id,
          name: name.trim(),
        });
      }
      if (key.trim() !== kind.key) {
        current = await domainService.rpc<KindRecord>('kind.updateKey' as never, {
          id: kind.id,
          key: key.trim(),
        });
      }
      if (description.trim() !== (kind.description ?? '')) {
        current = await domainService.rpc<KindRecord>(NETIOR_RPC_METHODS.kindUpdateDescription, {
          id: kind.id,
          description: description.trim() || null,
        });
      }
      await refreshCurrentWorld();
      useEditorStore.getState().updateTitle(tab.id, current.name);
      useEditorStore.getState().setDirty(tab.id, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  async function createProperty(): Promise<void> {
    if (!kind || !propertyName.trim()) return;
    const nextKey = propertyKey.trim() || makeKey(propertyName);
    if (!isValidKey(nextKey)) {
      setError(t('domainEditor.keyInvalid' as never));
      return;
    }
    setSaving('property');
    setError(null);
    try {
      if (editingPropertyId) {
        const property = properties.find((item) => item.id === editingPropertyId);
        if (!property) return;
        if (propertyName.trim() !== property.name) {
          await domainService.rpc<PropertyRecord>(NETIOR_RPC_METHODS.propertyRename, {
            id: property.id,
            name: propertyName.trim(),
          });
        }
        if (nextKey !== property.key) {
          await domainService.rpc<PropertyRecord>('property.updateKey' as never, {
            id: property.id,
            key: nextKey,
          });
        }
        if (propertyDescription.trim() !== (property.description ?? '')) {
          await domainService.rpc<PropertyRecord>(NETIOR_RPC_METHODS.propertyUpdateDescription, {
            id: property.id,
            description: propertyDescription.trim() || null,
          });
        }
        if (valueType !== property.value_type) {
          await domainService.rpc<PropertyRecord>(NETIOR_RPC_METHODS.propertyUpdateValueType, {
            id: property.id,
            valueType,
          });
        }
        if (requiredPolicy !== property.required_policy) {
          await domainService.rpc<PropertyRecord>(NETIOR_RPC_METHODS.propertyUpdateRequiredPolicy, {
            id: property.id,
            requiredPolicy,
          });
        }
        resetPropertyDraftForm();
        await refreshCurrentWorld();
        return;
      }
      await domainService.rpc<PropertyRecord>(NETIOR_RPC_METHODS.propertyCreate, {
        kindId: kind.id,
        name: propertyName.trim(),
        key: nextKey,
        description: propertyDescription.trim() || null,
        valueType,
        cardinality: 'single',
        requiredPolicy,
      });
      resetPropertyDraftForm();
      await refreshCurrentWorld();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  function editProperty(property: PropertyRecord): void {
    setEditingPropertyId(property.id);
    setPropertyName(property.name);
    setPropertyKey(property.key);
    setPropertyKeyTouched(true);
    setPropertyDescription(property.description ?? '');
    setValueType(property.value_type);
    setRequiredPolicy(property.required_policy === 'required' ? 'required' : 'optional');
    setError(null);
  }

  async function deleteProperty(): Promise<void> {
    if (!propertyToDelete) return;
    setSaving('property-delete');
    setError(null);
    try {
      await domainService.rpc<boolean>('property.delete' as never, { id: propertyToDelete.id });
      if (editingPropertyId === propertyToDelete.id) resetPropertyDraftForm();
      setPropertyToDelete(null);
      await refreshCurrentWorld();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  const deletingPropertyValueCount = useMemo(() => {
    if (!propertyToDelete) return 0;
    return (snapshot?.propertyValues ?? []).filter((value) => value.property_id === propertyToDelete.id && value.status !== 'archived').length;
  }, [propertyToDelete, snapshot?.propertyValues]);

  if (!draft && !kind) {
    return <EditorScroll><div className="text-sm text-muted">{t('domainEditor.kindNotFound' as never)}</div></EditorScroll>;
  }

  return (
    <EditorScroll>
      <EditorHeader
        eyebrow={draft ? t('domainEditor.newKind' as never) : t('domainEditor.kind' as never)}
        title={displayTitle}
        subtitle={draft ? t('domainEditor.newKindDescription' as never) : t('domainEditor.kindEditorDescription' as never)}
      />
      <ErrorBanner message={error} />

      <div className="rounded-xl border border-subtle bg-surface-card p-4">
        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-default">{t('domainEditor.basicInfo' as never)}</h3>
            <Field label={t('domainEditor.name' as never)}>
              <Input value={name} onChange={(event) => handleNameChange(event.target.value)} />
            </Field>
            <Field label={t('domainEditor.key' as never)}>
              <Input
                value={key}
                onChange={(event) => {
                  setKeyTouched(true);
                  setKey(event.target.value);
                }}
              />
            </Field>
            <Field label={t('domainEditor.description' as never)}>
              <TextArea value={description} onChange={(event) => setDescription(event.target.value)} />
            </Field>
          </section>

          <section className="space-y-3 border-t border-subtle pt-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-default">{t('domainEditor.properties' as never)}</h3>
              <span className="text-xs text-muted">{draft ? propertyDrafts.length : properties.length}</span>
            </div>
            <FormGrid>
              <Field label={t('domainEditor.name' as never)}>
                <Input value={propertyName} onChange={(event) => handlePropertyNameChange(event.target.value)} />
              </Field>
              <Field label={t('domainEditor.key' as never)}>
                <Input
                  value={propertyKey}
                  onChange={(event) => {
                    setPropertyKeyTouched(true);
                    setPropertyKey(event.target.value);
                  }}
                />
              </Field>
              <Field label={t('domainEditor.valueType' as never)}>
                <Select options={valueTypeOptions} value={valueType} onChange={(event) => setValueType(event.target.value)} />
              </Field>
              <Field label={t('domainEditor.required' as never)}>
                <div className="flex h-10 items-center">
                  <Toggle
                    checked={requiredPolicy === 'required'}
                    onChange={(checked) => setRequiredPolicy(checked ? 'required' : 'optional')}
                  />
                </div>
              </Field>
            </FormGrid>
            <Field label={t('domainEditor.description' as never)}>
              <TextArea value={propertyDescription} onChange={(event) => setPropertyDescription(event.target.value)} />
            </Field>
            <div className="flex justify-end gap-2">
              {editingPropertyId && (
                <Button size="sm" variant="ghost" onClick={resetPropertyDraftForm}>
                  {t('common.cancel' as never)}
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                isLoading={saving === 'property'}
                disabled={!propertyName.trim()}
                onClick={() => (draft ? addDraftProperty() : void createProperty())}
              >
                {editingPropertyId ? t('common.save' as never) : t('domainEditor.addProperty' as never)}
              </Button>
            </div>
            <div className="overflow-hidden rounded-lg border border-subtle bg-surface-input">
              {draft && propertyDrafts.length > 0 ? propertyDrafts.map((property) => (
                <div key={property.id} className="group flex items-center gap-3 border-b border-subtle px-3 py-2.5 last:border-b-0 hover:bg-surface-hover">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-default">{property.name}</div>
                    <div className="truncate text-xs text-muted">{property.key} / {property.valueType} / {property.requiredPolicy}</div>
                  </div>
                  <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                    <IconButton
                      label={t('common.edit' as never)}
                      className="!h-7 !w-7"
                      onClick={() => {
                        setPropertyName(property.name);
                        setPropertyKey(property.key);
                        setPropertyKeyTouched(true);
                        setPropertyDescription(property.description);
                        setValueType(property.valueType);
                        setRequiredPolicy(property.requiredPolicy);
                        setPropertyDrafts((current) => current.filter((item) => item.id !== property.id));
                      }}
                    >
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton
                      label={t('common.delete' as never)}
                      className="!h-7 !w-7 hover:enabled:text-status-error"
                      onClick={() => setPropertyDrafts((current) => current.filter((item) => item.id !== property.id))}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </div>
              )) : !draft && properties.length > 0 ? properties.map((property) => (
                <div key={property.id} className="group flex items-center gap-3 border-b border-subtle px-3 py-2.5 last:border-b-0 hover:bg-surface-hover">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-default">{property.name}</div>
                    <div className="truncate text-xs text-muted">{property.key} / {property.value_type} / {property.required_policy}</div>
                  </div>
                  <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                    <IconButton label={t('common.edit' as never)} className="!h-7 !w-7" onClick={() => editProperty(property)}>
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton
                      label={t('common.delete' as never)}
                      className="!h-7 !w-7 hover:enabled:text-status-error"
                      onClick={() => setPropertyToDelete(property)}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </div>
              )) : (
                <div className="px-3 py-6 text-center text-xs text-muted">{t('domainEditor.noPropertiesYet' as never)}</div>
              )}
            </div>
          </section>
        </div>

        <div className="mt-6 flex justify-end border-t border-subtle pt-4">
          <Button size="sm" isLoading={saving === 'kind'} disabled={!isDirty || !name.trim() || !key.trim()} onClick={() => void saveKind()}>
            {t('domainEditor.save' as never)}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={Boolean(propertyToDelete)}
        onClose={() => setPropertyToDelete(null)}
        onConfirm={() => void deleteProperty()}
        title={t('common.delete' as never)}
        message={
          deletingPropertyValueCount > 0
            ? `${propertyToDelete?.name ?? ''} 속성을 삭제합니다. 이 속성 값이 ${deletingPropertyValueCount}개 인스턴스 값에서 사용 중입니다. 계속 삭제할까요?`
            : `${propertyToDelete?.name ?? ''} 속성을 삭제할까요?`
        }
        confirmLabel={t('common.delete' as never)}
        cancelLabel={t('common.cancel' as never)}
        isLoading={saving === 'property-delete'}
      />
    </EditorScroll>
  );
}
