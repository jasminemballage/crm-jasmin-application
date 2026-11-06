import { notFound, redirect } from "next/navigation";
import CRM from "@/components/crm";
import { DomainError } from "@/lib/domain";
import { isSupabaseMode } from "@/lib/supabase/config";
import { requireCrmMember } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
const sections = ["", "catalogue", "stocks", "commandes", "expeditions", "connexions", "parametres"];
export default async function Page({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section } = await params;
  const page = section?.join("/") ?? "";
  if (!sections.includes(page)) notFound();
  const shared = isSupabaseMode();
  let email: string | undefined;
  if (shared) {
    try { email = (await requireCrmMember()).email; }
    catch (error) {
      if (error instanceof DomainError && error.status === 401) redirect(`/connexion?next=${encodeURIComponent(`/${page}`)}`);
      if (error instanceof DomainError) return <main className="print-page"><h1>Accès indisponible</h1><p role="alert">{error.message}</p><a className="button secondary" href="/connexion">Revenir à la connexion</a></main>;
      throw error;
    }
  }
  return <CRM page={page} shared={shared} email={email} />;
}
