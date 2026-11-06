import test from "node:test";
import assert from "node:assert/strict";
import { parseAiObject } from "../src/lib/ai-json";
import { enrichProduct, sanitizeSuggestion } from "../src/lib/openrouter";
import type { AiContext, AiSuggestion } from "../src/lib/ai-contract";

const context: AiContext = { sourceUrl: "https://example.com/sac", lookupReference: "", researchContext: "", name: "", brand: "", ean: "", category: "Accessoires", unitsPerPack: 0, packsPerCarton: 0, weightGrams: 0, priceCents: 0, lengthMm: 0, widthMm: 0, heightMm: 0, attributes: [] };
const valid: AiSuggestion = { name: "Sac fictif", shortDescription: "Description fictive", longDescription: "Texte avec des accolades {ici} et des délimiteurs ``` dans une chaîne.", brand: "", ean: "", category: "Sacs", unitsPerPack: null, packsPerCarton: null, weightGrams: null, priceCents: null, lengthMm: null, widthMm: null, heightMm: null, attributes: [], imageUrls: [], sources: [], evidence: [], uncertainties: ["Poids inconnu"] };
const config = { apiKey: "unit-test-not-a-real-token", enabled: true, textModel: "test/text", imageModel: "test/image", imageRules: "" };
const codeBlock = (json: string) => ["```json", json, "```"].join("\n");

test("la réponse JSON brute, avec BOM ou un seul bloc Markdown est lue sans modifier son contenu", () => {
  const json = JSON.stringify(valid);
  for (const text of [json, `\uFEFF ${json}\n`, codeBlock(json), ["```", json, "```"].join("\r\n")])
    assert.deepEqual(parseAiObject(text, "stop"), valid);
});

test("le lecteur refuse les objets coupés, le texte environnant, le JavaScript et les valeurs hors objet", () => {
  for (const text of ['{"name":', 'Voici le résultat : {"name":"Sac"}', '{"name":"Sac",}', "{name:'Sac'}", "null", "[]", '"un texte"', codeBlock('{"name":')])
    assert.throws(() => parseAiObject(text, "stop"));
  assert.throws(() => parseAiObject(null), /Aucune proposition/);
  assert.throws(() => parseAiObject(" "), /Aucune proposition/);
});

test("une réponse annoncée tronquée ou refusée ne devient jamais une proposition utilisable", () => {
  assert.throws(() => parseAiObject(JSON.stringify(valid), "length"), /interrompue/);
  assert.throws(() => parseAiObject(JSON.stringify(valid), "max_tokens"), /interrompue/);
  assert.throws(() => parseAiObject(JSON.stringify(valid), "content_filter"), /Aucun champ/);
  assert.throws(() => parseAiObject(JSON.stringify(valid), "stop", "refus fournisseur"), /Aucun champ/);
});

test("la limite de sortie est expliquée sans attribuer la coupure au contexte fourni", () => {
  for (const finishReason of ["length", "max_tokens"]) {
    assert.throws(() => parseAiObject(JSON.stringify(valid), finishReason), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /limite de génération/);
      assert.doesNotMatch(error.message, /Réduisez le contexte/);
      assert.match(error.message, /Aucun champ/);
      return true;
    });
  }
});

for (const scenario of [
  { name: "l’extraction", retrievalTokens: 3000, formattingTokens: 3000 },
  { name: "le formatage JSON", retrievalTokens: 1000, formattingTokens: 5000 }
]) test(`le budget couvre le raisonnement pendant ${scenario.name} sans imposer un paramètre de modèle`, async () => {
  const referenceContext = { ...context, sourceUrl: "", lookupReference: "SAC-123" };
  let calls = 0;
  const mock = (async (_url, options) => {
    calls++;
    const payload = JSON.parse(String(options?.body));
    const formatting = Boolean(payload.response_format);
    // The provider counts reasoning inside max_tokens, even when only the final text is returned.
    const requiredTokens = formatting ? scenario.formattingTokens : scenario.retrievalTokens;
    assert.ok(payload.max_tokens <= (formatting ? 10000 : 6000), "Les dépenses restent bornées à chaque étape.");
    assert.equal(Object.hasOwn(payload, "reasoning"), false);
    const truncated = payload.max_tokens < requiredTokens;
    return Response.json({
      choices: [{ finish_reason: truncated ? "length" : "stop", message: {
        content: truncated ? '{"name":' : formatting ? JSON.stringify(valid) : "Sac fictif. Source : https://example.com/sac"
      } }],
      usage: { completion_tokens: Math.min(payload.max_tokens, requiredTokens), completion_tokens_details: { reasoning_tokens: formatting ? 2143 : 422 }, cost: 0.001 }
    });
  }) as typeof fetch;
  const result = await enrichProduct(referenceContext, "web", config, mock);
  assert.deepEqual(result.suggestion, valid);
  assert.equal(result.cost, 0.002);
  assert.equal(calls, 2);
});

