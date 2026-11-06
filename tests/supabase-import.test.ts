import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {emptyProductInfo} from '../src/lib/product-info';
import {seedState} from '../src/lib/seed';
import {buildImportPlan} from '../src/lib/supabase/import-plan';
async function fixture(run:(root:string)=>Promise<void>) {
 const root=await mkdtemp(path.join(tmpdir(),'crm-import-'));
 try {await mkdir(path.join(root,'.local/chronopost/audit'),{recursive:true});await mkdir(path.join(root,'.local/media'));await writeFile(path.join(root,'.local/demo-state.json'),JSON.stringify(seedState()));await run(root);} finally {await rm(root,{recursive:true,force:true});}
}
test('preserves revision/IDs, archives audits, keeps orphan uncertain and missing PDF created',()=>fixture(async root=>{
 const state=seedState(); await writeFile(path.join(root,'.local/demo-state.json'),JSON.stringify({...state,revision:17}));
 await writeFile(path.join(root,'.local/chronopost/orphan.lock'),'locked');
 await writeFile(path.join(root,'.local/chronopost/audit/history.json'),'sensitive historical payload');
 await writeFile(path.join(root,'.local/chronopost/created.json'),JSON.stringify({shipmentId:'created',status:'created',trackingNumber:'private',createdAt:'2026-11-06T00:00:00.000Z',fingerprint:'abc'}));
 const plan=await buildImportPlan(root);
 assert.equal(plan.state.revision,17);assert.deepEqual(plan.state.orders,state.orders);
 assert.equal(plan.labels.find(l=>l.shipment_id==='orphan')?.status,'uncertain');
 assert.equal(plan.labels.find(l=>l.shipment_id==='created')?.status,'created');assert.equal(plan.missingPdfs,1);
 assert.equal(plan.objects.length,3);assert.ok(plan.objects.every(o=>!o.path.includes('history')));
 assert.equal((await buildImportPlan(root)).snapshot,plan.snapshot);
 await writeFile(path.join(root,'.env.local'),'OPENROUTER_API_KEY=changed');assert.notEqual((await buildImportPlan(root)).snapshot,plan.snapshot);
}));
test('refuses malformed carrier record without discarding it',()=>fixture(async root=>{
 await writeFile(path.join(root,'.local/chronopost/bad.json'),'{}');await assert.rejects(buildImportPlan(root));
}));
test('refuses source symlinks',()=>fixture(async root=>{
 await symlink(path.join(root,'.local/demo-state.json'),path.join(root,'.local/media/link'));await assert.rejects(buildImportPlan(root));
}));

test('rejected plus lock remains uncertain; created plus lock stays created',()=>fixture(async root=>{
 for(const status of ['rejected','created']) {
 await writeFile(path.join(root,`.local/chronopost/${status}.json`),JSON.stringify({shipmentId:status,status,trackingNumber:'x',createdAt:'2026-11-06T00:00:00.000Z',fingerprint:'f'}));
 await writeFile(path.join(root,`.local/chronopost/${status}.lock`),'');
 }
 const p=await buildImportPlan(root);assert.equal(p.labels.find(l=>l.shipment_id==='rejected')?.status,'uncertain');assert.equal(p.labels.find(l=>l.shipment_id==='created')?.status,'created');
}));
test('rejects invalid media names, formats and missing references',()=>fixture(async root=>{
 const name='00000000-0000-4000-8000-000000000000.png';
 await writeFile(path.join(root,'.local/media',name),'invalid');await assert.rejects(buildImportPlan(root));
 await rm(path.join(root,'.local/media',name));
 const state=seedState();state.products[0].info={...emptyProductInfo(),images:[{id:'image',url:'/api/demo/media/'+name,alt:'',kind:'uploaded',reviewed:true,sourceUrl:'',prompt:''}]};
 await writeFile(path.join(root,'.local/demo-state.json'),JSON.stringify(state));await assert.rejects(buildImportPlan(root));
}));

