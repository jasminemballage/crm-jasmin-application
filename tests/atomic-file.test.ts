import test from "node:test";
import assert from "node:assert/strict";
import { renameWithRetry } from "../src/lib/atomic-file";
test("un verrou Windows temporaire est réessayé sans supprimer la destination", async () => {
  let calls = 0;
  await renameWithRetry("source.tmp", "destination.json", async (source, destination) => {
    assert.equal(source, "source.tmp"); assert.equal(destination, "destination.json"); calls++;
    if (calls < 3) throw Object.assign(new Error("verrou de test"), { code: "EPERM" });
  });
  assert.equal(calls, 3);
});
test("un verrou permanent reste une erreur après un nombre borné de tentatives", async () => {
  let calls = 0;
  await assert.rejects(() => renameWithRetry("source.tmp", "destination.json", async () => { calls++; throw Object.assign(new Error("verrou de test"), { code: "EBUSY" }); }), /verrou de test/);
  assert.equal(calls, 4);
});
test("une autre erreur disque est renvoyée immédiatement", async () => {
  let calls = 0;
  await assert.rejects(() => renameWithRetry("source.tmp", "destination.json", async () => { calls++; throw Object.assign(new Error("disque de test"), { code: "EIO" }); }), /disque de test/);
  assert.equal(calls, 1);
});
