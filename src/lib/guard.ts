import { DomainError } from "./domain";

export function assertLocalRequest(request: Request, mutation = false, format: "json" | "image" = "json") {
  if (process.env.NODE_ENV === "production" && process.env.CRM_LOCAL_DEMO !== "1")
    throw new DomainError("Cette version locale ne peut pas être mise en service. L’accès sécurisé et PostgreSQL restent à intégrer.", 503);
  const host = request.headers.get("host");
  if (!host || !["127.0.0.1", "localhost", "[::1]"].includes(new URL(`http://${host}`).hostname))
    throw new DomainError("La démonstration est réservée à cet ordinateur.", 403);
  if (mutation) {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).host !== host || !["http:", "https:"].includes(new URL(origin).protocol))
      throw new DomainError("Origine de la requête refusée.", 403);
    const contentType = request.headers.get("content-type") ?? "";
    if (format === "json" ? !contentType.startsWith("application/json") : !/^image\/(png|jpeg|webp)(;|$)/.test(contentType))
      throw new DomainError("Format de requête non pris en charge.", 415);
  }
}
