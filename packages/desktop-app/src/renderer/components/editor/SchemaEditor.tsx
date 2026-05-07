import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  SchemaMeaning,
  SchemaMeaningSlotBinding,
  EditorTab,
  SemanticCategoryRefKey,
  SemanticCategoryKey,
  SemanticMeaningKey,
  ModelKey,
  ModelRefKey,
  MeaningSlotKey,
} from '@netior/shared/types';
import {
  MODEL_DEFINITIONS,
  SEMANTIC_CATEGORY_LABELS,
  getSemanticCategoryDescriptionKey,
  getSemanticCategoryLabelKey,
  getModelDescriptionKey,
  getModelLabelKey,
  getMeaningSlotDefinition,
  getMeaningSlotLabelKey,
  fieldMeaningToMeaningBindings,
} from '@netior/shared/constants';
import { useSchemaStore } from '../../stores/schema-store';
import { useEditorStore } from '../../stores/editor-store';
import { useModelStore } from '../../stores/model-store';
import { useEditorSession } from '../../hooks/useEditorSession';
import { useI18n } from '../../hooks/useI18n';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';
import { IconSelector } from '../ui/IconSelector';
import { RadioGroup } from '../ui/RadioGroup';
import { FilePicker } from '../ui/FilePicker';
import { ColorPicker } from '../ui/ColorPicker';
import { Select } from '../ui/Select';
import { ScrollArea } from '../ui/ScrollArea';
import { SchemaSlotDesigner, type ModelCategoryOption, type ModelOptionDefinition } from './SchemaSlotDesigner';
import { useSettingsStore } from '../../stores/settings-store';
import { useUIStore } from '../../stores/ui-store';
import { stringifySchemaFieldOptions } from '../../lib/schema-field-options';
import { getFieldMeaningSlot } from '../../lib/field-meaning-bindings';
import {
  NetworkObjectEditorShell,
  NetworkObjectEditorSection,
  NetworkObjectMetadataList,
} from './NetworkObjectEditorShell';
import { isImageSourceValue } from '../workspace/node-components/node-visual-utils';
import { NodeVisual } from '../workspace/node-components/NodeVisual';

interface SchemaEditorProps {
  tab: EditorTab;
}

interface SchemaState {
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  node_shape: string | null;
  file_template: string | null;
  models: ModelRefKey[];
}

const EMPTY_SCHEMA_STATE: SchemaState = {
  name: '',
  description: null,
  icon: null,
  color: null,
  node_shape: null,
  file_template: null,
  models: [],
};

const EMPTY_LIST: never[] = [];
const IMAGE_FILE_FILTERS = [
  { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'] },
] as const;

type VisualMode = 'icon' | 'image';

function normalizeModelRefs(value: unknown): ModelRefKey[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is ModelRefKey => typeof item === 'string');
  }

  if (typeof value === 'string') {
    try {
      return normalizeModelRefs(JSON.parse(value));
    } catch {
      return value.trim() ? [value as ModelRefKey] : [];
    }
  }

  return [];
}

function isBuiltInSemanticCategory(value: SemanticCategoryRefKey): value is SemanticCategoryKey {
  return Object.prototype.hasOwnProperty.call(SEMANTIC_CATEGORY_LABELS, value);
}

function getCategoryKeyFromModelSource(sourceRef?: string | null): SemanticCategoryRefKey {
  const prefix = 'model-category.';
  if (sourceRef?.startsWith(prefix)) {
    return sourceRef.slice(prefix.length) as SemanticCategoryRefKey;
  }
  return 'knowledge';
}

function getDefaultFieldOptionsForSlot(slot: MeaningSlotKey): string | null {
  switch (slot) {
    case 'recurrence_frequency':
      return stringifySchemaFieldOptions({ choices: ['daily', 'weekly', 'monthly'] });
    case 'recurrence_weekdays':
      return stringifySchemaFieldOptions({ choices: ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] });
    default:
      return null;
  }
}

function getAutoCreateBindingsForMeaning(meaning: SchemaMeaning): SchemaMeaningSlotBinding[] {
  const slots = Array.isArray(meaning.slots) ? meaning.slots : [];
  if (meaning.meaning_key === 'recurrence') return slots;
  return slots.filter((slot) => slot.required);
}

