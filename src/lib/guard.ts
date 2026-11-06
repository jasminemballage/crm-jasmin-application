import { DomainError } from "./domain";
import { isSupabaseMode } from "./supabase/config";

const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);

/** NextURL normalizes loopback URLs to localhost; Host retains the browser's authority. */
export function assertRequestOrigin(request: Request, format: "json" | "image" = "json") {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  let expected: URL;
  try {
    const internal = new URL(request.url);
    // Reject credentials, paths, ambiguous forwarded lists and malformed ports.
    if (!host || !/^(?:\[[0-9a-f:]+\]|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::[0-9]{1,5})?$/i.test(host)) throw new Error("host");
    expected = new URL(`${internal.protocol}//${host}`);
    if (!["http:", "https:"].includes(expected.protocol)) throw new Error("protocol");
    if (!loopbackHosts.has(expected.hostname) && expected.protocol !== "https:") throw new Error("https");
    // A non-loopback request URL must agree with Host. Loopback URLs may have
    // been rewritten by Next's proxy; never trust x-forwarded-host instead.
    if (!loopbackHosts.has(internal.hostname) && internal.host !== expected.host) throw new Error("host mismatch");
    if (loopbackHosts.has(expected.hostname) && (!loopbackHosts.has(internal.hostname) || internal.port !== expected.port)) throw new Error("loopback mismatch");
    if (!origin || origin !== expected.origin) throw new Error("origin");
  } catch { throw new DomainError("Origine de la requête refusée.", 403); }
  const contentType = request.headers.get("content-type") ?? "";
  if (format === "json" ? !/^application\/json(?:;|$)/i.test(contentType) : !/^image\/(png|jpeg|webp)(;|$)/i.test(contentType))
    throw new DomainError("Format de requête non pris en charge.", 415);
}

export async function assertLocalRequest(request: Request, mutation = false, format: "json" | "image" = "json") {
  if (isSupabaseMode()) {
    if (mutation) assertRequestOrigin(request, format);
    const { requireCrmMember } = await import("./supabase/server");
    await requireCrmMember();
    return;
  }
  if (process.env.NODE_ENV === "production" && process.env.CRM_LOCAL_DEMO !== "1")
    throw new DomainError("Cette version locale ne peut pas être mise en service. Activez l’espace partagé sécurisé.", 503);
  const host = request.headers.get("host");
  let hostname: string;
  try { hostname = host ? new URL(`http://${host}`).hostname : ""; } catch { hostname = ""; }
  if (!host || !["127.0.0.1", "localhost", "[::1]"].includes(hostname))
    throw new DomainError("La démonstration est réservée à cet ordinateur.", 403);
  if (mutation) assertRequestOrigin(request, format);
}
