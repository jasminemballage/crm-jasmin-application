import test from "node:test";
import assert from "node:assert/strict";
import dns from "node:dns/promises";
import https from "node:https";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { inspectProductSource } from "../src/lib/product-source";

test("un domaine public résolu vers une adresse privée, même mélangée à une IP publique, ne reçoit aucune requête", async t => {
  let requests = 0;
  t.mock.method(https, "request", () => { requests++; throw Error("Connexion interdite"); });
  for (const addresses of [[{ address: "127.0.0.1", family: 4 }], [{ address: "8.8.8.8", family: 4 }, { address: "10.0.0.1", family: 4 }]]) {
    const mocked = t.mock.method(dns, "lookup", async () => addresses);
    await assert.rejects(inspectProductSource("https://shop.example.com/product"), /Destination non publique/);
    mocked.mock.restore();
  }
  assert.equal(requests, 0);
});

test("chaque redirection repasse par le contrôle DNS et la connexion utilise uniquement l’IP validée", async t => {
  t.mock.method(dns, "lookup", async (hostname: string) => [{ address: hostname === "shop.example.com" ? "8.8.8.8" : "169.254.169.254", family: 4 }]);
  let requests = 0;
  t.mock.method(https, "request", (_url: URL, options: any, callback: (response: any) => void) => {
    requests++;
    options.lookup("shop.example.com", {}, (error: unknown, address: string) => { assert.equal(error, null); assert.equal(address, "8.8.8.8"); });
    assert.equal(options.agent, false);
    assert.equal(options.headers.Authorization, undefined);
    const req = Object.assign(new EventEmitter(), { end() {
      const res = Object.assign(new PassThrough(), { statusCode: 302, headers: { location: "https://redirect.example.com/product" } });
      callback(res);
    } });
    return req;
  });
  await assert.rejects(inspectProductSource("https://shop.example.com/product"), /Destination non publique/);
  assert.equal(requests, 1);
});

test("la lecture d’une fiche trop volumineuse s’arrête avant son analyse", async t => {
  t.mock.method(dns, "lookup", async () => [{ address: "8.8.8.8", family: 4 }]);
  t.mock.method(https, "request", (_url: URL, _options: unknown, callback: (response: any) => void) => Object.assign(new EventEmitter(), { end() {
    const res = Object.assign(new PassThrough(), { statusCode: 200, headers: { "content-type": "text/html" } });
    callback(res);
    res.end(Buffer.alloc(2 * 1024 * 1024 + 1));
  } }));
  await assert.rejects(inspectProductSource("https://shop.example.com/product"), /Fiche trop volumineuse/);
});

test("une annulation avant la consultation ne déclenche aucune résolution ni requête", async t => {
  let resolutions = 0;
  t.mock.method(dns, "lookup", () => { resolutions++; throw Error("DNS interdit"); });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(inspectProductSource("https://shop.example.com/product", controller.signal), { name: "AbortError" });
  assert.equal(resolutions, 0);
});