export function SchemaEditor({ tab }: SchemaEditorProps): JSX.Element {
  const { t } = useI18n();
  const schemaId = tab.targetId;
  const rawSchemas = useSchemaStore((s) => s.schemas);
  const rawFields = useSchemaStore((s) => s.fields[schemaId]);
  const rawMeanings = useSchemaStore((s) => s.meanings[schemaId]);
  const rawProjectModels = useModelStore((s) => s.models);
  const loadModels = useModelStore((s) => s.loadByProject);
  const {
    loadFields,
    loadMeanings,
    createField,
    updateField,
    deleteField,
    ensureMeaning,
    updateMeaningSlot,
    deleteMeaning,
  } = useSchemaStore();
  const updateSchema = useSchemaStore((s) => s.updateSchema);
  const fieldComplexityLevel = useSettingsStore((s) => s.fieldComplexityLevel);
  const setShowSettings = useUIStore((s) => s.setShowSettings);
  const [activeSemanticCategory, setActiveSemanticCategory] = useState<SemanticCategoryRefKey>('time');
  const [visualMode, setVisualMode] = useState<VisualMode>('icon');
  const schemas = Array.isArray(rawSchemas) ? rawSchemas : EMPTY_LIST;
  const fields = Array.isArray(rawFields) ? rawFields : EMPTY_LIST;
  const meanings = Array.isArray(rawMeanings) ? rawMeanings : EMPTY_LIST;
  const projectModels = Array.isArray(rawProjectModels) ? rawProjectModels : EMPTY_LIST;

  const schema = schemas.find((a) => a.id === schemaId);

  useEffect(() => {
    loadFields(schemaId);
    loadMeanings(schemaId);
  }, [schemaId, loadFields, loadMeanings]);

  useEffect(() => {
    if (schema?.project_id) {
      void loadModels(schema.project_id);
    }
  }, [schema?.project_id, loadModels]);

  const session = useEditorSession<SchemaState>({
    tabId: tab.id,
    load: () => {
      const schemas = useSchemaStore.getState().schemas;
      const a = (Array.isArray(schemas) ? schemas : []).find((ar) => ar.id === schemaId);
      if (!a) return EMPTY_SCHEMA_STATE;
      return {
        name: a.name,
        description: a.description,
        icon: a.icon,
        color: a.color,
        node_shape: a.node_shape,
        file_template: a.file_template,
        models: normalizeModelRefs(a.models),
      };
    },
    save: async (state) => {
      await updateSchema(schemaId, {
        ...state,
        models: normalizeModelRefs(state.models),
      });
      useEditorStore.getState().updateTitle(tab.id, state.name);
    },
    deps: [schemaId],
  });
  const editorState = session.state ?? EMPTY_SCHEMA_STATE;
  useEffect(() => {
    if (isImageSourceValue(editorState.icon)) {
      setVisualMode('image');
    } else if (editorState.icon) {
      setVisualMode('icon');
    }
  }, [editorState.icon]);
  const selectedModels = useMemo(
    () => normalizeModelRefs(editorState.models),
    [editorState.models],
  );
  const modelDefinitions = useMemo<readonly ModelOptionDefinition[]>(() => {
    const schemaModels = projectModels.filter((model) => (
      model.target_kind === 'object' || model.target_kind === 'both'
    ));
    if (schemaModels.length > 0) {
      return schemaModels.map((model) => ({
        key: model.key,
        category: getCategoryKeyFromModelSource(model.category_concept_source_ref),
        label: model.built_in ? t(getModelLabelKey(model.key as ModelKey) as never) : model.name,
        description: model.built_in ? t(getModelDescriptionKey(model.key as ModelKey) as never) : model.description,
        meanings: model.meaning_keys,
        coreSlots: model.core_slots,
        optionalSlots: model.optional_slots,
        builtIn: model.built_in,
      }));
    }

    return MODEL_DEFINITIONS.filter((definition) => (
      (definition.targetKind ?? 'object') === 'object' || definition.targetKind === 'both'
    )).map((definition) => ({
      key: definition.key,
      category: definition.category,
      label: t(getModelLabelKey(definition.key) as never),
      description: t(getModelDescriptionKey(definition.key) as never),
      meanings: definition.meanings,
      coreSlots: definition.coreSlots,
      optionalSlots: definition.optionalSlots,
      builtIn: true,
    }));
  }, [projectModels, t]);
  const modelCategories = useMemo<readonly ModelCategoryOption[]>(() => {
    const categoryByKey = new Map<SemanticCategoryRefKey, ModelCategoryOption>();
    const getCategoryOption = (key: SemanticCategoryRefKey, fallbackLabel: string): ModelCategoryOption => {
      if (isBuiltInSemanticCategory(key)) {
        return {
          key,
          label: t(getSemanticCategoryLabelKey(key) as never),
          description: t(getSemanticCategoryDescriptionKey(key) as never),
        };
      }
      return {
        key,
        label: fallbackLabel,
      };
    };

    for (const definition of modelDefinitions) {
      if (!categoryByKey.has(definition.category)) {
        categoryByKey.set(definition.category, getCategoryOption(definition.category, definition.category));
      }
    }

    for (const model of projectModels) {
      const categoryKey = getCategoryKeyFromModelSource(model.category_concept_source_ref);
      if ((model.target_kind === 'object' || model.target_kind === 'both') && !categoryByKey.has(categoryKey)) {
        categoryByKey.set(categoryKey, getCategoryOption(categoryKey, model.category_concept_title ?? categoryKey));
      }
    }

    return [...categoryByKey.values()];
  }, [modelDefinitions, projectModels, t]);
  const modelDefinitionByKey = useMemo(
    () => new Map(modelDefinitions.map((definition) => [definition.key, definition])),
    [modelDefinitions],
  );
  const creatingSlotRef = useRef(new Set<string>());

  const update = (patch: Partial<SchemaState>) => {
    session.setState((prev) => ({ ...prev, ...patch }));
  };

  const visualModeOptions = useMemo(() => [
    { value: 'icon', label: t('concept.visualModeOptions.icon' as never) },
    { value: 'image', label: t('concept.visualModeOptions.image' as never) },
  ], [t]);

  const handleVisualModeChange = (mode: VisualMode) => {
    setVisualMode(mode);
    if ((isImageSourceValue(editorState.icon) ? 'image' : 'icon') !== mode) {
      update({ icon: null });
    }
  };

  const handleEnsureMeaning = useCallback(async (
    meaning: SemanticMeaningKey,
    options: { sourceModel?: ModelRefKey | null } = {},
  ) => {
    useEditorStore.getState().setDirty(tab.id, true);
    await ensureMeaning({
      schema_id: schemaId,
      meaning_key: meaning,
      source: options.sourceModel ? 'model' : 'manual',
      source_model: options.sourceModel ?? null,
    });
  }, [schemaId, ensureMeaning, tab.id]);

  const handleCreateFieldForSlot = useCallback(async (
    binding: SchemaMeaningSlotBinding,
    meaning: { source: string; source_model?: ModelRefKey | null },
    options: { markEditorDirty?: boolean } = {},
  ) => {
    const slot = binding.slot_key;
    const slotCreationKey = `${schemaId}:${slot}`;
    if (creatingSlotRef.current.has(slotCreationKey)) return;

    const currentFieldsRaw = useSchemaStore.getState().fields[schemaId];
    const currentFields = Array.isArray(currentFieldsRaw) ? currentFieldsRaw : [];
    const existingField = binding.field_id
      ? currentFields.find((field) => field.id === binding.field_id)
      : currentFields.find((field) => getFieldMeaningSlot(field) === slot);
    if (existingField) {
      await updateMeaningSlot(binding.id, schemaId, {
        target_kind: 'field',
        field_id: existingField.id,
      });
      return;
    }

    const slotDefinition = getMeaningSlotDefinition(slot);
    if (!slotDefinition) return;

    if (options.markEditorDirty !== false) {
      useEditorStore.getState().setDirty(tab.id, true);
    }
    creatingSlotRef.current.add(slotCreationKey);
    try {
      const field = await createField({
        schema_id: schemaId,
        name: t(getMeaningSlotLabelKey(slot) as never),
        field_type: slotDefinition.allowedFieldTypes[0],
        options: getDefaultFieldOptionsForSlot(slot) ?? undefined,
        sort_order: currentFields.length,
        required: binding.required,
        meaning_slot: slot,
        meaning_key: slotDefinition.fieldMeaning,
        meaning_bindings: fieldMeaningToMeaningBindings(slotDefinition.fieldMeaning),
        slot_binding_locked: true,
        generated_by_model: meaning.source === 'model' || Boolean(meaning.source_model),
      });
      await updateMeaningSlot(binding.id, schemaId, {
        target_kind: 'field',
        field_id: field.id,
      });
    } finally {
      creatingSlotRef.current.delete(slotCreationKey);
    }
  }, [schemaId, createField, t, tab.id, updateMeaningSlot]);

  const handleCreateField = useCallback(async () => {
    const currentFieldsRaw = useSchemaStore.getState().fields[schemaId];
    const currentFields = Array.isArray(currentFieldsRaw) ? currentFieldsRaw : [];
    useEditorStore.getState().setDirty(tab.id, true);
    await createField({
      schema_id: schemaId,
      name: t('schema.fieldName'),
      field_type: 'text',
      sort_order: currentFields.length,
      required: false,
      meaning_bindings: [],
      slot_binding_locked: false,
      generated_by_model: false,
    });
  }, [schemaId, createField, t, tab.id]);

  const handleBindFieldToSlot = useCallback(async (
    binding: SchemaMeaningSlotBinding,
    fieldId: string,
  ) => {
    useEditorStore.getState().setDirty(tab.id, true);
    await updateMeaningSlot(binding.id, schemaId, {
      target_kind: 'field',
      field_id: fieldId,
    });
  }, [schemaId, tab.id, updateMeaningSlot]);

  const handleDeleteMeaning = useCallback(async (meaningId: string) => {
    useEditorStore.getState().setDirty(tab.id, true);
    await deleteMeaning(meaningId, schemaId);
  }, [deleteMeaning, schemaId, tab.id]);

  const handleUpdateField = useCallback(
    (id: string, data: Parameters<typeof updateField>[2]) => {
      useEditorStore.getState().setDirty(tab.id, true);
      updateField(id, schemaId, data);
    },
    [schemaId, tab.id, updateField],
  );

  const handleDeleteField = useCallback(
    (id: string) => {
      useEditorStore.getState().setDirty(tab.id, true);
      deleteField(id, schemaId);
    },
    [schemaId, tab.id, deleteField],
  );

  const handleToggleModel = useCallback(async (model: ModelRefKey, checked: boolean) => {
    const nextModels = checked
      ? [...new Set([...selectedModels, model])]
      : selectedModels.filter((item) => item !== model);

    useEditorStore.getState().setDirty(tab.id, true);
    session.setState((prev) => ({ ...prev, models: nextModels }));

    if (!checked) return;

    const modelDefinition = modelDefinitionByKey.get(model);
    if (!modelDefinition) return;

    for (const meaningKey of modelDefinition.meanings) {
      await ensureMeaning({
        schema_id: schemaId,
        meaning_key: meaningKey,
        source: 'model',
        source_model: model,
      });
    }
  }, [schemaId, ensureMeaning, modelDefinitionByKey, selectedModels, session, tab.id]);

  const nodeShapeOptions = [
    { value: 'rectangle', label: t('schema.rectangle') },
    { value: 'rounded', label: t('schema.rounded') },
    { value: 'circle', label: t('schema.circle') },
    { value: 'diamond', label: t('schema.diamond') },
    { value: 'hexagon', label: t('schema.hexagon') },
    { value: 'parallelogram', label: t('schema.parallelogram') },
    { value: 'cylinder', label: t('schema.cylinder') },
    { value: 'stadium', label: t('schema.stadium') },
  ];

  if (!schema) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted">
        {t('schema.notFound')}
      </div>
    );
  }

  if (session.isLoading) return <></>;

  return (
    <ScrollArea className="h-full min-h-0">
      <NetworkObjectEditorShell
        badge={t('schema.title')}
        title={editorState.name || schema.name}
        subtitle={t('editorShell.networkObject' as never)}
        description={t('schema.descriptionPlaceholder')}
        leadingVisual={<NodeVisual icon={editorState.icon ?? 'boxes'} size={24} imageSize={56} className="shrink-0" />}
      >
        <NetworkObjectEditorSection title={t('editorShell.overview' as never)}>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">{t('schema.name')}</label>
            <Input
              value={editorState.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">{t('schema.description')}</label>
            <TextArea
              value={editorState.description ?? ''}
              onChange={(e) => update({ description: e.target.value || null })}
              rows={4}
              placeholder={t('schema.descriptionPlaceholder')}
            />
          </div>
        </NetworkObjectEditorSection>

        <NetworkObjectEditorSection title={t('schema.visualDefaults')}>
          <div className="flex flex-col gap-2">
            <span className="text-xs text-secondary">{t('concept.visual' as never)}</span>
            <RadioGroup
              options={visualModeOptions}
              value={visualMode}
              onChange={(value) => handleVisualModeChange(value as VisualMode)}
              orientation="horizontal"
            />
            {visualMode === 'image' ? (
              <FilePicker
                value={isImageSourceValue(editorState.icon) ? editorState.icon ?? '' : ''}
                onChange={(path) => update({ icon: path || null })}
                placeholder={t('concept.selectProfileImage' as never)}
                filters={[...IMAGE_FILE_FILTERS]}
              />
            ) : (
              <IconSelector
                value={editorState.icon ?? undefined}
                onChange={(icon) => update({ icon })}
              />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs text-secondary">{t('schema.color')}</span>
            <ColorPicker
              value={editorState.color ?? undefined}
              onChange={(color) => update({ color })}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs text-secondary">{t('schema.nodeShape')}</span>
            <Select
              options={nodeShapeOptions}
              value={editorState.node_shape ?? ''}
              onChange={(e) => update({ node_shape: e.target.value || null })}
              placeholder={t('schema.nodeShapePlaceholder')}
              selectSize="sm"
            />
          </div>
        </NetworkObjectEditorSection>

        <NetworkObjectEditorSection title={t('schema.fileTemplate')} defaultOpen={false}>
          <TextArea
            value={editorState.file_template ?? ''}
            onChange={(e) => update({ file_template: e.target.value || null })}
            rows={6}
            placeholder={t('schema.fileTemplatePlaceholder')}
            className="font-mono text-xs"
          />
        </NetworkObjectEditorSection>

        <NetworkObjectEditorSection title={t('schema.propertySchema')}>
          <SchemaSlotDesigner
            tabId={tab.id}
            fields={fields}
            meanings={meanings}
            selectedModels={selectedModels}
            modelDefinitions={modelDefinitions}
            modelCategories={modelCategories}
            activeCategory={activeSemanticCategory}
            fieldComplexityLevel={fieldComplexityLevel}
            onActiveCategoryChange={setActiveSemanticCategory}
            onToggleModel={handleToggleModel}
            onEnsureMeaning={handleEnsureMeaning}
            onCreateFieldForSlot={handleCreateFieldForSlot}
            onBindFieldToSlot={handleBindFieldToSlot}
            onCreateField={handleCreateField}
            onDeleteMeaning={handleDeleteMeaning}
            onUpdateField={handleUpdateField}
            onDeleteField={handleDeleteField}
            onOpenSettings={() => setShowSettings(true)}
          />
        </NetworkObjectEditorSection>

        <NetworkObjectEditorSection title={t('editorShell.metadata' as never)} defaultOpen={false}>
          <NetworkObjectMetadataList
            items={[
              { label: t('editorShell.objectId' as never), value: <code className="font-mono text-xs">{schema.id}</code> },
            ]}
          />
        </NetworkObjectEditorSection>
      </NetworkObjectEditorShell>
    </ScrollArea>
  );
}
