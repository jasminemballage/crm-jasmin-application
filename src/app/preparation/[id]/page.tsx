import { redirect } from "next/navigation";
import Preparation from "@/components/preparation";
import { DomainError } from "@/lib/domain";
import { isSupabaseMode } from "@/lib/supabase/config";
import { requireCrmMember } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (isSupabaseMode()) {
    try { await requireCrmMember(); }
    catch (error) {
      if (error instanceof DomainError && error.status === 401) redirect(`/connexion?next=${encodeURIComponent(`/preparation/${id}`)}`);
      if (error instanceof DomainError) return <main className="print-page"><h1>Accès indisponible</h1><p role="alert">{error.message}</p><a href="/connexion">Revenir à la connexion</a></main>;
      throw error;
    }
  }
  return <Preparation params={Promise.resolve({ id })} />;
}
