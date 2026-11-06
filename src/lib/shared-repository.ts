import { applyAction, DomainError, validateState } from "./domain";
import type { Action, State } from "./model";
import { getSupabaseAdmin } from "./supabase/admin";

export interface StateStore {
  read(): Promise<State>;
  commit(revision: number, state: State): Promise<boolean>;
}
const postgresStore: StateStore = {
  async read() {
    const { data, error } = await getSupabaseAdmin().from("crm_state").select("revision,payload").eq("id", 1).maybeSingle();
    if (error) throw new DomainError("La base partagée est momentanément indisponible.", 503);
    if (!data) throw new DomainError("L’import des données dans Supabase doit être terminé avant l’ouverture du CRM.", 503);
    const state = validateState(data.payload);
    if (state.revision !== Number(data.revision)) throw new DomainError("La révision des données partagées est incohérente.", 503);
    return state;
  },
  async commit(revision, state) {
    const { data, error } = await getSupabaseAdmin().rpc("crm_commit_state", { p_revision: revision, p_payload: state });
    if (error?.code === "P0001") throw new DomainError("Une étiquette Chronopost protège ce colis. Vérifiez son état avant de modifier ou annuler l’envoi.", 409);
    if (error) throw new DomainError("L’enregistrement n’a pas pu être confirmé. Actualisez les données avant toute nouvelle action.", 503);
    return data === true;
  },
};
export class SharedRepository {
  constructor(private store: StateStore = postgresStore) {}
  read() { return this.store.read(); }
  async mutate(action: Action, revision: number) {
    if (action.type === "reset") throw new DomainError("La réinitialisation est désactivée pour la base partagée.", 403);
    const previous = await this.store.read();
    if (previous.revision !== revision) throw new DomainError("Les données ont changé. La page a été actualisée ; relancez votre action.", 409);
    const next = structuredClone(previous);
    const targetId = applyAction(next, action);
    next.revision = previous.revision + 1;
    const state = validateState(next);
    if (!await this.store.commit(revision, state)) throw new DomainError("Les données ont changé. La page a été actualisée ; relancez votre action.", 409);
    return { state, targetId };
  }
}
