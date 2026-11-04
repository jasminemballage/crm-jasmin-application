import { DomainError } from "./domain";

export function readAiText(content: unknown, finishReason?: string | null, refusal?: unknown): string {
  if (finishReason === "content_filter" || (typeof refusal === "string" && refusal.trim()))
    throw new DomainError("Le modèle n’a pas fourni de proposition pour cette demande. Aucun champ n’a été modifié.", 502);
  if (["length", "max_tokens"].includes(finishReason ?? ""))
    throw new DomainError("La réponse IA a été interrompue avant sa fin. Aucun champ n’a été modifié. Réduisez le contexte avant un nouvel essai.", 502);
  if (typeof content !== "string" || !content.trim())
    throw new DomainError("Aucune proposition textuelle n’a été renvoyée. Aucun champ n’a été modifié.", 502);
  return content.trim();
}

/** Accept only JSON, optionally enclosed in one Markdown code block; never guess missing values or execute model output. */
export function parseAiObject(content: unknown, finishReason?: string | null, refusal?: unknown): Record<string, unknown> {
  const trimmed = readAiText(content, finishReason, refusal);
  const fenced = /^```(?:json)?[ \t]*(?:\r?\n)?([\s\S]*?)(?:\r?\n)?```$/i.exec(trimmed);
  let parsed: unknown;
  try { parsed = JSON.parse(fenced ? fenced[1].trim() : trimmed); }
  catch { throw new DomainError("La proposition IA n’est pas un objet JSON valide. Aucun champ n’a été modifié.", 502); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new DomainError("La proposition IA doit contenir un objet décrivant la fiche produit. Aucun champ n’a été modifié.", 502);
  return parsed as Record<string, unknown>;
}
