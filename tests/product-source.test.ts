import test from "node:test";
import assert from "node:assert/strict";
import { inferProductCategory, inspectProductSource, isPublicAddress, parseProductSource, trustedProductUrl } from "../src/lib/product-source";
import { completeSourceProposal } from "../src/lib/source-proposal";
import type { AiContext, AiSuggestion } from "../src/lib/ai-contract";
import { enrichProduct } from "../src/lib/openrouter";

const url = "https://jasminemballage.fr/product/Sac-Poulet-XL-20-8x35-cm";
const photo = "https://jasminemballage.fr/assets/images/SAC-POULET-XL.jpg";
const context: AiContext = { sourceUrl: url, lookupReference: "", researchContext: "", name: "", brand: "", ean: "", category: "Accessoires", unitsPerPack: 0, packsPerCarton: 0, weightGrams: 0, priceCents: 0, lengthMm: 0, widthMm: 0, heightMm: 0, attributes: [] };
const proposal = (): AiSuggestion => ({ name: "Sac Poulet XL", shortDescription: "Sac fictif", longDescription: "Sac fictif", brand: "Jasmin Emballage", ean: "", category: "Accessoires", unitsPerPack: null, packsPerCarton: null, weightGrams: null, priceCents: null, lengthMm: null, widthMm: null, heightMm: null, attributes: [], imageUrls: ["https://example.com/autre.jpg"], sources: [], evidence: [], uncertainties: [] });

test("le titre du sac et sa photo principale sont extraits sans prendre le vendeur, son logo ou les recommandations", () => {
  const html = `<meta content="${photo}" property="og:image"><h1>Sac Poulet XL 20+8x35 cm</h1><script type="application/ld+json">{"@type":"LocalBusiness","name":"Jasmin Emballage","image":"https://jasminemballage.fr/logo.png"}</script><img src="autre-produit.jpg">`;
  const source = parseProductSource(html, url);
  assert.equal(source.category, "Sacs"); assert.equal(source.brand, ""); assert.deepEqual(source.imageUrls, [photo]);
});

test("la marque explicite du Product correspondant est lue avec ses photos, y compris un CDN public, sans accepter SVG", () => {
  const product = { "@type": "Product", url, name: "Sac Poulet XL", brand: { name: "Marque produit" }, image: [photo, photo, "/assets/images/sac-detail.webp", "https://example.com/ailleurs.jpg", "/logo.svg"] };
  const source = parseProductSource(`<h1>Sac Poulet XL</h1><script type='application/ld+json'>${JSON.stringify(product)}</script>`, url);
  assert.equal(source.brand, "Marque produit"); assert.equal(source.imageUrls.length, 3); assert.equal(source.imageUrls[0], photo);
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

test("la consultation directe accepte les fiches publiques HTTPS et préserve les paramètres produit", async () => {
  assert.equal(trustedProductUrl(url + "?utm_source=test#photos")?.href, url);
  assert.equal(trustedProductUrl("https://duncan-nice.com/produit.html?variant=35235&utm_source=test#taille-tu")?.href, "https://duncan-nice.com/produit.html?variant=35235");
  for (const input of ["http://jasminemballage.fr/product/Test", "https://127.0.0.1/product/Test", "https://jasminemballage.fr:8443/product/Test", "https://crm.internal/product", "https://user:password@example.com/product", "https://jasminemballage.fr/product/a?token=secret"]) {
    assert.equal(trustedProductUrl(input), null); assert.equal(await inspectProductSource(input), null);
  }
});

const duncanUrl = "https://duncan-nice.com/accessoires-karl-lagerfeld/5748-35235-karl-lagerfeld-porte-cartes-noir-kloom-en-cuir.html";
const duncanTitle = "KARL LAGERFELD - PORTE-CARTES NOIR K/LOOM EN CUIR";
const duncanImage = (id: number) => `https://duncan-nice.com/${id}-thickbox_default/karl-lagerfeld-porte-cartes-noir-kloom-en-cuir.jpg`;
// Structure réduite de la fiche fournie : galerie différée, microdonnées Product, logo distinct.
const duncanHtml = `<meta property="og:image" content="${duncanImage(15212)}">
  <script type="application/ld+json">{"@type":"Organization","name":"Boutique Duncan","logo":"/img/logo.jpg"}</script>
  <section itemscope itemtype="https://schema.org/Product">
    <meta itemprop="url" content="${duncanUrl}#/1408-taille-tu">
    <h1 itemprop="name"><span>${duncanTitle}</span></h1>
    <meta itemprop="brand" content="KARL LAGERFELD">
    <img class="manufacturer-logo" src="/img/m/2.jpg">
    ${[15211, 15212, 15213, 15214, 15211].map(id => `<img itemprop="image swiper-lazy" data-image-large-src="${duncanImage(id)}" src="data:image/svg+xml,placeholder" data-src="/${id}-medium_default/photo.jpg">`).join("")}
    <article itemscope itemtype="https://schema.org/Product"><a itemprop="url" href="/autre.html"></a><img itemprop="image" src="/autre-produit.jpg"></article>
    <div itemscope itemtype="https://schema.org/Organization"><img itemprop="image" src="/magasin.jpg"></div>
  </section>`;

test("la fiche Duncan restitue ses quatre photos grand format sans doublons, logo ni produit recommandé", () => {
  const source = parseProductSource(duncanHtml, duncanUrl);
  assert.equal(source.title, duncanTitle);
  assert.equal(source.brand, "KARL LAGERFELD");
  assert.deepEqual(source.imageUrls, [duncanImage(15212), duncanImage(15211), duncanImage(15213), duncanImage(15214)]);
  const result = completeSourceProposal({ ...proposal(), imageUrls: [] }, { ...context, sourceUrl: duncanUrl }, source);
  assert.equal(result.imageUrls.length, 4);
  assert.equal(result.evidence.some(e => e.field === "imageUrls" && e.url === duncanUrl), true);
});

test("l’enrichissement restitue les photos de la fiche même si le modèle ne renvoie aucune URL d’image", async () => {
  const data = { ...context, sourceUrl: duncanUrl };
  const modelAnswer = { ...proposal(), brand: "", imageUrls: [] };
  const config = { enabled: true, apiKey: "unit-test-not-a-key", textModel: "test/text", imageModel: "test/image", imageRules: "" };
  let calls = 0;
  const fake = (async () => {
    calls++;
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: calls === 1 ? "Porte-cartes noir, sans URL de photo dans le texte extrait." : JSON.stringify(modelAnswer) } }] });
  }) as typeof fetch;
  const result = await enrichProduct(data, "web", config, fake, undefined, async (input) => {
    assert.equal(input, duncanUrl);
    return parseProductSource(duncanHtml, input);
  });
  assert.equal(calls, 2);
  assert.deepEqual(result.suggestion.imageUrls, [duncanImage(15212), duncanImage(15211), duncanImage(15213), duncanImage(15214)]);
  assert.equal(result.suggestion.brand, "KARL LAGERFELD");
});

