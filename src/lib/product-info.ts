import { z } from "zod";

export const productCategories = ["Gobelets", "Barquettes", "Sacs", "Couverts", "Accessoires"] as const;
export function isPublicUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && url.hostname.includes(".") &&
      !/^[\d.]+$/.test(url.hostname) && !url.hostname.includes(":") &&
      !/(^|\.)(localhost|local|internal|test|invalid|onion)$/.test(url.hostname) &&
      ![...url.searchParams.keys()].some(k => /^(token|access_token|api_key|password|secret|authorization)$/i.test(k));
  } catch { return false; }
}
export const publicUrl = z.string().trim().max(2048).refine(isPublicUrl, "Utilisez une adresse HTTPS publique, sans identifiant ni secret.");
export function isValidGtin(value: string) {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(value) || /^0+$/.test(value)) return false;
  const digits = [...value].map(Number);
  const check = digits.pop()!;
  return (10 - digits.reverse().reduce((n, d, i) => n + d * (i % 2 === 0 ? 3 : 1), 0) % 10) % 10 === check;
}
export const imageAsset = z.object({
  id: z.string().min(1).max(100),
  url: z.string().max(2048).refine(v => /^\/api\/demo\/media\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(v) || isPublicUrl(v), "Adresse d’image invalide."),
  alt: z.string().trim().max(250), kind: z.enum(["uploaded", "generated", "remote"]),
  reviewed: z.boolean(), sourceUrl: z.union([z.literal(""), publicUrl]), prompt: z.string().max(3000)
});
export const attributeSchema = z.object({ name: z.string().trim().min(1).max(80), value: z.string().trim().min(1).max(300) });
export const productInfoSchema = z.object({
  workflowStatus: z.enum(["draft", "active"]), sourceUrl: z.union([z.literal(""), publicUrl]),
  lookupReference: z.string().trim().max(160), researchContext: z.string().trim().max(3000),
  ean: z.string().trim().refine(v => !v || isValidGtin(v), "EAN/GTIN invalide : vérifiez la longueur et la clé de contrôle."),
  brand: z.string().trim().max(120), shortDescription: z.string().trim().max(1000), longDescription: z.string().trim().max(16000),
  vatRateBps: z.number().int().min(0).max(3000),
  lengthMm: z.number().int().min(0).max(100000), widthMm: z.number().int().min(0).max(100000), heightMm: z.number().int().min(0).max(100000),
  attributes: z.array(attributeSchema).max(40).refine(a => new Set(a.map(x => x.name.toLowerCase())).size === a.length, "Chaque attribut doit avoir un nom différent."),
  images: z.array(imageAsset).max(8),
  sources: z.array(z.object({ url: publicUrl, title: z.string().max(200) })).max(12)
});
const quantity = z.number().int().min(0).max(1_000_000);
export const productEditorInput = z.object({
  sku: z.string().trim().max(40).refine(v => !v || /^[A-Za-z0-9_.-]{2,40}$/.test(v), "Référence interne invalide."),
  name: z.string().trim().max(160), category: z.enum(productCategories), unitsPerPack: quantity, packsPerCarton: quantity,
  priceCents: quantity, safetyPacks: quantity, weightGrams: quantity,
  info: productInfoSchema
});
export type ProductInfo = z.infer<typeof productInfoSchema>;
export type ProductEditorInput = z.infer<typeof productEditorInput>;
export type ImageAsset = z.infer<typeof imageAsset>;
export function emptyProductInfo(): ProductInfo {
  return { workflowStatus: "draft", sourceUrl: "", lookupReference: "", researchContext: "", ean: "", brand: "",
    shortDescription: "", longDescription: "", vatRateBps: 2000, lengthMm: 0, widthMm: 0, heightMm: 0,
    attributes: [], images: [], sources: [] };
}
export const priceIncludingTax = (netCents: number, rateBps: number) => Math.round(netCents * (10000 + rateBps) / 10000);
export const priceExcludingTax = (grossCents: number, rateBps: number) => Math.round(grossCents * 10000 / (10000 + rateBps));
