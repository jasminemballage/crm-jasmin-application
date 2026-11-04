import { demoRepository } from "@/lib/repository";
import { assertLocalRequest } from "@/lib/guard";
import { DomainError } from "@/lib/domain";
import { availablePacks, reservedPacks, orderAmount } from "@/lib/selectors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function cell(value: unknown) {
  const raw = String(value ?? "");
  const safe = /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}
export async function GET(request: Request) {
  try {
    assertLocalRequest(request);
    const state = await demoRepository.read();
    const kind = new URL(request.url).searchParams.get("kind");
    if (kind === "backup") return new Response(JSON.stringify(state, null, 2), { headers: {
      "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="jasmin-demonstration.json"' } });
    let rows: unknown[][];
    if (kind === "template-products") rows = [["SKU", "Nom", "Categorie", "PiecesParPaquet", "PaquetsParCarton", "PrixHT", "SecuritePaquets", "PoidsGrammes"],
      ["EXEMPLE-GOB-25", "Gobelets fictifs 25 cl", "Gobelets", 50, 10, "4,25", 2, 500]];
    else if (kind === "template-stock") rows = [["SKU", "StockPaquets", "StockCartons"], ["EXEMPLE-GOB-25", "", 2]];
    else if (kind === "stock") rows = [["SKU", "StockPaquets"], ...state.products.map(p => [p.sku, p.physicalPacks])];
    else if (kind === "orders") rows = [["Référence", "Canal", "Statut", "Date", "Client fictif", "Ville test", "Pays", "Total HT EUR"],
      ...state.orders.map(o => [o.externalId, o.channel, o.status, o.createdAt, o.customer, o.city, o.country, (orderAmount(o) / 100).toFixed(2)])];
    else if (kind === "products") rows = [["SKU", "Produit fictif", "Catégorie", "Pièces/paquet", "Paquets/carton", "Prix HT EUR/paquet", "Physique paquets", "Réservé paquets", "Sécurité paquets", "Disponible paquets", "Poids du paquet (g)"],
      ...state.products.map(p => [p.sku, p.name, p.category, p.unitsPerPack, p.packsPerCarton, (p.priceCents / 100).toFixed(2), p.physicalPacks, reservedPacks(state, p.id), p.safetyPacks, availablePacks(state, p), p.weightGrams])];
    else throw new DomainError("Export inconnu.", 400);
    return new Response("\uFEFF" + rows.map(r => r.map(cell).join(";")).join("\r\n"), { headers: {
      "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="jasmin-demo-${kind}.csv"` } });
  } catch (error) { return Response.json({ error: error instanceof DomainError ? error.message : "Export indisponible." }, { status: error instanceof DomainError ? error.status : 500 }); }
}
