import React, { useEffect, useMemo, useState } from 'react';
import type {
  Instance,
  Meaning,
  SchemaField,
  EditorTab,
  FieldType,
  SemanticMeaningKey,
  MeaningKey,
  MeaningFieldRecipe,
  MeaningAspectRecipe,
  MeaningContract,
  MeaningRefKey,
  MeaningRepresentationKind,
  MeaningRuleRecipe,
  MeaningTargetKind,
  MeaningSlotKey,
} from '@netior/shared/types';
import {
  getSemanticMeaningDescriptionKey,
  getSemanticMeaningLabelKey,
  getMeaningSlotDescriptionKey,
  getMeaningSlotLabelKey,
  MEANING_DEFINITIONS,
  MEANING_CATEGORY_SCHEMA_SOURCE_REF,
} from '@netior/shared/constants';
import { Plus, Trash2 } from 'lucide-react';
import { useMeaningStore } from '../../stores/meaning-store';
import { useSchemaStore } from '../../stores/schema-store';
import { useInstanceStore } from '../../stores/instance-store';
import { useProjectStore } from '../../stores/project-store';
import { useEditorStore } from '../../stores/editor-store';
import { useEditorSession } from '../../hooks/useEditorSession';
import { useI18n } from '../../hooks/useI18n';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';
import { Select } from '../ui/Select';
import { ColorPicker } from '../ui/ColorPicker';
import { IconSelector } from '../ui/IconSelector';
import { FilePicker } from '../ui/FilePicker';
import { RadioGroup } from '../ui/RadioGroup';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Toggle } from '../ui/Toggle';
import { ScrollArea } from '../ui/ScrollArea';
import {
  NetworkObjectEditorShell,
  NetworkObjectEditorSection,
  NetworkObjectMetadataList,
} from './NetworkObjectEditorShell';
import { getFieldMeaningSlot } from '../../lib/field-meaning-bindings';
import { createOntologyDisplayResolver } from '@netior/shared';
import { isImageSourceValue } from '../workspace/node-components/node-visual-utils';
import { NodeVisual } from '../workspace/node-components/NodeVisual';

interface MeaningEditorProps {
  tab: EditorTab;
}

interface MeaningEditorState {
  key: MeaningRefKey;
  name: string;
  description: string | null;
  category_instance_id: string | null;
  target_kind: MeaningTargetKind;
  meaning_keys: SemanticMeaningKey[];
  core_slots: MeaningSlotKey[];
  optional_slots: MeaningSlotKey[];
  recipe: MeaningContract;
  color: string | null;
  icon: string | null;
  built_in: boolean;
}

interface MeaningConsumer {
  meaning: Meaning;
  linkedToMeaning: boolean;
  meaningKeys: SemanticMeaningKey[];
  fields: SchemaField[];
}

const EMPTY_MEANING_STATE: MeaningEditorState = {
  key: 'meaning',
  name: '',
  description: null,
  category_instance_id: null,
  target_kind: 'object',
  meaning_keys: [],
  core_slots: [],
  optional_slots: [],
  recipe: { meanings: [], rules: [] },
  color: null,
  icon: null,
  built_in: false,
};

const REPRESENTATION_OPTIONS: Array<{ value: MeaningRepresentationKind; labelKey: string }> = [
  { value: 'single_field', labelKey: 'meaning.representation.singleField' },
  { value: 'field_group', labelKey: 'meaning.representation.fieldGroup' },
  { value: 'relation', labelKey: 'meaning.representation.relation' },
  { value: 'computed', labelKey: 'meaning.representation.computed' },
];

const FIELD_TYPE_OPTIONS: Array<{ value: FieldType; labelKey: string }> = [
  { value: 'text', labelKey: 'typeSelector.text' },
  { value: 'textarea', labelKey: 'typeSelector.textarea' },
  { value: 'number', labelKey: 'typeSelector.number' },
  { value: 'boolean', labelKey: 'typeSelector.boolean' },
  { value: 'date', labelKey: 'typeSelector.dateType' },
  { value: 'datetime', labelKey: 'typeSelector.datetime' },
  { value: 'select', labelKey: 'typeSelector.select' },
  { value: 'multi-select', labelKey: 'typeSelector.multi-select' },
  { value: 'radio', labelKey: 'typeSelector.radio' },
  { value: 'relation', labelKey: 'typeSelector.relation' },
  { value: 'file', labelKey: 'typeSelector.file' },
  { value: 'url', labelKey: 'typeSelector.url' },
  { value: 'color', labelKey: 'typeSelector.color' },
  { value: 'rating', labelKey: 'typeSelector.rating' },
  { value: 'tags', labelKey: 'typeSelector.tags' },
  { value: 'meaning_ref', labelKey: 'typeSelector.meaning_ref' },
];

const TARGET_KIND_OPTIONS: Array<{ value: MeaningTargetKind; labelKey: string }> = [
  { value: 'object', labelKey: 'meaning.targetKind.object' },
  { value: 'relation', labelKey: 'meaning.targetKind.relation' },
  { value: 'both', labelKey: 'meaning.targetKind.both' },
];

