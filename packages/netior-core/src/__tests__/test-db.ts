import Database from 'better-sqlite3';
import { migrate001 } from '../migrations/001-baseline';

let testDb: Database.Database | null = null;

export function setupTestDb(): Database.Database {
  testDb = new Database(':memory:');
  testDb.pragma('journal_mode = WAL');
  testDb.pragma('foreign_keys = ON');
  migrate001(testDb);
  return testDb;
}

export function teardownTestDb(): void {
  if (testDb) {
    testDb.close();
    testDb = null;
  }
}

export function getTestDb(): Database.Database {
  if (!testDb) throw new Error('Test DB not initialized');
  return testDb;
}
