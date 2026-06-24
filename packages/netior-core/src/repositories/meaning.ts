import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import { createObject, deleteObjectByRef, getObjectByRef } from './objects';
import { ensureObjectScopeBindingForDb, getDefaultOwnerNetworkIdForWorldDb } from './network-scope';
import { syncRootNetworkOntologyForDb } from './system-networks';
import { ensureMeaningCategoryTaxonomyForWorldDb } from './meaning-category';
import {
  SEMANTIC_MEANING_DEFINITIONS,
  MEANING_DEFINITIONS,
  getMeaningSlotDefinition,
} from '@netior/shared/constants';
import type {
  FieldType,
  EdgeLineStyle,
  SemanticCategoryRefKey,
  SemanticMeaningKey,
  Meaning,
  MeaningCreate,
  MeaningFieldRecipe,
  MeaningAspectRecipe,
  MeaningContract,
  MeaningRepresentationKind,
  MeaningRuleRecipe,
  MeaningRefKey,
  MeaningTargetKind,
  MeaningUpdate,
  MeaningSlotKey,
  OntologySourceKind,
} from '@netior/shared/types';

type Db = ReturnType<typeof getDatabase>;

type MeaningRow = Omit<
  Meaning,
  'meaning_keys' | 'core_slots' | 'optional_slots' | 'recipe' | 'built_in' | 'directed'
> & {
  meaning_keys: string | null;
  core_slots: string | null;
  optional_slots: string | null;
  recipe_json?: string | null;
  built_in: number;
  directed: number | null;
  category_instance_title?: string | null;
  category_instance_source_ref?: string | null;
};

const EMPTY_MODEL_RECIPE: MeaningContract = {
  meanings: [],
  rules: [],
};

const FIELD_TYPES: readonly FieldType[] = [
  'text',
  'textarea',
  'number',
  'boolean',
  'date',
  'datetime',
  'select',
  'multi-select',
  'radio',
  'relation',
  'object',
  'file',
  'url',
  'color',
  'rating',
  'tags',
  'meaning_ref',
];

const REPRESENTATION_KINDS: readonly MeaningRepresentationKind[] = [
  'single_field',
  'field_group',
  'relation',
  'computed',
];

function parseStringArray<T extends string>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is T => typeof item === 'string' && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function serializeStringArray(values: readonly string[] | undefined): string {
  return JSON.stringify(values ?? []);
}

function updateSchemaMeaningRefs(
  db: Db,
  rootNetworkId: string,
  rewrite: (refs: MeaningRefKey[]) => MeaningRefKey[],
): void {
  const rows = db.prepare('SELECT id, meanings FROM schemas WHERE root_network_id = ?').all(rootNetworkId) as Array<{
    id: string;
    meanings: string | null;
  }>;
  const update = db.prepare('UPDATE schemas SET meanings = ?, updated_at = ? WHERE id = ?');

  for (const row of rows) {
    const current = parseStringArray<MeaningRefKey>(row.meanings);
    const next = [...new Set(rewrite(current))];
    if (JSON.stringify(current) === JSON.stringify(next)) continue;
    update.run(serializeStringArray(next), new Date().toISOString(), row.id);
  }
}

function replaceSchemaMeaningRef(
  db: Db,
  rootNetworkId: string,
  oldKey: MeaningRefKey,
  newKey: MeaningRefKey,
): void {
  if (oldKey === newKey) return;
  updateSchemaMeaningRefs(db, rootNetworkId, (refs) => refs.map((ref) => (ref === oldKey ? newKey : ref)));
}

function removeSchemaMeaningRef(db: Db, rootNetworkId: string, key: MeaningRefKey): void {
  updateSchemaMeaningRefs(db, rootNetworkId, (refs) => refs.filter((ref) => ref !== key));
}

