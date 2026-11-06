import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { applyAction, validateState, DomainError } from "../src/lib/domain";
import { availablePacks, reservedPacks, totalPacks, unpreparedPacks } from "../src/lib/selectors";
import { seedState } from "../src/lib/seed";
import { DemoRepository } from "../src/lib/repository";
import { assertLocalRequest } from "../src/lib/guard";
import type { Action, State } from "../src/lib/model";

const create = (externalId = "TEST-1", quantity = 1, unit: "pack" | "carton" = "pack"): Action => ({
  type: "createOrder", externalId, channel: "Amazon", customer: "Client fictif", city: "Ville test", country: "FR",
  lines: [{ productId: "prd-1", quantity, unit }]
});
async function testDirectory(prefix: string) {
  const root = path.join(process.cwd(), ".local", "test-runs");
  await mkdir(root, { recursive: true });
  return mkdtemp(path.join(root, prefix));
}
function prepare(s: State, orderId = "ord-1", packs = 6) {
  const o = s.orders.find(o => o.id === orderId)!;
  return applyAction(s, { type: "prepareShipment", orderId, weightGrams: 3000, lengthCm: 40, widthCm: 30, heightCm: 25,
    allocations: [{ lineId: o.lines[0].id, packs }] });
}
test("le jeu initial est cohérent et l’historique ne réserve pas de stock", () => {
  const s = validateState(seedState());
  assert.equal(reservedPacks(s, "prd-8"), 0);
  assert.equal(reservedPacks(s, "prd-1"), 6);
  assert.equal(availablePacks(s, s.products[0]), 160);
});
test("un carton consomme le coefficient produit et le conserve après modification de la fiche", () => {
  const s = seedState(); const key = applyAction(s, create("CARTON", 2, "carton") as Exclude<Action, {type:"reset"}>);
  const o = s.orders.find(o => o.id === key)!;
  assert.equal(totalPacks(o.lines[0]), 40);
  s.products[0].packsPerCarton = 50;
  assert.equal(totalPacks(o.lines[0]), 40);
  assert.equal(reservedPacks(s, "prd-1"), 46);
});
test("une commande importée deux fois ne réserve qu’une seule fois, avec référence insensible à la casse", () => {
  const s = seedState(); const a = create("Doublon", 2) as Exclude<Action, {type:"reset"}>;
  const key = applyAction(s, a); const size = s.orders.length;
  const again = applyAction(s, { ...a, externalId: "doublon" } as typeof a);
  assert.equal(again, key); assert.equal(s.orders.length, size); assert.equal(reservedPacks(s, "prd-1"), 8);
});
test("une réservation protège le stock de sécurité", () => {
  const s = seedState();
  assert.throws(() => applyAction(s, create("TROP", 161) as Exclude<Action, {type:"reset"}>), /160 disponibles/);
  assert.equal(s.orders.length, 8);
});
test("les lignes multiples du même produit sont agrégées avant réservation", () => {
  const s = seedState(); const a = create("MULTI", 100) as Extract<Action, {type:"createOrder"}>;
  a.lines.push({ productId: "prd-1", quantity: 100, unit: "pack" });
  assert.throws(() => applyAction(s, a), /200 paquets demandés/);
});
test("un mouvement saisi en cartons ajoute exactement les paquets correspondants", () => {
  const s = seedState(); applyAction(s, { type: "adjustStock", productId: "prd-1", direction: "in", quantity: 2, unit: "carton", reason: "Réception test" });
  assert.equal(s.products[0].physicalPacks, 226); assert.equal(s.events[0].deltaPacks, 40);
});
test("un retrait ne consomme pas des paquets déjà réservés", () => {
  const s = seedState();
  assert.throws(() => applyAction(s, { type: "adjustStock", productId: "prd-1", direction: "out", quantity: 181, unit: "pack", reason: "Correction test" }), /déjà réservé/);
});
test("préparer un colis ne déduit pas le stock et empêche la double préparation", () => {
  const s = seedState(); prepare(s);
  assert.equal(s.products[0].physicalPacks, 186); assert.equal(reservedPacks(s, "prd-1"), 6);
  assert.equal(unpreparedPacks(s, s.orders[0], "line-1"), 0);
  assert.throws(() => prepare(s), /supérieure au solde/);
});
test("la remise est idempotente et libère uniquement la réservation du colis", () => {
  const s = seedState(); const sh = prepare(s);
  applyAction(s, { type: "dispatchShipment", id: sh }); applyAction(s, { type: "dispatchShipment", id: sh });
  assert.equal(s.products[0].physicalPacks, 180); assert.equal(reservedPacks(s, "prd-1"), 0);
  assert.equal(s.orders[0].status, "shipped"); validateState(s);
});
test("deux colis partiels épuisent la commande sans double sortie", () => {
  const s = seedState(); const first = prepare(s, "ord-1", 2); const second = prepare(s, "ord-1", 4);
  applyAction(s, { type: "dispatchShipment", id: second });
  assert.equal(s.orders[0].status, "partial"); assert.equal(reservedPacks(s, "prd-1"), 2);
  applyAction(s, { type: "dispatchShipment", id: first });
  assert.equal(s.products[0].physicalPacks, 180); assert.equal(s.orders[0].status, "shipped");
});
test("annuler un solde partiel préserve les sorties passées et annule les colis restants", () => {
  const s = seedState(); const first = prepare(s, "ord-1", 2); const second = prepare(s, "ord-1", 4);
  applyAction(s, { type: "dispatchShipment", id: first }); applyAction(s, { type: "cancelOrder", id: "ord-1" });
  assert.equal(s.products[0].physicalPacks, 184); assert.equal(reservedPacks(s, "prd-1"), 0);
  assert.throws(() => applyAction(s, { type: "dispatchShipment", id: second }), /annulé/);
});
test("une commande historique est en consultation seule", () => {
  const s = seedState();
  assert.throws(() => applyAction(s, { type: "cancelOrder", id: "ord-8" }), /close/);
  assert.throws(() => prepare(s, "ord-8", 1), /pas ouverte/);
});
test("la validation d’une commande à vérifier réserve à cet instant", () => {
  const s = seedState(); assert.equal(reservedPacks(s, "prd-4"), 0);
  applyAction(s, { type: "releaseOrder", id: "ord-5" }); assert.equal(reservedPacks(s, "prd-4"), 4);
});
test("deux demandes concurrentes pour le dernier paquet ne peuvent pas toutes deux réussir", async () => {
  const dir = await testDirectory("stock-");
  const file = path.join(dir, "state.json"); const initial = seedState();
  initial.products[0].physicalPacks = 27; // 6 reserved + 20 safety + 1 available
  await writeFile(file, JSON.stringify(initial)); const repo = new DemoRepository(file);
  const results = await Promise.allSettled([repo.mutate(create("A"), 0), repo.mutate(create("B"), 0)]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1,
    results.map(r => r.status === "rejected" ? String(r.reason) : "réussite").join(" | "));
  assert.equal(reservedPacks(await repo.read(), "prd-1"), 7);
  await assert.rejects(() => repo.mutate(create("C"), 1), /0 disponibles/);
});
test("une écriture invalide ne remplace pas le fichier précédent", async () => {
  const dir = await testDirectory("rollback-"); const file = path.join(dir, "state.json");
  const repo = new DemoRepository(file); await repo.read(); const before = await readFile(file, "utf8");
  await assert.rejects(() => repo.mutate({ type: "adjustStock", productId: "prd-1", direction: "in", quantity: 1_000_000, unit: "carton", reason: "Valeur trop grande" }, 0));
  assert.equal(await readFile(file, "utf8"), before);
});
test("un fichier corrompu est conservé sans réinitialisation silencieuse", async () => {
  const dir = await testDirectory("corrupt-"); const file = path.join(dir, "state.json");
  await writeFile(file, "{illisible}"); const repo = new DemoRepository(file);
  await assert.rejects(() => repo.read(), /conservé/); assert.equal(await readFile(file, "utf8"), "{illisible}");
});
test("la protection locale refuse un accès distant et une origine différente", async () => {
  await assert.rejects(() => assertLocalRequest(new Request("http://evil.test/api", { headers: { host: "evil.test" } })), DomainError);
  await assert.rejects(() => assertLocalRequest(new Request("http://localhost:3000/api", { headers: { host: "localhost:3000", origin: "https://evil.test", "content-type": "application/json" } }), true), /Origine/);
  await assert.doesNotReject(() => assertLocalRequest(new Request("http://127.0.0.1:3000/api", { headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000", "content-type": "application/json" } }), true));
});
test("le mode production refuse les données de démonstration sans activation locale explicite", async () => {
  const previous = { nodeEnv: process.env.NODE_ENV, demo: process.env.CRM_LOCAL_DEMO };
  try {
    Object.assign(process.env, { NODE_ENV: "production", CRM_LOCAL_DEMO: "0" });
    await assert.rejects(() => assertLocalRequest(new Request("http://127.0.0.1:3000/api", { headers: { host: "127.0.0.1:3000" } })), /ne peut pas être mise en service/);
  } finally {
    if (previous.nodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
    else Object.assign(process.env, { NODE_ENV: previous.nodeEnv });
    if (previous.demo === undefined) delete process.env.CRM_LOCAL_DEMO;
    else process.env.CRM_LOCAL_DEMO = previous.demo;
  }
});
test("un fichier contenant une surallocation de colis est refusé", () => {
  const s = seedState(); prepare(s);
  s.shipments[0].allocations[0].packs = 7;
  assert.throws(() => validateState(s), /Quantités de colis incohérentes/);
});
