import type {
  FieldType,
  Model,
} from '@netior/shared/types';

export type AgentFieldType = Exclude<FieldType, 'schema_ref'> | 'schema_ref';

export function toAgentFieldType(fieldType: FieldType): AgentFieldType {
  return fieldType === 'schema_ref' ? 'schema_ref' : fieldType;
}

export function fromAgentFieldType(fieldType: AgentFieldType): FieldType {
  return fieldType === 'schema_ref' ? 'schema_ref' : fieldType;
}

export function toAgentModel(model: Model) {
  return {
    ...model,
  };
}
