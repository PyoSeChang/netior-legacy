import type Database from 'better-sqlite3';

type TableColumn = {
  name: string;
};

function tableExists(db: Database.Database, table: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table);
  return !!row;
}

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  if (!tableExists(db, table)) return false;
  const columns = db.pragma('table_info(' + table + ')') as TableColumn[];
  return columns.some((entry) => entry.name === column);
}

export function migrate063(db: Database.Database): void {
  if (!tableExists(db, 'modules') || hasColumn(db, 'modules', 'description')) return;
  db.exec('ALTER TABLE modules ADD COLUMN description TEXT');
}
