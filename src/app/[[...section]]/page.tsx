import { notFound } from "next/navigation";
import CRM from "@/components/crm";
const sections = ["", "catalogue", "stocks", "commandes", "expeditions", "connexions", "parametres"];
export default async function Page({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section } = await params;
  const page = section?.join("/") ?? "";
  if (!sections.includes(page)) notFound();
  return <CRM page={page} />;
}
