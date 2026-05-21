import type Database from 'better-sqlite3';
import { hasColumn } from '../connection';

export function migrate052(db: Database.Database): void {
  if (!hasColumn(db, 'schemas', 'node_shape')) return;

  db.exec(`ALTER TABLE schemas DROP COLUMN node_shape`);
}
