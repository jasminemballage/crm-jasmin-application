import { z } from "zod";
import { DomainError } from "./domain";
export function chronopostErrorResponse(error: unknown) {
  return Response.json({ error: error instanceof DomainError ? error.message : error instanceof z.ZodError ? "Vérifiez les informations Chronopost : adresse complète en France métropolitaine, téléphone, email et confirmation sont requis pour une étiquette." : "L’opération Chronopost n’a pas abouti. Vérifiez son état avant toute nouvelle tentative." },
    { status: error instanceof DomainError ? error.status : error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 503, headers: { "Cache-Control": "no-store" } });
}
