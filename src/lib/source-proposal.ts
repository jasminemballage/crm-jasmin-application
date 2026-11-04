import type { AiContext, AiSuggestion } from "./ai-contract";
import { inferProductCategory, type ProductSource } from "./product-source";

export function completeSourceProposal(input: AiSuggestion, context: AiContext, source: ProductSource | null): AiSuggestion {
  const result = structuredClone(input);
  const inferred = source?.category ?? ((result.category === "Accessoires" || !result.category) ? inferProductCategory(result.name || context.name) : null);
  if (inferred) result.category = inferred;
  if (!source) return result;

  result.sources = [...new Map([{ url: source.url, title: source.title }, ...result.sources].map(s => [s.url, s])).values()].slice(0, 12);
  function evidence(field: "brand" | "category" | "imageUrls", note: string) {
    result.evidence = [{ field, url: source!.url, note }, ...result.evidence.filter(e => e.field !== field)].slice(0, 30);
  }
  if (source.category) evidence("category", `Catégorie déduite du titre de la fiche : ${source.title}.`);
  if (context.brand) result.brand = context.brand;
  else {
    result.brand = source.brand;
    result.evidence = result.evidence.filter(e => e.field !== "brand");
    if (source.brand) evidence("brand", "Marque déclarée dans les métadonnées du produit, distincte du vendeur.");
    else result.uncertainties.unshift("Marque non précisée pour ce produit sur la fiche source : à confirmer. Le vendeur n’est pas utilisé comme marque.");
  }
  result.imageUrls = [...source.imageUrls];
  result.evidence = result.evidence.filter(e => e.field !== "imageUrls");
  if (source.imageUrls.length) evidence("imageUrls", "Photo principale déclarée pour ce produit sur sa fiche ; logos et produits suggérés exclus.");
  else result.uncertainties.unshift("Aucune photo de ce produit n’a été identifiée dans les métadonnées de la fiche.");
  result.uncertainties = [...new Set(result.uncertainties)].slice(0, 20);
  return result;
}
