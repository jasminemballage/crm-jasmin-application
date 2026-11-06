import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const first = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
const shipment = { id:'col-test',orderId:'ord-test',status:'prepared',createdAt:'2026-11-06T00:00:00Z',dispatchedAt:null as string | null,weightGrams:100,lengthCm:10,widthCm:10,heightCm:10,allocations:[{lineId:'line-test',packs:1}] };
function state(revision=0) { return { version:1,revision,shipments:[structuredClone(shipment)],orders:[{id:'ord-test',status:'preparing'}],products:[],events:[] }; }
async function claim(attempt=first,revision=0) { return (await db.query<{attempt_id:string;status:string}>('select * from public.crm_claim_chronopost($1,$2,$3,$4)', ['col-test','hash',attempt,revision])).rows[0]; }
async function finish(attempt=first,status='created') { return (await db.query<{value:boolean}>('select public.crm_finish_chronopost($1,$2,$3,$4,$5,$6,$7,$8) as value',['col-test',attempt,status,status==='created'?'XY123456789FR':null,null,null,'chronopost/response.xml',status==='created'?'chronopost/label.pdf':null])).rows[0].value; }
async function commit(payload: unknown, revision=0) { return (await db.query<{value:boolean}>('select public.crm_commit_state($1,$2) as value',[revision,JSON.stringify(payload)])).rows[0].value; }
before(async()=>{
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key);
 create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);`);
 await db.exec(await readFile('supabase/migrations/202611060001_core.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/202611060002_chronopost.sql','utf8'));
});
beforeEach(async()=>{
 await db.exec('reset role; delete from public.crm_chronopost_labels; delete from public.crm_state; delete from public.crm_settings;');
 await db.query('insert into public.crm_state(id,revision,payload) values(1,0,$1)',[JSON.stringify(state())]);
});
after(async()=>{await db.close();});

test('SQL state and settings CAS reject stale revisions without overwriting',async()=>{
 await db.exec('set role service_role');
 assert.equal(await commit(state(1)),true);assert.equal(await commit({...state(1),events:[{id:'stale'}]}),false);
 const update=async(revision:number,payload:string)=>(await db.query<{value:boolean}>('select public.crm_commit_settings($1,$2,$3) as value',['ai',revision,payload])).rows[0].value;
 assert.equal(await update(0,'encrypted-A'),true);assert.equal(await update(0,'encrypted-stale'),false);
 assert.equal(await update(1,'encrypted-B'),true);assert.equal(await update(1,'encrypted-stale'),false);
 assert.equal((await db.query<{payload:string}>('select payload from public.crm_settings')).rows[0].payload,'encrypted-B');
});
test('SQL claim is exclusive and finish is conditional on current attempt',async()=>{
 await db.exec('set role service_role');
 const [a,b]=await Promise.all([claim(),claim(second)]);
 assert.equal(a.attempt_id,first);assert.equal(b.attempt_id,first);
 assert.equal(await finish(second),false);assert.equal(await finish(),true);assert.equal(await finish(first,'uncertain'),false);
 assert.equal((await claim(second)).status,'created');
});
test('SQL pending and uncertain never expire into a new claim; rejected can be corrected',async()=>{
 await claim();await db.exec("update public.crm_chronopost_labels set created_at='2000-01-01'");
 assert.equal((await claim(second)).attempt_id,first);
 assert.equal(await finish(first,'uncertain'),true);assert.equal((await claim(second)).attempt_id,first);
 await db.exec('delete from public.crm_chronopost_labels');await claim();assert.equal(await finish(first,'rejected'),true);
 assert.equal((await claim(second)).attempt_id,second);assert.equal(await finish(first),false);
});
test('SQL claim refuses stale state and unavailable current shipment/order',async()=>{
 await assert.rejects(claim(first,1),/Stale state/);
 const changed=state(1);changed.shipments[0].status='cancelled';assert.equal(await commit(changed),true);
 await assert.rejects(claim(first,1),/Shipment unavailable/);
 await db.query('update public.crm_state set payload=$1,revision=2',[JSON.stringify({...state(2),orders:[{id:'ord-test',status:'cancelled'}]})]);
 await assert.rejects(claim(first,2),/Order unavailable/);
 assert.equal((await db.query('select * from public.crm_chronopost_labels')).rows.length,0);
});
test('SQL trigger protects in-flight shipment and cancellation; created permits dispatch',async()=>{
 await claim();
 const changed=state(1);changed.shipments[0].weightGrams=200;await assert.rejects(commit(changed),/protected/);
 const cancel=state(1);cancel.orders[0].status='cancelled';await assert.rejects(commit(cancel),/protected/);
 const dispatch=state(1);dispatch.shipments[0].status='dispatched';dispatch.shipments[0].dispatchedAt='2026-11-06T00:00:00Z';
 await assert.rejects(commit(dispatch),/unresolved/);
 assert.equal(await finish(),true);assert.equal(await commit(dispatch),true);
});
test('SQL anon and authenticated cannot read private tables or execute mutation functions',async()=>{
 for(const role of ['anon','authenticated']) {
  await db.exec(`set role ${role}`);
  for(const table of ['crm_state','crm_settings','crm_members','crm_chronopost_labels']) await assert.rejects(db.query(`select * from public.${table}`),/permission denied/);
  await assert.rejects(claim(),/permission denied/);await assert.rejects(finish(),/permission denied/);await assert.rejects(commit(state(1)),/permission denied/);
  await assert.rejects(db.query("select public.crm_commit_settings('ai',0,'secret')"),/permission denied/);
  await db.exec('reset role');
 }
 const rows=(await db.query<{relname:string;relrowsecurity:boolean}>("select relname,relrowsecurity from pg_catalog.pg_class where relname in ('crm_state','crm_settings','crm_members','crm_chronopost_labels')")).rows;
 assert.equal(rows.length,4);assert.equal(rows.every(r=>r.relrowsecurity),true);
});
