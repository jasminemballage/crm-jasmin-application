import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import path from "node:path";
import { emptyProductInfo, isPublicUrl, isValidGtin, priceExcludingTax, priceIncludingTax, productEditorInput, type ProductEditorInput } from "../src/lib/product-info";
import { applyAction, validateState } from "../src/lib/domain";
import { seedState } from "../src/lib/seed";
import { DemoRepository } from "../src/lib/repository";
import { imageFormat, readImage, storeImage } from "../src/lib/media";
import { getAiSettings, publicAiStatus, readEnvValues, saveAiSettings } from "../src/lib/ai-settings";
import { enrichProduct, generateProductImage, sanitizeSuggestion } from "../src/lib/openrouter";
import { aiSuggestionSchema, type AiContext, type AiSuggestion } from "../src/lib/ai-contract";

const blank = (): ProductEditorInput => ({ sku: "", name: "", category: "Accessoires", unitsPerPack: 0, packsPerCarton: 0,
  priceCents: 0, safetyPacks: 0, weightGrams: 0, info: emptyProductInfo() });
const complete = (): ProductEditorInput => ({ ...blank(), sku: "NOUVEAU-TEST", name: "Produit fictif de test", unitsPerPack: 50,
  packsPerCarton: 10, weightGrams: 500, priceCents: 425, info: { ...emptyProductInfo(), workflowStatus: "active", brand: "Marque fictive", ean: "4006381333931",
    shortDescription: "Résumé fictif", longDescription: "Description longue fictive", lengthMm: 120, widthMm: 90, heightMm: 200,
    attributes: [{ name: "Matière", value: "Papier" }], sourceUrl: "https://example.com/produit", sources: [{ url: "https://example.com/produit", title: "Source fictive" }] } });
const context = (): AiContext => ({ sourceUrl: "https://example.com/produit", lookupReference: "REF-TEST", researchContext: "Gobelet fictif",
  name: "Gobelet kraft fictif", brand: "", ean: "", category: "Gobelets", unitsPerPack: 0, packsPerCarton: 0, weightGrams: 0,
  priceCents: 0, lengthMm: 0, widthMm: 0, heightMm: 0, attributes: [] });
const suggestion = (): AiSuggestion => ({ name: "Titre proposé", shortDescription: "Résumé proposé", longDescription: "Description proposée", brand: "", ean: "", category: "Gobelets",
  unitsPerPack: null, packsPerCarton: null, weightGrams: null, priceCents: null, lengthMm: null, widthMm: null, heightMm: null,
  attributes: [], imageUrls: [], sources: [], evidence: [], uncertainties: [] });
const config = { apiKey: "unit-test-token-not-a-real-key", enabled: true, textModel: "test/text", imageModel: "test/image", imageRules: "Fond blanc fictif" };
async function directory() { const root = path.join(process.cwd(), ".local", "test-runs"); await mkdir(root, { recursive: true }); return mkdtemp(path.join(root, "infos-")); }
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6bXwAAAAASUVORK5CYII=", "base64");

