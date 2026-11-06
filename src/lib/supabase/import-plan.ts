import { createHash } from 'node:crypto';
import { readdir, readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { validateState } from '../domain';
import { chronopostRecordSchema } from '../chronopost';
import { imageFormat } from '../media';
import { chronopostObjectPaths } from '../chronopost-store';
export const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
async function scan(root: string, prefix = ''): Promise<Map<string, Buffer>> {
  const result = new Map<string, Buffer>();
  let entries; try { if ((await lstat(root)).isSymbolicLink()) throw new Error('Source contains symbolic link'); entries = await readdir(root, { withFileTypes: true }); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return result; throw e; }
  for (const entry of entries.sort((a,b) => a.name.localeCompare(b.name))) {
    if (entry.isSymbolicLink()) throw new Error('Source contains symbolic link');
    const name = prefix + entry.name;
    if (entry.isDirectory()) for (const [k,v] of await scan(path.join(root, entry.name), name + '/')) result.set(k,v);
    else if (entry.isFile()) result.set(name, await readFile(path.join(root, entry.name)));
    else throw new Error('Unsupported source file');
  }
  return result;
}
export async function buildImportPlan(root: string) {
  if ((await lstat(path.join(root, '.local/demo-state.json'))).isSymbolicLink()) throw new Error('Source contains symbolic link');
  const stateBytes = await readFile(path.join(root, '.local/demo-state.json'));
  const state = validateState(JSON.parse(stateBytes.toString()));
  const media = await scan(path.join(root, '.local/media'));
  const carrier = await scan(path.join(root, '.local/chronopost'));
  const objects: { path: string; bytes: Buffer; contentType: string }[] = [];
  for (const [name,bytes] of media) {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(png|jpg|webp)$/.test(name)) throw new Error('Invalid media path');
    const format = imageFormat(bytes);
    if (!name.endsWith('.' + format.ext)) throw new Error('Image extension mismatch');
    objects.push({ path: `media/${name}`, bytes, contentType: format.mime });
  }
  const checkReferences = (value: unknown): void => {
    if (typeof value === 'string' && value.startsWith('/api/demo/media/')) {
      if (!media.has(value.slice('/api/demo/media/'.length))) throw new Error('Missing referenced media');
    } else if (Array.isArray(value)) value.forEach(checkReferences);
    else if (value && typeof value === 'object') Object.values(value).forEach(checkReferences);
  };
  checkReferences(state);
  // Every carrier artifact, including audit history and locks, is retained privately.
  for (const [name,bytes] of carrier) objects.push({ path: `chronopost/import-archive/${hash(name)}/${hash(bytes)}`, bytes, contentType: name.endsWith('.pdf') ? 'application/pdf' : name.endsWith('.xml') ? 'application/xml' : name.endsWith('.json') ? 'application/json' : 'application/octet-stream' });
  const ids = new Set([...carrier.keys()].filter(n => !n.includes('/') && /\.(json|lock|pdf|response\.xml)$/.test(n)).map(n => n.replace(/\.(response\.xml|json|lock|pdf)$/, '')));
  let missingPdfs = 0;
  const labels = [];
  for (const id of [...ids].sort()) {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new Error('Invalid carrier identifier');
    const raw = carrier.get(`${id}.json`);
    const record = raw ? chronopostRecordSchema.parse(JSON.parse(raw.toString())) : null;
    if (record && (record.shipmentId !== id || record.status === 'created' && !record.trackingNumber)) throw new Error('Invalid carrier record');
    // A lock/artifact without a valid terminal record remains blocked durably.
    const seed = hash(id); const attempt = `${seed.slice(0,8)}-${seed.slice(8,12)}-4${seed.slice(13,16)}-8${seed.slice(17,20)}-${seed.slice(20,32)}`;
    const paths = chronopostObjectPaths(id, attempt);
    const pdf = carrier.get(`${id}.pdf`), response = carrier.get(`${id}.response.xml`);
    if (pdf) objects.push({path: paths.pdf, bytes: pdf, contentType: 'application/pdf'});
    if (response) objects.push({path: paths.response, bytes: response, contentType: 'application/xml'});
    if (record?.status === 'created' && !pdf) missingPdfs++;
    labels.push({shipment_id: id, attempt_id: attempt, status: record?.status === 'rejected' && carrier.has(`${id}.lock`) ? 'uncertain' : record?.status ?? 'uncertain',
      created_at: record?.createdAt ?? new Date((await lstat(path.join(root, '.local/chronopost', [...carrier.keys()].find(n => n.startsWith(id + '.'))!))).mtimeMs).toISOString(),
      fingerprint: record?.fingerprint ?? hash('orphan:' + id), tracking_number: record?.trackingNumber ?? null,
      message: record?.message ?? (record ? null : 'Historique local incomplet : vérifier avant toute création.'), diagnostic: record?.diagnostic ?? null,
      response_path: response ? paths.response : null, pdf_path: pdf ? paths.pdf : null });
  }
  let envBytes: Buffer; try { envBytes = await readFile(path.join(root, '.env.local')); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; envBytes = Buffer.alloc(0); }
  const snapshot = hash(stable({state:hash(stateBytes),env:hash(envBytes),media:[...media].map(([n,b])=>[n,hash(b)]),carrier:[...carrier].map(([n,b])=>[n,hash(b)])}));
  return {state, objects, labels, missingPdfs, snapshot};
}

