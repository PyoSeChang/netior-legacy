import type { NarreSkillDefinition } from './types.js';

function buildInteractiveViewPrompt(): string {
  return `## Active Skill: Interactive View
You are authoring a Netior Interactive View for an existing instance.

Interactive View is not a preset library and not a separate editor. It is a user-approved TSX view module rendered inside InstanceEditor.

Required workflow:
1. Resolve the mentioned instance and its schema/fields.
2. Inspect existing field values only as needed.
3. Draft source_code and manifest_json.
4. Call dry_run_interactive_view_template with the exact source_code and manifest_json.
5. If dry run fails, revise and dry-run again before asking for approval or saving.
6. Create or update a schema-scoped interactive view template by default.
7. Set that template as the schema default so instances inherit it automatically.
8. Use an instance preference only when the user explicitly asks for one instance to override the schema default or disable the view.

Source contract:
- Write normal TSX.
- Import UI/runtime APIs only from "@netior/interactive-sdk" and React APIs only from "react".
- Available "@netior/interactive-sdk" exports are exactly: ViewRoot, Button, IconButton, TextInput, TextArea, Select, Checkbox, Toggle, Field, FieldEditor, Inline, Panel, Stack, Badge, Chip, Divider, useContent, useField, useFieldValue, useFields, useCurrentInstance, useOpenObject, useOpenInstance, useUpdateField, useViewState, useDslValue, useDslObject, useDslObjects.
- Prefer SDK UI primitives over raw HTML controls. Use IconButton for compact icon actions such as previous/next, Chip for tag/list values, Select/Checkbox/Toggle/TextInput/TextArea for controls, and ViewRoot as the top-level view container.
- Export default, View, or InteractiveView.
- Use useField/useFields/useContent to read instance data.
- Use useDslValue/useDslObject/useDslObjects when the view needs scoped lookup, semantic navigation, relative next/previous, or aggregates.
- Netior DSL operator names are exact JSON AST values. Use "instances", "field.value", "field.object", "filter", "equals", "sort", "aggregate", and "relative". Never invent operators such as "objects", "eq", "field", "id", "title", "select", or SQL-like orderBy arrays.
- For next/previous question navigation, use "relative" with scope {"op":"instances","schemaId":"<schema_id>"}, current {"op":"context.object"}, and orderBy {"fieldId":"<order_field_id>"}.
- useDslObject returns { value, loading, error }. useDslObjects can be mapped as an array, but for relative next/previous use useDslObject and read result.value.refId.
- For navigation inside an Interactive View, use useOpenObject('instance', refId, title) or useOpenInstance(refId, title). This replaces the current editor object and keeps the editor in Interactive View mode.
- Use useViewState for interaction progress such as selection, checked state, open sections, attempts, and step index.
- Use useUpdateField only when the user explicitly wants to change real instance fields.
- Never use window, document, storage APIs, fetch, eval, Function, dynamic import, or renderer/main/core imports.

Manifest contract:
- kind must be "interactive-view".
- sdkVersion must be 1.
- target should use {"kind":"schema","id":"<schema_id>"} for schema defaults or {"kind":"instance","id":"<instance_id>"} for one-off overrides.
- permissions.readFields must list the fields the view reads, or "*" only when the view genuinely works across arbitrary fields.
- permissions.writeFields should be empty unless the view changes actual instance fields.
- permissions.dsl must be true when the source uses useDslValue/useDslObject/useDslObjects.
- permissions.viewState should be true when the view keeps UI/progress state.
- Narre-generated templates should use runtime "sandbox".
- For normal authoring, target_kind should be "schema" and target_id should be the current instance schema ID.
- Use target_kind "instance" only for a deliberate one-off instance override.
- Never use legacy manifest keys such as target.schemaId, permissions.fields.read, or permissions.fields.write.

For exam/question views:
- Treat quiz checking as view interaction logic, not as a Netior preset.
- Read the question, optional image/attachment field, choices, answer, and explanation from the instance fields that actually exist.
- Render choices from the stored field value; support newline, JSON array, or pipe-separated choices if the stored format is uncertain.
- Compare the selected choice with the answer in TSX and show immediate correct/incorrect feedback.
- Store selected choice, checked state, and explanation visibility in view state.
- Use exact DSL selectors for next/previous question navigation when the schema and order field are known.
- Do not write fields unless the user explicitly asks to record a score, status, or note.`;
}

export const interactiveViewSkill: NarreSkillDefinition = {
  id: 'interactive-view',
  name: 'interactive-view',
  description: 'narre.command.interactiveView',
  source: 'builtin',
  trigger: { type: 'slash', name: 'interactive-view' },
  hint: 'narre.command.interactiveViewHint',
  additionalToolProfiles: ['interactive-view-authoring'],
  requiredMentionTypes: ['instance'],
  buildPrompt: () => buildInteractiveViewPrompt(),
};
