import React, { useEffect, useMemo, useState } from 'react';
import type {
  SchemaField,
  SchemaFieldUpdate,
} from '@netior/shared/types';
import {
  getMeaningSlotDefinition,
  getMeaningSlotLabelKey,
} from '@netior/shared/constants';
import { Link2, Trash2 } from 'lucide-react';
import { Input } from '../ui/Input';
import { TypeSelector } from '../ui/TypeSelector';
import { Toggle } from '../ui/Toggle';
import { Tooltip } from '../ui/Tooltip';
import { SchemaSourcePicker } from '../ui/SchemaSourcePicker';
import { FieldBehaviorSelect, type FieldBehaviorMode } from './FieldBehaviorSelect';
import { useI18n } from '../../hooks/useI18n';
import { useSchemaStore } from '../../stores/schema-store';
import { useEditorStore } from '../../stores/editor-store';
import {
  parseSchemaFieldOptions,
  stringifySchemaFieldOptions,
} from '../../lib/schema-field-options';
import { getFieldMeaningSlot } from '../../lib/field-meaning-bindings';

interface SchemaFieldRowProps {
  tabId: string;
  field: SchemaField;
  onUpdate: (id: string, data: SchemaFieldUpdate) => void;
  onDelete: (id: string) => void;
}

const CHOICE_TYPES = new Set(['select', 'multi-select', 'radio']);

type FieldBehavior =
  | 'none'
  | 'schema_composition'
  | 'schema_extension'
  | 'conditional_field'
  | 'computed_field'
  | 'derived_collection';

const STANDARD_FIELD_TYPES: SchemaField['field_type'][] = [
  'text',
  'textarea',
  'number',
  'boolean',
  'date',
  'datetime',
  'select',
  'multi-select',
  'radio',
  'object',
  'file',
  'url',
  'color',
  'rating',
  'tags',
  'model_ref',
];

const VALUE_FIELD_TYPES: SchemaField['field_type'][] = [
  'text',
  'textarea',
  'number',
  'boolean',
  'date',
  'datetime',
  'file',
  'url',
  'color',
  'rating',
  'tags',
  'model_ref',
];

const COMPUTED_FIELD_TYPES: SchemaField['field_type'][] = [
  'text',
  'textarea',
  'number',
  'boolean',
  'date',
  'datetime',
  'url',
  'color',
  'rating',
  'tags',
];

const SOURCE_SCHEMA_BEHAVIORS = new Set<FieldBehavior>([
  'schema_composition',
  'schema_extension',
  'derived_collection',
]);

function parseChoices(options: string | null): string {
  return parseSchemaFieldOptions(options).choices.join(', ');
}

function getFieldBehavior(field: SchemaField): FieldBehavior {
  const binding = field.bindings.find((item) => (
    item.binding_kind === 'schema_composition'
    || item.binding_kind === 'schema_extension'
    || item.binding_kind === 'conditional_field'
    || item.binding_kind === 'computed_field'
    || item.binding_kind === 'derived_collection'
  ));
  return binding?.binding_kind ?? 'none';
}

function createBehaviorBinding(
  behavior: FieldBehavior,
  sourceSchemaId: string | null,
  config?: string | null,
): SchemaFieldUpdate['bindings'] {
  if (behavior === 'none') return [];
  if (behavior === 'schema_composition') {
    return [{
      binding_kind: 'schema_composition',
      source_schema_id: sourceSchemaId,
      cardinality: 'object',
    }];
  }
  if (behavior === 'schema_extension') {
    return [{
      binding_kind: 'schema_extension',
      source_schema_id: sourceSchemaId,
      cardinality: 'object',
    }];
  }
  if (behavior === 'derived_collection') {
    return [{
      binding_kind: 'derived_collection',
      source_schema_id: sourceSchemaId,
      cardinality: 'many',
      read_only: true,
      config: config ?? null,
    }];
  }
  return [{
    binding_kind: behavior,
    cardinality: 'none',
    read_only: behavior === 'computed_field',
    config: config ?? null,
  }];
}

function getDefaultFieldTypeForBehavior(behavior: FieldBehavior, current: SchemaField['field_type']): SchemaField['field_type'] {
  if (behavior === 'derived_collection') return 'multi-select';
  if (behavior === 'schema_composition' || behavior === 'schema_extension') return 'object';
  if (behavior === 'computed_field' || behavior === 'conditional_field') {
    return current === 'object' || current === 'relation' ? 'text' : current;
  }
  return current;
}

function createChoiceSourceBinding(fieldType: SchemaField['field_type'], sourceSchemaId: string | null): SchemaFieldUpdate['bindings'] {
  if (!CHOICE_TYPES.has(fieldType) || !sourceSchemaId) return [];
  return [{
    binding_kind: fieldType === 'multi-select' ? 'instance_multi_select' : 'instance_select',
    source_schema_id: sourceSchemaId,
    cardinality: fieldType === 'multi-select' ? 'many' : 'one',
  }];
}

