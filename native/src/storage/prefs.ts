// Key/value prefs — the native replacement for localStorage. Backed by the
// `prefs` table so knob positions, last-used sample id and the used-names set
// survive restarts.

import { getDB } from "./db";

export async function getPref(key: string): Promise<string | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ v: string }>(
    "SELECT v FROM prefs WHERE k = ?",
    key
  );
  return row ? row.v : null;
}

export async function setPref(key: string, value: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    "INSERT INTO prefs (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v",
    key,
    value
  );
}

export async function removePref(key: string): Promise<void> {
  const db = await getDB();
  await db.runAsync("DELETE FROM prefs WHERE k = ?", key);
}
