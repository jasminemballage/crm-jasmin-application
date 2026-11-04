import path from "node:path";

const crmGlobal = globalThis as typeof globalThis & { jasminCrmSettingsFileLocks?: Map<string, Promise<void>> };
const pending = crmGlobal.jasminCrmSettingsFileLocks ??= new Map<string, Promise<void>>();

/** Serialize each complete read/merge/write transaction across settings modules in this local process. */
export async function withSettingsFileLock<T>(file: string, work: () => Promise<T>): Promise<T> {
  const key = path.resolve(file);
  const previous = pending.get(key) ?? Promise.resolve();
  const result = previous.then(work);
  const settled = result.then(() => {}, () => {});
  pending.set(key, settled);
  try { return await result; }
  finally { if (pending.get(key) === settled) pending.delete(key); }
}
