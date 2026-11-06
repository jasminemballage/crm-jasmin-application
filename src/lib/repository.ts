import { readFile } from "node:fs/promises";
import path from "node:path";
import { atomicWriteFile } from "./atomic-file";
import { Action, State } from "./model";
import { applyAction, DomainError, validateState } from "./domain";
import { seedState } from "./seed";
import { isSupabaseMode } from "./supabase/config";
import { SharedRepository } from "./shared-repository";

/** One local process only. Replace with PostgreSQL transactions before deployment. */
export class DemoRepository {
  private pending: Promise<unknown> = Promise.resolve();
  constructor(private file: string) {}
  private locked<T>(work: () => Promise<T>): Promise<T> {
    const result = this.pending.then(work, work);
    this.pending = result.catch(() => {});
    return result;
  }
  private async load(): Promise<State> {
    try { return validateState(JSON.parse(await readFile(this.file, "utf8"))); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        const state = validateState(seedState());
        await this.save(state);
        return state;
      }
      throw new DomainError("Le fichier de démonstration est illisible ou incohérent. Il a été conservé ; restaurez-le avant de continuer.", 503);
    }
  }
  private async save(state: State) {
    await atomicWriteFile(this.file, JSON.stringify(state, null, 2));
  }
  read() { return this.locked(() => this.load()); }
  mutate(action: Action, revision: number) {
    return this.locked(async () => {
      const previous = await this.load();
      if (previous.revision !== revision) throw new DomainError("Les données ont changé. La page a été actualisée ; relancez votre action.", 409);
      const next = action.type === "reset" ? seedState() : structuredClone(previous);
      const targetId = action.type === "reset" ? "demo" : applyAction(next, action);
      next.revision = previous.revision + 1;
      const state = validateState(next);
      await this.save(state);
      return { state, targetId };
    });
  }
}
const globalStore = globalThis as typeof globalThis & { jasminDemo?: DemoRepository };
const localRoot = path.resolve(process.cwd(), ".local");
const dataFile = process.env.CRM_DEMO_DATA_FILE ? path.resolve(process.cwd(), process.env.CRM_DEMO_DATA_FILE)
  : path.join(localRoot, "demo-state.json");
const relativeDataFile = path.relative(localRoot, dataFile);
if (!relativeDataFile || relativeDataFile.startsWith("..") || path.isAbsolute(relativeDataFile) || !dataFile.endsWith(".json"))
  throw new Error("CRM_DEMO_DATA_FILE doit désigner un fichier JSON dans le dossier .local du projet.");
const sharedRepository = new SharedRepository();
function repository() {
  return isSupabaseMode() ? sharedRepository : (globalStore.jasminDemo ??= new DemoRepository(dataFile));
}
export const demoRepository = {
  read: () => repository().read(),
  mutate: (action: Action, revision: number) => repository().mutate(action, revision),
};
