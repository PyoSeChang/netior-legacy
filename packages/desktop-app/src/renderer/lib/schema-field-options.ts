export interface SchemaFieldOptionsConfig {
  choices: string[];
  instanceOptionSourceIds: string[];
}

export function parseSchemaFieldOptions(options: string | null): SchemaFieldOptionsConfig {
  if (!options) {
    return { choices: [], instanceOptionSourceIds: [] };
  }

  try {
    const parsed = JSON.parse(options) as Record<string, unknown>;
    const choices = Array.isArray(parsed.choices)
      ? parsed.choices.filter((item): item is string => typeof item === 'string')
      : [];
    const instanceOptionSourceIds = Array.isArray(parsed.instanceOptionSourceIds)
      ? parsed.instanceOptionSourceIds.filter((item): item is string => typeof item === 'string')
      : [];

    return { choices, instanceOptionSourceIds };
  } catch {
    return { choices: [], instanceOptionSourceIds: [] };
  }
}

export function stringifySchemaFieldOptions(config: Partial<SchemaFieldOptionsConfig>): string | null {
  const normalized: Record<string, string[]> = {};
  const choices = config.choices?.filter(Boolean) ?? [];
  const instanceOptionSourceIds = config.instanceOptionSourceIds?.filter(Boolean) ?? [];

  if (choices.length > 0) normalized.choices = choices;
  if (instanceOptionSourceIds.length > 0) normalized.instanceOptionSourceIds = instanceOptionSourceIds;

  return Object.keys(normalized).length > 0 ? JSON.stringify(normalized) : null;
}

export function toInstanceOptionValue(instanceId: string): string {
  return `instance:${instanceId}`;
}

export function fromInstanceOptionValue(value: string): string | null {
  return value.startsWith('instance:') ? value.slice('instance:'.length) : null;
}