test("un brouillon vide est conservé sans inventer de titre, de poids ou de conditionnement", () => {
  const state = seedState(); const id = applyAction(state, { type: "saveProductInfo", product: blank() });
  const p = state.products.find(p => p.id === id)!;
  assert.match(p.sku, /^JAS-/); assert.equal(p.name, ""); assert.equal(p.weightGrams, 0); assert.equal(p.packsPerCarton, 0);
  assert.equal(p.info?.workflowStatus, "draft"); validateState(state);
});
test("l’activation exige les champs métier et conserve toutes les informations de l’onglet Infos", () => {
  const state = seedState(); const invalid = blank(); invalid.info.workflowStatus = "active";
  assert.throws(() => applyAction(state, { type: "saveProductInfo", product: invalid }), /Pour activer/);
  const data = complete(); const id = applyAction(state, { type: "saveProductInfo", product: data, initialPhysicalPacks: 20 });
  const p = state.products.find(p => p.id === id)!;
  assert.equal(p.physicalPacks, 20); assert.deepEqual(p.info, data.info); validateState(state);
});
test("la modification d’une fiche ne modifie jamais son physique ni les réservations existantes", () => {
  const state = seedState(); const p = state.products[0];
  applyAction(state, { type: "saveProductInfo", id: p.id, product: { ...complete(), sku: p.sku, name: p.name } });
  assert.equal(p.physicalPacks, 186); assert.equal(state.orders[0].lines[0].quantity, 6);
  assert.throws(() => applyAction(state, { type: "saveProductInfo", id: p.id, product: complete(), initialPhysicalPacks: 999 }), /se modifie dans Stocks/);
});
test("les brouillons sont refusés pour les nouvelles commandes et les coefficients inconnus bloquent les cartons", () => {
  const state = seedState(); const id = applyAction(state, { type: "saveProductInfo", product: blank() });
  assert.throws(() => applyAction(state, { type: "createOrder", externalId: "TEST-DRAFT", channel: "Amazon", customer: "Fictif", city: "Test", country: "FR", lines: [{ productId: id, quantity: 1, unit: "pack" }] }), /activez la fiche/);
  assert.throws(() => applyAction(state, { type: "adjustStock", productId: id, direction: "in", quantity: 2, unit: "carton", reason: "Test fictif" }), /paquets par carton/);
});
test("un visuel IA non vérifié empêche l’activation mais peut rester en brouillon", () => {
  const state = seedState(); const p = complete();
  p.info.images = [{ id: "image-test", url: "https://example.com/produit.png", alt: "Image fictive", kind: "generated", reviewed: false, sourceUrl: "", prompt: "Test" }];
  assert.throws(() => applyAction(state, { type: "saveProductInfo", product: p }), /visuels IA/);
  p.info.workflowStatus = "draft"; const id = applyAction(state, { type: "saveProductInfo", product: p });
  p.info.images[0].reviewed = true; p.info.workflowStatus = "active";
  applyAction(state, { type: "saveProductInfo", id, product: p }); assert.equal(state.products.find(p => p.id === id)!.info!.workflowStatus, "active");
});
test("les EAN contrôlent leur clé, les attributs sont uniques et les adresses privées sont refusées", () => {
  assert.equal(isValidGtin("4006381333931"), true); assert.equal(isValidGtin("4006381333932"), false);
  for (const url of ["http://example.com/a", "https://localhost/a", "https://127.0.0.1/a", "https://user:password@example.com/a", "https://example.com/a?api_key=secret"])
    assert.equal(isPublicUrl(url), false);
  const p = complete(); p.info.attributes.push({ name: "matière", value: "Autre" }); assert.equal(productEditorInput.safeParse(p).success, false);
});
test("les conversions HT/TTC travaillent en centimes et respectent la TVA choisie", () => {
  assert.equal(priceIncludingTax(425, 2000), 510); assert.equal(priceExcludingTax(510, 2000), 425);
  assert.equal(priceIncludingTax(1000, 550), 1055); assert.equal(priceIncludingTax(425, 0), 425);
});
test("le réimport du catalogue et l’ancienne API de modification préservent les métadonnées Infos", () => {
  const state = seedState(); const data = complete(); const id = applyAction(state, { type: "saveProductInfo", product: data });
  applyAction(state, { type: "importProducts", rows: [{ sku: data.sku, name: "Nouveau titre" }] });
  const p = state.products.find(p => p.id === id)!; assert.deepEqual(p.info, data.info);
  const { sku, name, category, unitsPerPack, packsPerCarton, priceCents, safetyPacks, weightGrams } = p;
  applyAction(state, { type: "updateProduct", id, product: { sku, name, category, unitsPerPack, packsPerCarton, priceCents, safetyPacks, weightGrams } });
  assert.deepEqual(p.info, data.info);
});
test("la fiche complète persiste sur disque et une erreur d’activation conserve la version précédente", async () => {
  const dir = await directory(); const file = path.join(dir, "state.json"); const repo = new DemoRepository(file);
  const result = await repo.mutate({ type: "saveProductInfo", product: complete() }, 0);
  assert.deepEqual((await repo.read()).products.find(p => p.id === result.targetId)!.info, complete().info);
  const before = await readFile(file, "utf8"); const invalid = blank(); invalid.info.workflowStatus = "active";
  await assert.rejects(() => repo.mutate({ type: "saveProductInfo", product: invalid }, 1)); assert.equal(await readFile(file, "utf8"), before);
});
test("les photos sont enregistrées hors du JSON, relues et protégées contre les chemins arbitraires", async () => {
  const dir = await directory(); const asset = await storeImage(png, { kind: "uploaded", alt: "Fictif" }, dir);
  assert.equal(asset.kind, "uploaded"); assert.equal(asset.reviewed, true);
  const image = await readImage(asset.url.split("/").pop()!, dir); assert.equal(image.mime, "image/png"); assert.deepEqual(image.bytes, png);
  await assert.rejects(() => readImage("../../package.json", dir), /introuvable/);
  assert.throws(() => imageFormat(Buffer.from("<svg>ceci-n-est-pas-une-photo</svg>")), /PNG, JPEG ou WebP/);
});
test("la configuration enregistre la clé hors catalogue sans jamais la renvoyer et conserve les autres variables", async () => {
  const dir = await directory(); const file = path.join(dir, "settings.env");
  const { writeFile } = await import("node:fs/promises"); await writeFile(file, "AUTRE_OPTION=conserver\n");
  const input = { enabled: true, apiKey: config.apiKey, clearKey: false, textModel: "test/text", imageModel: "test/image", imageRules: "Ligne 1\nLigne 2" };
  const status = await saveAiSettings(input, file);
  assert.equal(status.keyPresent, true); assert.equal(JSON.stringify(status).includes(config.apiKey), false);
  assert.match(await readFile(file, "utf8"), /AUTRE_OPTION=conserver/);
  assert.equal((await getAiSettings(file, {})).imageRules, "Ligne 1\nLigne 2");
  await saveAiSettings({ ...input, apiKey: undefined, clearKey: true, enabled: false }, file);
  assert.equal((await getAiSettings(file, { OPENROUTER_API_KEY: "old-process-value" })).apiKey, "");
  assert.equal(readEnvValues('OPENROUTER_API_KEY=""').OPENROUTER_API_KEY, "");
});
test("les contrôles désactivent les appels IA même si une clé existe dans l’environnement", async () => {
  const dir = await directory(); const settings = await getAiSettings(path.join(dir, "absent.env"), { OPENROUTER_API_KEY: config.apiKey, CRM_AI_DISABLED: "1" });
  assert.equal(publicAiStatus(settings).textReady, false);
  let calls = 0; const fake = (async () => { calls++; throw new Error("ne doit pas être appelé"); }) as typeof fetch;
  await assert.rejects(() => enrichProduct(context(), "web", settings, fake), /Configurez OpenRouter/); assert.equal(calls, 0);
});
test("les faits sans source et les EAN invalides sont écartés des propositions IA", () => {
  const s = suggestion(); s.ean = "4006381333932"; s.priceCents = 299; s.weightGrams = 500; s.brand = "Marque inventée";
  const checked = sanitizeSuggestion(s, context(), true);
  assert.equal(checked.ean, ""); assert.equal(checked.priceCents, null); assert.equal(checked.weightGrams, null); assert.equal(checked.brand, "");
  const sourced = suggestion(); sourced.weightGrams = 500; sourced.sources = [{ url: "https://example.com/produit", title: "Source fictive" }]; sourced.evidence = [{ field: "weightGrams", url: "https://example.com/produit", note: "Poids annoncé : 500 g" }];
  assert.equal(sanitizeSuggestion(sourced, context(), true).weightGrams, 500);
  assert.equal(sanitizeSuggestion(sourced, context(), false).weightGrams, null);
});
test("le connecteur web sépare la recherche bornée du formatage structuré sans transmettre la clé au modèle", async () => {
  const payloads: Record<string, any>[] = []; let endpoint = "";
  const fake = (async (url, options) => { endpoint = String(url); payloads.push(JSON.parse(String(options?.body)));
    assert.equal(new Headers(options?.headers).get("authorization"), `Bearer ${config.apiKey}`);
    return Response.json({ choices: [{ message: { content: JSON.stringify(suggestion()) } }], usage: { cost: 0.001 } }); }) as typeof fetch;
  const result = await enrichProduct(context(), "web", config, fake, undefined, async () => null);
  assert.equal(endpoint, "https://openrouter.ai/api/v1/chat/completions"); assert.equal(payloads.length, 2);
  assert.equal(payloads[0].tools[0].type, "openrouter:web_fetch"); assert.equal(payloads[0].tools[0].parameters.max_uses, 1);
  assert.equal(payloads[1].tools, undefined); assert.equal(payloads[1].response_format.type, "json_schema");
  assert.equal(JSON.stringify(payloads).includes(config.apiKey), false); assert.equal(result.suggestion.name, "Titre proposé");
  assert.equal(result.cost, 0.002);
  assert.equal(aiSuggestionSchema.safeParse(result.suggestion).success, true);
});
test("les réponses fournisseur malformées et erreurs d’accès sont refusées sans révéler leur corps", async () => {
  const invalid = (async () => Response.json({ choices: [{ message: { content: "{incorrect" } }] })) as typeof fetch;
  await assert.rejects(() => enrichProduct(context(), "compose", config, invalid), /objet JSON valide/);
  const refused = (async () => new Response(config.apiKey, { status: 401 })) as typeof fetch;
  await assert.rejects(() => enrichProduct(context(), "compose", config, refused), error => !String(error).includes(config.apiKey) && /refuse/.test(String(error)));
  const missingModel = (async () => Response.json({ error: { message: config.apiKey } }, { status: 400 })) as typeof fetch;
  await assert.rejects(() => enrichProduct(context(), "compose", config, missingModel), error => !String(error).includes(config.apiKey) && /HTTP 400/.test(String(error)));
});
test("la génération d’image utilise l’API Images et conserve un visuel non validé sans aucun appel réel", async () => {
  const dir = await directory(); const previous = process.env.CRM_DEMO_DATA_FILE;
  process.env.CRM_DEMO_DATA_FILE = path.join(dir, "state.json");
  try {
    let endpoint = ""; let payload: any;
    const fake = (async (url, options) => { endpoint = String(url); payload = JSON.parse(String(options?.body));
      return Response.json({ data: [{ b64_json: png.toString("base64"), media_type: "image/png" }], usage: { cost: 0.02 } }); }) as typeof fetch;
    const result = await generateProductImage({ context: context(), type: "packshot", prompt: "Image de test", useGlobalRules: true }, config, fake);
    assert.equal(endpoint, "https://openrouter.ai/api/v1/images"); assert.equal(payload.n, 1); assert.equal(payload.output_format, undefined);
    assert.equal(JSON.stringify(payload).includes(config.apiKey), false); assert.equal(result.image.kind, "generated"); assert.equal(result.image.reviewed, false);
    const image = await readImage(result.image.url.split("/").pop()!); assert.deepEqual(image.bytes, png);
  } finally { if (previous === undefined) delete process.env.CRM_DEMO_DATA_FILE; else process.env.CRM_DEMO_DATA_FILE = previous; }
});
