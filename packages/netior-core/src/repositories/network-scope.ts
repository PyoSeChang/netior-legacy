import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';

export function getDefaultOwnerNetworkIdForProjectDb(
  db: Database.Database,
  projectId: string | null | undefined,
): string | null {
  if (!projectId) return null;
  const row = db.prepare(
    `SELECT id
       FROM networks
      WHERE project_id = ?
        AND kind = 'ontology'
      ORDER BY created_at
      LIMIT 1`,
  ).get(projectId) as { id: string } | undefined;
  return row?.id ?? null;
}

export function ensureObjectScopeBindingForDb(
  db: Database.Database,
  data: {
    objectId: string;
    scopeNetworkId: string | null | undefined;
    includeDescendants?: boolean;
    bindingKind?: string;
    sourceKind?: string;
    sourceId?: string | null;
    sourceRef?: string | null;
    sourceVersion?: string | null;
  },
): void {
  if (!data.scopeNetworkId) return;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR IGNORE INTO object_scope_bindings (
       id, object_id, scope_network_id, include_descendants, binding_kind, source_kind,
       source_id, source_ref, source_version, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    data.objectId,
    data.scopeNetworkId,
    data.includeDescendants === false ? 0 : 1,
    data.bindingKind ?? 'visible',
    data.sourceKind ?? 'project',
    data.sourceId ?? null,
    data.sourceRef ?? null,
    data.sourceVersion ?? null,
    now,
    now,
  );
}
