import assert from 'node:assert/strict';
const base = process.env.CRM_CLOUD_QA_BASE_URL;
if (!base || new URL(base).hostname !== '127.0.0.1' || new URL(base).port === '3000') throw new Error('Serveur QA cloud isolé requis.');
let count = 0;
for (const route of ['/api/demo/state','/api/demo/export?kind=products','/api/demo/ai/settings','/api/demo/chronopost/settings','/api/demo/chronopost/labels?shipmentId=test','/api/demo/media/test.png','/api/demo/chronopost/labels/test/pdf']) {
  const response = await fetch(base + route);
  assert.equal(response.status, 401, route); count++;
  assert.equal(typeof (await response.json()).error, 'string');
}
for (const route of ['/api/demo/actions','/api/demo/ai','/api/demo/ai/settings','/api/demo/chronopost/settings','/api/demo/chronopost/labels','/api/demo/media']) {
  const response = await fetch(base + route, {method:'POST',headers:{Origin:base,'Content-Type':route.endsWith('/media')?'image/png':'application/json'},body:'{}'});
  assert.equal(response.status, 401, route); count++;
}
const crossOrigin = await fetch(base + '/api/auth/login', {method:'POST',headers:{Origin:'https://example.invalid','Content-Type':'application/json'},body:'{}'});
assert.equal(crossOrigin.status,403); count++;
const logout = await fetch(base + '/api/auth/logout', {method:'POST',headers:{Origin:'https://example.invalid','Content-Type':'application/json'},body:'{}'});
assert.equal(logout.status,403); count++;
for(const route of ['/commandes','/preparation/test']) {
  const response = await fetch(base+route,{redirect:'manual'});
  assert.equal(response.status,307); assert.ok(response.headers.get('location').startsWith('/connexion?next=')); count++;
}
const login = await fetch(base + '/connexion'); assert.equal(login.status,200); assert.match(await login.text(),/Votre espace partagé/); count++;
console.log(`${count} contrôles HTTP de refus/connexion réussis (serveur QA, aucun compte distant).`);
