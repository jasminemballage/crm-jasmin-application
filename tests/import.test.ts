import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { decodeImportFile, parseImportCsv, readCsv } from "../src/lib/csv-import";
import { planCatalogImport, planStockImport } from "../src/lib/import-plan";
import { applyAction, validateState } from "../src/lib/domain";
import { DemoRepository } from "../src/lib/repository";
import { seedState } from "../src/lib/seed";

const header = "SKU;Nom;Categorie;PiecesParPaquet;PaquetsParCarton;PrixHT;SecuritePaquets;PoidsGrammes";
const productCsv = (sku = "TEST-GOB") => `${header}\r\n${sku};Gobelets fictifs;Gobelets;50;10;4,25;2;500`;
const rows = (csv: string) => parseImportCsv(csv, "products").catalogRows;
async function repository() {
  const root = path.join(process.cwd(), ".local", "test-runs"); await mkdir(root, { recursive: true });
  const dir = await mkdtemp(path.join(root, "imports-")); const file = path.join(dir, "state.json");
  return { repo: new DemoRepository(file), file };
}
test("CSV français : prix exact en centimes, BOM, casse des catégories et SKU normalisé", () => {
  const parsed = parseImportCsv("\uFEFF" + productCsv("test-gob").replace(";Gobelets;50", ";gobelets;50"), "products");
  assert.equal(parsed.errors.length, 0); assert.equal(parsed.catalogRows[0].priceCents, 425);
  assert.equal(parsed.catalogRows[0].sku, "TEST-GOB"); assert.equal(parsed.catalogRows[0].category, "Gobelets");
});
test("CSV : champs cités, séparateurs internes, guillemets échappés et retours à la ligne", () => {
  const records = readCsv('SKU;Nom\r\nAB;"Sac; kraft ""test""\r\navec poignée"\r\nCD;Autre');
  assert.equal(records[1].cells[1], 'Sac; kraft "test"\navec poignée'); assert.equal(records[2].line, 4);
});
test("virgule, tabulation et directive Excel sont reconnues", () => {
  assert.equal(readCsv('SKU,Nom\nAB,"Test, cité"')[1].cells[1], "Test, cité");
  assert.equal(readCsv('SKU\tNom\nAB\tTest')[1].cells[1], "Test");
  assert.equal(readCsv('sep=;\r\nSKU;Nom\r\nAB;Test')[1].line, 3);
});
test("les guillemets invalides et le nombre de cellules incorrect bloquent l’import", () => {
  assert.throws(() => readCsv('SKU;Nom\nAB;"non fermé'), /fermeture manquant/);
  assert.throws(() => readCsv('SKU;Nom\nAB;"test"fin'), /mal placés/);
  assert.equal(parseImportCsv('SKU;Nom\nAB;Test;Trop', "products").errors.length, 1);
});
test("les lignes vides sont ignorées et les colonnes SKU ambiguës sont refusées", () => {
  assert.equal(readCsv('SKU;Nom\n\n;;\nAB;Test\n').length, 2);
  assert.match(parseImportCsv('SKU;Référence;Nom\nAB;CD;Test', "products").errors[0].message, /ambiguë/);
});
test("un catalogue partiel préserve les champs non renseignés et ne modifie pas le stock", () => {
  const s = seedState(); const parsed = parseImportCsv('SKU;Nom;PoidsGrammes;StockPaquets\nGOB-KR-25;Nouveau nom;;999', "products");
  assert.equal(parsed.errors.length, 0); assert.equal(parsed.warnings.length, 2);
  const plan = planCatalogImport(s, parsed.catalogRows); assert.equal(plan.updated, 1);
  applyAction(s, { type: "importProducts", rows: parsed.catalogRows });
  assert.equal(s.products[0].name, "Nouveau nom"); assert.equal(s.products[0].weightGrams, 500);
  assert.equal(s.products[0].physicalPacks, 186); assert.equal(s.products[0].packsPerCarton, 20);
});
test("une nouvelle fiche exige tous les champs et naît à zéro stock", () => {
  const s = seedState(); const plan = planCatalogImport(s, rows('SKU;Nom\nTEST-NEW;Test'));
  assert.ok(plan.errors.length > 0); applyAction(s, { type: "importProducts", rows: rows(productCsv()) });
  const p = s.products.find(p => p.sku === "TEST-GOB")!; assert.equal(p.physicalPacks, 0); assert.equal(p.priceCents, 425);
});
test("les références répétées sont refusées même si la casse diffère", () => {
  const s = seedState(); const plan = planCatalogImport(s, [{ sku: "GOB-KR-25", name: "A" }, { sku: "gob-kr-25", name: "B" }]);
  assert.equal(plan.errors.length, 2);
  assert.throws(() => applyAction(s, { type: "importProducts", rows: [{ sku: "GOB-KR-25" }, { sku: "gob-kr-25" }] }), /plusieurs fois/);
});
test("prix et quantités refusent les formules, les décimales excessives et les valeurs négatives", () => {
  for (const invalid of ["=2+2", "-4", "4,255", "1e3"]) {
    assert.ok(parseImportCsv(productCsv().replace("4,25", invalid), "products").errors.length > 0);
  }
  assert.ok(parseImportCsv('SKU;StockPaquets\nGOB-KR-25;1.5', "stock").errors.length > 0);
  assert.ok(parseImportCsv('SKU;StockPaquets\nGOB-KR-25;-1', "stock").errors.length > 0);
});
test("un inventaire est une valeur absolue et sa répétition n’ajoute pas de paquets ni de mouvements", () => {
  const s = seedState(); const data = parseImportCsv('SKU;StockCartons\nGOB-KR-25;10', "stock");
  const action = { type: "importStock" as const, rows: data.stockRows, reason: "Inventaire fictif" };
  const preview = planStockImport(s, data.stockRows); assert.equal(preview.entries[0].after, 200); assert.equal(preview.entries[0].delta, 14);
  applyAction(s, action); const events = s.events.length; applyAction(s, action);
  assert.equal(s.products[0].physicalPacks, 200); assert.equal(s.events.length, events); validateState(s);
});
test("zéro stock est accepté sans réservation et le stock réservé ne peut pas être effacé", () => {
  const s = seedState();
  assert.equal(planStockImport(s, [{ sku: "GOB-KR-25", quantity: 0, unit: "pack" }]).errors.length, 1);
  assert.equal(planStockImport(s, [{ sku: "CUI-BO-16", quantity: 0, unit: "pack" }]).errors.length, 0);
});
test("les produits inconnus, les unités ambiguës et les conversions excessives sont refusés", () => {
  const s = seedState(); assert.equal(planStockImport(s, [{ sku: "ABSENT", quantity: 10, unit: "pack" }]).errors.length, 1);
  assert.equal(planStockImport(s, [{ sku: "GOB-KR-25", quantity: 100000, unit: "carton" }]).errors.length, 1);
  assert.ok(parseImportCsv('SKU;StockPaquets;StockCartons\nGOB-KR-25;10;2', "stock").errors.length > 0);
  assert.ok(parseImportCsv('SKU;StockPaquets;StockCartons\nGOB-KR-25;;', "stock").errors.length > 0);
});
test("le changement du coefficient carton ne réécrit pas les commandes déjà reçues", () => {
  const s = seedState(); const original = s.orders[1].lines[0].packsPerSale;
  applyAction(s, { type: "importProducts", rows: [{ sku: "BAR-KR-750", packsPerCarton: 10 }] });
  assert.equal(s.orders[1].lines[0].packsPerSale, original);
});
test("un import de 300 références s’exécute sans doublons au réimport", () => {
  const s = seedState(); const base = rows(productCsv())[0]; const data = Array.from({ length: 300 }, (_, i) => ({ ...base, sku: `IMPORT-${i}` }));
  assert.equal(planCatalogImport(s, data).created, 300); applyAction(s, { type: "importProducts", rows: data });
  assert.equal(s.products.length, 312); const events = s.events.length;
  applyAction(s, { type: "importProducts", rows: data }); assert.equal(s.products.length, 312); assert.equal(s.events.length, events);
});
test("un import contenant une ligne invalide ne remplace pas le fichier de données", async () => {
  const { repo, file } = await repository(); await repo.read(); const before = await readFile(file, "utf8");
  await assert.rejects(() => repo.mutate({ type: "importProducts", rows: [{ sku: "GOB-KR-25", name: "Ne pas enregistrer" }, { sku: "NOUVEAU" }] }, 0), /Import refusé/);
  assert.equal(await readFile(file, "utf8"), before);
  await assert.rejects(() => repo.mutate({ type: "importStock", rows: [{ sku: "GOB-KR-25", quantity: 200, unit: "pack" }, { sku: "INCONNU", quantity: 1, unit: "pack" }], reason: "Inventaire test" }, 0), /Import refusé/);
  assert.equal(await readFile(file, "utf8"), before);
});
test("un aperçu périmé est rejeté après une modification concurrente", async () => {
  const { repo } = await repository(); await repo.read();
  await repo.mutate({ type: "adjustStock", productId: "prd-1", direction: "in", unit: "pack", quantity: 1, reason: "Réception concurrente" }, 0);
  await assert.rejects(() => repo.mutate({ type: "importStock", rows: [{ sku: "GOB-KR-25", quantity: 200, unit: "pack" }], reason: "Inventaire test" }, 0), /données ont changé/);
  assert.equal((await repo.read()).products[0].physicalPacks, 187);
});
test("les fichiers UTF-8, Windows-1252 et UTF-16 sont décodés sans perdre les accents", () => {
  assert.equal(decodeImportFile(new TextEncoder().encode("Catégorie")), "Catégorie");
  assert.equal(decodeImportFile(new Uint8Array([0x43, 0x61, 0x66, 0xe9])), "Café");
  assert.equal(decodeImportFile(new Uint8Array([0xff, 0xfe, 0xe9, 0x00])), "é");
});
test("les fichiers binaires et de plus de 1 000 lignes sont refusés", () => {
  assert.throws(() => readCsv("PK\0binaire"), /binaire/);
  assert.throws(() => readCsv("SKU;Nom\n" + Array.from({ length: 1001 }, (_, i) => `SKU-${i};Test`).join("\n")), /1 000 lignes/);
});
