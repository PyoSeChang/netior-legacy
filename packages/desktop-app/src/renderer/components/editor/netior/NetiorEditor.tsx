import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Link2, PanelTop, Search } from 'lucide-react';
import { createOntologyDisplayResolver } from '@netior/shared';
import {
  createEmbedToken,
  createMentionToken,
  parseSemanticEditorTokens,
  serializeSemanticTarget,
  type SemanticEditorToken,
  type SemanticTarget,
  type TargetProjection,
} from '@netior/shared/semantic-editor';
import type { Instance, InstanceProperty, InteractiveViewTemplate, Model, SchemaField } from '@netior/shared/types';
import type { MentionResult } from '../../../services/narre-service';
import { MarkdownEditor } from '../markdown/MarkdownEditor';
import { createNetiorSemanticPreviewPlugin, NETIOR_EMBED_EDIT_EVENT } from './semantic-preview';
import { InteractiveViewPanel } from '../interactive/InteractiveViewPanel';
import { IconButton } from '../../ui/IconButton';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Select } from '../../ui/Select';
import { instanceService, interactiveViewTemplateService, modelService, schemaService } from '../../../services';
import { useI18n } from '../../../hooks/useI18n';
import { useInstanceStore } from '../../../stores/instance-store';
import {
  NARRE_MENTION_CUSTOM_DROP_EVENT,
  type NarreMentionCustomDropDetail,
} from '../../../hooks/useNarreMentionDrag';
import { useRenderPerfTrace } from '../../../lib/perf-diagnostics';

type InsertMode = 'mention' | 'embed';
type TargetScope = 'instance' | 'content' | 'property' | 'properties' | 'interactive_view';

interface NetiorEditorProps {
  tabId: string;
  content: string;
  projectId?: string | null;
  instanceId?: string | null;
  onChange: (content: string) => void;
}

interface InsertRequest {
  id: number;
  text: string;
  block?: boolean;
  replaceFrom?: number;
  replaceTo?: number;
}

interface EditingTokenState {
  token: SemanticEditorToken;
  mode: InsertMode;
}

function isEmbeddableInstance(instance: Instance): boolean {
  return instance.source_kind === 'project' || instance.source_kind === 'imported';
}

function isRelationModel(model: Model): boolean {
  const targetKind = model.target_kind as string;
  return targetKind === 'relation' || targetKind === 'both';
}

function needsTrailingSemanticEditableLine(value: string): boolean {
  const trimmedRight = value.replace(/[ \t]+$/u, '');
  if (!trimmedRight || trimmedRight.endsWith('\n')) return false;
  const tokens = parseSemanticEditorTokens(trimmedRight);
  const lastToken = tokens[tokens.length - 1];
  return lastToken?.occurrenceType === 'embed' && lastToken.to === trimmedRight.length;
}

function projectionForScope(scope: TargetScope): TargetProjection {
  switch (scope) {
    case 'content':
      return 'content';
    case 'property':
      return 'property_value';
    case 'properties':
      return 'properties_table';
    case 'interactive_view':
      return 'interactive_view';
    case 'instance':
    default:
      return 'summary_card';
  }
}

interface LabelParts {
  fallbackInstance: string;
  content: string;
  properties: string;
  view: string;
}

function makeLabel(
  instance: Instance | undefined,
  scope: TargetScope,
  labels: LabelParts,
  field?: SchemaField,
  template?: InteractiveViewTemplate | null,
): string {
  const title = instance?.title ?? labels.fallbackInstance;
  if (scope === 'property' && field) return `${title}.${field.name}`;
  if (scope === 'properties') return title;
  if (scope === 'content') return `${title} ${labels.content}`;
  if (scope === 'interactive_view') return template?.name ? `${title} - ${template.name}` : `${title} ${labels.view}`;
  return title;
}