function normalizeRecipeField(raw: unknown, fallbackIndex: number): MeaningFieldRecipe | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<MeaningFieldRecipe>;
  const legacyItem = raw as { field_type?: unknown };
  const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : '';
  if (!name) return null;
  const key = typeof item.key === 'string' && item.key.trim()
    ? normalizeMeaningKey(item.key)
    : normalizeMeaningKey(name);
  const fieldTypes: FieldType[] = Array.isArray(item.field_types)
    ? item.field_types.filter((type): type is FieldType => FIELD_TYPES.includes(type as FieldType))
    : FIELD_TYPES.includes(legacyItem.field_type as FieldType)
      ? [legacyItem.field_type as FieldType]
      : ['text'];
  return {
    id: typeof item.id === 'string' && item.id.trim() ? item.id : `field-${fallbackIndex + 1}`,
    key,
    name,
    field_types: fieldTypes.length > 0 ? fieldTypes : ['text'],
    required: Boolean(item.required),
    description: typeof item.description === 'string' && item.description.trim() ? item.description : null,
    options: typeof item.options === 'string' && item.options.trim() ? item.options : null,
  };
}

function normalizeRecipeMeaning(raw: unknown, fallbackIndex: number): MeaningAspectRecipe | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<MeaningAspectRecipe>;
  const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : '';
  if (!name) return null;
  const key = typeof item.key === 'string' && item.key.trim()
    ? normalizeMeaningKey(item.key)
    : normalizeMeaningKey(name);
  const fields = Array.isArray(item.fields)
    ? item.fields.map(normalizeRecipeField).filter((field): field is MeaningFieldRecipe => Boolean(field))
    : [];
  return {
    id: typeof item.id === 'string' && item.id.trim() ? item.id : `role-${fallbackIndex + 1}`,
    key,
    name,
    description: typeof item.description === 'string' && item.description.trim() ? item.description : null,
    representation: REPRESENTATION_KINDS.includes(item.representation as MeaningRepresentationKind)
      ? item.representation as MeaningRepresentationKind
      : fields.length > 1
        ? 'field_group'
        : 'single_field',
    fields,
  };
}

function normalizeRecipeRule(raw: unknown, fallbackIndex: number): MeaningRuleRecipe | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<MeaningRuleRecipe>;
  const description = typeof item.description === 'string' && item.description.trim()
    ? item.description.trim()
    : '';
  if (!description) return null;
  return {
    id: typeof item.id === 'string' && item.id.trim() ? item.id : `rule-${fallbackIndex + 1}`,
    description,
  };
}

function normalizeMeaningContract(raw: unknown): MeaningContract {
  if (!raw || typeof raw !== 'object') return EMPTY_MODEL_RECIPE;
  const recipe = raw as Partial<MeaningContract>;
  const legacyRecipe = raw as { roles?: unknown };
  const rawMeanings = Array.isArray(recipe.meanings) ? recipe.meanings : legacyRecipe.roles;
  return {
    meanings: Array.isArray(rawMeanings)
      ? rawMeanings.map(normalizeRecipeMeaning).filter((meaning): meaning is MeaningAspectRecipe => Boolean(meaning))
      : [],
    rules: Array.isArray(recipe.rules)
      ? recipe.rules.map(normalizeRecipeRule).filter((rule): rule is MeaningRuleRecipe => Boolean(rule))
      : [],
  };
}

function parseMeaningContract(raw: string | null | undefined): MeaningContract {
  if (!raw) return EMPTY_MODEL_RECIPE;
  try {
    return normalizeMeaningContract(JSON.parse(raw));
  } catch {
    return EMPTY_MODEL_RECIPE;
  }
}

function serializeMeaningContract(recipe: MeaningContract | undefined): string {
  return JSON.stringify(normalizeMeaningContract(recipe));
}

function buildContractForBuiltInMeaning(
  definition: (typeof MEANING_DEFINITIONS)[number],
): MeaningContract {
  if ((definition.targetKind ?? 'object') === 'relation') {
    return {
      meanings: [{
        id: definition.key,
        key: definition.key,
        name: definition.label,
        description: definition.description ?? null,
        representation: 'relation',
        fields: [],
      }],
      rules: [],
    };
  }

  return {
    meanings: definition.meanings.map((meaningKey) => {
      const meaningDefinition = SEMANTIC_MEANING_DEFINITIONS.find((entry) => entry.key === meaningKey);
      const coreSlots = meaningDefinition?.coreSlots ?? [];
      const optionalSlots = meaningDefinition?.optionalSlots ?? [];
      const fields = [...coreSlots, ...optionalSlots].map((slot) => {
        const slotDefinition = getMeaningSlotDefinition(slot);
        return {
          id: slot,
          key: slot,
          name: slotDefinition?.label ?? slot,
          field_types: [...(slotDefinition?.allowedFieldTypes ?? ['text'])],
          required: coreSlots.includes(slot),
          description: null,
          options: null,
        };
      });

      return {
        id: meaningKey,
        key: meaningKey,
        name: meaningDefinition?.label ?? meaningKey,
        description: meaningDefinition?.description ?? null,
        representation: fields.length > 1 ? 'field_group' : 'single_field',
        fields,
      };
    }),
    rules: [],
  };
}

