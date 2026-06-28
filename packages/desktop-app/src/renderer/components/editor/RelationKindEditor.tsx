import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { NETIOR_RPC_METHODS, type RelationKindRecord } from '@netior/shared';
import type { EditorTab } from '../../types/editor';
import { useDomainStore } from '../../stores/domain-store';
import { useEditorStore } from '../../stores/editor-store';
import { domainService } from '../../services/domain-service';
import { useI18n } from '../../hooks/useI18n';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
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

interface RelationKindEditorProps {
  tab: EditorTab;
}

interface RelationKindDraftData {
  mode: 'create';
  modelId: string;
  rootId: string;
}

type DirectedEndpointPolicyShape = 'one_to_one' | 'one_to_many' | 'many_to_one' | 'many_to_many';
type UndirectedEndpointPolicyShape = 'one_to_one' | 'one_to_many' | 'many_to_many';
type EndpointPolicyShape = DirectedEndpointPolicyShape | UndirectedEndpointPolicyShape;

interface EndpointPairDraft {
  id: string;
  subjectKindKey: string;
  objectKindKey: string;
}

function getRelationKindDraftData(value: unknown): RelationKindDraftData | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Partial<RelationKindDraftData>;
  return data.mode === 'create' && typeof data.modelId === 'string' && typeof data.rootId === 'string'
    ? { mode: 'create', modelId: data.modelId, rootId: data.rootId }
    : null;
}

