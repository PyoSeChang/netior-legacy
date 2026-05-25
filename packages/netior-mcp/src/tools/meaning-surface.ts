import type {
  FieldType,
  Meaning,
} from '@netior/shared/types';

export type AgentFieldType = FieldType;

export function toAgentFieldType(fieldType: FieldType): AgentFieldType {
  return fieldType;
}

export function fromAgentFieldType(fieldType: AgentFieldType): FieldType {
  return fieldType;
}

export function toAgentMeaning(meaning: Meaning) {
  return {
    ...meaning,
  };
}