import { isDeepStrictEqual } from 'node:util';
import type { SupabaseClient } from '@supabase/supabase-js';
import { encryptSettings, decryptSettings } from './secrets';
import { PRIVATE_BUCKET } from './storage';
export async function applyImportPlan(root: string, plan: Awaited<ReturnType<typeof buildImportPlan>>, client: SupabaseClient, settings: Record<string, unknown>) {
    const checkState = async () => { const {data,error}=await client.from('crm_state').select('id').eq('id',1).maybeSingle(); if(error || data) throw new Error('Destination déjà initialisée ou inaccessible'); };
    await checkState();
    // Validate encryption key before any remote mutation.
    for (const [id,value] of Object.entries(settings)) encryptSettings(id,value);
    for (const [id,value] of Object.entries(settings)) {
      const before = await client.from('crm_settings').select('payload').eq('id',id).maybeSingle();
      if (before.error) throw new Error('Lecture réglages impossible');
      if (before.data) { if (!isDeepStrictEqual(decryptSettings(id,before.data.payload),value)) throw new Error('Conflit réglages'); }
      else { const {error}=await client.from('crm_settings').insert({id,revision:1,payload:encryptSettings(id,value)}); if(error) throw new Error('Insertion réglages impossible'); }
      const after=await client.from('crm_settings').select('payload').eq('id',id).single();
      if(after.error || !isDeepStrictEqual(decryptSettings(id,after.data.payload),value)) throw new Error('Vérification réglages impossible');
    }
    const bucket=client.storage.from(PRIVATE_BUCKET);
    for (const object of plan.objects) {
      let existing=await bucket.download(object.path);
      if(existing.error) {
        // Only a confirmed absence allows insertion; permission/network errors abort.
        if(!['404','400'].includes(String((existing.error as {statusCode?:string}).statusCode)) || !/not found/i.test(existing.error.message)) throw new Error('Lecture objet impossible');
        const {error}=await bucket.upload(object.path,object.bytes,{upsert:false,contentType:object.contentType});
        if(error) throw new Error('Insertion objet impossible');
        existing=await bucket.download(object.path);
      }
      if(existing.error || !existing.data || hash(Buffer.from(await existing.data.arrayBuffer()))!==hash(object.bytes)) throw new Error('Conflit ou vérification objet impossible');
    }
    for(const label of plan.labels) {
      const before=await client.from('crm_chronopost_labels').select('*').eq('shipment_id',label.shipment_id).maybeSingle();
      if(before.error) throw new Error('Lecture historique impossible');
      const matches=(data: Record<string,unknown>) => Object.entries(label).every(([k,v])=> k==='created_at' ? new Date(String(data[k])).getTime()===new Date(String(v)).getTime() : isDeepStrictEqual(data[k],v));
      if(before.data) {if(!matches(before.data)) throw new Error('Conflit historique');}
      else {const {error}=await client.from('crm_chronopost_labels').insert(label);if(error) throw new Error('Insertion historique impossible');}
      const after=await client.from('crm_chronopost_labels').select('*').eq('shipment_id',label.shipment_id).single();
      if(after.error || !matches(after.data)) throw new Error('Vérification historique impossible');
    }
    if((await buildImportPlan(root)).snapshot!==plan.snapshot) throw new Error('Source modifiée pendant import');
    await checkState();
    const {error}=await client.from('crm_state').insert({id:1,revision:plan.state.revision,payload:plan.state});
    if(error) throw new Error('Publication état impossible');
    const final=await client.from('crm_state').select('revision,payload').eq('id',1).single();
    if(final.error || final.data.revision!==plan.state.revision || !isDeepStrictEqual(final.data.payload,plan.state)) throw new Error('Vérification état publié impossible');
}
