import type {
  FieldType,
  Model,
} from '@netior/shared/types';

export type AgentFieldType = FieldType;

export function toAgentFieldType(fieldType: FieldType): AgentFieldType {
  return fieldType;
}

export function fromAgentFieldType(fieldType: AgentFieldType): FieldType {
  return fieldType;
}

export function toAgentModel(model: Model) {
  return {
    ...model,
  };
}