import {applyImportPlan} from '../src/lib/supabase/import-plan';
import type {SupabaseClient} from '@supabase/supabase-js';
function fakeClient() {
 const tables=new Map<string,Map<string,Record<string,unknown>>>();
 const objects=new Map<string,Buffer>();const events:string[]=[];
 const client={from(table:string) {
  const rows=tables.get(table)??new Map();tables.set(table,rows);
  return {select() {return {eq(_key:string,id:string|number) {const read=async()=>({data:rows.get(String(id))??null,error:null});return {maybeSingle:read,single:read};}};},
   async insert(row:Record<string,unknown>) {events.push(table);const id=String(row.id??row.shipment_id);if(rows.has(id))return {error:new Error('duplicate')};rows.set(id,structuredClone(row));return {error:null};}};
 },storage:{from(){return {async download(key:string){const b=objects.get(key);return b?{data:new Blob([new Uint8Array(b)]),error:null}:{data:null,error:{statusCode:'404',message:'Object not found'}};},async upload(key:string,bytes:Buffer){if(objects.has(key))return {error:new Error('duplicate')};objects.set(key,bytes);return {error:null};}};}}};
 return {client:client as unknown as SupabaseClient,tables,objects,events};
}
test('resume identical artifacts/settings; state last, refuse initialized destination',()=>fixture(async root=>{
 process.env.CRM_SETTINGS_ENCRYPTION_KEY=Buffer.alloc(32,9).toString('base64');
 await writeFile(path.join(root,'.local/chronopost/audit/old.json'),'{}');
 const plan=await buildImportPlan(root);const fake=fakeClient();
 // Interrupt immediately before publication through source drift; resumable private artifacts remain.
 await writeFile(path.join(root,'.env.local'),'CHANGED=1');
 await assert.rejects(applyImportPlan(root,plan,fake.client,{ai:{apiKey:'secret'}}));
 assert.equal(fake.tables.get('crm_state')?.size,0);assert.equal(fake.objects.size,1);
 await rm(path.join(root,'.env.local'));
 await applyImportPlan(root,plan,fake.client,{ai:{apiKey:'secret'}});
 assert.equal(fake.events.at(-1),'crm_state');assert.deepEqual(fake.tables.get('crm_state')?.get('1')?.payload,plan.state);
 await assert.rejects(applyImportPlan(root,plan,fake.client,{ai:{apiKey:'secret'}}));
}));
test('remote settings or object conflict abort before publishing state',()=>fixture(async root=>{
 process.env.CRM_SETTINGS_ENCRYPTION_KEY=Buffer.alloc(32,9).toString('base64');
 await writeFile(path.join(root,'.local/chronopost/audit/old.json'),'{}');
 const plan=await buildImportPlan(root);const fake=fakeClient();fake.objects.set(plan.objects[0].path,Buffer.from('different'));
 await assert.rejects(applyImportPlan(root,plan,fake.client,{ai:{apiKey:'a'}}));assert.equal(fake.tables.get('crm_state')?.size,0);
 await assert.rejects(applyImportPlan(root,plan,fake.client,{ai:{apiKey:'b'}}));assert.equal(fake.tables.get('crm_state')?.size,0);
}));
test('image name and extension must match supported bytes; valid PNG keeps MIME',()=>fixture(async root=>{
 const bytes=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);
 const dir=path.join(root,'.local/media');
 await writeFile(path.join(dir,'private-name.png'),bytes);await assert.rejects(buildImportPlan(root));await rm(path.join(dir,'private-name.png'));
 const base='00000000-0000-4000-8000-000000000000';
 await writeFile(path.join(dir,base+'.jpg'),bytes);await assert.rejects(buildImportPlan(root));await rm(path.join(dir,base+'.jpg'));
 await writeFile(path.join(dir,base+'.png'),bytes);assert.equal((await buildImportPlan(root)).objects[0].contentType,'image/png');
}));
