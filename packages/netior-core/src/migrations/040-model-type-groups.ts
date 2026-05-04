import type Database from 'better-sqlite3';

function tableExists(db: Database.Database, table: string): boolean {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  return !!row;
}

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  if (!tableExists(db, table)) return false;
  const columns = db.pragma(`table_info(${table})`) as { name: string }[];
  return columns.some((entry) => entry.name === column);
}

const MODEL_CATEGORY_GROUPS = [
  { category: 'time', name: 'Time', sortOrder: 0 },
  { category: 'workflow', name: 'Workflow', sortOrder: 1 },
  { category: 'structure', name: 'Structure', sortOrder: 2 },
  { category: 'knowledge', name: 'Knowledge', sortOrder: 3 },
  { category: 'space', name: 'Space', sortOrder: 4 },
  { category: 'quant', name: 'Quantitative', sortOrder: 5 },
  { category: 'governance', name: 'Governance', sortOrder: 6 },
] as const;

export function migrate040(db: Database.Database): void {
  if (!tableExists(db, 'models')) return;

  if (!hasColumn(db, 'models', 'group_id')) {
    db.exec(`ALTER TABLE models ADD COLUMN group_id TEXT REFERENCES type_groups(id) ON DELETE SET NULL`);
  }

  if (!tableExists(db, 'type_groups')) return;

  const now = new Date().toISOString();
  const insertGroup = db.prepare(`
    INSERT OR IGNORE INTO type_groups (
      id, scope, project_id, kind, name, parent_group_id, sort_order, created_at, updated_at
    )
    VALUES (?, 'project', ?, 'model', ?, ?, ?, ?, ?)
  `);
  const updateGroupParent = db.prepare(`
    UPDATE type_groups
       SET parent_group_id = ?, sort_order = ?, updated_at = ?
     WHERE id = ?
  `);
  const insertObject = db.prepare(`
    INSERT OR IGNORE INTO objects (id, object_type, scope, project_id, ref_id, created_at)
    VALUES (?, 'type_group', 'project', ?, ?, ?)
  `);
  const updateModels = db.prepare(`
    UPDATE models
       SET group_id = ?, updated_at = ?
     WHERE project_id = ?
       AND built_in = 1
       AND category = ?
       AND (group_id IS NULL OR trim(group_id) = '')
  `);
  const projects = db.prepare(`
    SELECT DISTINCT project_id
      FROM models
     WHERE project_id IS NOT NULL
  `).all() as { project_id: string }[];

  for (const project of projects) {
    const rootGroupId = `type-group-${project.project_id}-models`;
    insertGroup.run(rootGroupId, project.project_id, 'Models', null, 0, now, now);
    insertObject.run(`object-type-group-${rootGroupId}`, project.project_id, rootGroupId, now);
    for (const group of MODEL_CATEGORY_GROUPS) {
      const id = `type-group-${project.project_id}-model-${group.category}`;
      insertGroup.run(id, project.project_id, group.name, rootGroupId, group.sortOrder + 1, now, now);
      updateGroupParent.run(rootGroupId, group.sortOrder + 1, now, id);
      insertObject.run(`object-type-group-${id}`, project.project_id, id, now);
      updateModels.run(id, now, project.project_id, group.category);
    }
  }
}
