import test from 'node:test';
import assert from 'node:assert/strict';
import { createChronopostLabel, type ChronopostRecord } from '../src/lib/chronopost';
import type { ChronopostStore } from '../src/lib/chronopost-store';
import { seedState } from '../src/lib/seed';
import { applyAction } from '../src/lib/domain';
const address = { name:'Test',address1:'1 rue Test',address2:'',zipCode:'75001',city:'Paris',country:'FR' as const,contactName:'Test',email:'test@example.com',phone:'0612345678' };
const config = { enabled:true,password:'test',shipper:address,channels:Object.fromEntries(['Amazon','Cdiscount','RETIF','METRO','Site Jasmin'].map(c=>[c,{accountNumber:'123',subAccount:'0',productCode:'01',service:'0'}])) };
const pdf = Buffer.from('%PDF-1.4\nexample\n%%EOF');
const xml = `<Envelope><Body><shippingV7Response><return><errorCode>0</errorCode><skybillNumber>XY123456789FR</skybillNumber><pdfEtiquette>${pdf.toString('base64')}</pdfEtiquette></return></shippingV7Response></Body></Envelope>`;
function fixture() {
 const state=seedState(); const order=state.orders.find(o=>!['cancelled','shipped'].includes(o.status))!;
 const shipmentId=applyAction(state,{type:'prepareShipment',orderId:order.id,weightGrams:100,lengthCm:10,widthCm:10,heightCm:10,allocations:[{lineId:order.lines[0].id,packs:1}]}) as string;
 let record: ChronopostRecord|null=null; let savedPdf: Buffer|undefined; let finishes=0;
 const store:ChronopostStore={
  read:async()=>record,
  claim:async(next)=>{if(record && record.status!=='rejected')return false; record=next; return true;},
  saveResponse:async()=>{}, savePdf:async(_id,_attempt,bytes)=>{savedPdf=bytes;},
  finish:async(next)=>{finishes++;record=next;},
  readPdf:async()=>{if(!savedPdf)throw Error('missing');return savedPdf;}
 };
 return {state,shipmentId,store,record:()=>record,finishes:()=>finishes};
}
test('shared claim permits one transport call across independent requests',async()=>{
 const f=fixture();let calls=0;let release!:()=>void;let entered!:()=>void;
 const gate=new Promise<void>(r=>{release=r;});const started=new Promise<void>(r=>{entered=r;});
 const requestFetch=(async()=>{calls++;assert.equal(f.record()?.status,'pending');entered();await gate;return new Response(xml);}) as typeof fetch;
 const input={shipmentId:f.shipmentId,recipient:address,confirmed:true};
 const one=createChronopostLabel(input,f.state,config,{store:f.store,requestFetch});await started;
 await assert.rejects(createChronopostLabel(input,f.state,config,{store:f.store,requestFetch}));release();await one;
 assert.equal(calls,1);assert.equal(f.record()?.status,'created');
 assert.equal((await createChronopostLabel(input,f.state,config,{store:f.store,requestFetch})).reused,true);assert.equal(calls,1);
});
test('failed claim never contacts carrier and pending survives failed finalization',async()=>{
 const f=fixture();let calls=0;const input={shipmentId:f.shipmentId,recipient:address,confirmed:true};
 const requestFetch=(async()=>{calls++;throw Error('private error');}) as typeof fetch;
 f.store.finish=async()=>{throw Error('database unavailable');};
 await assert.rejects(createChronopostLabel(input,f.state,config,{store:f.store,requestFetch}));
 assert.equal(f.record()?.status,'pending');
 await assert.rejects(createChronopostLabel(input,f.state,config,{store:f.store,requestFetch}));assert.equal(calls,1);
 const g=fixture();g.store.claim=async()=>{throw Error('database unavailable');};
 await assert.rejects(createChronopostLabel({shipmentId:g.shipmentId,recipient:address,confirmed:true},g.state,config,{store:g.store,requestFetch}));assert.equal(calls,1);
});
test('successful carrier response with unavailable PDF storage blocks all later requests',async()=>{
 const f=fixture();let calls=0;f.store.savePdf=async()=>{throw Error('storage unavailable');};
 const input={shipmentId:f.shipmentId,recipient:address,confirmed:true};const requestFetch=(async()=>{calls++;return new Response(xml);}) as typeof fetch;
 await assert.rejects(createChronopostLabel(input,f.state,config,{store:f.store,requestFetch}));
 assert.equal(f.record()?.status,'uncertain');assert.equal(f.record()?.diagnostic?.code,'PDF_PERSIST_FAILED');
 await assert.rejects(createChronopostLabel(input,f.state,config,{store:f.store,requestFetch}));assert.equal(calls,1);
});
test('created label with missing stored PDF never sends again',async()=>{
 const f=fixture();let calls=0;const input={shipmentId:f.shipmentId,recipient:address,confirmed:true};
 const requestFetch=(async()=>{calls++;return new Response(xml);}) as typeof fetch;
 await createChronopostLabel(input,f.state,config,{store:f.store,requestFetch});
 f.store.readPdf=async()=>{throw Error('missing object');};
 await assert.rejects(createChronopostLabel(input,f.state,config,{store:f.store,requestFetch}));
 assert.equal(f.record()?.status,'created');assert.equal(calls,1);
});
test('only explicit carrier rejection allows a subsequent claim',async()=>{
 const f=fixture();let calls=0;const input={shipmentId:f.shipmentId,recipient:address,confirmed:true};
 const requestFetch=(async()=>{calls++;return new Response(calls===1?'<Envelope><Body><shippingV7Response><return><errorCode>33</errorCode></return></shippingV7Response></Body></Envelope>':xml);}) as typeof fetch;
 await assert.rejects(createChronopostLabel(input,f.state,config,{store:f.store,requestFetch}));assert.equal(f.record()?.status,'rejected');
 assert.equal((await createChronopostLabel(input,f.state,config,{store:f.store,requestFetch})).status,'created');assert.equal(calls,2);
});
test('raw-response persistence failure remains uncertain even with valid carrier response',async()=>{
 const f=fixture();let calls=0;f.store.saveResponse=async()=>{throw Error('storage unavailable');};
 const input={shipmentId:f.shipmentId,recipient:address,confirmed:true};const requestFetch=(async()=>{calls++;return new Response(xml);}) as typeof fetch;
 await assert.rejects(createChronopostLabel(input,f.state,config,{store:f.store,requestFetch}));
 assert.equal(f.record()?.diagnostic?.code,'RESPONSE_PERSIST_FAILED');
 await assert.rejects(createChronopostLabel(input,f.state,config,{store:f.store,requestFetch}));assert.equal(calls,1);
});
