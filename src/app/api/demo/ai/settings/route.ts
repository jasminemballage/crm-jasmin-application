import { z } from "zod";
import { getAiSettings, publicAiStatus, saveAiSettings } from "@/lib/ai-settings";
import { assertLocalRequest } from "@/lib/guard";
import { readBody } from "@/lib/http-body";
import { DomainError } from "@/lib/domain";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { assertLocalRequest(request); return Response.json(publicAiStatus(await getAiSettings())); }
  catch (error) { return Response.json({ error: error instanceof DomainError ? error.message : "Configuration IA indisponible." }, { status: error instanceof DomainError ? error.status : 500 }); }
}
export async function POST(request: Request) {
  try { assertLocalRequest(request, true); return Response.json(await saveAiSettings(JSON.parse((await readBody(request, 20000)).toString("utf8")))); }
  catch (error) { return Response.json({ error: error instanceof DomainError ? error.message : error instanceof z.ZodError ? "Vérifiez la clé, les identifiants des modèles et les règles d’image." : "La configuration IA n’a pas pu être enregistrée." }, { status: error instanceof DomainError ? error.status : error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 500 }); }
}
