import { catalogImportRow, productInput, stockImportRow, type CatalogImportRow, type Product, type State, type StockImportRow } from "./model";
import { reservedPacks } from "./selectors";

export type ImportIssue = { line: number; sku: string; message: string };
export const productFields = ["sku", "name", "category", "unitsPerPack", "packsPerCarton", "priceCents", "safetyPacks", "weightGrams"] as const;
export const fieldLabels: Record<typeof productFields[number], string> = {
  sku: "Référence SKU", name: "Nom du produit", category: "Catégorie", unitsPerPack: "Pièces / paquet",
  packsPerCarton: "Paquets / carton", priceCents: "Prix HT / paquet", safetyPacks: "Sécurité (paquets)", weightGrams: "Poids du paquet (g)"
};
export type CatalogEntry = {
  sku: string; line: number; operation: "create" | "update" | "unchanged";
  before?: Product; after: ProductInput; changes: { field: typeof productFields[number]; before?: string | number; after: string | number }[];
};
type ProductInput = ReturnType<typeof productInput.parse>;
export type StockEntry = {
  sku: string; line: number; productId: string; name: string; before: number; after: number;
  delta: number; reserved: number; safety: number; quantity: number; unit: "pack" | "carton"; factor: number;
};
function duplicateIssues(rows: { sku: string }[]) {
  const counts = new Map<string, number>();
  for (const r of rows) { const sku = r.sku.trim().toUpperCase(); counts.set(sku, (counts.get(sku) ?? 0) + 1); }
  return rows.flatMap((r, i) => (counts.get(r.sku.trim().toUpperCase()) ?? 0) > 1
    ? [{ line: i + 2, sku: r.sku, message: "Référence présente plusieurs fois dans le fichier. Conservez une seule ligne par SKU." }] : []);
}
function validationMessage(field: string) {
  const messages: Record<string, string> = {
    sku: "Référence SKU invalide : 2 à 40 lettres, chiffres, points ou tirets.",
    name: "Nom du produit obligatoire, limité à 160 caractères.",
    category: "Catégorie attendue : Gobelets, Barquettes, Sacs, Couverts ou Accessoires.",
    unitsPerPack: "Pièces par paquet : entier de 1 à 1 000 000 obligatoire pour un nouveau produit.",
    packsPerCarton: "Paquets par carton : entier de 1 à 1 000 000 obligatoire pour un nouveau produit.",
    priceCents: "Prix HT du paquet obligatoire, de 0 à 10 000 €, avec deux décimales au maximum.",
    safetyPacks: "Stock de sécurité : entier de 0 à 1 000 000 obligatoire pour un nouveau produit.",
    weightGrams: "Poids du paquet : entier de 1 à 1 000 000 grammes obligatoire pour un nouveau produit."
  };
  return messages[field] ?? "Valeur de la ligne invalide.";
}
export function planCatalogImport(state: State, rows: CatalogImportRow[]) {
  const errors: ImportIssue[] = duplicateIssues(rows);
  const entries: CatalogEntry[] = [];
  if (rows.length < 1 || rows.length > 1000) errors.push({ line: 1, sku: "", message: "Le fichier doit contenir entre 1 et 1 000 produits." });
  const bySku = new Map(state.products.map(p => [p.sku.toUpperCase(), p]));
  rows.forEach((raw, i) => {
    const valid = catalogImportRow.safeParse(raw);
    if (!valid.success) {
      errors.push({ line: i + 2, sku: raw.sku ?? "", message: validationMessage(String(valid.error.issues[0]?.path[0])) }); return;
    }
    const row = { ...valid.data, sku: valid.data.sku.toUpperCase() };
    const before = bySku.get(row.sku);
    const result = productInput.safeParse({ ...before, ...row });
    if (!result.success) {
      for (const issue of result.error.issues) errors.push({ line: i + 2, sku: row.sku, message: validationMessage(String(issue.path[0])) });
      return;
    }
    const after = result.data;
    const changes = productFields.filter(field => before?.[field] !== after[field])
      .map(field => ({ field, before: before?.[field], after: after[field] }));
    entries.push({ sku: row.sku, line: i + 2, before, after, changes,
      operation: !before ? "create" : changes.length ? "update" : "unchanged" });
  });
  return { entries, errors, created: entries.filter(e => e.operation === "create").length,
    updated: entries.filter(e => e.operation === "update").length, unchanged: entries.filter(e => e.operation === "unchanged").length };
}
export function planStockImport(state: State, rows: StockImportRow[]) {
  const errors: ImportIssue[] = duplicateIssues(rows);
  const entries: StockEntry[] = [];
  if (rows.length < 1 || rows.length > 1000) errors.push({ line: 1, sku: "", message: "Le fichier doit contenir entre 1 et 1 000 références." });
  const bySku = new Map(state.products.map(p => [p.sku.toUpperCase(), p]));
  rows.forEach((raw, i) => {
    const valid = stockImportRow.safeParse(raw);
    if (!valid.success) { errors.push({ line: i + 2, sku: raw.sku ?? "", message: "Référence invalide ou quantité de stock incorrecte (entier de 0 à 1 000 000)." }); return; }
    const row = valid.data;
    const p = bySku.get(row.sku.toUpperCase());
    if (!p) { errors.push({ line: i + 2, sku: row.sku, message: "Produit inconnu. Importez d’abord sa fiche dans Catalogue." }); return; }
    const factor = row.unit === "carton" ? p.packsPerCarton : 1;
    if (factor === 0) { errors.push({ line: i + 2, sku: p.sku, message: "Renseignez les paquets par carton avant un inventaire en cartons." }); return; }
    const after = row.quantity * factor;
    const reserved = reservedPacks(state, p.id);
    if (after > 1_000_000) { errors.push({ line: i + 2, sku: p.sku, message: "La conversion dépasse 1 000 000 de paquets." }); return; }
    if (after < reserved) { errors.push({ line: i + 2, sku: p.sku, message: `${after} paquets physiques proposés, mais ${reserved} sont déjà réservés. Le stock ne sera pas modifié.` }); return; }
    entries.push({ sku: p.sku, line: i + 2, productId: p.id, name: p.name, before: p.physicalPacks,
      after, delta: after - p.physicalPacks, reserved, safety: p.safetyPacks, quantity: row.quantity, unit: row.unit, factor });
  });
  return { entries, errors, updated: entries.filter(e => e.delta !== 0).length, unchanged: entries.filter(e => e.delta === 0).length };
}