export function NetiorEditor({
  tabId,
  content,
  projectId,
  instanceId: _instanceId,
  onChange,
}: NetiorEditorProps): JSX.Element {
  const { t } = useI18n();
  const display = useMemo(() => createOntologyDisplayResolver(t), [t]);
  const storeInstances = useInstanceStore((state) => state.instances);
  const propertiesByInstance = useInstanceStore((state) => state.properties);
  const loadProperties = useInstanceStore((state) => state.loadProperties);
  const [insertRequest, setInsertRequest] = useState<InsertRequest | null>(null);
  const [mode, setMode] = useState<InsertMode | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [fieldsBySchemaId, setFieldsBySchemaId] = useState<Record<string, SchemaField[]>>({});
  const [interactiveEmbedsPaused, setInteractiveEmbedsPaused] = useState(false);
  const interactiveEmbedsPausedRef = useRef(false);
  const interactiveResumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const droppedInstanceIdRef = useRef<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const deferredContent = useDeferredValue(content);
  const referencedTargetIds = useMemo(() => {
    const startedAt = performance.now();
    const contentInstanceIds = new Set<string>();
    const propertyInstanceIds = new Set<string>();
    const interactiveInstanceIds = new Set<string>();
    if (!deferredContent.includes('::netior-embed') && !deferredContent.includes('[[')) {
      return { content: [], properties: [], interactive: [], all: [] };
    }

    for (const token of parseSemanticEditorTokens(deferredContent)) {
      if (token.target.kind === 'instance_content') {
        contentInstanceIds.add(token.target.instanceId);
      }
      if (token.target.kind === 'instance_properties' || token.target.kind === 'instance_property') {
        propertyInstanceIds.add(token.target.instanceId);
      }
      if (token.target.kind === 'interactive_view') {
        interactiveInstanceIds.add(token.target.instanceId);
      }
    }
    const result = {
      content: Array.from(contentInstanceIds),
      properties: Array.from(propertyInstanceIds),
      interactive: Array.from(interactiveInstanceIds),
      all: Array.from(new Set([...contentInstanceIds, ...propertyInstanceIds, ...interactiveInstanceIds])),
    };
    const duration = performance.now() - startedAt;
    if (duration > 12) {
      console.debug('[NetiorPerf] NetiorEditor.parseReferences', {
        durationMs: Math.round(duration * 10) / 10,
        length: deferredContent.length,
        referenceCount: result.all.length,
      });
    }
    return result;
  }, [deferredContent]);
  const instanceById = useMemo(() => {
    const map: Record<string, Instance> = {};
    for (const instance of storeInstances) map[instance.id] = instance;
    for (const instance of instances) map[instance.id] = instance;
    return map;
  }, [instances, storeInstances]);
  const propertyValues = useMemo(() => {
    const values: Record<string, Record<string, string | null>> = {};
    for (const [targetInstanceId, properties] of Object.entries(propertiesByInstance)) {
      values[targetInstanceId] = properties.reduce<Record<string, string | null>>((acc, property: InstanceProperty) => {
        acc[property.field_id] = property.value;
        return acc;
      }, {});
    }
    return values;
  }, [propertiesByInstance]);
  const semanticDataVersion = useMemo(() => {
    const contentPart = referencedTargetIds.content
      .map((targetInstanceId) => `${targetInstanceId}:${instanceById[targetInstanceId]?.content ?? ''}`)
      .join('\u001f');
    const propertyPart = referencedTargetIds.properties
      .map((targetInstanceId) => {
        const values = propertyValues[targetInstanceId] ?? {};
        const fields = Object.keys(values)
          .sort()
          .map((fieldId) => `${fieldId}:${values[fieldId] ?? ''}`)
          .join('\u001d');
        return `${targetInstanceId}:${fields}`;
      })
      .join('\u001f');
    const interactivePart = referencedTargetIds.interactive
      .map((targetInstanceId) => {
        const instance = instanceById[targetInstanceId];
        const schemaId = instance?.schema_id ?? '';
        const fields = schemaId ? fieldsBySchemaId[schemaId] ?? [] : [];
        const values = propertyValues[targetInstanceId] ?? {};
        const fieldPart = fields.map((field) => `${field.id}:${field.name}`).join('\u001d');
        const valuePart = Object.keys(values).sort().map((fieldId) => `${fieldId}:${values[fieldId] ?? ''}`).join('\u001d');
        return `${targetInstanceId}:${schemaId}:${instance?.content ?? ''}:${fieldPart}:${valuePart}`;
      })
      .join('\u001f');
    return `${interactiveEmbedsPaused ? 'paused' : 'live'}\u001e${contentPart}\u001e${propertyPart}\u001e${interactivePart}`;
  }, [fieldsBySchemaId, instanceById, interactiveEmbedsPaused, propertyValues, referencedTargetIds.content, referencedTargetIds.interactive, referencedTargetIds.properties]);
  const instanceByIdRef = useRef(instanceById);
  const propertyValuesRef = useRef(propertyValues);
  const fieldsBySchemaIdRef = useRef(fieldsBySchemaId);
  const semanticDataVersionRef = useRef(semanticDataVersion);
  instanceByIdRef.current = instanceById;
  propertyValuesRef.current = propertyValues;
  fieldsBySchemaIdRef.current = fieldsBySchemaId;
  interactiveEmbedsPausedRef.current = interactiveEmbedsPaused;
  semanticDataVersionRef.current = semanticDataVersion;

  const semanticExtensions = useMemo(() => {
    const renderInteractiveView = (container: HTMLElement, token: SemanticEditorToken) => {
      const startedAt = performance.now();
      if (token.target.kind !== 'interactive_view' || !projectId) {
        container.textContent = '-';
        return undefined;
      }

      const instance = instanceByIdRef.current[token.target.instanceId];
      if (!instance?.schema_id) {
        container.textContent = '-';
        return undefined;
      }

      const fields = fieldsBySchemaIdRef.current[instance.schema_id] ?? [];
      const properties = propertyValuesRef.current[instance.id] ?? {};
      const root: Root = createRoot(container);
      root.render(
        <div className="netior-embed-interactive-view-panel">
          <InteractiveViewPanel
            tabId={tabId}
            projectId={projectId}
            schemaId={instance.schema_id}
            instanceId={instance.id}
            fields={fields}
            properties={properties}
            content={instance.content}
            onFieldChange={() => undefined}
            mode="view"
          />
        </div>,
      );
      const duration = performance.now() - startedAt;
      if (duration > 12) {
        console.debug('[NetiorPerf] NetiorEditor.mountInteractiveEmbed', {
          durationMs: Math.round(duration * 10) / 10,
          instanceId: instance.id,
        });
      }
      return () => {
        queueMicrotask(() => root.unmount());
      };
    };

    const createExtensions = (embedDepth: number) => createNetiorSemanticPreviewPlugin({
      getPropertyValue: (targetInstanceId, fieldId) => propertyValuesRef.current[targetInstanceId]?.[fieldId],
      getContent: (targetInstanceId) => instanceByIdRef.current[targetInstanceId]?.content,
      renderContent: (container, token, embeddedContent, depth) => {
        const root: Root = createRoot(container);
        root.render(
          <MarkdownEditor
            tabId={`${tabId}:embed:${token.from}`}
            content={embeddedContent}
            extensions={createExtensions(depth)}
            contentMaxWidth="100%"
            contentPadding="0"
            fillHeight={false}
            minHeight="0"
            readOnly
            showToc={false}
            refreshKey={semanticDataVersionRef.current}
            onChange={() => undefined}
          />,
        );
        return () => {
          queueMicrotask(() => root.unmount());
        };
      },
      shouldRenderInteractiveView: () => !interactiveEmbedsPausedRef.current,
      renderInteractiveView,
      getVersion: () => semanticDataVersionRef.current,
      embedDepth,
      maxEmbedDepth: 1,
    });

    return createExtensions(0);
  }, [projectId, tabId]);
  const [fields, setFields] = useState<SchemaField[]>([]);
  const [templates, setTemplates] = useState<InteractiveViewTemplate[]>([]);
  const [query, setQuery] = useState('');
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [scope, setScope] = useState<TargetScope>('instance');
  const [selectedFieldId, setSelectedFieldId] = useState('');
  const [selectedPropertyFieldIds, setSelectedPropertyFieldIds] = useState<string[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('');
  const [droppedMention, setDroppedMention] = useState<MentionResult | null>(null);
  const [editingToken, setEditingToken] = useState<EditingTokenState | null>(null);
  const selectedInstanceButtonRef = useRef<HTMLButtonElement | null>(null);
  const pendingTargetSelectionRef = useRef<{ fieldId?: string; fieldIds?: string[]; templateId?: string | null } | null>(null);
  useRenderPerfTrace('NetiorEditor', {
    tabId,
    projectId: projectId ?? null,
    instanceId: _instanceId ?? null,
    contentLength: content.length,
    hasSemanticSyntax: content.includes('::netior-embed') || content.includes('[['),
    referencedAllCount: referencedTargetIds.all.length,
    referencedContentCount: referencedTargetIds.content.length,
    referencedPropertiesCount: referencedTargetIds.properties.length,
    referencedInteractiveCount: referencedTargetIds.interactive.length,
    storeInstancesCount: storeInstances.length,
    localInstancesCount: instances.length,
    propertyInstanceCount: Object.keys(propertiesByInstance).length,
    fieldsBySchemaCount: Object.keys(fieldsBySchemaId).length,
    mode: mode ?? null,
    interactiveEmbedsPaused,
  });

  const openTokenEdit = (token: SemanticEditorToken) => {
    let nextScope: TargetScope = 'instance';
    let nextInstanceId = '';
    pendingTargetSelectionRef.current = null;

    if (token.target.kind === 'object' && token.target.objectType === 'instance') {
      nextScope = 'instance';
      nextInstanceId = token.target.objectId;
    } else if (token.target.kind === 'instance_content') {
      nextScope = 'content';
      nextInstanceId = token.target.instanceId;
    } else if (token.target.kind === 'instance_property') {
      nextScope = 'property';
      nextInstanceId = token.target.instanceId;
      pendingTargetSelectionRef.current = { fieldId: token.target.fieldId };
    } else if (token.target.kind === 'instance_properties') {
      nextScope = 'properties';
      nextInstanceId = token.target.instanceId;
      pendingTargetSelectionRef.current = { fieldIds: token.target.fieldIds };
    } else if (token.target.kind === 'interactive_view') {
      nextScope = 'interactive_view';
      nextInstanceId = token.target.instanceId;
      pendingTargetSelectionRef.current = { templateId: token.target.templateId };
    } else {
      return;
    }

    droppedInstanceIdRef.current = nextInstanceId;
    setEditingToken({ token, mode: token.occurrenceType === 'embed' ? 'embed' : 'mention' });
    setMode(token.occurrenceType === 'embed' ? 'embed' : 'mention');
    setScope(nextScope);
    setSelectedInstanceId(nextInstanceId);
    setSelectedModelId(token.modelId ?? '');
    setQuery('');
  };

  useEffect(() => {
    const handleMentionDrop = (event: Event) => {
      const detail = (event as CustomEvent<NarreMentionCustomDropDetail>).detail;
      const mention = detail?.mention;
      if (!mention) return;
      if (mention.type !== 'instance') {
        setDroppedMention(mention);
        return;
      }

      droppedInstanceIdRef.current = mention.id;
      setSelectedInstanceId(mention.id);
      setQuery('');
      setDroppedMention(mention);
    };
    const handleEmbedEdit = (event: Event) => {
      const token = (event as CustomEvent<{ token?: SemanticEditorToken }>).detail?.token;
      if (!token) return;
      openTokenEdit(token);
    };

    const root = rootRef.current;
    if (!root) return undefined;
    root.addEventListener(NARRE_MENTION_CUSTOM_DROP_EVENT, handleMentionDrop);
    root.addEventListener(NETIOR_EMBED_EDIT_EVENT, handleEmbedEdit);
    return () => {
      root.removeEventListener(NARRE_MENTION_CUSTOM_DROP_EVENT, handleMentionDrop);
      root.removeEventListener(NETIOR_EMBED_EDIT_EVENT, handleEmbedEdit);
    };
  }, []);

  useEffect(() => {
    const targetInstanceIds = new Set([...referencedTargetIds.properties, ...referencedTargetIds.interactive]);
    for (const targetInstanceId of targetInstanceIds) {
      if (propertiesByInstance[targetInstanceId]) continue;
      void loadProperties(targetInstanceId);
    }
  }, [loadProperties, propertiesByInstance, referencedTargetIds.interactive, referencedTargetIds.properties]);

  useEffect(() => {
    if (!projectId || (!mode && referencedTargetIds.all.length === 0)) return;
    let cancelled = false;
    void instanceService.getByProject(projectId).then((items) => {
      if (cancelled) return;
      setInstances(items);
      if (mode) {
        setSelectedInstanceId((current) => {
          if (current && items.some((item) => item.id === current)) return current;
          const droppedId = droppedInstanceIdRef.current;
          if (droppedId && items.some((item) => item.id === droppedId)) return droppedId;
          return items[0]?.id || '';
        });
      }
    });
    return () => { cancelled = true; };
  }, [mode, projectId, referencedTargetIds.all]);

  useEffect(() => {
    if (!projectId || !mode) return;
    let cancelled = false;
    void modelService.list(projectId).then((items) => {
      if (cancelled) return;
      const relationModels = items.filter(isRelationModel);
      setModels(relationModels);
      setSelectedModelId((current) => (
        current && relationModels.some((model) => model.id === current) ? current : ''
      ));
    });
    return () => { cancelled = true; };
  }, [mode, projectId]);

  const selectedInstance = useMemo(
    () => instances.find((instance) => instance.id === selectedInstanceId),
    [instances, selectedInstanceId],
  );

  useEffect(() => {
    const schemaIds = new Set<string>();
    for (const targetInstanceId of referencedTargetIds.interactive) {
      const schemaId = instanceById[targetInstanceId]?.schema_id;
      if (schemaId && !fieldsBySchemaId[schemaId]) schemaIds.add(schemaId);
    }
    if (schemaIds.size === 0) return;

    let cancelled = false;
    for (const schemaId of schemaIds) {
      void schemaService.field.list(schemaId).then((nextFields) => {
        if (cancelled) return;
        setFieldsBySchemaId((current) => (
          current[schemaId] ? current : { ...current, [schemaId]: nextFields }
        ));
      });
    }
    return () => { cancelled = true; };
  }, [fieldsBySchemaId, instanceById, referencedTargetIds.interactive]);

  useEffect(() => {
    setFields([]);
    setTemplates([]);
    setSelectedFieldId('');
    setSelectedPropertyFieldIds([]);
    setSelectedTemplateId('');
    if (!selectedInstance?.schema_id || !projectId || !mode) return;
    let cancelled = false;
    void Promise.all([
      schemaService.field.list(selectedInstance.schema_id),
      interactiveViewTemplateService.list({
        projectId,
        schemaId: selectedInstance.schema_id,
        instanceId: selectedInstance.id,
      }),
    ]).then(([nextFields, nextTemplates]) => {
      if (cancelled) return;
      const pending = pendingTargetSelectionRef.current;
      setFields(nextFields);
      setTemplates(nextTemplates);
      setSelectedFieldId(pending?.fieldId && nextFields.some((field) => field.id === pending.fieldId)
        ? pending.fieldId
        : nextFields[0]?.id ?? '');
      setSelectedPropertyFieldIds(pending?.fieldIds?.filter((fieldId) => nextFields.some((field) => field.id === fieldId))
        ?? nextFields.map((field) => field.id));
      setSelectedTemplateId(pending?.templateId && nextTemplates.some((template) => template.id === pending.templateId)
        ? pending.templateId
        : nextTemplates[0]?.id ?? '');
      pendingTargetSelectionRef.current = null;
    });
    return () => { cancelled = true; };
  }, [mode, projectId, selectedInstance?.id, selectedInstance?.schema_id]);

  const filteredInstances = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const candidates = mode === 'embed'
      ? instances.filter(isEmbeddableInstance)
      : instances;
    if (!normalized) return candidates;
    return candidates.filter((instance) => instance.title.toLowerCase().includes(normalized));
  }, [instances, mode, query]);

  useEffect(() => {
    if (!mode) return;
    if (instances.length === 0 || filteredInstances.length === 0) return;
    if (filteredInstances.some((instance) => instance.id === selectedInstanceId)) return;
    setSelectedInstanceId(filteredInstances[0]?.id ?? '');
  }, [filteredInstances, instances.length, mode, selectedInstanceId]);

  useEffect(() => {
    if (!mode || !selectedInstanceId) return;
    const handle = window.requestAnimationFrame(() => {
      selectedInstanceButtonRef.current?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
      });
    });
    return () => window.cancelAnimationFrame(handle);
  }, [mode, selectedInstanceId, filteredInstances]);

  const selectedField = fields.find((field) => field.id === selectedFieldId);
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null;
  const selectedPropertyFields = fields.filter((field) => selectedPropertyFieldIds.includes(field.id));
  const labelParts = useMemo<LabelParts>(() => ({
    fallbackInstance: t('netiorEditor.targetInstance'),
    content: t('netiorEditor.targetContent'),
    properties: t('netiorEditor.targetProperties'),
    view: t('netiorEditor.targetInteractiveView'),
  }), [t]);
  const canInsert = !!selectedInstance && (
    scope !== 'property' || !!selectedField
  ) && (
    scope !== 'properties' || fields.length === 0 || selectedPropertyFieldIds.length > 0
  ) && (
    scope !== 'interactive_view' || !!selectedTemplateId
  );

  const openFlow = (nextMode: InsertMode) => {
    setEditingToken(null);
    setMode(nextMode);
    setScope(nextMode === 'embed' ? 'properties' : 'instance');
    setSelectedModelId('');
    setQuery('');
  };

  const updateScope = (nextScope: TargetScope) => {
    setScope(nextScope);
    if (nextScope === 'properties' && fields.length > 0 && selectedPropertyFieldIds.length === 0) {
      setSelectedPropertyFieldIds(fields.map((field) => field.id));
    }
  };

  const togglePropertyField = (fieldId: string, checked: boolean) => {
    setSelectedPropertyFieldIds((current) => (
      checked
        ? Array.from(new Set([...current, fieldId]))
        : current.filter((id) => id !== fieldId)
    ));
  };

  const closeFlow = () => {
    setMode(null);
    setEditingToken(null);
  };
  const closeDroppedMention = () => setDroppedMention(null);

  const continueDroppedMention = (nextMode: InsertMode) => {
    if (droppedMention?.type === 'instance') {
      droppedInstanceIdRef.current = droppedMention.id;
      setSelectedInstanceId(droppedMention.id);
    }
    setMode(nextMode);
    setScope(nextMode === 'embed' ? 'properties' : 'instance');
    setEditingToken(null);
    setSelectedModelId('');
    setQuery('');
    setDroppedMention(null);
  };

  const handleInputActivity = useCallback(() => {
    if (!interactiveEmbedsPausedRef.current) {
      interactiveEmbedsPausedRef.current = true;
      setInteractiveEmbedsPaused(true);
    }
    if (interactiveResumeTimerRef.current) clearTimeout(interactiveResumeTimerRef.current);
    interactiveResumeTimerRef.current = setTimeout(() => {
      interactiveResumeTimerRef.current = null;
      interactiveEmbedsPausedRef.current = false;
      setInteractiveEmbedsPaused(false);
    }, 900);
  }, []);

  useEffect(() => () => {
    if (interactiveResumeTimerRef.current) clearTimeout(interactiveResumeTimerRef.current);
  }, []);

  const handleInsert = () => {
    if (!selectedInstance || !canInsert) return;

    const target: SemanticTarget = scope === 'content'
      ? { kind: 'instance_content', instanceId: selectedInstance.id }
      : scope === 'property' && selectedField
        ? { kind: 'instance_property', instanceId: selectedInstance.id, fieldId: selectedField.id }
        : scope === 'properties'
          ? {
              kind: 'instance_properties',
              instanceId: selectedInstance.id,
              fieldIds: selectedPropertyFieldIds.length > 0 ? selectedPropertyFieldIds : undefined,
            }
          : scope === 'interactive_view'
            ? { kind: 'interactive_view', instanceId: selectedInstance.id, templateId: selectedTemplateId }
            : { kind: 'object', objectType: 'instance', objectId: selectedInstance.id };

    const label = makeLabel(selectedInstance, scope, labelParts, selectedField, selectedTemplate);
    const serializedTarget = serializeSemanticTarget(target);
    const text = mode === 'embed'
      ? createEmbedToken({
        target: serializedTarget,
        label,
        projection: projectionForScope(scope),
        fieldLabels: scope === 'properties' ? selectedPropertyFields.map((field) => field.name) : undefined,
        modelId: selectedModelId || undefined,
      })
      : createMentionToken({
        target: serializedTarget,
        label,
        modelId: selectedModelId || undefined,
      });

    setInsertRequest({
      id: Date.now(),
      text,
      block: mode === 'embed',
      replaceFrom: editingToken?.token.from,
      replaceTo: editingToken?.token.to,
    });
    closeFlow();
  };

  return (
    <div
      ref={rootRef}
      className="relative min-h-[360px] bg-surface-editor"
      data-narre-mention-drop-target="true"
    >
      <div
        className="absolute top-6 z-[2] flex flex-col items-center gap-1 rounded-lg border border-subtle bg-surface-card p-0.5 shadow-sm"
        style={{ left: 'max(16px, calc((100% - 760px) / 2 - 56px))' }}
      >
        <IconButton
          label={t('netiorEditor.mentionAction')}
          tooltipPosition="right"
          className="h-8 w-8 rounded-md"
          onClick={() => openFlow('mention')}
        >
          <Link2 size={14} />
        </IconButton>
        <IconButton
          label={t('netiorEditor.embedAction')}
          tooltipPosition="right"
          className="h-8 w-8 rounded-md"
          onClick={() => openFlow('embed')}
        >
          <PanelTop size={14} />
        </IconButton>
      </div>

      <MarkdownEditor
        tabId={tabId}
        content={content}
        extensions={semanticExtensions}
        insertTextRequest={insertRequest}
        contentMaxWidth="760px"
        contentPadding="0.75rem 1.5rem 10rem 1.5rem"
        fillHeight={false}
        refreshKey={semanticDataVersion}
        needsTrailingEditableLine={needsTrailingSemanticEditableLine}
        onInputActivity={handleInputActivity}
        onChange={onChange}
      />

      <Modal
        open={mode !== null}
        onClose={closeFlow}
        title={editingToken
          ? t('netiorEditor.editTitle')
          : mode === 'embed'
            ? t('netiorEditor.embedTitle')
            : t('netiorEditor.mentionTitle')}
        width="min(92vw, 640px)"
        footer={(
          <>
            <Button type="button" variant="ghost" size="sm" onClick={closeFlow}>{t('common.cancel')}</Button>
            <Button type="button" size="sm" onClick={handleInsert} disabled={!canInsert}>{t('netiorEditor.insert')}</Button>
          </>
        )}
      >
        <div className="grid gap-4">
          <div className="flex items-center gap-2 rounded-lg border border-subtle bg-surface-input px-3 py-2">
            <Search size={14} className="shrink-0 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('netiorEditor.searchInstances')}
              className="w-full bg-transparent text-sm text-default outline-none placeholder:text-muted"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <div className="min-h-[220px] overflow-hidden rounded-lg border border-subtle bg-surface-panel">
              <div className="max-h-[260px] overflow-auto py-1">
                {filteredInstances.map((instance) => (
                  <button
                    key={instance.id}
                    ref={instance.id === selectedInstanceId ? selectedInstanceButtonRef : undefined}
                    type="button"
                    onClick={() => setSelectedInstanceId(instance.id)}
                    className={[
                      'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors',
                      selectedInstanceId === instance.id ? 'bg-state-selected text-accent' : 'text-default hover:bg-state-hover',
                    ].join(' ')}
                  >
                    <span className="min-w-0 truncate">{instance.title}</span>
                    {instance.schema_id && <span className="shrink-0 text-[10px] text-muted">{t('netiorEditor.schema')}</span>}
                  </button>
                ))}
                {filteredInstances.length === 0 && (
                  <div className="px-3 py-6 text-center text-xs text-muted">{t('netiorEditor.noInstances')}</div>
                )}
              </div>
            </div>

            <div className="grid content-start gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-secondary">{t('netiorEditor.target')}</label>
                <Select
                  selectSize="sm"
                  value={scope}
                  onChange={(event) => updateScope(event.target.value as TargetScope)}
                  options={mode === 'embed'
                    ? [
                        { value: 'instance', label: t('netiorEditor.targetInstance') },
                        { value: 'content', label: t('netiorEditor.targetContent') },
                        { value: 'properties', label: t('netiorEditor.targetProperties') },
                        { value: 'interactive_view', label: t('netiorEditor.targetInteractiveView') },
                      ]
                    : [
                        { value: 'instance', label: t('netiorEditor.targetInstance') },
                        { value: 'content', label: t('netiorEditor.targetContent') },
                        { value: 'property', label: t('netiorEditor.targetProperty') },
                        { value: 'properties', label: t('netiorEditor.targetProperties') },
                        { value: 'interactive_view', label: t('netiorEditor.targetInteractiveView') },
                      ]}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-secondary">{t('netiorEditor.relationshipModel')}</label>
                <Select
                  selectSize="sm"
                  searchable
                  value={selectedModelId}
                  onChange={(event) => setSelectedModelId(event.target.value)}
                  options={[
                    { value: '', label: t('netiorEditor.noRelationshipModel') },
                    ...models.map((model) => ({ value: model.id, label: display.modelName(model) })),
                  ]}
                  emptyMessage={t('netiorEditor.noRelationshipModels')}
                />
              </div>

              {scope === 'property' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-secondary">{t('netiorEditor.field')}</label>
                  <Select
                    selectSize="sm"
                    searchable
                    value={selectedFieldId}
                    onChange={(event) => setSelectedFieldId(event.target.value)}
                    options={fields.map((field) => ({ value: field.id, label: field.name }))}
                    emptyMessage={t('netiorEditor.noFields')}
                  />
                </div>
              )}

              {scope === 'properties' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-secondary">{t('netiorEditor.field')}</label>
                  <div className="max-h-36 overflow-auto rounded-md border border-subtle bg-surface-input p-2">
                    {fields.length > 0 ? (
                      <div className="grid gap-2">
                        {fields.map((field) => (
                          <Checkbox
                            key={field.id}
                            checked={selectedPropertyFieldIds.includes(field.id)}
                            onChange={(checked) => togglePropertyField(field.id, checked)}
                            label={field.name}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="px-1 py-3 text-center text-xs text-muted">{t('netiorEditor.noFields')}</div>
                    )}
                  </div>
                </div>
              )}

              {scope === 'interactive_view' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-secondary">{t('netiorEditor.view')}</label>
                  <Select
                    selectSize="sm"
                    searchable
                    value={selectedTemplateId}
                    onChange={(event) => setSelectedTemplateId(event.target.value)}
                    options={templates.map((template) => ({ value: template.id, label: template.name }))}
                    emptyMessage={t('netiorEditor.noViews')}
                  />
                </div>
              )}

            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={droppedMention !== null}
        onClose={closeDroppedMention}
        title={t('netiorEditor.dropTitle' as never)}
        width="min(92vw, 420px)"
        footer={(
          <>
            <Button type="button" variant="ghost" size="sm" onClick={closeDroppedMention}>{t('common.cancel')}</Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => continueDroppedMention('mention')}
              disabled={droppedMention?.type !== 'instance'}
            >
              {t('netiorEditor.mentionAction')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => continueDroppedMention('embed')}
              disabled={droppedMention?.type !== 'instance'}
            >
              {t('netiorEditor.embedAction')}
            </Button>
          </>
        )}
      >
        <div className="grid gap-2">
          <div className="rounded-lg border border-subtle bg-surface-panel px-3 py-2 text-sm text-default">
            {droppedMention?.display}
          </div>
          {droppedMention?.type !== 'instance' && (
            <div className="text-xs text-muted">{t('netiorEditor.dropInstanceOnly' as never)}</div>
          )}
        </div>
      </Modal>
    </div>
  );
}
