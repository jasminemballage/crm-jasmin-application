import { z } from "zod";
import { productEditorInput, productInfoSchema } from "./product-info";

export const channels = ["Amazon", "Cdiscount", "RETIF", "METRO", "Site Jasmin"] as const;
export const statuses = ["review", "ready", "preparing", "partial", "shipped", "cancelled", "archived"] as const;
const count = z.number().int().min(0).max(1_000_000);
const positive = count.min(1);
const text = z.string().trim().min(1).max(160);

export const productInput = z.object({
  sku: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_.-]+$/, "Référence : lettres, chiffres, tirets et points uniquement."),
  name: text, category: z.enum(["Gobelets", "Barquettes", "Sacs", "Couverts", "Accessoires"]),
  unitsPerPack: positive, packsPerCarton: positive,
  priceCents: count, safetyPacks: count, weightGrams: positive
});
export const productSchema = productInput.extend({ id: text, physicalPacks: count,
  name: z.string().trim().max(160), unitsPerPack: count, packsPerCarton: count, weightGrams: count,
  info: productInfoSchema.optional()
});
const lineSchema = z.object({
  id: text, productId: text, quantity: positive, packsPerSale: positive,
  shippedPacks: count, unitPriceCents: count
});
export const orderSchema = z.object({
  id: text, externalId: text, channel: z.enum(channels), createdAt: z.iso.datetime(),
  customer: text, city: text, country: z.enum(["FR", "BE", "DE", "ES", "IT", "NL", "LU"]),
  status: z.enum(statuses), lines: z.array(lineSchema).min(1).max(100)
});
const allocationSchema = z.object({ lineId: text, packs: positive });
export const shipmentSchema = z.object({
  id: text, orderId: text, createdAt: z.iso.datetime(), dispatchedAt: z.iso.datetime().nullable(),
  status: z.enum(["prepared", "dispatched", "cancelled"]),
  weightGrams: positive, lengthCm: positive.max(300), widthCm: positive.max(300), heightCm: positive.max(300),
  allocations: z.array(allocationSchema).min(1).max(100)
});
export const eventSchema = z.object({
  id: text, at: z.iso.datetime(), type: text, targetId: text, description: z.string().max(500),
  productId: text.optional(), deltaPacks: z.number().int().optional()
});
export const stateSchema = z.object({
  version: z.literal(1), revision: count, products: z.array(productSchema),
  orders: z.array(orderSchema), shipments: z.array(shipmentSchema), events: z.array(eventSchema)
});
export type Product = z.infer<typeof productSchema>;
export type Order = z.infer<typeof orderSchema>;
export type Shipment = z.infer<typeof shipmentSchema>;
export type State = z.infer<typeof stateSchema>;
export type Channel = typeof channels[number];
export type OrderStatus = typeof statuses[number];
export const catalogImportRow = productInput.partial().required({ sku: true });
export const stockImportRow = z.object({
  sku: productInput.shape.sku, quantity: count, unit: z.enum(["pack", "carton"])
});
export type CatalogImportRow = z.infer<typeof catalogImportRow>;
export type StockImportRow = z.infer<typeof stockImportRow>;

export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("createProduct"), product: productInput }),
  z.object({ type: z.literal("updateProduct"), id: text, product: productInput }),
  z.object({ type: z.literal("saveProductInfo"), id: text.optional(), product: productEditorInput, initialPhysicalPacks: count.optional() }),
  z.object({ type: z.literal("adjustStock"), productId: text, direction: z.enum(["in", "out"]), quantity: positive,
    unit: z.enum(["pack", "carton"]), reason: z.string().trim().min(5).max(250) }),
  z.object({ type: z.literal("createOrder"), externalId: text, channel: z.enum(channels),
    customer: text, city: text, country: orderSchema.shape.country,
    lines: z.array(z.object({ productId: text, quantity: positive, unit: z.enum(["pack", "carton"]) })).min(1).max(30) }),
  z.object({ type: z.literal("releaseOrder"), id: text }),
  z.object({ type: z.literal("cancelOrder"), id: text }),
  z.object({ type: z.literal("prepareShipment"), orderId: text, weightGrams: positive,
    lengthCm: positive.max(300), widthCm: positive.max(300), heightCm: positive.max(300),
    allocations: z.array(allocationSchema).min(1).max(100) }),
  z.object({ type: z.literal("dispatchShipment"), id: text }),
  z.object({ type: z.literal("importProducts"), rows: z.array(catalogImportRow).min(1).max(1000) }),
  z.object({ type: z.literal("importStock"), rows: z.array(stockImportRow).min(1).max(1000),
    reason: z.string().trim().min(5).max(250) }),
  z.object({ type: z.literal("reset") })
]);
export type Action = z.infer<typeof actionSchema>;