function isEmptyRecipe(raw: string | null | undefined): boolean {
  const recipe = parseMeaningContract(raw);
  return recipe.meanings.length === 0 && recipe.rules.length === 0;
}

function getBuiltInMeaningContract(key: string): MeaningContract | null {
  const definition = MEANING_DEFINITIONS.find((entry) => entry.key === key);
  return definition ? buildContractForBuiltInMeaning(definition) : null;
}

function normalizeMeaningKey(value: string): MeaningRefKey {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (normalized || 'meaning') as MeaningRefKey;
}

function getUniqueMeaningKey(
  db: Db,
  rootNetworkId: string,
  baseKey: MeaningRefKey,
  excludeId?: string,
): MeaningRefKey {
  const normalized = normalizeMeaningKey(baseKey);
  let candidate = normalized;
  let suffix = 2;
  while (true) {
    const existing = db.prepare(
      'SELECT id FROM meanings WHERE root_network_id = ? AND key = ?',
    ).get(rootNetworkId, candidate) as { id: string } | undefined;
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${normalized}_${suffix}` as MeaningRefKey;
    suffix += 1;
  }
}

function deriveSlotsForMeanings(meaningKeys: readonly SemanticMeaningKey[]): {
  coreSlots: MeaningSlotKey[];
  optionalSlots: MeaningSlotKey[];
} {
  const coreSlots = new Set<MeaningSlotKey>();
  const optionalSlots = new Set<MeaningSlotKey>();
  for (const key of meaningKeys) {
    const definition = SEMANTIC_MEANING_DEFINITIONS.find((entry) => entry.key === key);
    if (!definition) continue;
    definition.coreSlots.forEach((slot) => coreSlots.add(slot));
    definition.optionalSlots.forEach((slot) => optionalSlots.add(slot));
  }
  return { coreSlots: [...coreSlots], optionalSlots: [...optionalSlots] };
}

function toMeaning(row: MeaningRow): Meaning {
  return {
    ...row,
    key: row.key as MeaningRefKey,
    category_instance_id: row.category_instance_id ?? null,
    category_instance_title: row.category_instance_title ?? null,
    category_instance_source_ref: row.category_instance_source_ref ?? null,
    target_kind: (row.target_kind ?? 'object') as MeaningTargetKind,
    meaning_keys: parseStringArray<SemanticMeaningKey>(row.meaning_keys),
    core_slots: parseStringArray<MeaningSlotKey>(row.core_slots),
    optional_slots: parseStringArray<MeaningSlotKey>(row.optional_slots),
    recipe: parseMeaningContract(row.recipe_json),
    line_style: (row.line_style ?? null) as EdgeLineStyle | null,
    directed: row.directed == null ? null : !!row.directed,
    built_in: !!row.built_in,
  };
}

function ensureObjectForMeaning(
  db: Db,
  meaning: Pick<MeaningRow, 'id' | 'root_network_id' | 'owner_network_id' | 'created_at'>,
): void {
  const existing = getObjectByRef('meaning', meaning.id);
  const object = existing ?? createObject('meaning', 'world', meaning.root_network_id, meaning.id);
  ensureObjectScopeBindingForDb(db, {
    objectId: object.id,
    scopeNetworkId: meaning.owner_network_id ?? getDefaultOwnerNetworkIdForWorldDb(db, meaning.root_network_id),
    sourceKind: 'world',
  });
}

function assertMeaningCategoryInstance(db: Db, rootNetworkId: string, categoryInstanceId: string | null | undefined): void {
  if (!categoryInstanceId) return;
  const { schemaId } = ensureMeaningCategoryTaxonomyForWorldDb(db, rootNetworkId);
  const row = db.prepare(
    'SELECT id FROM instances WHERE id = ? AND root_network_id = ? AND schema_id = ?',
  ).get(categoryInstanceId, rootNetworkId, schemaId);
  if (!row) {
    throw new Error(`Meaning category instance not found in world meaning category schema: ${categoryInstanceId}`);
  }
}

export function seedBuiltInMeaningsForWorldDb(db: Db, rootNetworkId: string): void {
  const now = new Date().toISOString();
  const { instancesByKey } = ensureMeaningCategoryTaxonomyForWorldDb(db, rootNetworkId);
  const ownerNetworkId = getDefaultOwnerNetworkIdForWorldDb(db, rootNetworkId);
  const insertMeaning = db.prepare(`
    INSERT OR IGNORE INTO meanings (
      id, root_network_id, owner_network_id, key, name, description, category_instance_id,
      target_kind, meaning_keys, core_slots, optional_slots, recipe_json,
      color, icon, line_style, directed, built_in,
      source_kind, source_id, source_ref, source_version, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 1, 'system', 'netior.system', ?, '1', ?, ?)
  `);
  const updateMissingDescription = db.prepare(`
    UPDATE meanings
       SET description = ?, updated_at = ?
     WHERE root_network_id = ?
       AND key = ?
       AND built_in = 1
       AND (description IS NULL OR trim(description) = '')
  `);
  const updateMissingRecipe = db.prepare(`
    UPDATE meanings
       SET recipe_json = ?, updated_at = ?
     WHERE root_network_id = ?
       AND key = ?
       AND built_in = 1
       AND (recipe_json IS NULL OR trim(recipe_json) = '' OR recipe_json = '{"roles":[],"rules":[]}' OR recipe_json = '{"meanings":[],"rules":[]}')
  `);
  const updateMissingIcon = db.prepare(`
    UPDATE meanings
       SET icon = ?, updated_at = ?
     WHERE root_network_id = ?
       AND key = ?
       AND built_in = 1
       AND (icon IS NULL OR trim(icon) = '' OR icon IN ('box', 'boxes'))
  `);
  for (const definition of MEANING_DEFINITIONS) {
    const id = `meaning-${rootNetworkId}-${definition.key}`;
    const description = definition.description ?? null;
    const recipeJson = serializeMeaningContract(buildContractForBuiltInMeaning(definition));
    const icon = (definition as { icon?: string }).icon ?? null;
    insertMeaning.run(
      id,
      rootNetworkId,
      ownerNetworkId,
      definition.key,
      definition.label,
      description,
      instancesByKey.get(definition.category)?.id ?? null,
      definition.targetKind ?? 'object',
      serializeStringArray(definition.meanings),
      serializeStringArray(definition.coreSlots),
      serializeStringArray(definition.optionalSlots),
      recipeJson,
      icon,
      definition.lineStyle ?? null,
      definition.directed == null ? null : (definition.directed ? 1 : 0),
      `meaning.${definition.key}`,
      now,
      now,
    );
    if (description) {
      updateMissingDescription.run(description, now, rootNetworkId, definition.key);
    }
    if (icon) {
      updateMissingIcon.run(icon, now, rootNetworkId, definition.key);
    }
    updateMissingRecipe.run(recipeJson, now, rootNetworkId, definition.key);
    db.prepare('UPDATE meanings SET owner_network_id = ?, updated_at = ? WHERE id = ?')
      .run(ownerNetworkId, now, id);
    ensureObjectForMeaning(db, { id, root_network_id: rootNetworkId, owner_network_id: ownerNetworkId, created_at: now });
  }
}

function removeMeaningFromEdges(db: Db, meaningId: string): void {
  db.prepare('UPDATE edges SET meaning_id = NULL WHERE meaning_id = ?').run(meaningId);
}

export function createMeaning(data: MeaningCreate): Meaning {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();
  const meaningKeys = data.meaning_keys ?? [];
  const derivedSlots = deriveSlotsForMeanings(meaningKeys);
  const key = getUniqueMeaningKey(db, data.root_network_id, data.key ?? normalizeMeaningKey(data.name));
  const sourceKind = data.source_kind ?? (data.built_in ? 'system' : 'world');
  const ownerNetworkId = data.owner_network_id ?? getDefaultOwnerNetworkIdForWorldDb(db, data.root_network_id);
  assertMeaningCategoryInstance(db, data.root_network_id, data.category_instance_id);

  db.prepare(
    `INSERT INTO meanings (
      id, root_network_id, owner_network_id, key, name, description, category_instance_id,
      target_kind, meaning_keys, core_slots, optional_slots, recipe_json,
      color, icon, line_style, directed, built_in,
      source_kind, source_id, source_ref, source_version, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    data.root_network_id,
    ownerNetworkId,
    key,
    data.name,
    data.description ?? null,
    data.category_instance_id ?? null,
    data.target_kind ?? 'object',
    serializeStringArray(meaningKeys),
    serializeStringArray(data.core_slots ?? derivedSlots.coreSlots),
    serializeStringArray(data.optional_slots ?? derivedSlots.optionalSlots),
    serializeMeaningContract(data.recipe),
    data.color ?? null,
    data.icon ?? null,
    data.line_style ?? null,
    data.directed == null ? null : (data.directed ? 1 : 0),
    data.built_in ? 1 : 0,
    sourceKind,
    data.source_id ?? null,
    data.source_ref ?? null,
    data.source_version ?? null,
    now,
    now,
  );

  const object = createObject('meaning', 'world', data.root_network_id, id);
  ensureObjectScopeBindingForDb(db, {
    objectId: object.id,
    scopeNetworkId: ownerNetworkId,
    sourceKind,
    sourceId: data.source_id ?? null,
    sourceRef: data.source_ref ?? null,
    sourceVersion: data.source_version ?? null,
  });
  syncRootNetworkOntologyForDb(db, data.root_network_id);

  return getMeaning(id)!;
}

export function listMeanings(rootNetworkId: string): Meaning[] {
  const db = getDatabase();
  db.transaction(() => {
    seedBuiltInMeaningsForWorldDb(db, rootNetworkId);
    syncRootNetworkOntologyForDb(db, rootNetworkId);
  })();
  const rows = db
    .prepare(`
      SELECT m.*, c.title AS category_instance_title, c.source_ref AS category_instance_source_ref
        FROM meanings m
        LEFT JOIN instances c ON c.id = m.category_instance_id
       WHERE m.root_network_id = ?
       ORDER BY m.built_in DESC, COALESCE(c.title, ''), m.name
    `)
    .all(rootNetworkId) as MeaningRow[];
  const updateRecipe = db.prepare('UPDATE meanings SET recipe_json = ?, updated_at = ? WHERE id = ?');
  for (const row of rows) {
    ensureObjectForMeaning(db, row);
    if (row.built_in && isEmptyRecipe(row.recipe_json)) {
      const builtInRecipe = getBuiltInMeaningContract(row.key);
      if (builtInRecipe) {
        row.recipe_json = serializeMeaningContract(builtInRecipe);
        updateRecipe.run(row.recipe_json, new Date().toISOString(), row.id);
      }
    }
  }
  return rows.map(toMeaning);
}

export function getMeaning(id: string): Meaning | undefined {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT m.*, c.title AS category_instance_title, c.source_ref AS category_instance_source_ref
      FROM meanings m
      LEFT JOIN instances c ON c.id = m.category_instance_id
     WHERE m.id = ?
  `).get(id) as MeaningRow | undefined;
  if (row?.built_in && isEmptyRecipe(row.recipe_json)) {
    const builtInRecipe = getBuiltInMeaningContract(row.key);
    if (builtInRecipe) {
      row.recipe_json = serializeMeaningContract(builtInRecipe);
      db.prepare('UPDATE meanings SET recipe_json = ?, updated_at = ? WHERE id = ?')
        .run(row.recipe_json, new Date().toISOString(), row.id);
    }
  }
  return row ? toMeaning(row) : undefined;
}

export function updateMeaning(id: string, data: MeaningUpdate): Meaning | undefined {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM meanings WHERE id = ?').get(id) as MeaningRow | undefined;
  if (!existing) return undefined;

  const meaningKeysChanged = data.meaning_keys !== undefined;
  const nextMeaningKeys = data.meaning_keys ?? parseStringArray<SemanticMeaningKey>(existing.meaning_keys);
  const derivedSlots = deriveSlotsForMeanings(nextMeaningKeys);
  const nextKey = data.key !== undefined
    ? getUniqueMeaningKey(db, existing.root_network_id, data.key, id)
    : existing.key as MeaningRefKey;
  const now = new Date().toISOString();
  assertMeaningCategoryInstance(db, existing.root_network_id, data.category_instance_id);

  db.prepare(
    `UPDATE meanings
        SET owner_network_id = ?, key = ?, name = ?, description = ?, category_instance_id = ?, target_kind = ?, meaning_keys = ?,
            core_slots = ?, optional_slots = ?, recipe_json = ?, color = ?, icon = ?,
            line_style = ?, directed = ?, built_in = ?,
            source_kind = ?, source_id = ?, source_ref = ?, source_version = ?, updated_at = ?
      WHERE id = ?`,
  ).run(
    data.owner_network_id !== undefined ? data.owner_network_id : existing.owner_network_id,
    nextKey,
    data.name !== undefined ? data.name : existing.name,
    data.description !== undefined ? data.description : existing.description,
    data.category_instance_id !== undefined ? data.category_instance_id : existing.category_instance_id,
    data.target_kind !== undefined ? data.target_kind : existing.target_kind,
    serializeStringArray(nextMeaningKeys),
    serializeStringArray(data.core_slots ?? (meaningKeysChanged ? derivedSlots.coreSlots : parseStringArray<MeaningSlotKey>(existing.core_slots))),
    serializeStringArray(data.optional_slots ?? (meaningKeysChanged ? derivedSlots.optionalSlots : parseStringArray<MeaningSlotKey>(existing.optional_slots))),
    data.recipe !== undefined ? serializeMeaningContract(data.recipe) : existing.recipe_json ?? serializeMeaningContract(undefined),
    data.color !== undefined ? data.color : existing.color,
    data.icon !== undefined ? data.icon : existing.icon,
    data.line_style !== undefined ? data.line_style : existing.line_style,
    data.directed !== undefined ? (data.directed == null ? null : (data.directed ? 1 : 0)) : existing.directed,
    data.built_in !== undefined ? (data.built_in ? 1 : 0) : existing.built_in,
    data.source_kind !== undefined ? data.source_kind : existing.source_kind,
    data.source_id !== undefined ? data.source_id : existing.source_id,
    data.source_ref !== undefined ? data.source_ref : existing.source_ref,
    data.source_version !== undefined ? data.source_version : existing.source_version,
    now,
    id,
  );

  replaceSchemaMeaningRef(db, existing.root_network_id, existing.key as MeaningRefKey, nextKey);

  return getMeaning(id);
}

export function deleteMeaning(id: string): boolean {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM meanings WHERE id = ?').get(id) as MeaningRow | undefined;
  if (!existing) {
    console.warn('[ModelDelete][core] missing meaning row', { id });
    return false;
  }

  const object = getObjectByRef('meaning', id);
  const objectNodeCount = object
    ? (db.prepare('SELECT COUNT(*) AS count FROM network_nodes WHERE object_id = ?').get(object.id) as { count: number }).count
    : 0;
  const edgeModelCount = (db.prepare('SELECT COUNT(*) AS count FROM edges WHERE meaning_id = ?').get(id) as { count: number }).count;
  const schemaModelRefCount = (db.prepare('SELECT COUNT(*) AS count FROM schemas WHERE meanings LIKE ?').get(`%${existing.key}%`) as { count: number }).count;
  console.info('[ModelDelete][core] start', {
    id,
    rootNetworkId: existing.root_network_id,
    key: existing.key,
    builtIn: !!existing.built_in,
    objectId: object?.id ?? null,
    objectNodeCount,
    edgeModelCount,
    schemaModelRefCount,
  });

  removeMeaningFromEdges(db, id);
  removeSchemaMeaningRef(db, existing.root_network_id, existing.key as MeaningRefKey);
  const deletedObject = deleteObjectByRef('meaning', id);
  console.info('[ModelDelete][core] object cleanup', { id, deletedObject });

  const result = db.prepare('DELETE FROM meanings WHERE id = ?').run(id);
  console.info('[ModelDelete][core] meaning delete statement', { id, changes: result.changes });
  if (result.changes === 0) return false;

  syncRootNetworkOntologyForDb(db, existing.root_network_id);
  const remainingModel = db.prepare('SELECT id FROM meanings WHERE id = ?').get(id) as { id: string } | undefined;
  const remainingObject = getObjectByRef('meaning', id);
  console.info('[ModelDelete][core] after ontology sync', {
    id,
    remainingModel: Boolean(remainingModel),
    remainingObject: Boolean(remainingObject),
  });
  return true;
}
