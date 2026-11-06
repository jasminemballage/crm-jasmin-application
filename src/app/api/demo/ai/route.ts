import { z } from "zod";
import { enrichmentRequest, imageRequest } from "@/lib/ai-contract";
import { getAiSettings } from "@/lib/ai-settings";
import { enrichProduct, generateProductImage } from "@/lib/openrouter";
import { assertLocalRequest } from "@/lib/guard";
import { readBody } from "@/lib/http-body";
import { DomainError } from "@/lib/domain";
export const runtime = "nodejs";
export const maxDuration = 300;
const inputSchema = z.discriminatedUnion("action", [enrichmentRequest.extend({ action: z.literal("enrich") }), imageRequest.extend({ action: z.literal("image") })]);
const running = new Set<string>();
export async function POST(request: Request) {
  let action = "";
  try {
    await assertLocalRequest(request, true);
    const input = inputSchema.parse(JSON.parse((await readBody(request, 50000)).toString("utf8")));
    action = input.action;
    if (running.has(action)) { action = ""; throw new DomainError("Une requête de ce type est déjà en cours. Patientez avant de recommencer.", 429); }
    running.add(action);
    const config = await getAiSettings();
    return Response.json(input.action === "enrich" ? await enrichProduct(input.context, input.mode, config, fetch, request.signal)
      : await generateProductImage(input, config, fetch, request.signal));
  } catch (error) {
    const message = error instanceof DomainError ? error.message : error instanceof z.ZodError ? "Les informations produit envoyées à l’IA sont incomplètes ou invalides." : "La requête IA n’a pas abouti. Aucun champ n’a été appliqué ; vérifiez votre compte OpenRouter avant de relancer.";
    return Response.json({ error: message }, { status: error instanceof DomainError ? error.status : error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 502 });
  } finally { if (action) running.delete(action); }
}
