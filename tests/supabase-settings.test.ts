import test from 'node:test';
import assert from 'node:assert/strict';
import { decryptSettings } from '../src/lib/supabase/secrets';
import { randomBytes } from 'node:crypto';
import { getAiSettings, saveAiSettings } from '../src/lib/ai-settings';
import { getChronopostSettings, saveChronopostSettings } from '../src/lib/chronopost-settings';
import { emptyChronopostAddress, emptyChronopostChannels } from '../src/lib/chronopost-contract';

test('shared settings keep omitted secrets, clear explicitly, fail closed and detect concurrent writes', async () => {
  const env = { CRM_STORAGE_BACKEND: 'supabase', NEXT_PUBLIC_SUPABASE_URL: 'https://fictional.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'fictional-public', SUPABASE_SECRET_KEY: 'fictional-server', CRM_SETTINGS_ENCRYPTION_KEY: randomBytes(32).toString('base64') };
  const previous = Object.fromEntries(Object.keys(env).map(k => [k, process.env[k]])); Object.assign(process.env, env);
  const originalFetch = globalThis.fetch;
  const rows = new Map<string, { revision: number; payload: string }>();
  let conflict = false, failure = false;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url);
    assert.equal(url.hostname, 'fictional.supabase.co');
    assert.equal(new Headers(init?.headers).get('apikey'), env.SUPABASE_SECRET_KEY);
    if (failure) return Response.json({ message: 'fixture unavailable' }, { status: 503 });
    if (url.pathname.endsWith('/crm_settings')) {
      const id = url.searchParams.get('id')!.replace('eq.', '');
      return Response.json(rows.has(id) ? [rows.get(id)] : []);
    }
    assert.equal(url.pathname, '/rest/v1/rpc/crm_commit_settings');
    const body = JSON.parse(init!.body as string);
    if (conflict || (rows.get(body.p_id)?.revision ?? 0) !== body.p_revision) return Response.json(false);
    assert.ok(!body.p_payload.includes('fictional-sensitive-secret'));
    assert.equal('revision' in (decryptSettings(body.p_id, body.p_payload) as object), false);
    rows.set(body.p_id, { revision: body.p_revision + 1, payload: body.p_payload });
    return Response.json(true);
  };
  try {
    const ai = { revision: 0, enabled: true, apiKey: 'fictional-sensitive-secret', clearKey: false, textModel: 'openai/gpt-4o-mini', imageModel: 'google/gemini-2.5-flash-image', imageRules: 'Fixture' };
    const result = await saveAiSettings(ai);
    assert.equal(result.revision, 1); assert.equal(result.keyPresent, true); assert.equal('apiKey' in result, false);
    const { apiKey: omitted, ...edited } = ai; void omitted;
    await saveAiSettings({ ...edited, revision: 1, imageRules: 'Updated rules' });
    assert.equal((await getAiSettings()).apiKey, ai.apiKey);
    await saveAiSettings({ ...edited, revision: 2, clearKey: true });
    assert.equal((await getAiSettings()).apiKey, '');
    const chrono = { revision: 0, enabled: false, password: 'fictional-sensitive-secret', clearPassword: false, shipper: emptyChronopostAddress(), channels: emptyChronopostChannels() };
    const chronoStatus = await saveChronopostSettings(chrono);
    assert.equal(chronoStatus.passwordPresent, true); assert.equal('password' in chronoStatus, false);
    const { password: ignored, ...change } = chrono; void ignored;
    await saveChronopostSettings({ ...change, revision: 1 });
    assert.equal((await getChronopostSettings()).password, chrono.password);
    await saveChronopostSettings({ ...change, revision: 2, clearPassword: true });
    assert.equal((await getChronopostSettings()).password, '');
    // Two clients loaded the same revision. A commits, B's later POST must
    // conflict even though its server read sees the newer row.
    const a = await getAiSettings(), b = await getAiSettings();
    const aInput = { ...edited, revision: a.revision, imageRules: "Tab A rules" };
    await saveAiSettings(aInput);
    await assert.rejects(saveAiSettings({ ...edited, revision: b.revision, imageRules: "Stale tab B" }), { status: 409 });
    assert.equal((await getAiSettings()).imageRules, "Tab A rules");
    await assert.rejects(saveAiSettings({ ...edited, revision: undefined }), { status: 409 });
    const c = await getChronopostSettings(), d = await getChronopostSettings();
    await saveChronopostSettings({ ...change, revision: c.revision, shipper: { ...c.shipper, name: "Tab A shipper" } });
    await assert.rejects(saveChronopostSettings({ ...change, revision: d.revision }), { status: 409 });
    assert.equal((await getChronopostSettings()).shipper.name, "Tab A shipper");
    await assert.rejects(saveChronopostSettings({ ...change, revision: undefined }), { status: 409 });
    conflict = true;
    await assert.rejects(saveAiSettings({ ...edited, revision: (await getAiSettings()).revision }), /autre session/i);
    conflict = false; failure = true;
    await assert.rejects(getAiSettings(), /indisponible/i);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key,value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