function parseEndpointPolicy(
  subjectPolicy: string | null | undefined,
  objectPolicy: string | null | undefined,
  fallbackShape: EndpointPolicyShape,
): { shape: EndpointPolicyShape; pairs: EndpointPairDraft[] } {
  if (subjectPolicy?.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(subjectPolicy) as {
        shape?: EndpointPolicyShape;
        pairs?: Array<{ subjectKindKey?: string; objectKindKey?: string }>;
      };
      return {
        shape: parsed.shape ?? fallbackShape,
        pairs: (parsed.pairs ?? [])
          .filter((pair) => pair.subjectKindKey && pair.objectKindKey)
          .map((pair) => ({
            id: crypto.randomUUID(),
            subjectKindKey: pair.subjectKindKey as string,
            objectKindKey: pair.objectKindKey as string,
          })),
      };
    } catch {
      // Fall through to legacy comma policy parsing.
    }
  }

  const subjects = (subjectPolicy ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  const objects = (objectPolicy ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  const pairs: EndpointPairDraft[] = [];
  for (const subjectKindKey of subjects) {
    for (const objectKindKey of objects) {
      pairs.push({ id: crypto.randomUUID(), subjectKindKey, objectKindKey });
    }
  }
  return { shape: fallbackShape, pairs };
}

function serializeEndpointPolicy(shape: EndpointPolicyShape, pairs: EndpointPairDraft[]): string {
  return JSON.stringify({
    shape,
    pairs: pairs.map(({ subjectKindKey, objectKindKey }) => ({ subjectKindKey, objectKindKey })),
  });
}

function getEndpointPolicyShapeOptions(
  directed: boolean,
  t: ReturnType<typeof useI18n>['t'],
): Array<{ value: EndpointPolicyShape; label: string }> {
  return directed
    ? [
      { value: 'one_to_one', label: t('domainEditor.endpointShape.oneToOne' as never) },
      { value: 'one_to_many', label: t('domainEditor.endpointShape.oneToMany' as never) },
      { value: 'many_to_one', label: t('domainEditor.endpointShape.manyToOne' as never) },
      { value: 'many_to_many', label: t('domainEditor.endpointShape.manyToMany' as never) },
    ]
    : [
      { value: 'one_to_one', label: t('domainEditor.endpointShape.samePair' as never) },
      { value: 'one_to_many', label: t('domainEditor.endpointShape.fixedAndVariable' as never) },
      { value: 'many_to_many', label: t('domainEditor.endpointShape.anyPair' as never) },
    ];
}

function isEndpointPolicyValid(shape: EndpointPolicyShape, directed: boolean, pairs: EndpointPairDraft[]): boolean {
  if (pairs.length === 0) return true;
  const subjectSet = new Set(pairs.map((pair) => pair.subjectKindKey));
  const objectSet = new Set(pairs.map((pair) => pair.objectKindKey));
  if (shape === 'one_to_one') return pairs.length === 1;
  if (directed && shape === 'one_to_many') return subjectSet.size === 1;
  if (directed && shape === 'many_to_one') return objectSet.size === 1;
  if (!directed && shape === 'one_to_many') {
    const allKinds = new Set([...subjectSet, ...objectSet]);
    return [...allKinds].some((kindKey) => pairs.every(
      (pair) => pair.subjectKindKey === kindKey || pair.objectKindKey === kindKey,
    ));
  }
  return true;
}

export function RelationKindEditor({ tab }: RelationKindEditorProps): JSX.Element {
  const { t } = useI18n();
  const snapshot = useDomainStore((s) => s.snapshot);
  const refreshCurrentWorld = useDomainStore((s) => s.refreshCurrentWorld);
  const draft = getRelationKindDraftData(tab.draftData);
  const relationKind = snapshot?.relationKinds.find((item) => item.id === tab.targetId && item.status !== 'archived') ?? null;
  const modelId = draft?.modelId ?? relationKind?.model_id ?? null;
  const kinds = useMemo(
    () => (snapshot?.kinds ?? []).filter((item) => item.model_id === modelId && item.status !== 'archived'),
    [modelId, snapshot?.kinds],
  );
  const kindOptions = useMemo(
    () => [
      { value: '', label: t('domainEditor.selectKind' as never) },
      ...kinds.map((kind) => ({ value: kind.key, label: `${kind.name} (${kind.key})` })),
    ],
    [kinds, t],
  );
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [directed, setDirected] = useState(true);
  const [endpointPolicyShape, setEndpointPolicyShape] = useState<EndpointPolicyShape>('many_to_many');
  const [endpointPairs, setEndpointPairs] = useState<EndpointPairDraft[]>([]);
  const [subjectKindDraft, setSubjectKindDraft] = useState('');
  const [objectKindDraft, setObjectKindDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [endpointPolicyError, setEndpointPolicyError] = useState<string | null>(null);

  useEffect(() => {
    if (!relationKind) return;
    setName(relationKind.name);
    setKey(relationKind.key);
    setDescription(relationKind.description ?? '');
    const nextDirected = Boolean(relationKind.directed);
    const parsedPolicy = parseEndpointPolicy(
      relationKind.subject_kind_policy,
      relationKind.object_kind_policy,
      nextDirected ? 'many_to_many' : 'many_to_many',
    );
    setDirected(nextDirected);
    setEndpointPolicyShape(parsedPolicy.shape === 'many_to_one' && !nextDirected ? 'one_to_many' : parsedPolicy.shape);
    setEndpointPairs(parsedPolicy.pairs);
  }, [relationKind]);

  const displayTitle = name.trim() || (draft ? t('domainEditor.newRelationKind' as never) : relationKind?.name || t('domainEditor.relationKind' as never));
  const serializedEndpointPolicy = serializeEndpointPolicy(endpointPolicyShape, endpointPairs);
  const endpointPolicyShapeOptions = useMemo(
    () => getEndpointPolicyShapeOptions(directed, t),
    [directed, t],
  );
  const isDirty = draft
    ? name.trim().length > 0 || key.trim().length > 0 || description.trim().length > 0 || !directed || endpointPairs.length > 0 || endpointPolicyShape !== 'many_to_many'
    : Boolean(relationKind && (
      name !== relationKind.name
      || key !== relationKind.key
      || description !== (relationKind.description ?? '')
      || Number(directed) !== relationKind.directed
      || serializedEndpointPolicy !== (relationKind.subject_kind_policy ?? '')
    ));

  useEffect(() => {
    useEditorStore.getState().setDirty(tab.id, isDirty);
  }, [isDirty, tab.id]);

  function handleNameChange(nextName: string): void {
    setName(nextName);
    if (draft && !keyTouched) setKey(makeKey(nextName));
    useEditorStore.getState().updateTitle(tab.id, nextName.trim() || (draft ? t('domainEditor.newRelationKind' as never) : t('domainEditor.relationKind' as never)));
  }

  function addEndpointPair(): void {
    if (!subjectKindDraft || !objectKindDraft) return;
    const nextPair = {
      id: crypto.randomUUID(),
      subjectKindKey: subjectKindDraft,
      objectKindKey: objectKindDraft,
    };
    const nextPairs = endpointPairs.some((pair) => (
      pair.subjectKindKey === nextPair.subjectKindKey && pair.objectKindKey === nextPair.objectKindKey
    ))
      ? endpointPairs
      : [...endpointPairs, nextPair];
    if (!isEndpointPolicyValid(endpointPolicyShape, directed, nextPairs)) {
      setEndpointPolicyError(t('domainEditor.endpointPolicyInvalid' as never));
      return;
    }
    setEndpointPairs(nextPairs);
    setSubjectKindDraft('');
    setObjectKindDraft('');
    setEndpointPolicyError(null);
  }

  function removeEndpointPair(id: string): void {
    setEndpointPairs((current) => current.filter((pair) => pair.id !== id));
  }

  function handleDirectedChange(nextDirected: boolean): void {
    setDirected(nextDirected);
    if (!nextDirected && endpointPolicyShape === 'many_to_one') {
      setEndpointPolicyShape('one_to_many');
    }
    setEndpointPolicyError(null);
  }

  function handleEndpointPolicyShapeChange(nextShape: EndpointPolicyShape): void {
    setEndpointPolicyShape(nextShape);
    if (!isEndpointPolicyValid(nextShape, directed, endpointPairs)) {
      setEndpointPolicyError(t('domainEditor.endpointPolicyInvalid' as never));
      return;
    }
    setEndpointPolicyError(null);
  }

  async function save(): Promise<void> {
    if ((!relationKind && !draft) || !name.trim() || !key.trim()) return;
    if (!isValidKey(key.trim())) {
      setKeyError(t('domainEditor.keyInvalid' as never));
      return;
    }
    setKeyError(null);
    if (!isEndpointPolicyValid(endpointPolicyShape, directed, endpointPairs)) {
      setEndpointPolicyError(t('domainEditor.endpointPolicyInvalid' as never));
      return;
    }
    setEndpointPolicyError(null);
    setSaving(true);
    setError(null);
    try {
      if (draft) {
        const created = await domainService.rpc<RelationKindRecord>(NETIOR_RPC_METHODS.relationKindCreate, {
          modelId: draft.modelId,
          name: name.trim(),
          key: key.trim(),
          description: description.trim() || null,
          directed,
          subjectKindPolicy: serializedEndpointPolicy,
          objectKindPolicy: null,
          endpointPolicyShape,
          endpointPairs,
          cardinalityPolicy: null,
        });
        await refreshCurrentWorld();
        useEditorStore.getState().updateTitle(tab.id, created.name);
        useEditorStore.getState().setDirty(tab.id, false);
        useEditorStore.getState().openTab({
          type: 'relationKind',
          targetId: created.id,
          title: created.name,
          rootNetworkId: draft.rootId,
        });
        return;
      }
      if (!relationKind) return;
      let current: RelationKindRecord = relationKind;
      if (name.trim() !== relationKind.name) {
        current = await domainService.rpc<RelationKindRecord>(NETIOR_RPC_METHODS.relationKindRename, {
          id: relationKind.id,
          name: name.trim(),
        });
      }
      if (key.trim() !== relationKind.key) {
        current = await domainService.rpc<RelationKindRecord>('relationKind.updateKey' as never, {
          id: relationKind.id,
          key: key.trim(),
        });
      }
      if (description.trim() !== (relationKind.description ?? '')) {
        current = await domainService.rpc<RelationKindRecord>(NETIOR_RPC_METHODS.relationKindUpdateDescription, {
          id: relationKind.id,
          description: description.trim() || null,
        });
      }
      if (Number(directed) !== relationKind.directed) {
        current = await domainService.rpc<RelationKindRecord>(NETIOR_RPC_METHODS.relationKindUpdateDirected, {
          id: relationKind.id,
          directed,
        });
      }
      if (serializedEndpointPolicy !== (relationKind.subject_kind_policy ?? '') || (relationKind.object_kind_policy ?? '') !== '') {
        current = await domainService.rpc<RelationKindRecord>(NETIOR_RPC_METHODS.relationKindUpdateEndpointPolicy, {
          id: relationKind.id,
          subjectKindPolicy: serializedEndpointPolicy,
          objectKindPolicy: null,
          endpointPolicyShape,
          endpointPairs,
        });
      }
      if (relationKind.cardinality_policy) {
        current = await domainService.rpc<RelationKindRecord>(NETIOR_RPC_METHODS.relationKindUpdateCardinalityPolicy, {
          id: relationKind.id,
          cardinalityPolicy: null,
        });
      }
      await refreshCurrentWorld();
      useEditorStore.getState().updateTitle(tab.id, current.name);
      useEditorStore.getState().setDirty(tab.id, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (!draft && !relationKind) {
    return <EditorScroll><div className="text-sm text-muted">{t('domainEditor.relationKindNotFound' as never)}</div></EditorScroll>;
  }

  return (
    <EditorScroll>
      <EditorHeader
        eyebrow={draft ? t('domainEditor.newRelationKind' as never) : t('domainEditor.relationKind' as never)}
        title={displayTitle}
        subtitle={draft ? t('domainEditor.newRelationKindDescription' as never) : t('domainEditor.relationKindEditorDescription' as never)}
      />
      <ErrorBanner message={error} />

      <div className="rounded-xl border border-subtle bg-surface-card p-4">
        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-default">{t('domainEditor.basicInfo' as never)}</h3>
            <FormGrid>
              <Field label={t('domainEditor.name' as never)}>
                <Input value={name} onChange={(event) => handleNameChange(event.target.value)} />
              </Field>
              <Field label={t('domainEditor.key' as never)}>
                <Input
                  value={key}
                  onChange={(event) => {
                    setKeyTouched(true);
                    setKey(event.target.value);
                    if (keyError) setKeyError(null);
                  }}
                />
                {keyError && <div className="text-xs text-status-error">{keyError}</div>}
              </Field>
            </FormGrid>
            <Field label={t('domainEditor.description' as never)}>
              <TextArea value={description} onChange={(event) => setDescription(event.target.value)} />
            </Field>
          </section>

          <section className="space-y-3 border-t border-subtle pt-5">
            <h3 className="text-sm font-semibold text-default">{t('domainEditor.endpointPolicy' as never)}</h3>
            <Field label={t('domainEditor.directed' as never)}>
              <div className="flex h-10 items-center">
                <Toggle checked={directed} onChange={handleDirectedChange} />
              </div>
            </Field>
            <Field label={t('domainEditor.endpointPolicyShape' as never)}>
              <Select
                options={endpointPolicyShapeOptions}
                value={endpointPolicyShape}
                onChange={(event) => handleEndpointPolicyShapeChange(event.target.value as EndpointPolicyShape)}
              />
              {endpointPolicyError && <div className="text-xs text-status-error">{endpointPolicyError}</div>}
            </Field>
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <Field label={t('domainEditor.subjectKindPolicy' as never)}>
                <Select options={kindOptions} value={subjectKindDraft} onChange={(event) => setSubjectKindDraft(event.target.value)} />
              </Field>
              <Field label={t('domainEditor.objectKindPolicy' as never)}>
                <Select options={kindOptions} value={objectKindDraft} onChange={(event) => setObjectKindDraft(event.target.value)} />
              </Field>
              <div className="flex items-end">
                <IconButton
                  label={t('common.add' as never)}
                  className="shrink-0"
                  onClick={addEndpointPair}
                  disabled={!subjectKindDraft || !objectKindDraft}
                >
                  <Plus size={16} />
                </IconButton>
              </div>
            </div>
            <div className="flex min-h-8 flex-wrap gap-1.5">
              {endpointPairs.map((pair) => (
                <Badge key={pair.id}>
                  <span className="mr-1">{pair.subjectKindKey} - {pair.objectKindKey}</span>
                  <button type="button" className="text-muted hover:text-default" onClick={() => removeEndpointPair(pair.id)}>
                    <X size={12} />
                  </button>
                </Badge>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-6 flex justify-end border-t border-subtle pt-4">
          <Button size="sm" isLoading={saving} disabled={!isDirty || !name.trim()} onClick={() => void save()}>
            {t('domainEditor.save' as never)}
          </Button>
        </div>
      </div>
    </EditorScroll>
  );
}
