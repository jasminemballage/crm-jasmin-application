import test from "node:test";
import assert from "node:assert/strict";
import { inferProductCategory, inspectProductSource, isPublicAddress, parseProductSource, trustedProductUrl } from "../src/lib/product-source";
import { completeSourceProposal } from "../src/lib/source-proposal";
import type { AiContext, AiSuggestion } from "../src/lib/ai-contract";

const url = "https://jasminemballage.fr/product/Sac-Poulet-XL-20-8x35-cm";
const photo = "https://jasminemballage.fr/assets/images/SAC-POULET-XL.jpg";
const context: AiContext = { sourceUrl: url, lookupReference: "", researchContext: "", name: "", brand: "", ean: "", category: "Accessoires", unitsPerPack: 0, packsPerCarton: 0, weightGrams: 0, priceCents: 0, lengthMm: 0, widthMm: 0, heightMm: 0, attributes: [] };
const proposal = (): AiSuggestion => ({ name: "Sac Poulet XL", shortDescription: "Sac fictif", longDescription: "Sac fictif", brand: "Jasmin Emballage", ean: "", category: "Accessoires", unitsPerPack: null, packsPerCarton: null, weightGrams: null, priceCents: null, lengthMm: null, widthMm: null, heightMm: null, attributes: [], imageUrls: ["https://example.com/autre.jpg"], sources: [], evidence: [], uncertainties: [] });

test("le titre du sac et sa photo principale sont extraits sans prendre le vendeur, son logo ou les recommandations", () => {
  const html = `<meta content="${photo}" property="og:image"><h1>Sac Poulet XL 20+8x35 cm</h1><script type="application/ld+json">{"@type":"LocalBusiness","name":"Jasmin Emballage","image":"https://jasminemballage.fr/logo.png"}</script><img src="autre-produit.jpg">`;
  const source = parseProductSource(html, url);
  assert.equal(source.category, "Sacs"); assert.equal(source.brand, ""); assert.deepEqual(source.imageUrls, [photo]);
});

test("la marque explicite du Product correspondant est lue avec ses photos, sans accepter SVG ni hôte externe", () => {
  const product = { "@type": "Product", url, name: "Sac Poulet XL", brand: { name: "Marque produit" }, image: [photo, photo, "/assets/images/sac-detail.webp", "https://example.com/ailleurs.jpg", "/logo.svg"] };
  const source = parseProductSource(`<h1>Sac Poulet XL</h1><script type='application/ld+json'>${JSON.stringify(product)}</script>`, url);
  assert.equal(source.brand, "Marque produit"); assert.equal(source.imageUrls.length, 2); assert.equal(source.imageUrls[0], photo);
});

test("un Product qui désigne une autre fiche ne fournit pas la marque ou la photo du produit courant", () => {
  const other = { "@type": "Product", url: "https://jasminemballage.fr/product/Autre", brand: "Autre marque", image: photo };
  const source = parseProductSource(`<h1>Sac Poulet XL</h1><script type="application/ld+json">${JSON.stringify(other)}</script>`, url);
  assert.equal(source.brand, ""); assert.deepEqual(source.imageUrls, []);
});

test("les métadonnées décodent les entités et les graphes Product sans exécuter de script", () => {
  const graph = { "@graph": [{ "@type": "Product", name: "Sac & papier", brand: "Marque & fils", image: photo }] };
  const source = parseProductSource(`<meta name="og:title" content="Sac &amp; papier"><script type="application/ld+json">${JSON.stringify(graph)}</script><script>throw Error('ne jamais executer')</script>`, url);
  assert.equal(source.title, "Sac & papier"); assert.equal(source.brand, "Marque & fils"); assert.equal(source.category, "Sacs");
});

test("des données structurées invalides et un logo générique ne sont pas utilisés comme fiche produit", () => {
  const source = parseProductSource('<h1>Sac poulet</h1><meta property="og:image" content="/assets/images/logo.png"><script type="application/ld+json">{incorrect}</script>', url);
  assert.equal(source.brand, ""); assert.deepEqual(source.imageUrls, []);
});

test("la catégorie interne est déduite de familles explicites dans les titres", () => {
  for (const [title, expected] of [["Sac poulet", "Sacs"], ["Gobelets 25cl", "Gobelets"], ["Barquette kraft", "Barquettes"], ["Cuillères bois", "Couverts"], ["Serviettes", "Accessoires"]]) assert.equal(inferProductCategory(title), expected);
  assert.equal(inferProductCategory("Produit non décrit"), null);
});

test("la consultation directe reste limitée aux fiches Jasmin HTTPS et ne contacte pas un lien non autorisé", async () => {
  assert.equal(trustedProductUrl(url + "?utm_source=test#photos")?.href, url);
  for (const input of ["http://jasminemballage.fr/product/Test", "https://example.com/product/Test", "https://jasminemballage.fr:8443/product/Test", "https://jasminemballage.fr/compte", "https://jasminemballage.fr/product/a%2f..%2fcompte", "https://jasminemballage.fr/product/a?token=secret"]) {
    assert.equal(trustedProductUrl(input), null); assert.equal(await inspectProductSource(input), null);
  }
});

test("le réseau local et les adresses spéciales sont refusés avant une connexion directe", () => {
  for (const address of ["127.0.0.1", "10.0.0.1", "192.168.1.1", "172.16.0.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1", "2001:db8::1", "2002:a00:1::", "incorrect"]) assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress("8.8.8.8"), true); assert.equal(isPublicAddress("2606:4700::1111"), true);
});

test("une marque de vendeur supposée est retirée et la catégorie et la photo vérifiées sont proposées", () => {
  const source = parseProductSource(`<h1>Sac poulet XL</h1><meta property="og:image" content="${photo}">`, url);
  const input = proposal(); const before = structuredClone(input); const result = completeSourceProposal(input, context, source);
  assert.equal(result.brand, ""); assert.equal(result.category, "Sacs"); assert.deepEqual(result.imageUrls, [photo]); assert.match(result.uncertainties.join(" "), /Marque non précisée/);
  assert.equal(result.evidence.some(e => e.field === "category"), true); assert.equal(result.evidence.some(e => e.field === "imageUrls"), true); assert.deepEqual(input, before);
});

test("une marque fournie par l’utilisateur est conservée et une marque Product explicite peut être proposée", () => {
  const source = { url, title: "Sac poulet", category: "Sacs" as const, brand: "Marque déclarée", imageUrls: [photo] };
  assert.equal(completeSourceProposal(proposal(), { ...context, brand: "Ma marque confirmée" }, source).brand, "Ma marque confirmée");
  const result = completeSourceProposal(proposal(), context, source);
  assert.equal(result.brand, "Marque déclarée"); assert.equal(result.evidence.some(e => e.field === "brand"), true);
});
