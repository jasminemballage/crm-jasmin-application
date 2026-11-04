import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

test("settings writes stay serialized across separate module instances", async () => {
  const requireModule = createRequire(path.join(process.cwd(), "package.json"));
  const modulePath = requireModule.resolve("./src/lib/settings-file-lock.ts");
  const first = requireModule(modulePath) as typeof import("../src/lib/settings-file-lock");
  delete requireModule.cache[modulePath];
  const second = requireModule(modulePath) as typeof import("../src/lib/settings-file-lock");
  assert.notEqual(first.withSettingsFileLock, second.withSettingsFileLock);
  const file = path.join(process.cwd(), ".local", "mutex-test-never-written.env");
  const events: string[] = [];
  let release!: () => void;
  let enter!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const entered = new Promise<void>(resolve => { enter = resolve; });
  const writeFirst = first.withSettingsFileLock(file, async () => {
    events.push("first-start"); enter(); await gate; events.push("first-end");
  });
  await entered;
  const writeSecond = second.withSettingsFileLock(file, async () => { events.push("second"); });
  try {
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.deepEqual(events, ["first-start"]);
  } finally { release(); await Promise.all([writeFirst, writeSecond]); }
  assert.deepEqual(events, ["first-start", "first-end", "second"]);
});