test("les microdonnées d’un autre produit ne contaminent pas la fiche courante", () => {
  const html = `<h1>Produit courant</h1><div itemscope itemtype="https://schema.org/Product"><meta itemprop="url" content="/autre.html"><meta itemprop="brand" content="Autre marque"><img itemprop="image" src="/autre.jpg"></div>`;
  const source = parseProductSource(html, duncanUrl);
  assert.equal(source.brand, ""); assert.deepEqual(source.imageUrls, []);
});

test("les images structurées sur CDN acceptent ImageObject mais refusent les adresses privées, secrets et logos", () => {
  const product = { "@type": "Product", url: duncanUrl, image: [
    { "@type": "ImageObject", contentUrl: "https://cdn.example.com/detail.webp" },
    "http://cdn.example.com/insecure.jpg", "https://127.0.0.1/private.jpg", "https://crm.local/private.jpg",
    "https://cdn.example.com/photo.jpg?token=secret", "https://cdn.example.com:8443/photo.jpg", "/logo.jpg", "/photo.svg"
  ] };
  assert.deepEqual(parseProductSource(`<script type="application/ld+json">${JSON.stringify(product)}</script>`, duncanUrl).imageUrls, ["https://cdn.example.com/detail.webp"]);
});

test("une page de blocage avec illustration générique ne remplace pas les faits sourcés de l’enrichissement", () => {
  const source = parseProductSource('<h1>Accès temporairement indisponible</h1><meta property="og:image" content="/123.jpg">', duncanUrl);
  const input = proposal();
  const result = completeSourceProposal(input, { ...context, sourceUrl: duncanUrl }, source);
  assert.equal(result.brand, input.brand);
  assert.deepEqual(result.imageUrls, input.imageUrls);
});

test("les paramètres produit distinguent les photos de deux variantes sur un même chemin", () => {
  const current = duncanUrl + "?variant=black";
  const variants = [{ "@type": "Product", url: duncanUrl + "?variant=red", image: "/red.jpg" }, { "@type": "Product", url: current, image: "/black.jpg" }];
  const html = `<h1>Porte-cartes noir</h1><script type="application/ld+json">${JSON.stringify(variants)}</script>`;
  assert.deepEqual(parseProductSource(html, current).imageUrls, ["https://duncan-nice.com/black.jpg"]);
  const microdata = variants.map(p => `<article itemscope itemtype="https://schema.org/Product"><meta itemprop="url" content="${p.url}"><img itemprop="image" src="${p.image}"></article>`).join("");
  assert.deepEqual(parseProductSource(microdata, current).imageUrls, ["https://duncan-nice.com/black.jpg"]);
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
