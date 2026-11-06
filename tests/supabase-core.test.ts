import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import { isSupabaseMode, supabaseConfig } from '../src/lib/supabase/config';
import { encryptSettings, decryptSettings } from '../src/lib/supabase/secrets';
import { SharedRepository } from '../src/lib/shared-repository';
import { seedState } from '../src/lib/seed';
import type { Action } from '../src/lib/model';

test('cloud configuration fails closed and never silently chooses local storage', () => {
  assert.equal(isSupabaseMode({ CRM_STORAGE_BACKEND: 'supabase' }), true);
  assert.throws(() => supabaseConfig({ CRM_STORAGE_BACKEND: 'supabase' }), /configuration/i);
  assert.throws(() => isSupabaseMode({ CRM_STORAGE_BACKEND: 'typo' }), /stockage/i);
  assert.equal(isSupabaseMode({}), false);
});
test('settings encrypted with fresh nonces, authenticated provider and tamper detection', () => {
  const key = randomBytes(32).toString('base64');
  const input = { apiKey: 'fictional-sensitive-key', enabled: true };
  const a = encryptSettings('ai', input, key), b = encryptSettings('ai', input, key);
  assert.notEqual(a, b); assert.equal(a.includes(input.apiKey), false);
  assert.deepEqual(decryptSettings('ai', a, key), input);
  assert.throws(() => decryptSettings('chronopost', a, key));
  assert.throws(() => decryptSettings('ai', a, randomBytes(32).toString('base64')));
  assert.throws(() => encryptSettings('ai', input, 'short'));
});
test('two independent repositories cannot overwrite a concurrent edit; reset forbidden', async () => {
  let current = seedState();
  const port = {
    read: async () => structuredClone(current),
    commit: async (revision: number, state: typeof current) => {
      if (revision !== current.revision) return false;
      current = structuredClone(state); return true;
    }
  };
  const first = new SharedRepository(port), second = new SharedRepository(port);
  const state = await first.read();
  const action: Action = { type: 'adjustStock', productId: state.products[0].id, direction: 'in', quantity: 1, unit: 'pack', reason: 'Test concurrence' };
  const result = await Promise.allSettled([first.mutate(action, state.revision), second.mutate(action, state.revision)]);
  assert.equal(result.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(result.filter(r => r.status === 'rejected').length, 1);
  assert.equal(current.revision, state.revision + 1);
  assert.equal(current.products[0].physicalPacks, state.products[0].physicalPacks + 1);
  await assert.rejects(first.mutate({ type: 'reset' }, current.revision), /réinitialisation/i);
});
