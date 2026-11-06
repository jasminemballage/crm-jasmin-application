import { DomainError } from "../domain";

type Environment = Record<string, string | undefined>;
export function isSupabaseMode(environment: Environment = process.env) {
  const backend = environment.CRM_STORAGE_BACKEND;
  if (backend && !["local", "supabase"].includes(backend)) throw new DomainError("Le stockage configuré est inconnu.", 503);
  return backend === "supabase";
}
export function supabaseConfig(environment: Environment = process.env) {
  const url = environment.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = environment.SUPABASE_SECRET_KEY;
  if (!url || !publishableKey || !secretKey) throw new DomainError("La configuration Supabase est incomplète.", 503);
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new DomainError("La configuration Supabase contient une URL invalide.", 503); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash)
    throw new DomainError("La configuration Supabase exige une URL HTTPS sans chemin.", 503);
  return { url: parsed.origin, publishableKey, secretKey };
}
