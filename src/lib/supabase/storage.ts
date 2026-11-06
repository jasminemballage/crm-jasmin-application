import { DomainError } from "../domain";
import { getSupabaseAdmin } from "./admin";
export const PRIVATE_BUCKET = "crm-private";
function validatePath(path: string) {
  if (!/^(media|chronopost)\/[A-Za-z0-9/_.-]+$/.test(path) || path.split("/").some(p => !p || p === "." || p === ".."))
    throw new DomainError("Chemin de document invalide.");
}
export async function uploadPrivateObject(path: string, bytes: Uint8Array, contentType: string) {
  validatePath(path);
  const { error } = await getSupabaseAdmin().storage.from(PRIVATE_BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (error) throw new DomainError("Le document n’a pas pu être enregistré dans le stockage partagé.", 503);
}
export async function downloadPrivateObject(path: string): Promise<Buffer> {
  validatePath(path);
  const { data, error } = await getSupabaseAdmin().storage.from(PRIVATE_BUCKET).download(path);
  if (error || !data) throw new DomainError("Le document est indisponible dans le stockage partagé.", 503);
  return Buffer.from(await data.arrayBuffer());
}
/** Short-lived access after authorization, avoiding the function response-size limit. */
export async function privateObjectUrl(path: string, download?: string) {
  validatePath(path);
  const { data, error } = await getSupabaseAdmin().storage.from(PRIVATE_BUCKET).createSignedUrl(path, 60, download ? { download } : undefined);
  if (error || !data?.signedUrl) throw new DomainError("Le document est indisponible dans le stockage partagé.", 503);
  return data.signedUrl;
}
