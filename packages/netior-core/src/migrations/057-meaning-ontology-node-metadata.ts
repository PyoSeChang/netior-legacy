import type Database from 'better-sqlite3';
import { tableExists } from '../connection';

export function migrate057(db: Database.Database): void {
  if (!tableExists(db, 'network_nodes')) return;

  db.exec(`
    UPDATE network_nodes
       SET metadata = replace(metadata, 'model_category', 'meaning_category')
     WHERE metadata LIKE '%managedBy%'
       AND metadata LIKE '%ontology%'
       AND metadata LIKE '%model_category%'
  `);
}
