import { z } from "zod";
import { attributeSchema, imageAsset, productCategories, publicUrl } from "./product-info";
const optionalUrl = z.union([z.literal(""), publicUrl]);
const amount = z.number().int().min(0).max(1_000_000);
export const aiContextSchema = z.object({
  sourceUrl: optionalUrl, lookupReference: z.string().trim().max(160), researchContext: z.string().trim().max(3000),
  name: z.string().max(160), brand: z.string().max(120), ean: z.string().max(14), category: z.enum(productCategories),
  unitsPerPack: amount, packsPerCarton: amount, weightGrams: amount, priceCents: amount,
  lengthMm: amount, widthMm: amount, heightMm: amount, attributes: z.array(attributeSchema).max(40)
});
export const aiEvidenceFields = ["ean", "brand", "category", "unitsPerPack", "packsPerCarton", "weightGrams", "priceCents", "lengthMm", "widthMm", "heightMm", "attributes", "imageUrls"] as const;
export const aiSuggestionSchema = z.object({
  name: z.string().max(160), shortDescription: z.string().max(1000), longDescription: z.string().max(16000),
  brand: z.string().max(120), ean: z.string().max(14), category: z.enum(productCategories).nullable(),
  unitsPerPack: amount.nullable(), packsPerCarton: amount.nullable(), weightGrams: amount.nullable(), priceCents: amount.nullable(),
  lengthMm: amount.nullable(), widthMm: amount.nullable(), heightMm: amount.nullable(),
  attributes: z.array(attributeSchema).max(40), imageUrls: z.array(publicUrl).max(8),
  sources: z.array(z.object({ url: publicUrl, title: z.string().max(200) })).max(12),
  evidence: z.array(z.object({ field: z.enum(aiEvidenceFields), url: publicUrl, note: z.string().max(400) })).max(30),
  uncertainties: z.array(z.string().max(400)).max(20)
}).strict();
export const enrichmentRequest = z.object({ mode: z.enum(["compose", "web"]), context: aiContextSchema });
export const imageRequest = z.object({ context: aiContextSchema, type: z.enum(["packshot", "lifestyle", "detail"]),
  prompt: z.string().trim().max(3000), useGlobalRules: z.boolean(), referenceImage: imageAsset.shape.url.optional() });
export type AiContext = z.infer<typeof aiContextSchema>;
export type AiSuggestion = z.infer<typeof aiSuggestionSchema>;
export type AiStatus = { enabled: boolean; keyPresent: boolean; textReady: boolean; imageReady: boolean; textModel: string; imageModel: string; imageRules: string };
const modelId = z.string().trim().min(3).max(160).regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*\/[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/);
export const aiSettingsInput = z.object({
  enabled: z.boolean(), apiKey: z.string().trim().min(10).max(512).regex(/^[A-Za-z0-9._-]+$/).optional(),
  clearKey: z.boolean(), textModel: modelId, imageModel: modelId, imageRules: z.string().trim().max(3000)
});
