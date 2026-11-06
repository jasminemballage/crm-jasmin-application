import { DomainError } from "@/lib/domain";
import { assertRequestOrigin } from "@/lib/guard";
import { readBody } from "@/lib/http-body";
import { isSupabaseMode } from "@/lib/supabase/config";
import { safeReturnPath } from "@/lib/supabase/auth";
import { createSupabaseServerClient, requireCrmMember } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    assertRequestOrigin(request);
    if (!isSupabaseMode()) throw new DomainError("La connexion n’est disponible que dans l’espace partagé.", 404);
    const input = JSON.parse((await readBody(request, 10000)).toString("utf8"));
    if (!input || typeof input !== "object" || typeof input.email !== "string" || input.email.length > 254 || typeof input.password !== "string" || !input.password || input.password.length > 1024)
      throw new DomainError("Renseignez votre email et votre mot de passe.", 400);
    const client = await createSupabaseServerClient();
    const { error } = await client.auth.signInWithPassword({ email: input.email.trim(), password: input.password });
    if (error) throw new DomainError("Email ou mot de passe incorrect, ou connexion indisponible.", 401);
    try { await requireCrmMember(); }
    catch (error) { await client.auth.signOut({ scope: "local" }); throw error; }
    return Response.json({ redirect: safeReturnPath(input.next) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof DomainError ? error.status : error instanceof SyntaxError ? 400 : 503;
    return Response.json({ error: error instanceof DomainError ? error.message : "La connexion est indisponible. Réessayez." }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
