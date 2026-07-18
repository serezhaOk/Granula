// Sample library CRUD — the native analogue of the web build's IndexedDB
// `samples` store. Rows are ordered newest-first (by ts) like renderLibrary().

import { getDB } from "./db";

export interface SampleRow {
  id: number;
  name: string;
  uri: string;
  duration: number;
  ts: number;
}

export async function dbAll(): Promise<SampleRow[]> {
  const db = await getDB();
  return db.getAllAsync<SampleRow>("SELECT * FROM samples ORDER BY ts DESC");
}

export async function dbGet(id: number): Promise<SampleRow | null> {
  const db = await getDB();
  return db.getFirstAsync<SampleRow>("SELECT * FROM samples WHERE id = ?", id);
}

export async function dbAdd(rec: Omit<SampleRow, "id">): Promise<number> {
  const db = await getDB();
  const res = await db.runAsync(
    "INSERT INTO samples (name, uri, duration, ts) VALUES (?, ?, ?, ?)",
    rec.name,
    rec.uri,
    rec.duration,
    rec.ts
  );
  return res.lastInsertRowId;
}

export async function dbRename(id: number, name: string): Promise<void> {
  const db = await getDB();
  await db.runAsync("UPDATE samples SET name = ? WHERE id = ?", name, id);
}

export async function dbDel(id: number): Promise<void> {
  const db = await getDB();
  await db.runAsync("DELETE FROM samples WHERE id = ?", id);
}
