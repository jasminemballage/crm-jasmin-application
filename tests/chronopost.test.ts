import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getChronopostSettings, publicChronopostStatus, saveChronopostSettings } from "../src/lib/chronopost-settings";
import { getAiSettings, saveAiSettings } from "../src/lib/ai-settings";
import { chronopostAddressSchema } from "../src/lib/chronopost-contract";
import { createChronopostLabel, readChronopostLabel, readChronopostPdf, buildChronopostSoap, parseChronopostResponse } from "../src/lib/chronopost";
import { seedState } from "../src/lib/seed";
import { applyAction } from "../src/lib/domain";

const address = { name: "Jasmin & fils", address1: "1 rue des Fleurs", address2: "", zipCode: "75001", city: "Paris", country: "FR" as const, contactName: "Tim", email: "tim@example.com", phone: "0612345678" };
const channels = Object.fromEntries(["Amazon", "Cdiscount", "RETIF", "METRO", "Site Jasmin"].map(c => [c, { accountNumber: "123456", subAccount: "002", productCode: "01", service: "0" }]));
const config = { enabled: true, password: "secret<&value", shipper: address, channels };
const recipient = { ...address, name: "Client", address1: "2 rue du Client" };
const pdf = Buffer.from("%PDF-1.4\nmock PDF\n%%EOF");
const success = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns:shippingV7Response xmlns:ns="http://cxf.shipping.soap.chronopost.fr/"><return><errorCode>0</errorCode><skybillNumber>XY123456789FR</skybillNumber><pdfEtiquette>${pdf.toString("base64")}</pdfEtiquette></return></ns:shippingV7Response></soap:Body></soap:Envelope>`;
function prepared() {
  const state = seedState();
  const order = state.orders.find(o => !["cancelled", "shipped"].includes(o.status))!;
  const shipmentId = applyAction(state, { type: "prepareShipment", orderId: order.id, weightGrams: 2500, lengthCm: 30, widthCm: 20, heightCm: 10, allocations: [{ lineId: order.lines[0].id, packs: 1 }] }) as string;
  return { state, shipmentId };
}
async function temporary(work: (root: string) => Promise<void>) { const root = await mkdtemp(path.join(tmpdir(), "jasmin-chrono-")); try { await work(root); } finally { await rm(root, { recursive: true, force: true }); } }

test("Chronopost settings preserve other configuration and never disclose the password", async () => temporary(async root => {
  const file = path.join(root, "settings.env"); await writeFile(file, 'OTHER_KEY="preserved"\n');
  const result = await saveChronopostSettings({ ...config, clearPassword: false }, file);
  assert.equal(result.passwordPresent, true); assert.equal("password" in result, false);
  assert.equal((await readFile(file, "utf8")).includes('OTHER_KEY="preserved"'), true);
  assert.equal((await getChronopostSettings(file, {})).password, config.password);
  const masked = publicChronopostStatus(await getChronopostSettings(file, {}));
  assert.equal(JSON.stringify(masked).includes(config.password), false);
  await saveChronopostSettings({ ...config, password: undefined, clearPassword: true }, file);
  assert.equal((await getChronopostSettings(file, {})).password, "");
}));

test("Concurrent OpenRouter and Chronopost saves preserve both settings and unrelated environment values", async () => temporary(async root => {
  const file = path.join(root, "shared.env");
  await writeFile(file, 'OTHER_KEY="preserved"\n');
  await Promise.all([
    saveAiSettings({ enabled: true, apiKey: "test-openrouter-secret", clearKey: false,
      textModel: "test/text", imageModel: "test/image", imageRules: "Test" }, file),
    saveChronopostSettings({ ...config, clearPassword: false }, `${root}/./shared.env`)
  ]);
  const ai = await getAiSettings(file, {});
  const chrono = await getChronopostSettings(file, {});
  assert.equal(ai.apiKey, "test-openrouter-secret");
  assert.equal(ai.textModel, "test/text");
  assert.equal(chrono.password, config.password);
  assert.deepEqual(chrono.shipper, address);
  assert.match(await readFile(file, "utf8"), /OTHER_KEY="preserved"/);
}));

test("Chronopost requires 8 to 15 real phone digits while accepting spacing and an international prefix", () => {
  for (const phone of ["        ", "........", "1234567", "1234567890123456"])
    assert.equal(chronopostAddressSchema.safeParse({ ...address, phone }).success, false, "A non telephone must be rejected.");
  const parsed = chronopostAddressSchema.parse({ ...address, phone: "  +33 (0)6 12 34 56 78  " });
  assert.equal(parsed.phone, "+33 (0)6 12 34 56 78");
});

test("Chronopost SOAP uses documented shippingV7 sequence, configured channel and physical units", () => {
  const { state, shipmentId } = prepared(); const shipment = state.shipments.find(s => s.id === shipmentId)!;
  const xml = buildChronopostSoap(shipment, state.orders.find(o => o.id === shipment.orderId)!, recipient, config, new Date("2026-11-04T10:00:00Z"));
  assert.match(xml, /<chr:shippingV7/); assert.match(xml, /<weight>2.5<\/weight>/); assert.match(xml, /<weightUnit>KGM<\/weightUnit>/);
  assert.match(xml, /<length>30<\/length>/); assert.match(xml, /<subAccount>2<\/subAccount>/); assert.match(xml, /<password>secret&lt;&amp;value<\/password>/);
  assert.match(xml, /<mode>PDF<\/mode>/); assert.match(xml, /<withReservation>0<\/withReservation>/);
});

test("Chronopost parses namespaced response and rejects unsafe XML or non PDF payload", () => {
  assert.equal(parseChronopostResponse(success).trackingNumber, "XY123456789FR");
  assert.throws(() => parseChronopostResponse('<!DOCTYPE a [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + success));
  assert.throws(() => parseChronopostResponse(success.replace(pdf.toString("base64"), Buffer.from("not pdf").toString("base64"))));
});

test("Chronopost persists before sending and reuses successful label without modifying orders or stock", async () => temporary(async root => {
  const { state, shipmentId } = prepared(); const before = JSON.stringify(state); let calls = 0;
  const requestFetch = (async (_url, options) => {
    calls++; assert.equal((await readChronopostLabel(shipmentId, root)).status, "pending");
    assert.equal(options?.method, "POST"); assert.match(String(options?.body), /<chr:shippingV7/);
    return new Response(success, { headers: { "content-type": "text/xml" } });
  }) as typeof fetch;
  const label = await createChronopostLabel({ shipmentId, recipient, confirmed: true }, state, config, { root, requestFetch });
  assert.equal(label.trackingNumber, "XY123456789FR"); assert.equal(label.reused, false);
  assert.deepEqual(await readChronopostPdf(shipmentId, root), pdf);
  assert.equal((await createChronopostLabel({ shipmentId, recipient, confirmed: true }, state, config, { root, requestFetch })).reused, true);
  assert.equal(calls, 1); assert.equal(JSON.stringify(state), before);
}));

test("Chronopost never resends after a network timeout", async () => temporary(async root => {
  const { state, shipmentId } = prepared(); let calls = 0;
  const requestFetch = (async () => { calls++; throw new Error("timeout"); }) as typeof fetch;
  await assert.rejects(createChronopostLabel({ shipmentId, recipient, confirmed: true }, state, config, { root, requestFetch }), /incertaine/);
  assert.equal((await readChronopostLabel(shipmentId, root)).status, "uncertain");
  await assert.rejects(createChronopostLabel({ shipmentId, recipient, confirmed: true }, state, config, { root, requestFetch }), /Chronopost/);
  assert.equal(calls, 1);
}));

test("Chronopost validates credentials, prepared shipment, channel and full address before sending", async () => temporary(async root => {
  const { state, shipmentId } = prepared(); let calls = 0;
  const requestFetch = (async () => { calls++; return new Response(success); }) as typeof fetch;
  await assert.rejects(createChronopostLabel({ shipmentId, recipient, confirmed: true }, state, { ...config, password: "" }, { root, requestFetch }), /Configurez/);
  await assert.rejects(createChronopostLabel({ shipmentId, recipient: { ...recipient, address1: "" }, confirmed: true }, state, config, { root, requestFetch }));
  state.shipments.find(s => s.id === shipmentId)!.status = "cancelled";
  await assert.rejects(createChronopostLabel({ shipmentId, recipient, confirmed: true }, state, config, { root, requestFetch }), /préparé/);
  assert.equal(calls, 0);
}));

test("Chronopost explicit rejection is safe to correct; no carrier internals or secrets are exposed", async () => temporary(async root => {
  const { state, shipmentId } = prepared();
  const requestFetch = (async () => new Response(success.replace("<errorCode>0</errorCode>", "<errorCode>33</errorCode>").replace(/<skybillNumber>.*?<\/skybillNumber>/, "").replace(/<pdfEtiquette>.*?<\/pdfEtiquette>/, ""))) as typeof fetch;
  await assert.rejects(createChronopostLabel({ shipmentId, recipient, confirmed: true }, state, config, { root, requestFetch }), /33/);
  assert.equal((await readChronopostLabel(shipmentId, root)).status, "rejected");
  assert.equal((await createChronopostLabel({ shipmentId, recipient, confirmed: true }, state, config, { root, requestFetch: (async () => new Response(success)) as typeof fetch })).status, "created");
}));

test("Chronopost concurrent creation reaches the carrier once and returns the existing PDF after dispatch", async () => temporary(async root => {
  const { state, shipmentId } = prepared(); let calls = 0; let release!: () => void;
  let entered!: () => void; const started = new Promise<void>(resolve => { entered = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const requestFetch = (async () => { calls++; entered(); await gate; return new Response(success); }) as typeof fetch;
  const first = createChronopostLabel({ shipmentId, recipient, confirmed: true }, state, config, { root, requestFetch });
  await started;
  await assert.rejects(createChronopostLabel({ shipmentId, recipient, confirmed: true }, state, config, { root, requestFetch }), /déjà en cours/);
  release(); await first;
  state.shipments.find(s => s.id === shipmentId)!.status = "dispatched";
  const reused = await createChronopostLabel({ shipmentId, recipient, confirmed: true }, state, config, { root, requestFetch });
  assert.equal(reused.reused, true); assert.equal(calls, 1);
}));

for (const scenario of ["invalid XML", "missing PDF", "HTTP failure", "SOAP fault"]) test(`Chronopost persists uncertain outcome for ${scenario} and blocks regeneration`, async () => temporary(async root => {
  const { state, shipmentId } = prepared(); let calls = 0;
  const response = scenario === "invalid XML" ? new Response("not XML") : scenario === "missing PDF" ? new Response(success.replace(/<pdfEtiquette>.*?<\/pdfEtiquette>/, "")) : scenario === "HTTP failure" ? new Response("unavailable", { status: 500 }) : new Response('<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><soap:Fault><faultstring>secret echo</faultstring></soap:Fault></soap:Body></soap:Envelope>');
  const requestFetch = (async () => { calls++; return response; }) as typeof fetch;
  await assert.rejects(createChronopostLabel({ shipmentId, recipient, confirmed: true }, state, config, { root, requestFetch }), /incertaine/);
  const record = await readChronopostLabel(shipmentId, root);
  assert.equal(record.status, "uncertain"); assert.equal(JSON.stringify(record).includes("secret echo"), false);
  await assert.rejects(createChronopostLabel({ shipmentId, recipient, confirmed: true }, state, config, { root, requestFetch }));
  assert.equal(calls, 1);
}));

test("Chronopost requires explicit confirmation and never sends disabled, incomplete channel or non metropolitan requests", async () => temporary(async root => {
  const { state, shipmentId } = prepared(); let calls = 0;
  const requestFetch = (async () => { calls++; return new Response(success); }) as typeof fetch;
  await assert.rejects(createChronopostLabel({ shipmentId, recipient }, state, config, { root, requestFetch }));
  await assert.rejects(createChronopostLabel({ shipmentId, recipient, confirmed: true }, state, { ...config, enabled: false }, { root, requestFetch }));
  await assert.rejects(createChronopostLabel({ shipmentId, recipient, confirmed: true }, state, { ...config, channels: {} }, { root, requestFetch }));
  await assert.rejects(createChronopostLabel({ shipmentId, recipient: { ...recipient, zipCode: "97100" }, confirmed: true }, state, config, { root, requestFetch }));
  await assert.rejects(createChronopostLabel({ shipmentId, recipient: { ...recipient, country: "BE" }, confirmed: true }, state, config, { root, requestFetch }));
  assert.equal(calls, 0);
}));

test("Chronopost persisted pending marker survives a process interruption and forbids another carrier call", async () => temporary(async root => {
  const { state, shipmentId } = prepared();
  await writeFile(path.join(root, `${shipmentId}.json`), JSON.stringify({ shipmentId, status: "pending", createdAt: new Date().toISOString(), fingerprint: "previous-process" }));
  let calls = 0; const requestFetch = (async () => { calls++; return new Response(success); }) as typeof fetch;
  await assert.rejects(createChronopostLabel({ shipmentId, recipient, confirmed: true }, state, config, { root, requestFetch }), /incertaine/);
  assert.equal(calls, 0);
}));

test("Chronopost PDF route and settings routes reject non local requests and cross origin writes", async () => {
  const settingsRoute = await import("../src/app/api/demo/chronopost/settings/route");
  const pdfRoute = await import("../src/app/api/demo/chronopost/labels/[shipmentId]/pdf/route");
  const foreign = new Request("http://example.com/api/demo/chronopost/settings", { headers: { host: "example.com" } });
  assert.equal((await settingsRoute.GET(foreign)).status, 403);
  const csrf = new Request("http://localhost:3000/api/demo/chronopost/settings", { method: "POST", headers: { host: "localhost:3000", origin: "https://example.com", "content-type": "application/json" }, body: "{}" });
  assert.equal((await settingsRoute.POST(csrf)).status, 403);
  assert.equal((await pdfRoute.GET(foreign, { params: Promise.resolve({ shipmentId: "test" }) })).status, 403);
});

test("Chronopost successful PDF is reusable even if a crash left the old lock file", async () => temporary(async root => {
  const { state, shipmentId } = prepared(); let calls = 0;
  const requestFetch = (async () => { calls++; return new Response(success); }) as typeof fetch;
  await createChronopostLabel({ shipmentId, recipient, confirmed: true }, state, config, { root, requestFetch });
  await writeFile(path.join(root, `${shipmentId}.lock`), "");
  assert.equal((await createChronopostLabel({ shipmentId, recipient, confirmed: true }, state, config, { root, requestFetch })).reused, true);
  assert.equal(calls, 1);
}));

test("Chronopost becomes ready with one configured channel and validates the actual order channel before sending", async () => temporary(async root => {
  const { state, shipmentId } = prepared(); const shipment = state.shipments.find(s => s.id === shipmentId)!;
  const order = state.orders.find(o => o.id === shipment.orderId)!;
  const blank = { accountNumber: "", subAccount: "", productCode: "", service: "" };
  const progressive = { ...config, channels: Object.fromEntries(Object.keys(config.channels).map(key => [key, key === order.channel ? config.channels[key] : blank])) };
  assert.equal(publicChronopostStatus(progressive).ready, true);
  assert.equal(publicChronopostStatus({ ...progressive, password: "" }).ready, false);
  assert.equal(publicChronopostStatus({ ...progressive, shipper: { ...address, address1: "" } }).ready, false);
  let calls = 0;
  const requestFetch = (async () => { calls++; return new Response(success); }) as typeof fetch;
  const wrongChannel = { ...progressive, channels: { ...progressive.channels, [order.channel]: blank } };
  await assert.rejects(createChronopostLabel({ shipmentId, recipient, confirmed: true }, state, wrongChannel, { root, requestFetch }), /canal/);
  assert.equal(calls, 0);
  assert.equal((await createChronopostLabel({ shipmentId, recipient, confirmed: true }, state, progressive, { root, requestFetch })).status, "created");
  assert.equal(calls, 1);
}));

test("Chronopost refuses cached label reuse without its local shipment and order", async () => temporary(async root => {
  const { state, shipmentId } = prepared();
  const requestFetch = (async () => new Response(success)) as typeof fetch;
  await createChronopostLabel({ shipmentId, recipient, confirmed: true }, state, config, { root, requestFetch });
  const shipment = state.shipments.find(s => s.id === shipmentId)!;
  const withoutOrder = { ...state, orders: state.orders.filter(o => o.id !== shipment.orderId) };
  await assert.rejects(createChronopostLabel({ shipmentId, recipient, confirmed: true }, withoutOrder, config, { root, requestFetch }), /introuvable/);
  const withoutShipment = { ...state, shipments: [] };
  await assert.rejects(createChronopostLabel({ shipmentId, recipient, confirmed: true }, withoutShipment, config, { root, requestFetch }), /introuvable/);
}));
