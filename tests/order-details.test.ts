import test from "node:test";
import assert from "node:assert/strict";
import { orderSchema, stateSchema } from "../src/lib/model";
import { seedState } from "../src/lib/seed";
import { getOrderDetails, orderDue, orderTotal } from "../src/lib/order-details";

test("les anciennes commandes restent lisibles sans inventer TTC, destinataire ou échéance", () => {
  const state = stateSchema.parse(seedState());
  const order = state.orders[0];
  const details = getOrderDetails(order, state.products);
  assert.deepEqual(orderTotal(order), { cents: order.lines.reduce((sum, line) => sum + line.quantity * line.unitPriceCents, 0), taxBasis: "HT" });
  assert.equal(orderDue(order), null);
  assert.equal(details.recipient.email, null);
  assert.equal(details.recipient.firstName, null);
  assert.equal(details.recipient.lastName, null);
  assert.equal(details.recipient.city, order.city);
  assert.equal(details.fulfillment, null);
  assert.equal(details.prime, null);
});

test("le total historique multiplie le prix de vente par les cartons et ne multiplie pas deux fois les paquets", () => {
  const order = seedState().orders[0];
  order.lines = [{ ...order.lines[0], quantity: 3, packsPerSale: 20, unitPriceCents: 8500 }];
  const details = getOrderDetails(order, []);
  assert.deepEqual(details.total, { cents: 25500, taxBasis: "HT" });
  assert.equal(details.articleCount, 3);
  assert.equal(details.packCount, 60);
  assert.equal(details.lines[0].totalPacks, 60);
  assert.equal(details.lines[0].sku, null);
  assert.equal(details.lines[0].taxCents, null);
});

test("les métadonnées optionnelles passent le schéma et le TTC explicite prime sans calcul de TVA", () => {
  const order = orderSchema.parse({ ...seedState().orders[0], details: {
    totalTtcCents: 12345, fulfillment: "FBA", prime: false, b2b: true,
    marketplace: "Amazon FR", shipBy: "2026-11-05T18:00:00.000Z",
    recipient: { company: "Entreprise fictive", address1: "Adresse de test", postalCode: "00000" }
  } });
  assert.deepEqual(orderTotal(order), { cents: 12345, taxBasis: "TTC" });
  assert.equal(orderDue(order), "2026-11-05T18:00:00.000Z");
  const details = getOrderDetails(order, []);
  assert.equal(details.fulfillment, "FBA");
  assert.equal(details.prime, false);
  assert.equal(details.b2b, true);
  assert.equal(details.recipient.company, "Entreprise fictive");
});

test("un TTC partiel de lignes ne transforme pas le reste HT en TTC et zéro reste un montant explicite", () => {
  const original = seedState().orders[0];
  const order = orderSchema.parse({ ...original, lines: [
    { ...original.lines[0], id: "line-a", quantity: 2, unitPriceCents: 100, details: { totalTtcCents: 240, taxCents: 40, shippingCents: 0, discountCents: 0 } },
    { ...original.lines[0], id: "line-b", quantity: 1, unitPriceCents: 100 }
  ] });
  assert.deepEqual(orderTotal(order), { cents: 300, taxBasis: "HT" });
  order.lines[1].details = { totalTtcCents: 120 };
  assert.deepEqual(orderTotal(order), { cents: 360, taxBasis: "TTC" });
  order.details = { totalTtcCents: 0 };
  assert.deepEqual(orderTotal(order), { cents: 0, taxBasis: "TTC" });
  const line = getOrderDetails(order, []).lines[0];
  assert.equal(line.shippingCents, 0);
  assert.equal(line.discountCents, 0);
});

test("les lignes conservent les références de vente et les données de catalogue ne les écrasent pas", () => {
  const state = seedState();
  const order = orderSchema.parse({ ...state.orders[0], lines: [{ ...state.orders[0].lines[0], details: { sku: "SKU-VENDU", asin: "ASIN-FICTIF", title: "Titre lors de la vente" } }] });
  const line = getOrderDetails(order, state.products).lines[0];
  assert.equal(line.sku, "SKU-VENDU");
  assert.equal(line.asin, "ASIN-FICTIF");
  assert.equal(line.title, "Titre lors de la vente");
});

test("le schéma refuse les montants négatifs, les dates invalides et les fenêtres inversées", () => {
  const original = seedState().orders[0];
  for (const details of [
    { totalTtcCents: -1 }, { totalTtcCents: 10.5 }, { shipBy: "demain" },
    { shipFrom: "2026-11-06T08:00:00.000Z", shipBy: "2026-11-05T18:00:00.000Z" },
    { deliverFrom: "2026-11-08T08:00:00.000Z", deliverBy: "2026-11-07T18:00:00.000Z" }
  ]) assert.equal(orderSchema.safeParse({ ...original, details }).success, false);
});
