import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

/** Antivirus and synchronization tools can briefly lock a file on Windows. Keep the old file until an atomic replacement succeeds. */
export async function renameWithRetry(source: string, destination: string, operation: typeof rename = rename) {
  const waits = [25, 100, 250];
  for (let attempt = 0; ; attempt++) {
    try { await operation(source, destination); return; }
    catch (error) {
      if (attempt >= waits.length || !["EPERM", "EACCES", "EBUSY"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error;
      await delay(waits[attempt]);
    }
  }
}
export async function atomicWriteFile(file: string, content: string, mode?: number) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, content, { encoding: "utf8", flag: "wx", ...(mode ? { mode } : {}) }); await renameWithRetry(temporary, file); }
  finally { await unlink(temporary).catch(() => {}); }
}
