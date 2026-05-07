import type {
  Schema,
  SchemaField,
  SchemaMeaning,
  SchemaMeaningSlotBinding,
  Instance,
  FieldType,
  ObjectRecord,
  Model,
} from '@netior/shared/types';

export type AgentFieldType = Exclude<FieldType, 'schema_ref'> | 'schema_ref';
export type AgentObjectType = Exclude<ObjectRecord['object_type'], 'schema'> | 'schema';

export function toAgentFieldType(fieldType: FieldType): AgentFieldType {
  return fieldType === 'schema_ref' ? 'schema_ref' : fieldType;
}

export function fromAgentFieldType(fieldType: AgentFieldType): FieldType {
  return fieldType === 'schema_ref' ? 'schema_ref' : fieldType;
}

export function toAgentObjectType(objectType: ObjectRecord['object_type']): AgentObjectType {
  return objectType === 'schema' ? 'schema' : objectType;
}

export function fromAgentObjectType(objectType: AgentObjectType): ObjectRecord['object_type'] {
  return objectType === 'schema' ? 'schema' : objectType;
}

export function toAgentSchema(schema: Schema) {
  const {
    ...rest
  } = schema;

  return {
    ...rest,
  };
}

export function toAgentSchemaField(field: SchemaField) {
  const {
    schema_id,
    ref_schema_id,
    slot_binding_locked: _slotBindingLocked,
    generated_by_model: _generatedByModel,
    ...schemaField
  } = field;

  return {
    ...schemaField,
    schema_id: schema_id,
    field_type: toAgentFieldType(field.field_type),
    ref_schema_id: ref_schema_id,
  };
}

export function toAgentMeaningSlot(slot: SchemaMeaningSlotBinding) {
  const {
    meaning_id,
    ...rest
  } = slot;

  return {
    ...rest,
    schema_meaning_id: meaning_id,
  };
}

export function toAgentSchemaMeaning(meaning: SchemaMeaning) {
  const {
    schema_id,
    source_model: _sourceModel,
    slots,
    ...schemaMeaning
  } = meaning;

  return {
    ...schemaMeaning,
    schema_id: schema_id,
    slots: slots.map(toAgentMeaningSlot),
  };
}

export function toAgentInstance(instance: Instance) {
  const {
    schema_id,
    ...rest
  } = instance;

  return {
    ...rest,
    schema_id: schema_id,
  };
}

export function toAgentObject(record: ObjectRecord) {
  return {
    ...record,
    object_type: toAgentObjectType(record.object_type),
  };
}

export function toAgentModel(model: Model) {
  return {
    ...model,
    recipe: {
      ...model.recipe,
      meanings: model.recipe.meanings.map((meaning) => ({
        ...meaning,
        fields: meaning.fields.map((field) => ({
          ...field,
          field_types: field.field_types.map(toAgentFieldType),
        })),
      })),
    },
  };
}