const ADD_CATEGORY_OPTION_VALUE = '__add_meaning_category__';
const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
const IMAGE_FILE_FILTERS = [
  { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'] },
] as const;

type VisualMode = 'icon' | 'image';

function createLocalId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatKeyInput(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_');
}

function normalizeKey(value: string, fallback: string): string {
  const normalized = formatKeyInput(value).replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

function isValidQueryKey(value: string): boolean {
  return KEY_PATTERN.test(value);
}

function getNextKey(prefix: string, existingKeys: readonly string[]): string {
  const used = new Set(existingKeys);
  let index = 1;
  let candidate = `${prefix}_${index}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `${prefix}_${index}`;
  }
  return candidate;
}

function shouldSyncKeyFromName(currentKey: string, previousName: string, fallbackKey: string): boolean {
  return !currentKey || currentKey === fallbackKey || currentKey === normalizeKey(previousName, fallbackKey);
}

function countKeys(keys: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const key of keys) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function hasInvalidRecipeKeys(recipe: MeaningContract): boolean {
  const activeMeanings = recipe.meanings.filter((meaning) => meaning.name.trim().length > 0);
  const meaningKeyCounts = countKeys(activeMeanings.map((meaning) => meaning.key));
  return activeMeanings.some((meaning) => {
    const activeFields = meaning.fields.filter((field) => field.name.trim().length > 0);
    const fieldKeyCounts = countKeys(activeFields.map((field) => field.key));
    return (
    !isValidQueryKey(meaning.key)
    || (meaningKeyCounts.get(meaning.key) ?? 0) > 1
    || activeFields.some((field) => (
      !isValidQueryKey(field.key) || (fieldKeyCounts.get(field.key) ?? 0) > 1
    ))
    );
  });
}

function normalizeRecipe(recipe: MeaningContract): MeaningContract {
  return {
    meanings: recipe.meanings
      .map((meaning, meaningIndex) => ({
        ...meaning,
        id: meaning.id || createLocalId('meaning'),
        key: normalizeKey(meaning.key || meaning.name, `meaning_${meaningIndex + 1}`),
        name: meaning.name.trim(),
        description: meaning.description?.trim() || null,
        fields: meaning.fields
          .map((field, fieldIndex) => ({
            ...field,
            id: field.id || createLocalId('field'),
            key: normalizeKey(field.key || field.name, `field_${fieldIndex + 1}`),
            name: field.name.trim(),
            field_types: (field.field_types?.length ?? 0) > 0 ? field.field_types : ['text' as FieldType],
            description: field.description?.trim() || null,
            options: field.options?.trim() || null,
          }))
          .filter((field) => field.name.length > 0),
      }))
      .filter((meaning) => meaning.name.length > 0),
    rules: recipe.rules
      .map((rule) => ({
        ...rule,
        id: rule.id || createLocalId('rule'),
        description: rule.description.trim(),
      }))
      .filter((rule) => rule.description.length > 0),
  };
}

function makeEmptyMeaning(existingKeys: readonly string[] = []): MeaningAspectRecipe {
  return {
    id: createLocalId('meaning'),
    key: getNextKey('meaning', existingKeys),
    name: '',
    description: null,
    representation: 'field_group',
    fields: [],
  };
}

function makeEmptyField(existingKeys: readonly string[] = []): MeaningFieldRecipe {
  return {
    id: createLocalId('field'),
    key: getNextKey('field', existingKeys),
    name: '',
    field_types: ['text'],
    required: false,
    description: null,
    options: null,
  };
}

function makeEmptyRule(): MeaningRuleRecipe {
  return {
    id: createLocalId('rule'),
    description: '',
  };
}

function normalizeMeaningRefs(value: unknown): MeaningRefKey[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is MeaningRefKey => typeof item === 'string' && item.trim().length > 0);
  }

  if (typeof value === 'string') {
    try {
      return normalizeMeaningRefs(JSON.parse(value));
    } catch {
      return value.trim() ? [value as MeaningRefKey] : [];
    }
  }

  return [];
}

function getMeaningCategorySourceKey(instance: Instance): string | null {
  const prefix = 'meaning-category.';
  return instance.source_ref?.startsWith(prefix) ? instance.source_ref.slice(prefix.length) : null;
}

function makeMeaningCategoryDisplaySource(instance: Instance) {
  return {
    kind: 'instance' as const,
    title: instance.title,
    description: null,
    source_kind: instance.source_kind,
    source_ref: instance.source_ref,
  };
}

export function MeaningEditor({ tab }: MeaningEditorProps): JSX.Element {
  const { t } = useI18n();
  const display = useMemo(() => createOntologyDisplayResolver(t), [t]);
  const meaningId = tab.targetId;
  const meanings = useMeaningStore((s) => s.meanings);
  const loadMeanings = useMeaningStore((s) => s.loadByProject);
  const saveMeaning = useMeaningStore((s) => s.updateMeaning);
  const deleteMeaning = useMeaningStore((s) => s.deleteMeaning);
  const currentProject = useProjectStore((s) => s.currentProject);
  const instances = useInstanceStore((s) => s.instances);
  const loadInstances = useInstanceStore((s) => s.loadByProject);
  const createInstance = useInstanceStore((s) => s.createInstance);
  const schemas = useSchemaStore((s) => s.schemas);
  const loadSchemas = useSchemaStore((s) => s.loadByProject);
  const fieldsByMeaning = useSchemaStore((s) => s.fields);
  const meaningsByMeaning = useSchemaStore((s) => s.meanings);
  const loadMeaningFields = useSchemaStore((s) => s.loadFields);
  const loadMeaningAspects = useSchemaStore((s) => s.loadMeanings);
  const meaning = meanings.find((item) => item.id === meaningId);
  const projectId = meaning?.project_id ?? tab.projectId ?? currentProject?.id ?? null;
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showCategoryCreator, setShowCategoryCreator] = useState(false);
  const [visualMode, setVisualMode] = useState<VisualMode>('icon');

  useEffect(() => {
    if (projectId) {
      void loadMeanings(projectId);
      void loadSchemas(projectId);
      void loadInstances(projectId);
    }
  }, [loadInstances, loadMeanings, loadSchemas, projectId]);

  const projectMeanings = useMemo(
    () => meanings.filter((meaning) => !projectId || meaning.project_id === projectId),
    [projectId, meanings],
  );
  const projectMeaningIdsKey = useMemo(
    () => projectMeanings.map((meaning) => meaning.id).sort().join('|'),
    [projectMeanings],
  );

  useEffect(() => {
    if (!projectMeaningIdsKey) return;

    let cancelled = false;
    void (async () => {
      for (const meaning of projectMeanings) {
        if (cancelled) return;
        await Promise.all([
          loadMeaningFields(meaning.id),
          loadMeaningAspects(meaning.id),
        ]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadMeaningFields, loadMeaningAspects, projectMeaningIdsKey, projectMeanings]);

  const session = useEditorSession<MeaningEditorState>({
    tabId: tab.id,
    load: () => {
      const current = useMeaningStore.getState().meanings.find((item) => item.id === meaningId);
      if (!current) return EMPTY_MEANING_STATE;
      return {
        key: current.key,
        name: current.name,
        description: current.description,
        category_instance_id: current.category_instance_id,
        target_kind: current.target_kind,
        meaning_keys: current.meaning_keys,
        core_slots: current.core_slots,
        optional_slots: current.optional_slots,
        recipe: current.recipe ?? { meanings: [], rules: [] },
        color: current.color,
        icon: current.icon,
        built_in: current.built_in,
      };
    },
    save: async (state) => {
      const normalizedRecipe = normalizeRecipe(state.recipe);
      const meaningKey = String(state.key) as MeaningRefKey;
      const duplicateMeaningKey = meanings.some((item) => item.id !== meaningId && item.key === meaningKey);
      if (!isValidQueryKey(meaningKey) || duplicateMeaningKey || hasInvalidRecipeKeys(state.recipe)) {
        throw new Error('Invalid meaning query keys');
      }
      await saveMeaning(meaningId, {
        key: meaningKey,
        name: state.name,
        description: state.description,
        category_instance_id: state.category_instance_id,
        target_kind: state.target_kind,
        meaning_keys: state.meaning_keys,
        core_slots: state.core_slots,
        optional_slots: state.optional_slots,
        recipe: normalizedRecipe,
        color: state.color,
        icon: state.icon,
        built_in: state.built_in,
      });
      const nextDisplayMeaning = {
        ...meaning,
        key: meaningKey as MeaningKey,
        name: state.name,
        description: state.description,
        target_kind: state.target_kind,
        built_in: state.built_in,
        source_kind: meaning?.source_kind ?? 'project',
        source_ref: meaning?.source_ref ?? null,
      };
      useEditorStore.getState().updateTitle(tab.id, display.meaningName(nextDisplayMeaning) || t('meaning.title' as never));
    },
    deps: [meaningId],
  });
  const currentEditorState = session.state ?? EMPTY_MEANING_STATE;

  useEffect(() => {
    if (isImageSourceValue(currentEditorState.icon)) {
      setVisualMode('image');
    } else if (currentEditorState.icon) {
      setVisualMode('icon');
    }
  }, [currentEditorState.icon]);

  const meaningConsumers = useMemo<MeaningConsumer[]>(() => {
    if (!meaning) return [];

    const meaningKey = meaning.key;
    const meaningSlotKeys = new Set<MeaningSlotKey>([
      ...meaning.core_slots,
      ...meaning.optional_slots,
    ]);

    return projectMeanings.flatMap((meaning) => {
      const meaningRefs = normalizeMeaningRefs((meaning as unknown as { meanings?: unknown }).meanings);
      const linkedToMeaning = meaningRefs.includes(meaningKey);
      const sourceMeanings = meaningsByMeaning[meaning.id] ?? [];
      const linkedMeanings = sourceMeanings.filter((meaning) => (
        meaning.source_meaning === meaningKey
      ));
      const meaningKeys = [...new Set(linkedMeanings.map((meaning) => meaning.meaning_key))];
      const boundFieldIds = new Set(
        linkedMeanings.flatMap((meaning) => (
          meaning.slots.map((slot) => slot.field_id).filter((fieldId): fieldId is string => Boolean(fieldId))
        )),
      );
      const meaningFields = fieldsByMeaning[meaning.id] ?? [];
      const fieldById = new Map(meaningFields.map((field) => [field.id, field]));
      const fields = [
        ...[...boundFieldIds].map((fieldId) => fieldById.get(fieldId)).filter((field): field is SchemaField => Boolean(field)),
        ...meaningFields.filter((field) => (
          linkedToMeaning
          && Boolean(getFieldMeaningSlot(field) && meaningSlotKeys.has(getFieldMeaningSlot(field)!))
          && !boundFieldIds.has(field.id)
        )),
      ].sort((a, b) => a.sort_order - b.sort_order);

      if (!linkedToMeaning && meaningKeys.length === 0 && fields.length === 0) return [];

      return [{
        meaning,
        linkedToMeaning,
        meaningKeys,
        fields,
      }];
    });
  }, [fieldsByMeaning, meaningsByMeaning, meaning, projectMeanings]);

  const fieldTypeLabelByValue = useMemo(
    () => new Map(FIELD_TYPE_OPTIONS.map((option) => [option.value, t(option.labelKey as never)])),
    [t],
  );
  const meaningCategorySchema = useMemo(() => (
    schemas.find((schema) => (
      schema.project_id === projectId
      && schema.source_ref === MEANING_CATEGORY_SCHEMA_SOURCE_REF
    )) ?? null
  ), [projectId, schemas]);
  const meaningCategoryInstances = useMemo(() => (
    instances
      .filter((instance) => (
        instance.project_id === projectId
        && (
          instance.schema_id === meaningCategorySchema?.id
          || instance.source_ref?.startsWith('meaning-category.')
        )
      ))
      .sort((a, b) => {
        const aKey = getMeaningCategorySourceKey(a) ?? a.title;
        const bKey = getMeaningCategorySourceKey(b) ?? b.title;
        return aKey.localeCompare(bKey);
      })
  ), [instances, meaningCategorySchema?.id, projectId]);
  const meaningCategoryOptions = useMemo(() => {
    const optionByValue = new Map(meaningCategoryInstances.map((instance) => [instance.id, {
      value: instance.id,
      label: display.name(makeMeaningCategoryDisplaySource(instance)),
    }]));
    if (currentEditorState.category_instance_id && !optionByValue.has(currentEditorState.category_instance_id)) {
      optionByValue.set(currentEditorState.category_instance_id, {
        value: currentEditorState.category_instance_id,
        label: meaning?.category_instance_source_ref
          ? display.name({
            kind: 'instance',
            title: meaning.category_instance_title ?? currentEditorState.category_instance_id,
            source_ref: meaning.category_instance_source_ref,
          })
          : meaning?.category_instance_title ?? currentEditorState.category_instance_id,
      });
    }
    return [
      { value: '', label: t('meaning.categoryPlaceholder' as never) },
      ...optionByValue.values(),
      {
        value: ADD_CATEGORY_OPTION_VALUE,
        label: t('meaning.addCategory' as never),
      },
    ];
  }, [
    currentEditorState.category_instance_id,
    display,
    meaning?.category_instance_source_ref,
    meaning?.category_instance_title,
    meaningCategoryInstances,
    t,
  ]);
  const visualModeOptions = useMemo(() => [
    { value: 'icon', label: t('instance.visualModeOptions.icon' as never) },
    { value: 'image', label: t('instance.visualModeOptions.image' as never) },
  ], [t]);

  if (!meaning) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted">
        {t('meaning.notFound' as never)}
      </div>
    );
  }

  if (session.isLoading) return <></>;

  const isBuiltInMeaning = session.state.built_in;
  const displayMeaning = {
    ...meaning,
    key: session.state.key as MeaningKey,
    name: session.state.name,
    description: session.state.description,
    built_in: session.state.built_in,
  };
  const displayName = display.meaningName(displayMeaning);
  const displayDescription = display.meaningDescription(displayMeaning) ?? '';
  const duplicateMeaningKey = meanings.some((item) => item.id !== meaningId && item.key === session.state.key);
  const getKeyError = (key: string, duplicate: boolean): string | null => {
    if (!isValidQueryKey(key)) return t('meaning.keyInvalid' as never);
    if (duplicate) return t('meaning.keyDuplicate' as never);
    return null;
  };
  const meaningKeyError = isBuiltInMeaning
    ? null
    : getKeyError(session.state.key, duplicateMeaningKey);
  const meaningKeyCounts = countKeys(session.state.recipe.meanings.map((meaning) => meaning.key));
  const meaningKeyErrors = new Map(session.state.recipe.meanings.map((meaning) => [
    meaning.id,
    getKeyError(meaning.key, (meaningKeyCounts.get(meaning.key) ?? 0) > 1),
  ]));
  const fieldKeyErrors = new Map<string, string | null>();
  for (const meaning of session.state.recipe.meanings) {
    const fieldKeyCounts = countKeys(meaning.fields.map((field) => field.key));
    for (const field of meaning.fields) {
      fieldKeyErrors.set(
        field.id,
        getKeyError(field.key, (fieldKeyCounts.get(field.key) ?? 0) > 1),
      );
    }
  }
  const hasKeyValidationError = Boolean(meaningKeyError)
    || [...meaningKeyErrors.values()].some(Boolean)
    || [...fieldKeyErrors.values()].some(Boolean);

  const update = (patch: Partial<MeaningEditorState>) => {
    session.setState((prev) => ({ ...prev, ...patch }));
  };

  const builtInDefinitionIcon = session.state.built_in
    ? (MEANING_DEFINITIONS.find((definition) => definition.key === session.state.key) as { icon?: string } | undefined)?.icon ?? null
    : null;
  const displayIcon = session.state.icon ?? builtInDefinitionIcon ?? 'boxes';

  const handleVisualModeChange = (mode: VisualMode) => {
    setVisualMode(mode);
    if ((isImageSourceValue(session.state.icon) ? 'image' : 'icon') !== mode) {
      update({ icon: null });
    }
  };

  const updateRecipe = (recipe: MeaningContract) => {
    update({ recipe });
  };

  const updateRecipeMeaning = (meaningId: string, patch: Partial<MeaningAspectRecipe>) => {
    updateRecipe({
      ...session.state.recipe,
      meanings: session.state.recipe.meanings.map((meaning) => (
        meaning.id === meaningId ? { ...meaning, ...patch } : meaning
      )),
    });
  };

  const updateField = (
    meaningId: string,
    fieldId: string,
    patch: Partial<MeaningFieldRecipe>,
  ) => {
    updateRecipe({
      ...session.state.recipe,
      meanings: session.state.recipe.meanings.map((meaning) => (
        meaning.id === meaningId
          ? {
            ...meaning,
            fields: meaning.fields.map((field) => (
              field.id === fieldId ? { ...field, ...patch } : field
            )),
          }
          : meaning
      )),
    });
  };

  const toggleFieldType = (meaningId: string, field: MeaningFieldRecipe, fieldType: FieldType) => {
    const current = new Set(field.field_types ?? []);
    if (current.has(fieldType)) {
      current.delete(fieldType);
    } else {
      current.add(fieldType);
    }
    updateField(meaningId, field.id, {
      field_types: current.size > 0 ? [...current] : ['text'],
    });
  };

  const previewFields = session.state.recipe.meanings.flatMap((meaning) => (
    meaning.fields.map((field) => ({ meaning, field }))
  ));
  const formatFieldTypes = (fieldTypes: FieldType[] | undefined): string => {
    const normalizedFieldTypes = fieldTypes && fieldTypes.length > 0 ? fieldTypes : ['text' as FieldType];
    return normalizedFieldTypes
      .map((fieldType) => fieldTypeLabelByValue.get(fieldType) ?? fieldType)
      .join(', ');
  };
  const getMeaningDisplayName = (meaning: MeaningAspectRecipe): string => {
    if (!isBuiltInMeaning) return meaning.name;
    const key = getSemanticMeaningLabelKey(meaning.key as SemanticMeaningKey);
    const label = t(key as never);
    return label === key ? meaning.name : label;
  };
  const getMeaningDisplayDescription = (meaning: MeaningAspectRecipe): string => {
    if (!isBuiltInMeaning) return meaning.description ?? '';
    const key = getSemanticMeaningDescriptionKey(meaning.key as SemanticMeaningKey);
    const description = t(key as never);
    return description === key ? meaning.description ?? '' : description;
  };
  const getFieldDisplayName = (field: MeaningFieldRecipe): string => {
    if (!isBuiltInMeaning) return field.name;
    const key = getMeaningSlotLabelKey(field.key as MeaningSlotKey);
    const label = t(key as never);
    return label === key ? field.name : label;
  };
  const getFieldDisplayDescription = (field: MeaningFieldRecipe): string => {
    if (!isBuiltInMeaning) return field.description ?? '';
    const key = getMeaningSlotDescriptionKey(field.key as MeaningSlotKey);
    const description = t(key as never);
    return description === key ? field.description ?? '' : description;
  };
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !projectId || !meaningCategorySchema) return;
    const name = newCategoryName.trim();
    const sourceKey = normalizeKey(name, 'category');
    const created = await createInstance({
      project_id: projectId,
      schema_id: meaningCategorySchema.id,
      title: name,
      source_kind: 'project',
      source_ref: `meaning-category.${sourceKey}`,
    });
    update({ category_instance_id: created.id });
    setNewCategoryName('');
    setShowCategoryCreator(false);
  };

  const handleDelete = async () => {
    await deleteMeaning(meaningId);
    useEditorStore.getState().closeTab(tab.id);
  };

  return (
    <ScrollArea className="h-full min-h-0">
      <NetworkObjectEditorShell
        badge={t('meaning.title' as never)}
        title={displayName || meaning.name}
        subtitle={t('editorShell.networkObject' as never)}
        description={displayDescription || t('meaning.descriptionPlaceholder' as never)}
        leadingVisual={<NodeVisual icon={displayIcon} size={24} imageSize={56} className="shrink-0" />}
      >
        <NetworkObjectEditorSection title={t('editorShell.overview' as never)} defaultOpen={tab.isDirty} viewMode="body">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_170px]">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-secondary">{t('meaning.name' as never)}</label>
              <Input
                value={displayName}
                onChange={(event) => update({ name: event.target.value })}
                disabled={isBuiltInMeaning}
              />
            </div>
            {!isBuiltInMeaning && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-secondary">{t('meaning.key' as never)}</label>
                <Input
                  value={session.state.key}
                  onChange={(event) => update({ key: formatKeyInput(event.target.value) as MeaningRefKey })}
                  inputSize="sm"
                  error={Boolean(meaningKeyError)}
                />
                <div className={`text-[11px] ${meaningKeyError ? 'text-status-error' : 'text-muted'}`}>
                  {meaningKeyError ?? t('meaning.keyHint' as never)}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">{t('meaning.description' as never)}</label>
            <TextArea
              value={displayDescription}
              onChange={(event) => update({ description: event.target.value || null })}
              rows={3}
              placeholder={t('meaning.descriptionPlaceholder' as never)}
              disabled={isBuiltInMeaning}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-secondary">{t('meaning.category' as never)}</label>
              <Select
                value={session.state.category_instance_id ?? ''}
                options={meaningCategoryOptions}
                onChange={(event) => {
                  if (event.target.value === ADD_CATEGORY_OPTION_VALUE) {
                    setShowCategoryCreator(true);
                    return;
                  }
                  setShowCategoryCreator(false);
                  update({ category_instance_id: event.target.value || null });
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-secondary">{t('meaning.targetKind.label' as never)}</label>
              <div className="flex min-h-[38px] items-center rounded-lg border border-input bg-surface-input px-3 text-sm text-secondary">
                {t((TARGET_KIND_OPTIONS.find((option) => option.value === session.state.target_kind)?.labelKey ?? 'meaning.targetKind.object') as never)}
              </div>
            </div>
          </div>

          {showCategoryCreator && (
            <div className="grid gap-2 rounded-lg border border-subtle bg-surface-card p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-secondary">{t('meaning.newCategory' as never)}</label>
                <Input
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  placeholder={t('meaning.categoryPlaceholder' as never)}
                  autoFocus
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={handleCreateCategory}
                disabled={!newCategoryName.trim() || !meaningCategorySchema}
              >
                <Plus size={14} />
                {t('meaning.addCategory' as never)}
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Badge variant={session.state.built_in ? 'accent' : 'default'}>
              {session.state.built_in ? t('meaning.builtIn' as never) : t('meaning.custom' as never)}
            </Badge>
          </div>

          {hasKeyValidationError && (
            <div className="rounded-lg border border-status-error/40 bg-status-error/10 px-3 py-2 text-xs text-status-error">
              {t('meaning.keyValidationSummary' as never)}
            </div>
          )}
        </NetworkObjectEditorSection>

        <NetworkObjectEditorSection title={t('meaning.meanings' as never)} viewMode="body">
          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => updateRecipe({
                  ...session.state.recipe,
                  meanings: [
                    ...session.state.recipe.meanings,
                    makeEmptyMeaning(session.state.recipe.meanings.map((meaning) => meaning.key)),
                  ],
                })}
              >
                <Plus size={14} />
                {t('meaning.addMeaning' as never)}
              </Button>
            </div>

            {session.state.recipe.meanings.length === 0 && (
              <div className="rounded-lg border border-subtle bg-surface-editor px-3 py-3 text-xs text-muted">
                {t('meaning.noMeanings' as never)}
              </div>
            )}

            {session.state.recipe.meanings.map((meaning, meaningIndex) => {
              const meaningKeyError = meaningKeyErrors.get(meaning.id) ?? null;
              return (
              <div key={meaning.id} className="rounded-lg border border-subtle bg-surface-editor p-3">
                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_170px_190px_auto] md:items-start">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-secondary">{t('meaning.meaningName' as never)}</label>
                    <Input
                      inputSize="sm"
                      value={getMeaningDisplayName(meaning)}
                      onChange={(event) => {
                        const nextName = event.target.value;
                        const fallbackKey = `meaning_${meaningIndex + 1}`;
                        updateRecipeMeaning(meaning.id, {
                          name: nextName,
                          ...(shouldSyncKeyFromName(meaning.key, meaning.name, fallbackKey)
                            ? { key: normalizeKey(nextName, fallbackKey) }
                            : {}),
                        });
                      }}
                      placeholder={t('meaning.meaningNamePlaceholder' as never)}
                      disabled={isBuiltInMeaning}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-secondary">{t('meaning.meaningKey' as never)}</label>
                    <Input
                      inputSize="sm"
                      value={meaning.key}
                      onChange={(event) => updateRecipeMeaning(meaning.id, { key: formatKeyInput(event.target.value) })}
                      error={Boolean(meaningKeyError)}
                      disabled={isBuiltInMeaning}
                    />
                    <div className={`text-[11px] ${meaningKeyError ? 'text-status-error' : 'text-muted'}`}>
                      {meaningKeyError ?? t('meaning.keyHintShort' as never)}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-secondary">{t('meaning.representation.label' as never)}</label>
                    <Select
                      selectSize="sm"
                      value={meaning.representation}
                      options={REPRESENTATION_OPTIONS.map((option) => ({
                        value: option.value,
                        label: t(option.labelKey as never),
                      }))}
                      onChange={(event) => updateRecipeMeaning(meaning.id, {
                        representation: event.target.value as MeaningRepresentationKind,
                      })}
                      disabled={isBuiltInMeaning}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-5"
                    disabled={isBuiltInMeaning}
                    onClick={() => updateRecipe({
                      ...session.state.recipe,
                      meanings: session.state.recipe.meanings.filter((item) => item.id !== meaning.id),
                    })}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>

                <div className="mt-2">
                  <TextArea
                    value={getMeaningDisplayDescription(meaning)}
                    onChange={(event) => updateRecipeMeaning(meaning.id, { description: event.target.value || null })}
                    rows={2}
                    placeholder={t('meaning.meaningDescriptionPlaceholder' as never)}
                    disabled={isBuiltInMeaning}
                  />
                </div>

                <div className="mt-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-medium text-secondary">{t('meaning.fields' as never)}</div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isBuiltInMeaning}
                      onClick={() => updateRecipeMeaning(meaning.id, {
                        fields: [
                          ...meaning.fields,
                          makeEmptyField(meaning.fields.map((field) => field.key)),
                        ],
                      })}
                    >
                      <Plus size={14} />
                      {t('meaning.addField' as never)}
                    </Button>
                  </div>

                  {meaning.fields.length === 0 && (
                    <div className="rounded border border-subtle bg-surface-card px-3 py-2 text-xs text-muted">
                      {t('meaning.noFields' as never)}
                    </div>
                  )}

                  {meaning.fields.map((field, fieldIndex) => {
                    const fieldKeyError = fieldKeyErrors.get(field.id) ?? null;
                    return (
                    <div key={field.id} className="rounded border border-subtle bg-surface-card px-2.5 py-2">
                      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_170px_auto_auto] md:items-start">
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-medium text-secondary">{t('meaning.fieldName' as never)}</label>
                          <Input
                            inputSize="sm"
                            value={getFieldDisplayName(field)}
                            onChange={(event) => {
                              const nextName = event.target.value;
                              const fallbackKey = `field_${fieldIndex + 1}`;
                              updateField(meaning.id, field.id, {
                                name: nextName,
                                ...(shouldSyncKeyFromName(field.key, field.name, fallbackKey)
                                  ? { key: normalizeKey(nextName, fallbackKey) }
                                  : {}),
                              });
                            }}
                            placeholder={t('meaning.fieldName' as never)}
                            disabled={isBuiltInMeaning}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-medium text-secondary">{t('meaning.fieldKey' as never)}</label>
                          <Input
                            inputSize="sm"
                            value={field.key}
                            onChange={(event) => updateField(meaning.id, field.id, { key: formatKeyInput(event.target.value) })}
                            error={Boolean(fieldKeyError)}
                            disabled={isBuiltInMeaning}
                          />
                          <div className={`text-[11px] ${fieldKeyError ? 'text-status-error' : 'text-muted'}`}>
                            {fieldKeyError ?? t('meaning.keyHintShort' as never)}
                          </div>
                        </div>
                        <div className="pt-5">
                          <Toggle
                            checked={field.required}
                            onChange={(checked) => updateField(meaning.id, field.id, { required: checked })}
                            label={t('meaning.required' as never)}
                            disabled={isBuiltInMeaning}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-5"
                          disabled={isBuiltInMeaning}
                          onClick={() => updateRecipeMeaning(meaning.id, {
                            fields: meaning.fields.filter((item) => item.id !== field.id),
                          })}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                      <div className="mt-2">
                        <div className="mb-1.5 text-[11px] font-medium text-secondary">
                          {t('meaning.fieldTypes' as never)}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {FIELD_TYPE_OPTIONS.map((typeOption) => {
                            const selected = (field.field_types ?? []).includes(typeOption.value);
                            return (
                              <button
                                key={typeOption.value}
                                type="button"
                                className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
                                  selected
                                    ? 'border-accent bg-accent-muted text-accent'
                                    : 'border-subtle bg-surface-editor text-secondary hover:border-default hover:text-default'
                                }`}
                                disabled={isBuiltInMeaning}
                                onClick={() => toggleFieldType(meaning.id, field, typeOption.value)}
                              >
                                {t(typeOption.labelKey as never)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <Input
                          inputSize="sm"
                          value={getFieldDisplayDescription(field)}
                          onChange={(event) => updateField(meaning.id, field.id, { description: event.target.value || null })}
                          placeholder={t('meaning.fieldDescriptionPlaceholder' as never)}
                          disabled={isBuiltInMeaning}
                        />
                        <Input
                          inputSize="sm"
                          value={field.options ?? ''}
                          onChange={(event) => updateField(meaning.id, field.id, { options: event.target.value || null })}
                          placeholder={t('meaning.fieldOptionsPlaceholder' as never)}
                          disabled={isBuiltInMeaning}
                        />
                      </div>
                    </div>
                  );
                  })}
                </div>
              </div>
              );
            })}
          </div>
        </NetworkObjectEditorSection>

        <NetworkObjectEditorSection title={t('meaning.rules' as never)} viewMode="body">
          <div className="flex flex-col gap-2">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => updateRecipe({
                  ...session.state.recipe,
                  rules: [...session.state.recipe.rules, makeEmptyRule()],
                })}
              >
                <Plus size={14} />
                {t('meaning.addRule' as never)}
              </Button>
            </div>
            {session.state.recipe.rules.length === 0 && (
              <div className="rounded-lg border border-subtle bg-surface-editor px-3 py-3 text-xs text-muted">
                {t('meaning.noRules' as never)}
              </div>
            )}
            {session.state.recipe.rules.map((rule) => (
              <div key={rule.id} className="grid gap-2 rounded-lg border border-subtle bg-surface-editor px-3 py-2 md:grid-cols-[minmax(0,1fr)_auto]">
                <Input
                  inputSize="sm"
                  value={rule.description}
                  onChange={(event) => updateRecipe({
                    ...session.state.recipe,
                    rules: session.state.recipe.rules.map((item) => (
                      item.id === rule.id ? { ...item, description: event.target.value } : item
                    )),
                  })}
                  placeholder={t('meaning.rulePlaceholder' as never)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => updateRecipe({
                    ...session.state.recipe,
                    rules: session.state.recipe.rules.filter((item) => item.id !== rule.id),
                  })}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        </NetworkObjectEditorSection>

        <NetworkObjectEditorSection title={t('meaning.preview' as never)} defaultOpen={false} viewMode="details">
          <div className="flex flex-col gap-2">
            {previewFields.length === 0 && (
              <div className="rounded-lg border border-subtle bg-surface-editor px-3 py-3 text-xs text-muted">
                {t('meaning.noPreview' as never)}
              </div>
            )}
            {previewFields.map(({ meaning, field }) => (
              <div key={`${meaning.id}:${field.id}`} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-subtle bg-surface-editor px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-default">{getFieldDisplayName(field) || t('meaning.fieldName' as never)}</div>
                  <div className="truncate text-[11px] text-secondary">{getMeaningDisplayName(meaning) || t('meaning.meaningName' as never)}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-secondary">
                  <span className="rounded bg-state-hover px-2 py-0.5">{formatFieldTypes(field.field_types)}</span>
                  {field.required && <span className="rounded bg-accent-muted px-2 py-0.5 text-accent">{t('meaning.required')}</span>}
                </div>
              </div>
            ))}
          </div>
        </NetworkObjectEditorSection>

        <NetworkObjectEditorSection title={t('meaning.consumers' as never)} defaultOpen={false} viewMode="details">
          <div className="flex flex-col gap-2">
            {meaningConsumers.length === 0 && (
              <div className="rounded-lg border border-subtle bg-surface-editor px-3 py-3 text-xs text-muted">
                {t('meaning.noConsumers' as never)}
              </div>
            )}
            {meaningConsumers.map((consumer) => (
              <div key={consumer.meaning.id} className="rounded-lg border border-subtle bg-surface-editor px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-default">{display.meaningName(consumer.meaning)}</div>
                    <div className="mt-0.5 text-[11px] text-secondary">{t('meaning.title')}</div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {consumer.linkedToMeaning && (
                      <span className="rounded bg-accent-muted px-2 py-0.5 text-[11px] text-accent">
                        {t('meaning.consumerMeaningLink' as never)}
                      </span>
                    )}
                    <span className="rounded bg-state-hover px-2 py-0.5 text-[11px] text-secondary">
                      {t('meaning.consumerMeaningCount' as never).replace('{count}', String(consumer.meaningKeys.length))}
                    </span>
                    <span className="rounded bg-state-hover px-2 py-0.5 text-[11px] text-secondary">
                      {t('meaning.consumerFieldCount' as never).replace('{count}', String(consumer.fields.length))}
                    </span>
                  </div>
                </div>

                {consumer.meaningKeys.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {consumer.meaningKeys.map((meaningKey) => (
                      <span key={meaningKey} className="rounded bg-surface-card px-2 py-0.5 text-[11px] text-secondary">
                        {t(getSemanticMeaningLabelKey(meaningKey) as never)}
                      </span>
                    ))}
                  </div>
                )}

                {consumer.fields.length > 0 && (
                  <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                    {consumer.fields.map((field) => (
                      <div key={field.id} className="flex min-w-0 items-center justify-between gap-2 rounded border border-subtle bg-surface-card px-2 py-1.5">
                        <span className="truncate text-xs text-default">{field.name}</span>
                        <span className="shrink-0 text-[11px] text-muted">
                          {getFieldMeaningSlot(field) ? t(getMeaningSlotLabelKey(getFieldMeaningSlot(field)!) as never) : field.field_type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </NetworkObjectEditorSection>

        <NetworkObjectEditorSection title={t('meaning.visualDefaults')} defaultOpen={false} viewMode="details">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-2">
              <span className="text-xs text-secondary">{t('instance.visual' as never)}</span>
              <RadioGroup
                options={visualModeOptions}
                value={visualMode}
                onChange={(value) => handleVisualModeChange(value as VisualMode)}
                orientation="horizontal"
              />
              {visualMode === 'image' ? (
                <FilePicker
                  value={isImageSourceValue(session.state.icon) ? session.state.icon ?? '' : ''}
                  onChange={(path) => update({ icon: path || null })}
                  placeholder={t('instance.selectProfileImage' as never)}
                  filters={[...IMAGE_FILE_FILTERS]}
                />
              ) : (
                <IconSelector
                  value={session.state.icon ?? builtInDefinitionIcon ?? undefined}
                  onChange={(icon) => update({ icon })}
                />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs text-secondary">{t('meaning.color')}</span>
              <ColorPicker
                value={session.state.color ?? undefined}
                onChange={(color) => update({ color })}
              />
            </div>
          </div>
        </NetworkObjectEditorSection>

        <NetworkObjectEditorSection title={t('editorShell.metadata' as never)} defaultOpen={false} viewMode="details">
          <NetworkObjectMetadataList
            items={[
              { label: t('editorShell.objectId' as never), value: <code className="font-mono text-xs">{meaning.id}</code> },
              { label: t('meaning.meanings' as never), value: `${session.state.recipe.meanings.length}` },
              { label: t('meaning.fields' as never), value: `${previewFields.length}` },
            ]}
          />
        </NetworkObjectEditorSection>

        <div className="mx-auto flex w-full max-w-[760px] justify-end px-6 pt-1" data-network-object-view-mode="details">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="bg-status-error/10 text-status-error hover:bg-status-error/15 hover:text-status-error"
            disabled={isBuiltInMeaning || meaning.source_kind !== 'project'}
            onClick={() => { void handleDelete(); }}
          >
            {t('common.delete')}
          </Button>
        </div>
      </NetworkObjectEditorShell>
    </ScrollArea>
  );
}
