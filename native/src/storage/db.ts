// Shared SQLite handle. One database, two tables: `samples` (recording/loaded
// clip metadata) and `prefs` (key/value store replacing the web build's
// localStorage). Audio bytes themselves live as files under documentDirectory;
// only their paths are kept in the DB.

import * as SQLite from "expo-sqlite";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync("granula.db");
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS samples (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          uri TEXT NOT NULL,
          duration REAL NOT NULL,
          ts INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS prefs (
          k TEXT PRIMARY KEY,
          v TEXT
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}
