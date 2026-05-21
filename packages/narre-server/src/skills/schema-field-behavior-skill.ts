import type { NarreSkillDefinition } from './types.js';

function buildSchemaFieldBehaviorPrompt(): string {
  return `## Active Skill: Schema Field Behavior Authoring
You are configuring advanced schema field behavior from a user's domain request.

Required workflow:
1. Resolve the target schema, target field, and any condition/source fields before writing behavior.
2. For simple "show/require this field when that field equals value" requests, prefer set_conditional_field_visibility.
3. Use set_field_behavior_dsl only for advanced behavior that cannot be represented by the convenience conditional visibility tool.
4. Supported advanced behavior kinds are conditional_field, computed_field, and derived_collection.
5. Generate valid Netior DSL yourself. Users describe the domain; they do not author DSL JSON.
6. Validate or save through the MCP tools and do not call the work complete until the returned field includes the saved behavior config.
7. If evaluation or candidate resolution is ambiguous, inspect candidates or ask a concise question instead of guessing.

Authoring rules:
- For conditional visibility, use effect="visible" unless the user clearly asks for required/validation behavior.
- Use exact schemaId and fieldId selectors when the relevant fields were just created or inspected.
- If the condition lives on an object referenced by the current schema, pass via_field_id when using set_conditional_field_visibility.
- Use semantic selectors only while discovering unknown targets, then converge to exact selectors before saving.
- Never invent DSL operators. Use the supported JSON AST operators already exposed by Netior DSL.`;
}

export const schemaFieldBehaviorSkill: NarreSkillDefinition = {
  id: 'schema-field-behavior',
  name: 'schema-field-behavior',
  description: 'narre.command.schemaFieldBehavior',
  source: 'builtin',
  trigger: { type: 'slash', name: 'schema-field-behavior' },
  hint: 'narre.command.schemaFieldBehaviorHint',
  additionalToolProfiles: ['schema-field-behavior'],
  buildPrompt: () => buildSchemaFieldBehaviorPrompt(),
};
