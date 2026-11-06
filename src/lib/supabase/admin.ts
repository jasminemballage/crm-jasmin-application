import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

/** Backend only: routes must authorize the user before calling this client. */
export function getSupabaseAdmin() {
  if (typeof window !== "undefined") throw new Error("Client Supabase serveur uniquement.");
  const { url, secretKey } = supabaseConfig();
  return createClient(url, secretKey, {
    db: { retry: false },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: init?.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) }) },
  });
}
