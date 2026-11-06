import { DomainError } from "../domain";
import { getSupabaseAdmin } from "./admin";
import { decryptSettings, encryptSettings } from "./secrets";

export async function readSharedSettings(provider: "ai" | "chronopost") {
  const { data, error } = await getSupabaseAdmin().from("crm_settings").select("revision,payload").eq("id", provider).maybeSingle();
  if (error) throw new DomainError("Lecture des réglages partagés indisponible.", 503);
  return data ? { revision: Number(data.revision), value: decryptSettings(provider, data.payload) } : { revision: 0, value: null };
}
export async function writeSharedSettings(provider: "ai" | "chronopost", revision: number, value: unknown) {
  const payload = encryptSettings(provider, value);
  const { data, error } = await getSupabaseAdmin().rpc("crm_commit_settings", { p_id: provider, p_revision: revision, p_payload: payload });
  if (error) throw new DomainError("Les réglages partagés n’ont pas pu être enregistrés. Rechargez pour vérifier leur état.", 503);
  if (data !== true) throw new DomainError("Les réglages ont changé dans une autre session. Rechargez-les avant de recommencer.", 409);
}
