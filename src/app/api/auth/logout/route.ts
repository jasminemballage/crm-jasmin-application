import { DomainError } from "@/lib/domain";
import { assertRequestOrigin } from "@/lib/guard";
import { isSupabaseMode } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    assertRequestOrigin(request);
    if (!isSupabaseMode()) throw new DomainError("L’espace partagé n’est pas activé.", 404);
    const client = await createSupabaseServerClient();
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw new DomainError("La déconnexion a échoué. Réessayez.", 503);
    return Response.json({ redirect: "/connexion" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof DomainError ? error.message : "La déconnexion est indisponible." }, { status: error instanceof DomainError ? error.status : 503, headers: { "Cache-Control": "no-store" } });
  }
}