test("un résultat web entouré de Markdown devient une proposition validée avec le contrat explicite demandé", async () => {
  let calls = 0;
  const mock = (async (_url, options) => {
    calls++;
    const payload = JSON.parse(String(options?.body));
    if (calls === 1) return Response.json({ choices: [{ finish_reason: "stop", message: { content: "Sac fictif. Source : https://example.com/sac" } }] });
    assert.equal(payload.messages[0].content.endsWith(JSON.stringify(payload.response_format.json_schema.schema)), true);
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: codeBlock(JSON.stringify(valid)) } }] });
  }) as typeof fetch;
  const result = await enrichProduct(structuredClone(context), "web", config, mock, undefined, async () => null);
  assert.deepEqual(result.suggestion, valid); assert.equal(calls, 2);
});

test("un JSON lisible dont les rubriques sont incorrectes reste rejeté sans conversion hasardeuse ni nouvel appel", async () => {
  let calls = 0; const before = structuredClone(context);
  const mock = (async () => { calls++; return Response.json({ choices: [{ finish_reason: "stop", message: { content: codeBlock(JSON.stringify({ ...valid, sourceUrl: context.sourceUrl, attributes: ["papier"], uncertainties: { weightGrams: null } })) } }] }); }) as typeof fetch;
  await assert.rejects(() => enrichProduct(context, "web", config, mock, undefined, async () => null), /données invalides/);
  assert.equal(calls, 2); assert.deepEqual(context, before);
});

test("le connecteur signale une réponse interrompue et ne la répare pas par une autre requête payante", async () => {
  let calls = 0;
  const mock = (async () => { calls++; return Response.json({ choices: [{ finish_reason: "length", message: { content: JSON.stringify(valid) } }] }); }) as typeof fetch;
  await assert.rejects(() => enrichProduct(context, "compose", config, mock), /interrompue/);
  assert.equal(calls, 1);
});

test("une consultation web tronquée s’arrête avant le formatage et une annulation empêche le second appel", async () => {
  let calls = 0;
  const truncated = (async () => { calls++; return Response.json({ choices: [{ finish_reason: "length", message: { content: "Une extraction incomplète" } }] }); }) as typeof fetch;
  await assert.rejects(() => enrichProduct(context, "web", config, truncated, undefined, async () => null), /interrompue/); assert.equal(calls, 1);
  calls = 0; const controller = new AbortController();
  const cancelled = (async () => { calls++; controller.abort(); return Response.json({ choices: [{ finish_reason: "stop", message: { content: "Sac fictif" } }] }); }) as typeof fetch;
  await assert.rejects(() => enrichProduct(context, "web", config, cancelled, controller.signal, async () => null)); assert.equal(calls, 1);
});

test("un carton de 500 sacs ne devient pas 500 paquets et les zéros inconnus ne deviennent pas des faits", () => {
  const source = "https://example.com/sac";
  const proposed = { ...structuredClone(valid), unitsPerPack: 0, priceCents: 0, weightGrams: 0, packsPerCarton: 500,
    sources: [{ url: source, title: "Sac fictif" }], evidence: [{ field: "packsPerCarton" as const, url: source, note: "Livré en carton de 500 sacs." }] };
  const result = sanitizeSuggestion(proposed, context, true);
  assert.equal(result.packsPerCarton, null); assert.equal(result.unitsPerPack, null); assert.equal(result.priceCents, null); assert.equal(result.weightGrams, null);
  assert.match(result.uncertainties.join(" "), /nombre de pièces ou de sacs/);
  const correct = { ...structuredClone(valid), packsPerCarton: 10, sources: [{ url: source, title: "Sac fictif" }],
    evidence: [{ field: "packsPerCarton" as const, url: source, note: "10 paquets par carton." }] };
  assert.equal(sanitizeSuggestion(correct, context, true).packsPerCarton, 10);
});
