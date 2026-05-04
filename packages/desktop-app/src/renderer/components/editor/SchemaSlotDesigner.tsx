import React, { useMemo } from 'react';
import type {
  SchemaField,
  SchemaFieldUpdate,
  SchemaMeaning,
  SchemaMeaningSlotBinding,
  FieldType,
  SemanticCategoryKey,
  SemanticCategoryRefKey,
  SemanticMeaningKey,
  ModelKey,
  ModelRefKey,
  MeaningSlotKey,
} from '@netior/shared/types';
import {
  SEMANTIC_CATEGORY_LABELS,
  SEMANTIC_MEANING_DEFINITIONS,
  MODEL_DEFINITIONS,
  getSemanticCategoryDescriptionKey,
  getSemanticCategoryLabelKey,
  getSemanticMeaningDescriptionKey,
  getSemanticMeaningLabelKey,
  getModelDescriptionKey,
  getModelLabelKey,
  getMeaningSlotDefinition,
  getMeaningSlotDescriptionKey,
  getMeaningSlotLabelKey,
} from '@netior/shared/constants';
import type { TranslationKey } from '@netior/shared/i18n';
import {
  CheckCircle2,
  Circle,
  CircleDashed,
  Layers3,
  Link2,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { Checkbox } from '../ui/Checkbox';
import { Badge } from '../ui/Badge';
import { Select } from '../ui/Select';
import { SchemaFieldRow } from './SchemaFieldRow';
import { getFieldMeaningSlot } from '../../lib/field-meaning-bindings';

interface SchemaSlotDesignerProps {
  tabId: string;
  fields: SchemaField[];
  meanings: SchemaMeaning[];
  selectedModels: ModelRefKey[];
  modelDefinitions?: readonly ModelOptionDefinition[];
  activeCategory: SemanticCategoryRefKey;
  fieldComplexityLevel: string;
  onActiveCategoryChange: (category: SemanticCategoryRefKey) => void;
  onToggleModel: (model: ModelRefKey, checked: boolean) => void | Promise<void>;
  onEnsureMeaning: (
    meaning: SemanticMeaningKey,
    options?: { sourceModel?: ModelRefKey | null },
  ) => void | Promise<void>;
  onCreateFieldForSlot: (
    binding: SchemaMeaningSlotBinding,
    meaning: SchemaMeaning,
  ) => void | Promise<void>;
  onBindFieldToSlot: (
    binding: SchemaMeaningSlotBinding,
    fieldId: string,
  ) => void | Promise<void>;
  onCreateField: () => void | Promise<void>;
  onDeleteMeaning: (meaningId: string) => void | Promise<void>;
  onUpdateField: (id: string, data: SchemaFieldUpdate) => void;
  onDeleteField: (id: string) => void;
  onOpenSettings: () => void;
  modelCategories?: readonly ModelCategoryOption[];
}

const CATEGORY_KEYS = Object.keys(SEMANTIC_CATEGORY_LABELS) as SemanticCategoryKey[];

export interface ModelOptionDefinition {
  key: ModelRefKey;
  category: SemanticCategoryRefKey;
  label: string;
  description?: string | null;
  meanings: readonly SemanticMeaningKey[];
  coreSlots: readonly MeaningSlotKey[];
  optionalSlots: readonly MeaningSlotKey[];
  builtIn?: boolean;
}

export interface ModelCategoryOption {
  key: SemanticCategoryRefKey;
  label: string;
  description?: string;
}

const FIELD_TYPE_LABEL_KEYS: Record<FieldType, TranslationKey> = {
  text: 'typeSelector.text',
  textarea: 'typeSelector.textarea',
  number: 'typeSelector.number',
  boolean: 'typeSelector.boolean',
  date: 'typeSelector.dateType',
  datetime: 'typeSelector.datetime',
  select: 'typeSelector.select',
  'multi-select': 'typeSelector.multi-select',
  radio: 'typeSelector.radio',
  relation: 'typeSelector.relation',
  schema_ref: 'typeSelector.schema_ref',
  model_ref: 'typeSelector.model_ref',
  file: 'typeSelector.file',
  url: 'typeSelector.url',
  color: 'typeSelector.color',
  rating: 'typeSelector.rating',
  tags: 'typeSelector.tags',
};

function sortFields(fields: SchemaField[]): SchemaField[] {
  return [...fields].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

function sourceLabelKey(source: SchemaMeaning['source']): TranslationKey {
  if (source === 'model') return 'semantic.ui.sourceModel' as TranslationKey;
  if (source === 'migration') return 'semantic.ui.sourceMigration' as TranslationKey;
  if (source === 'system') return 'semantic.ui.sourceSystem' as TranslationKey;
  return 'semantic.ui.sourceManual' as TranslationKey;
}

export function SchemaSlotDesigner({
  tabId,
  fields,
  meanings,
  selectedModels,
  modelDefinitions,
  activeCategory,
  fieldComplexityLevel,
  onActiveCategoryChange,
  onToggleModel,
  onEnsureMeaning,
  onCreateFieldForSlot,
  onBindFieldToSlot,
  onCreateField,
  onDeleteMeaning,
  onUpdateField,
  onDeleteField,
  onOpenSettings,
  modelCategories = [],
}: SchemaSlotDesignerProps): JSX.Element {
  const { t } = useI18n();
  const sortedFields = useMemo(() => sortFields(fields), [fields]);
  const fieldById = useMemo(() => new Map(fields.map((field) => [field.id, field])), [fields]);
  const fieldBySlot = useMemo(() => {
    const map = new Map<string, SchemaField>();
    for (const field of fields) {
      const slot = getFieldMeaningSlot(field);
      if (slot) map.set(slot, field);
    }
    return map;
  }, [fields]);
  const bindableFieldOptions = useMemo(() => {
    const options = sortFields(fields).map((field) => ({
      value: field.id,
      label: field.name || t('schema.fieldName'),
    }));
    return [{ value: '', label: t('semantic.ui.selectField' as never) }, ...options];
  }, [fields, t]);
  const meaningByKey = useMemo(() => (
    new Map(meanings.map((meaning) => [meaning.meaning_key, meaning]))
  ), [meanings]);
  const availableModelDefinitions = useMemo<readonly ModelOptionDefinition[]>(
    () => modelDefinitions ?? MODEL_DEFINITIONS.map((definition) => ({
      key: definition.key,
      category: definition.category,
      label: definition.label,
      meanings: definition.meanings,
      coreSlots: definition.coreSlots,
      optionalSlots: definition.optionalSlots,
      builtIn: true,
    })),
    [modelDefinitions],
  );

  const getModelLabel = (definition: ModelOptionDefinition): string => {
    if (definition.builtIn) {
      const key = getModelLabelKey(definition.key as ModelKey);
      const label = t(key as never);
      return label === key ? definition.label : label;
    }
    return definition.label;
  };

  const getModelDescription = (definition: ModelOptionDefinition): string => {
    if (definition.builtIn) {
      const key = getModelDescriptionKey(definition.key as ModelKey);
      const description = t(key as never);
      return description === key ? definition.description ?? '' : description;
    }
    return definition.description ?? '';
  };

  const categoryModels = useMemo(() => {
    const categoryOptionByKey = new Map(modelCategories.map((category) => [category.key, category]));
    const categoryKeys = modelCategories.map((category) => category.key);

    return categoryKeys.map((categoryKey) => {
      const categoryModelDefinitions = availableModelDefinitions.filter((definition) => definition.category === categoryKey);
      const isSystemCategory = CATEGORY_KEYS.includes(categoryKey as SemanticCategoryKey);
      const categoryOption = categoryOptionByKey.get(categoryKey);
      const meaningDefinitions = isSystemCategory
        ? SEMANTIC_MEANING_DEFINITIONS.filter((definition) => definition.category === categoryKey)
        : [];
      const activeMeanings = meaningDefinitions.filter((definition) => meaningByKey.has(definition.key));
      return {
        categoryKey,
        categoryLabel: categoryOption?.label ?? (
          isSystemCategory ? t(getSemanticCategoryLabelKey(categoryKey as SemanticCategoryKey) as never) : categoryKey
        ),
        categoryDescription: categoryOption?.description ?? (
          isSystemCategory ? t(getSemanticCategoryDescriptionKey(categoryKey as SemanticCategoryKey) as never) : ''
        ),
        modelDefinitions: categoryModelDefinitions,
        meaningDefinitions,
        activeMeanings,
      };
    });
  }, [availableModelDefinitions, meaningByKey, modelCategories, t]);

  const activeModel = categoryModels.find((category) => category.categoryKey === activeCategory) ?? categoryModels[0];

  const renderBinding = (
    binding: SchemaMeaningSlotBinding,
    meaning: SchemaMeaning,
  ): JSX.Element => {
    const slotDefinition = getMeaningSlotDefinition(binding.slot_key);
    const boundField = (binding.field_id ? fieldById.get(binding.field_id) : undefined) ?? fieldBySlot.get(binding.slot_key);
    const allowedTypeLabels = slotDefinition?.allowedFieldTypes.map((fieldType) => t(FIELD_TYPE_LABEL_KEYS[fieldType])) ?? [];

    return (
      <div
        key={binding.id}
        className="grid gap-2 rounded-lg border border-subtle bg-surface-editor px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(110px,160px)_auto] sm:items-center"
      >
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {boundField ? (
              <CheckCircle2 size={13} className="shrink-0 text-accent" />
            ) : (
              <CircleDashed size={13} className="shrink-0 text-muted" />
            )}
            <span className="truncate text-xs font-medium text-default">
              {t(getMeaningSlotLabelKey(binding.slot_key) as never)}
            </span>
            <span className="rounded bg-state-hover px-1.5 py-0.5 text-[10px] text-secondary">
              {binding.required ? t('semantic.ui.requiredRole' as never) : t('semantic.ui.optionalRole' as never)}
            </span>
          </div>
          {slotDefinition && (
            <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-secondary">
              {t(getMeaningSlotDescriptionKey(slotDefinition.key) as never)}
            </div>
          )}
          {allowedTypeLabels.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {allowedTypeLabels.map((label) => (
                <span key={`${binding.id}:${label}`} className="rounded bg-surface-card px-1.5 py-0.5 text-[10px] text-muted">
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 text-xs">
          {boundField ? (
            <div className="flex min-w-0 items-center gap-1.5 text-secondary">
              <Link2 size={12} className="shrink-0" />
              <span className="truncate">{boundField.name || t('schema.fieldName')}</span>
            </div>
          ) : (
            <Select
              value=""
              options={bindableFieldOptions}
              onChange={(event) => {
                if (event.target.value) {
                  void onBindFieldToSlot(binding, event.target.value);
                }
              }}
              selectSize="sm"
            />
          )}
        </div>

        {boundField ? (
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-state-hover hover:text-status-error"
            title={t('schema.deleteField')}
            aria-label={t('schema.deleteField')}
            onClick={() => { onDeleteField(boundField.id); }}
          >
            <Trash2 size={14} />
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg border border-subtle px-2 text-xs text-secondary transition-colors hover:border-accent hover:text-accent"
            onClick={() => { void onCreateFieldForSlot(binding, meaning); }}
          >
            <Plus size={13} />
            {t('semantic.ui.createField' as never)}
          </button>
        )}
      </div>
    );
  };

  if (!activeModel) {
    return <div className="flex flex-col gap-6" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-[188px_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-medium text-secondary">
            <Sparkles size={14} />
            {t('semantic.ui.meaningModel' as never)}
          </div>
          <div className="grid gap-1">
            {categoryModels.map((category) => {
              const isActive = category.categoryKey === activeModel.categoryKey;
              return (
                <button
                  key={category.categoryKey}
                  type="button"
                  className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                    isActive
                      ? 'border-accent bg-accent-muted text-default'
                      : 'border-subtle bg-surface-editor text-secondary hover:border-default hover:text-default'
                  }`}
                  onClick={() => onActiveCategoryChange(category.categoryKey)}
                >
                  <span className="truncate text-xs font-medium">{category.categoryLabel}</span>
                  <span className="shrink-0 text-[11px] text-muted">
                    {`${category.activeMeanings.length}/${category.meaningDefinitions.length}`}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-2 rounded-lg border border-subtle px-3 py-2 text-left text-xs text-secondary transition-colors hover:border-default hover:text-default"
            onClick={onOpenSettings}
          >
            <SlidersHorizontal size={13} />
            <span className="truncate">
              {`${t('settings.fieldComplexity' as never)}: ${t(`settings.fieldComplexity${fieldComplexityLevel[0].toUpperCase()}${fieldComplexityLevel.slice(1)}` as TranslationKey)}`}
            </span>
          </button>
        </div>

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-default">{activeModel.categoryLabel}</div>
              <div className="mt-1 text-xs leading-relaxed text-secondary">{activeModel.categoryDescription}</div>
            </div>
            <div className="flex shrink-0 gap-2 text-[11px] text-muted">
              <span className="rounded-md bg-surface-editor px-2 py-1">
                {`${activeModel.activeMeanings.length} ${t('semantic.ui.activeMeanings' as never)}`}
              </span>
              <span className="rounded-md bg-surface-editor px-2 py-1">
                {`${selectedModels.length} ${t('semantic.ui.selectedModels' as never)}`}
              </span>
            </div>
          </div>

          <div className="mb-5">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-default">
              <Layers3 size={14} />
              {t('semantic.ui.modelPresets' as never)}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {activeModel.modelDefinitions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-subtle bg-surface-editor px-3 py-4 text-xs leading-relaxed text-secondary md:col-span-2">
                  {t('semantic.ui.noModelsInCategory' as never)}
                </div>
              ) : (
                activeModel.modelDefinitions.map((modelDefinition) => {
                  const enabled = selectedModels.includes(modelDefinition.key);
                  return (
                    <div
                      key={modelDefinition.key}
                      className={`rounded-lg border px-3 py-3 transition-colors ${
                        enabled ? 'border-accent/40 bg-accent-muted/20' : 'border-subtle bg-surface-card'
                      }`}
                    >
                      <Checkbox
                        checked={enabled}
                        onChange={(checked) => { void onToggleModel(modelDefinition.key, checked); }}
                        label={getModelLabel(modelDefinition)}
                      />
                      <div className="mt-2 text-xs leading-relaxed text-secondary">
                        {getModelDescription(modelDefinition)}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {modelDefinition.meanings.map((meaning) => (
                          <span key={`${modelDefinition.key}:${meaning}`} className="rounded bg-surface-editor px-2 py-0.5 text-[11px] text-secondary">
                            {t(getSemanticMeaningLabelKey(meaning) as never)}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-default">
              <Sparkles size={14} />
              {t('semantic.ui.meaningsTitle' as never)}
            </div>
            <div className="grid gap-3">
              {activeModel.meaningDefinitions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-subtle bg-surface-editor px-3 py-4 text-xs leading-relaxed text-secondary">
                  {t('semantic.ui.noMeaningsInCategory' as never)}
                </div>
              ) : (
                activeModel.meaningDefinitions.map((definition) => {
                  const meaning = meaningByKey.get(definition.key);
                  const isActive = Boolean(meaning);
                  return (
                    <div
                      key={definition.key}
                      className={`rounded-lg border px-3 py-3 ${
                        isActive ? 'border-default bg-surface-card' : 'border-subtle bg-surface-editor'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium text-default">
                              {t(getSemanticMeaningLabelKey(definition.key) as never)}
                            </span>
                            {meaning && <Badge>{t(sourceLabelKey(meaning.source) as never)}</Badge>}
                          </div>
                          <div className="mt-1 text-xs leading-relaxed text-secondary">
                            {t(getSemanticMeaningDescriptionKey(definition.key) as never)}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {!meaning ? (
                            <button
                              type="button"
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-subtle px-2 text-xs text-secondary transition-colors hover:border-accent hover:text-accent"
                              onClick={() => { void onEnsureMeaning(definition.key); }}
                            >
                              <Plus size={13} />
                              {t('semantic.ui.addMeaning' as never)}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-state-hover hover:text-status-error"
                              title={t('semantic.ui.deleteMeaning' as never)}
                              aria-label={t('semantic.ui.deleteMeaning' as never)}
                              onClick={() => { void onDeleteMeaning(meaning.id); }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {meaning && (
                        <div className="mt-3 grid gap-2">
                          {meaning.slots.map((binding) => renderBinding(binding, meaning))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-subtle pt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-default">{t('semantic.ui.fieldsTitle' as never)}</div>
            <div className="mt-1 text-[11px] text-secondary">
              {`${sortedFields.length} ${t('semantic.ui.fieldCount' as never)}`}
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-subtle px-2 text-xs text-secondary transition-colors hover:border-accent hover:text-accent"
            onClick={() => { void onCreateField(); }}
          >
            <Plus size={13} />
            {t('semantic.ui.addField' as never)}
          </button>
        </div>
        {sortedFields.length > 0 ? (
          <div className="flex flex-col gap-2">
            {sortedFields.map((field) => (
              <SchemaFieldRow
                key={field.id}
                tabId={tabId}
                field={field}
                onUpdate={onUpdateField}
                onDelete={onDeleteField}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-subtle bg-surface-editor px-3 py-3 text-xs text-muted">
            <Circle size={12} />
            {t('semantic.ui.noFieldsYet' as never)}
          </div>
        )}
      </div>
    </div>
  );
}
