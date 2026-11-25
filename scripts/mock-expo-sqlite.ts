// Test helper: lets src/db.ts run in plain Node by backing `expo-sqlite` with node:sqlite (in memory).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('module');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite');

export const testDb = new DatabaseSync(':memory:');

const adapter = {
  execAsync: async (sql: string) => testDb.exec(sql),
  runAsync: async (sql: string, params: unknown[] = []) => {
    const r = testDb.prepare(sql).run(...params);
    return { lastInsertRowId: Number(r.lastInsertRowid), changes: r.changes };
  },
  getFirstAsync: async (sql: string, params: unknown[] = []) => testDb.prepare(sql).get(...params) ?? null,
  getAllAsync: async (sql: string, params: unknown[] = []) => testDb.prepare(sql).all(...params),
};

const originalLoad = Module._load;
Module._load = function (request: string, ...rest: unknown[]) {
  if (request === 'expo-sqlite') return { openDatabaseAsync: async () => adapter };
  return originalLoad.call(this, request, ...rest);
};
