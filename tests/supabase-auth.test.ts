import test from "node:test";
import assert from "node:assert/strict";
import { safeReturnPath, verifyCrmMember } from "../src/lib/supabase/auth";
import { assertRequestOrigin, assertLocalRequest } from "../src/lib/guard";

const user = { id: "member-1", email: "member@example.test" };
const client = (value: typeof user | null, error: unknown = null) => ({ auth: { getUser: async () => ({ data: { user: value }, error }) } });
const lookup = (enabled: boolean) => async () => ({ data: { enabled }, error: null });
test("session absente, invalide et anonyme : aucune donnée membre consultée", async () => {
  let calls = 0;
  const member = async () => { calls++; return { data: { enabled: true }, error: null }; };
  await assert.rejects(() => verifyCrmMember(client(null), member), { status: 401 });
  await assert.rejects(() => verifyCrmMember(client(user, new Error("invalid")), member), { status: 401 });
  await assert.rejects(() => verifyCrmMember(client({ ...user, is_anonymous: true } as typeof user), member), { status: 401 });
  assert.equal(calls, 0);
});
test("membre absent/désactivé refusé, panne fermée, membre actif accepté", async () => {
  await assert.rejects(() => verifyCrmMember(client(user), async () => ({ data: null, error: null })), { status: 403 });
  await assert.rejects(() => verifyCrmMember(client(user), lookup(false)), { status: 403 });
  await assert.rejects(() => verifyCrmMember(client(user), async () => ({ data: null, error: { message: "db secret" } })), error => (error as Error).message.includes("indisponible") && !(error as Error).message.includes("secret"));
  assert.deepEqual(await verifyCrmMember(client(user), lookup(true)), user);
});
test("redirection limitée aux chemins CRM relatifs autorisés", () => {
  for (const path of ["https://evil.test", "//evil.test", "/\\evil.test", "/connexion", "/api/demo/state", "/catalogue?next=evil", "/preparation/../api"]) assert.equal(safeReturnPath(path), "/");
  assert.equal(safeReturnPath("/catalogue"), "/catalogue");
  assert.equal(safeReturnPath("/preparation/shipment-123"), "/preparation/shipment-123");
});
test("mutations : origine stricte et type de contenu exact", () => {
  const request = (origin: string, type = "application/json") => new Request("https://crm.example.test/api/demo/actions", { headers: { host: "crm.example.test", origin, "content-type": type } });
  assert.doesNotThrow(() => assertRequestOrigin(request("https://crm.example.test", "application/json; charset=utf-8")));
  for (const origin of ["http://crm.example.test", "https://crm.example.test:123", "https://evil.test", "null", ""]) assert.throws(() => assertRequestOrigin(request(origin)), { status: 403 });
  for (const type of ["application/jsonp", "text/plain", "application/x-www-form-urlencoded"]) assert.throws(() => assertRequestOrigin(request("https://crm.example.test", type)), { status: 415 });
  assert.throws(() => assertRequestOrigin(request("https://crm.example.test", "image/svg+xml"), "image"), { status: 415 });
});
test("mode partagé incomplet ne retombe jamais sur la démonstration locale", async () => {
  const previous = process.env.CRM_STORAGE_BACKEND;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.CRM_STORAGE_BACKEND = "supabase";
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  try {
    await assert.rejects(() => assertLocalRequest(new Request("https://crm.example.test/api/demo/state")), { status: 503 });
  } finally {
    if (previous === undefined) delete process.env.CRM_STORAGE_BACKEND; else process.env.CRM_STORAGE_BACKEND = previous;
    if (url !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    if (key !== undefined) process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = key;
  }
});

test("Next proxy loopback normalization keeps the browser Host and rejects hostile authority", () => {
  const request = (host: string, origin: string, url = "http://localhost:3102/api/demo/actions") => new Request(url, { headers: { host, origin, "content-type": "application/json" } });
  assert.doesNotThrow(() => assertRequestOrigin(request("127.0.0.1:3102", "http://127.0.0.1:3102")));
  assert.doesNotThrow(() => assertRequestOrigin(request("[::1]:3102", "http://[::1]:3102")));
  for (const host of ["evil.test:3102", "localhost:9999", "trusted.test@evil.test", "evil.test/path", "evil.test,localhost:3102", "localhost:99999"]) assert.throws(() => assertRequestOrigin(request(host, "http://127.0.0.1:3102")), { status: 403 });
  assert.throws(() => assertRequestOrigin(request("127.0.0.1:3102", "https://127.0.0.1:3102")), { status: 403 });
  assert.throws(() => assertRequestOrigin(request("evil.test", "https://evil.test", "https://crm.example.test/api/actions")), { status: 403 });
  assert.throws(() => assertRequestOrigin(request("crm.example.test", "http://crm.example.test", "http://crm.example.test/api/actions")), { status: 403 });
  assert.doesNotThrow(() => assertRequestOrigin(request("crm.example.test", "https://crm.example.test", "https://localhost:3000/api/actions")));
});