function getAllowedFieldTypesForBehavior(behavior: FieldBehavior): SchemaField['field_type'][] {
  if (behavior === 'schema_composition' || behavior === 'schema_extension') return ['object'];
  if (behavior === 'derived_collection') return ['multi-select'];
  if (behavior === 'computed_field') return COMPUTED_FIELD_TYPES;
  return STANDARD_FIELD_TYPES;
}

function intersectAllowedTypes(
  behaviorAllowedTypes: SchemaField['field_type'][],
  slotAllowedTypes?: readonly SchemaField['field_type'][],
): SchemaField['field_type'][] {
  if (!slotAllowedTypes) return behaviorAllowedTypes;
  return behaviorAllowedTypes.filter((type) => slotAllowedTypes.includes(type));
}

export function SchemaFieldRow({
  tabId,
  field,
  onUpdate,
  onDelete,
}: SchemaFieldRowProps): JSX.Element {
  const { t } = useI18n();
  const schemas = useSchemaStore((state) => state.schemas);
  const behavior = getFieldBehavior(field);
  const showChoiceOptions = CHOICE_TYPES.has(field.field_type) && !SOURCE_SCHEMA_BEHAVIORS.has(behavior);
  const showSourceSchema = SOURCE_SCHEMA_BEHAVIORS.has(behavior);
  const fieldOptions = parseSchemaFieldOptions(field.options);
  const sourceBinding = field.bindings.find((binding) => (
    SOURCE_SCHEMA_BEHAVIORS.has(binding.binding_kind as FieldBehavior)
  )) ?? field.bindings.find((binding) => (
    binding.binding_kind === 'instance_select' || binding.binding_kind === 'instance_multi_select'
  )) ?? null;
  const sourceSchemaId = sourceBinding?.source_schema_id ?? null;
  const bindingConfig = sourceBinding?.config ?? '';
  const meaningSlot = getFieldMeaningSlot(field);
  const slotDefinition = meaningSlot ? getMeaningSlotDefinition(meaningSlot) : undefined;
  const behaviorAllowedTypes = useMemo(() => getAllowedFieldTypesForBehavior(behavior), [behavior]);
  const allowedTypes = useMemo(() => (
    intersectAllowedTypes(behaviorAllowedTypes, slotDefinition?.allowedFieldTypes)
  ), [behaviorAllowedTypes, slotDefinition]);
  const slotLabel = meaningSlot ? t(getMeaningSlotLabelKey(meaningSlot) as never) : null;

  const [nameText, setNameText] = useState(field.name);
  const [optionsText, setOptionsText] = useState(() => parseChoices(field.options));
  const [configText, setConfigText] = useState(bindingConfig);
  const markDirty = () => {
    useEditorStore.getState().setDirty(tabId, true);
  };

  useEffect(() => { setNameText(field.name); }, [field.name]);
  useEffect(() => { setOptionsText(parseChoices(field.options)); }, [field.options]);
  useEffect(() => { setConfigText(bindingConfig); }, [bindingConfig]);

  const commitOptions = () => {
    const choices = optionsText.split(',').map((s) => s.trim()).filter(Boolean);
    markDirty();
    onUpdate(field.id, {
      options: stringifySchemaFieldOptions({
        ...fieldOptions,
        choices,
      }),
    });
  };

  const updateBehavior = (nextBehavior: FieldBehavior) => {
    const nextAllowedTypes = intersectAllowedTypes(
      getAllowedFieldTypesForBehavior(nextBehavior),
      slotDefinition?.allowedFieldTypes,
    );
    const preferredFieldType = getDefaultFieldTypeForBehavior(nextBehavior, field.field_type);
    const nextFieldType = nextAllowedTypes.includes(preferredFieldType)
      ? preferredFieldType
      : nextAllowedTypes[0] ?? preferredFieldType;
    const nextBindings = createBehaviorBinding(nextBehavior, sourceSchemaId, configText);
    markDirty();
    onUpdate(field.id, {
      field_type: nextFieldType,
      bindings: nextBindings,
    });
  };

  const updateSourceSchema = (schemaId: string | null) => {
    const patch: SchemaFieldUpdate = {
      bindings: CHOICE_TYPES.has(field.field_type)
        ? createChoiceSourceBinding(field.field_type, schemaId)
        : createBehaviorBinding(behavior, schemaId, configText),
    };

    if (schemaId && !nameText.trim()) {
      const sourceSchema = schemas.find((schema) => schema.id === schemaId);
      if (sourceSchema) {
        patch.name = sourceSchema.name;
        setNameText(sourceSchema.name);
      }
    }

    markDirty();
    onUpdate(field.id, patch);
  };

  const commitConfig = () => {
    markDirty();
    onUpdate(field.id, {
      bindings: createBehaviorBinding(behavior, sourceSchemaId, configText.trim() ? configText.trim() : null),
    });
  };

  return (
    <div className="group flex flex-col gap-3 rounded-lg border border-subtle bg-surface-card px-3 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {meaningSlot && (
          <div className="flex min-w-0 items-center gap-1.5 overflow-hidden text-[11px] text-secondary sm:basis-full">
            <Link2 size={12} className="shrink-0 text-accent" />
            <span className="truncate font-medium text-default">{slotLabel}</span>
            {(field.generated_by_model ?? field.generated_by_model) && (
              <span className="shrink-0 rounded bg-accent-muted px-1.5 py-0.5 text-[10px] text-accent">
                {t('semantic.ui.fromModel' as never)}
              </span>
            )}
            {field.slot_binding_locked && (
              <span className="shrink-0 rounded bg-state-hover px-1.5 py-0.5 text-[10px] text-secondary">
                {t('semantic.ui.boundField' as never)}
              </span>
            )}
            {slotDefinition?.constraintLevel && (
              <span className="shrink-0 rounded bg-state-hover px-1.5 py-0.5 text-[10px] text-secondary">
                {t(`semantic.constraintLevel.${slotDefinition.constraintLevel}` as never)}
              </span>
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <Input
            inputSize="sm"
            className="min-w-[100px]"
            value={nameText}
            placeholder={t('schema.fieldName')}
            onChange={(e) => {
              markDirty();
              setNameText(e.target.value);
            }}
            onBlur={() => {
              markDirty();
              onUpdate(field.id, { name: nameText });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                markDirty();
                onUpdate(field.id, { name: nameText });
              }
            }}
          />
        </div>
        <Toggle
          checked={field.required}
          onChange={(checked) => {
            markDirty();
            onUpdate(field.id, { required: checked });
          }}
          label={t('schema.required')}
        />
        <Tooltip content={t('schema.deleteField')} position="top">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-state-hover hover:text-status-error"
            onClick={() => {
              markDirty();
              onDelete(field.id);
            }}
          >
            <Trash2 size={14} />
          </button>
        </Tooltip>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(260px,1.2fr)_minmax(220px,0.8fr)]">
        <div className="min-w-0">
          <div className="mb-1 text-[11px] font-medium text-secondary">
            {t('schema.fieldBehaviorLabel' as never)}
          </div>
          <FieldBehaviorSelect
            value={behavior as FieldBehaviorMode}
            onChange={(value) => updateBehavior(value)}
          />
        </div>
        <div className="min-w-0">
          <div className="mb-1 text-[11px] font-medium text-secondary">
            {t('schema.fieldTypeLabel' as never)}
          </div>
          <TypeSelector
            value={field.field_type}
            onChange={(type) => {
              markDirty();
              onUpdate(field.id, {
                field_type: type,
                bindings: CHOICE_TYPES.has(type)
                  ? createChoiceSourceBinding(type, sourceSchemaId)
                  : createBehaviorBinding(behavior, sourceSchemaId, configText),
              });
            }}
            allowedTypes={allowedTypes}
          />
        </div>
      </div>

      {showChoiceOptions && (
        <div className="flex flex-col gap-1.5">
          <Input
            inputSize="sm"
            value={optionsText}
            placeholder={t('schema.options')}
            onChange={(e) => {
              markDirty();
              setOptionsText(e.target.value);
            }}
            onBlur={commitOptions}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitOptions();
            }}
          />
          <div>
            <div className="mb-1 text-[11px] font-medium text-secondary">
              {t('schema.instanceOptions' as never)}
            </div>
            <SchemaSourcePicker mode="schema" value={sourceSchemaId} excludeSchemaId={field.schema_id} onChange={updateSourceSchema} />
          </div>
        </div>
      )}

      {showSourceSchema && (
        <div>
          <div className="mb-1 text-[11px] font-medium text-secondary">
            {t('schema.sourceSchema' as never)}
          </div>
          <SchemaSourcePicker mode="schema" value={sourceSchemaId} excludeSchemaId={field.schema_id} onChange={updateSourceSchema} />
        </div>
      )}

      {(behavior === 'conditional_field' || behavior === 'computed_field' || behavior === 'derived_collection') && (
        <div>
          <div className="mb-1 text-[11px] font-medium text-secondary">
            {behavior === 'computed_field'
              ? t('schema.fieldBehaviorConfig.computed' as never)
              : behavior === 'conditional_field'
                ? t('schema.fieldBehaviorConfig.conditional' as never)
                : t('schema.fieldBehaviorConfig.derived' as never)}
          </div>
          <Input
            inputSize="sm"
            value={configText}
            placeholder={behavior === 'computed_field'
              ? t('schema.fieldBehaviorConfig.computedPlaceholder' as never)
              : behavior === 'conditional_field'
                ? t('schema.fieldBehaviorConfig.conditionalPlaceholder' as never)
                : t('schema.fieldBehaviorConfig.derivedPlaceholder' as never)}
            onChange={(event) => {
              markDirty();
              setConfigText(event.target.value);
            }}
            onBlur={commitConfig}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitConfig();
            }}
          />
        </div>
      )}
    </div>
  );
}
