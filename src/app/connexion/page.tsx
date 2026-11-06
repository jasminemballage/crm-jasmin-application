import { redirect } from "next/navigation";
import LoginForm from "@/components/login-form";
import { DomainError } from "@/lib/domain";
import { isSupabaseMode } from "@/lib/supabase/config";
import { safeReturnPath } from "@/lib/supabase/auth";
import { requireCrmMember } from "@/lib/supabase/server";
import "./connexion.css";

export const dynamic = "force-dynamic";
export default async function Connexion({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!isSupabaseMode()) redirect("/");
  const next = safeReturnPath((await searchParams).next);
  let authenticated = false;
  let error = "";
  try { await requireCrmMember(); authenticated = true; }
  catch (cause) { if (!(cause instanceof DomainError) || cause.status !== 401) error = cause instanceof DomainError ? cause.message : "La connexion est indisponible. Réessayez."; }
  if (authenticated) redirect(next);
  return <LoginForm next={next} initialError={error} />;
}
