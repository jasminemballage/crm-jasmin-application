// Requires an isolated test server and a data file under .local/test-runs/.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const base = process.env.CRM_TEST_BASE_URL;
const configuredFile = process.env.CRM_DEMO_DATA_FILE;
if (!base || !configuredFile) throw new Error("Définissez CRM_TEST_BASE_URL et CRM_DEMO_DATA_FILE pour un serveur de test isolé.");
const parsedBase = new URL(base);
if (parsedBase.hostname !== "127.0.0.1" || parsedBase.protocol !== "http:" || parsedBase.port === "3000")
  throw new Error("Le contrôle HTTP est limité à un serveur local isolé, hors du port 3000.");
const file = path.resolve(process.cwd(), configuredFile);
const testRoot = path.resolve(process.cwd(), ".local", "test-runs");
const relative = path.relative(testRoot, file);
if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Le fichier de test doit être dans .local/test-runs.");
let state = await fetch(`${base}/api/demo/state`).then(r => r.json());
const previous = await readFile(file, "utf8");
assert.equal(JSON.parse(previous).revision, state.revision, "Le serveur doit utiliser le même fichier de test.");
let expectedRevision = state.revision;
const originalRevision = expectedRevision;
const suffix = Date.now().toString();
let assertions = 0;
const check = (a, b) => { assert.equal(a, b); assertions++; };
async function action(action) {
  const r = await fetch(`${base}/api/demo/actions`, { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify({ revision: state.revision, action }) });
  const result = await r.json();
  assert.equal(r.status, 200, JSON.stringify(result));
  state = result.state; expectedRevision = state.revision;
  return result.targetId;
}
try {
  for (const route of ["/", "/catalogue", "/stocks", "/commandes", "/expeditions", "/connexions", "/parametres"]) {
    const r = await fetch(base + route); check(r.status, 200); assert.match(await r.text(), /Jasmin/);
  }
  const id = await action({ type: "createProduct", product: { sku: `QA-${suffix}`, name: "=Produit fictif QA", category: "Gobelets", unitsPerPack: 50, packsPerCarton: 6, priceCents: 450, safetyPacks: 0, weightGrams: 500 } });
  await action({ type: "adjustStock", productId: id, direction: "in", quantity: 2, unit: "carton", reason: "Contrôle automatisé local" });
  check(state.products.find(p => p.id === id).physicalPacks, 12);
  const orderAction = { type: "createOrder", externalId: `QA-${suffix}`, channel: "Amazon", customer: "Client fictif QA", city: "Ville test", country: "FR", lines: [{ productId: id, quantity: 2, unit: "pack" }] };
  const orderId = await action(orderAction); const count = state.orders.length;
  check(await action(orderAction), orderId); check(state.orders.length, count);
  const order = state.orders.find(o => o.id === orderId);
  const sh = await action({ type: "prepareShipment", orderId, weightGrams: 1000, lengthCm: 30, widthCm: 20, heightCm: 15, allocations: [{ lineId: order.lines[0].id, packs: 1 }] });
  check(state.products.find(p => p.id === id).physicalPacks, 12);
  await action({ type: "dispatchShipment", id: sh });
  check(state.products.find(p => p.id === id).physicalPacks, 11);
  check(state.orders.find(o => o.id === orderId).status, "partial");
  await action({ type: "dispatchShipment", id: sh });
  check(state.products.find(p => p.id === id).physicalPacks, 11);
  await action({ type: "cancelOrder", id: orderId });
  check(state.orders.find(o => o.id === orderId).status, "cancelled");
  const refreshed = await fetch(`${base}/api/demo/state`).then(r => r.json());
  check(refreshed.revision, state.revision);
  check(refreshed.products.find(p => p.id === id).physicalPacks, 11);
  check((await fetch(`${base}/preparation/${sh}`)).status, 200);
  const csv = await fetch(`${base}/api/demo/export?kind=products`).then(r => r.text());
  assert.match(csv, /'\=Produit fictif QA/); assertions++;
  const denied = await fetch(`${base}/api/demo/actions`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://example.invalid" }, body: JSON.stringify({ revision: state.revision, action: { type: "reset" } }) });
  check(denied.status, 403);
  const stale = await fetch(`${base}/api/demo/actions`, { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify({ revision: originalRevision, action: { type: "reset" } }) });
  check(stale.status, 409);
  for (const kind of ["template-products", "template-stock", "stock"]) {
    const template = await fetch(`${base}/api/demo/export?kind=${kind}`); check(template.status, 200);
    assert.match(await template.text(), /SKU/); assertions++;
  }
  const batch = Array.from({ length: 300 }, (_, i) => ({ sku: `BATCH-${suffix}-${i}`, name: `Produit fictif ${i}`.padEnd(145, "."),
    category: "Gobelets", unitsPerPack: 50, packsPerCarton: 10, priceCents: 425, safetyPacks: 2, weightGrams: 500 }));
  const beforeBatch = state.products.length;
  await action({ type: "importProducts", rows: batch }); check(state.products.length, beforeBatch + 300);
  await action({ type: "importProducts", rows: batch }); check(state.products.length, beforeBatch + 300);
  const stockRows = [{ sku: batch[0].sku, quantity: 2, unit: "carton" }];
  await action({ type: "importStock", rows: stockRows, reason: "Inventaire de test isolé" });
  check(state.products.find(p => p.sku === batch[0].sku).physicalPacks, 20);
  const events = state.events.length;
  await action({ type: "importStock", rows: stockRows, reason: "Inventaire de test isolé" });
  check(state.products.find(p => p.sku === batch[0].sku).physicalPacks, 20); check(state.events.length, events);
  const bad = await fetch(`${base}/api/demo/actions`, { method: "POST", headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ revision: state.revision, action: { type: "importStock", reason: "Erreur de test isolé", rows: [
      { sku: batch[0].sku, quantity: 999, unit: "pack" }, { sku: "INCONNU-QA", quantity: 1, unit: "pack" }] } }) });
  check(bad.status, 422);
  const afterBad = await fetch(`${base}/api/demo/state`).then(r => r.json());
  check(afterBad.revision, state.revision); check(afterBad.products.find(p => p.sku === batch[0].sku).physicalPacks, 20);
  const settingsResponse = await fetch(`${base}/api/demo/ai/settings`); check(settingsResponse.status, 200);
  const aiStatus = await settingsResponse.json(); check(Object.hasOwn(aiStatus, "apiKey"), false);
  check(aiStatus.textReady, false); // The QA server must use CRM_AI_DISABLED=1.
  const info = { workflowStatus: "draft", sourceUrl: "https://example.com/produit", lookupReference: "REFERENCE-FICTIVE", researchContext: "Test isolé",
    ean: "", brand: "Marque fictive", shortDescription: "Description courte fictive", longDescription: "Description longue fictive",
    vatRateBps: 2000, lengthMm: 120, widthMm: 80, heightMm: 200, attributes: [{ name: "Matière", value: "Papier" }], images: [], sources: [] };
  const productInfo = { sku: "", name: "", category: "Accessoires", unitsPerPack: 0, packsPerCarton: 0, weightGrams: 0, priceCents: 0, safetyPacks: 0, info };
  const draftId = await action({ type: "saveProductInfo", product: productInfo });
  check(state.products.find(p => p.id === draftId).info.workflowStatus, "draft");
  const photo = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6bXwAAAAASUVORK5CYII=", "base64");
  const upload = await fetch(`${base}/api/demo/media`, { method: "POST", headers: { Origin: base, "Content-Type": "image/png" }, body: photo });
  check(upload.status, 200); const asset = await upload.json();
  const photoResponse = await fetch(base + asset.url); check(photoResponse.status, 200); check(photoResponse.headers.get("content-type"), "image/png");
  const activated = { ...productInfo, sku: state.products.find(p => p.id === draftId).sku, name: "Fiche complète fictive", unitsPerPack: 50, packsPerCarton: 10, weightGrams: 500, priceCents: 425,
    info: { ...info, workflowStatus: "active", images: [asset] } };
  await action({ type: "saveProductInfo", id: draftId, product: activated });
  check(state.products.find(p => p.id === draftId).info.longDescription, info.longDescription);
  check(state.products.find(p => p.id === draftId).info.images[0].url, asset.url);
  check(state.products.find(p => p.id === draftId).physicalPacks, 0);
  const invalidPhoto = await fetch(`${base}/api/demo/media`, { method: "POST", headers: { Origin: base, "Content-Type": "image/png" }, body: Buffer.from("ceci-n-est-pas-une-image") });
  check(invalidPhoto.status, 422);
  const aiContext = { sourceUrl: info.sourceUrl, lookupReference: info.lookupReference, researchContext: "Fictif", name: "Produit fictif", brand: "", ean: "", category: "Accessoires",
    unitsPerPack: 0, packsPerCarton: 0, weightGrams: 0, priceCents: 0, lengthMm: 0, widthMm: 0, heightMm: 0, attributes: [] };
  const noAi = await fetch(`${base}/api/demo/ai`, { method: "POST", headers: { Origin: base, "Content-Type": "application/json" }, body: JSON.stringify({ action: "enrich", mode: "compose", context: aiContext }) });
  check(noAi.status, 503);
  console.log(`${assertions} contrôles HTTP réussis : parcours, import de 300 produits, inventaire, répétitions, refus sans modification et exports.`);
} finally {
  const current = JSON.parse(await readFile(file, "utf8"));
  if (current.revision === expectedRevision) {
    await writeFile(file, previous, "utf8");
    console.log("État de test restauré. Le fichier des essais de Jasmin n’a pas été utilisé.");
  } else {
    await writeFile(path.join(process.cwd(), ".local", `avant-controle-${suffix}.json`), previous, "utf8");
    console.log("Autres modifications détectées : elles sont conservées, copie antérieure sauvegardée.");
  }
}
