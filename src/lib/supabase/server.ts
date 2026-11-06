import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { DomainError } from "../domain";
import { getSupabaseAdmin } from "./admin";
import { verifyCrmMember } from "./auth";

export function supabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new DomainError("La connexion à l’espace partagé n’est pas configurée.", 503);
  return { url, key };
}

export async function createSupabaseServerClient() {
  const { url, key } = supabasePublicConfig();
  const jar = await cookies();
  return createServerClient(url, key, {
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: init?.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) }) },
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" },
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        // Rendering cannot write cookies. Proxy refreshes them before rendering;
        // route handlers (login/logout and API refresh) can write them here.
        try { for (const { name, value, options } of values) jar.set(name, value, options); } catch { /* Server component render. */ }
      },
    },
  });
}

export async function requireCrmMember() {
  const client = await createSupabaseServerClient();
  return verifyCrmMember(client, id => getSupabaseAdmin().from("crm_members").select("enabled").eq("user_id", id).maybeSingle());
}
