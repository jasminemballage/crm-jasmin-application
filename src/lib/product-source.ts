import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import { parse, type DefaultTreeAdapterMap } from "parse5";
import { isPublicUrl } from "./product-info";

type Category = "Gobelets" | "Barquettes" | "Sacs" | "Couverts" | "Accessoires";
export type ProductSource = { url: string; title: string; category: Category | null; brand: string; imageUrls: string[]; productIdentified?: boolean };

export function trustedProductUrl(input: string): URL | null {
  try {
    const url = new URL(input);
    if (input.length > 2048 || !isPublicUrl(input) || (url.port && url.port !== "443")) return null;
    // Keep variant/product query parameters; only remove tracking and browser-only fragments.
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|gclid$|fbclid$)/i.test(key)) url.searchParams.delete(key);
    url.hash = ""; return url;
  } catch { return null; }
}
export function isPublicAddress(address: string) {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168)) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
  }
  return isIP(address) === 6 && /^[23]/i.test(address) && !/^2001:(?:0*:|db8:|(?:0*)?(?:10|20):)/i.test(address) && !/^2002:/i.test(address);
}
async function resolvePublic(hostname: string, signal: AbortSignal) {
  signal.throwIfAborted();
  let abort: () => void = () => {};
  const cancelled = new Promise<never>((_, reject) => { abort = () => reject(signal.reason); signal.addEventListener("abort", abort, { once: true }); });
  try {
    const addresses = await Promise.race([lookup(hostname, { all: true }), cancelled]);
    if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) throw new Error("Destination non publique.");
    return addresses.find(a => a.family === 4) ?? addresses[0];
  } finally { signal.removeEventListener("abort", abort); }
}
async function readTrustedPage(url: URL, signal: AbortSignal): Promise<{ html: string; url: string }> {
  for (let redirects = 0; redirects <= 2; redirects++) {
    const checked = trustedProductUrl(url.href);
    if (!checked) throw new Error("Lien produit non autorisé.");
    url = checked;
    const address = await resolvePublic(url.hostname, signal);
    const response = await new Promise<{ html?: string; redirect?: string }>((resolve, reject) => {
      const req = request(url, { method: "GET", agent: false, family: address.family,
        lookup: (_hostname, _options, done) => done(null, address.address, address.family), signal,
        headers: { Accept: "text/html,application/xhtml+xml", "Accept-Encoding": "identity", "User-Agent": "CRM-Jasmin/0.3" } }, res => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode ?? 0)) { const location = res.headers.location; res.destroy(); if (location) resolve({ redirect: location }); else reject(new Error("Redirection vide.")); return; }
        if (res.statusCode !== 200 || !/^(text\/html|application\/xhtml\+xml)/i.test(res.headers["content-type"] ?? "")) { res.destroy(); reject(new Error("Fiche HTML indisponible.")); return; }
        if (Number(res.headers["content-length"] ?? 0) > 2 * 1024 * 1024) { res.destroy(); reject(new Error("Fiche trop volumineuse.")); return; }
        const chunks: Buffer[] = []; let size = 0;
        res.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 2 * 1024 * 1024) { res.destroy(new Error("Fiche trop volumineuse.")); return; } chunks.push(chunk); });
        res.on("end", () => resolve({ html: Buffer.concat(chunks).toString("utf8") })); res.on("error", reject);
      }); req.on("error", reject); req.end();
    });
    if (response.html !== undefined) return { html: response.html, url: url.href };
    url = new URL(response.redirect!, url);
  }
  throw new Error("Trop de redirections.");
}
function decode(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|nbsp|lt|gt);/gi, (whole, code: string) => {
    if (code[0] === "#") { const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1)); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ""; }
    return ({ amp: "&", quot: '"', apos: "'", nbsp: " ", lt: "<", gt: ">" } as Record<string, string>)[code.toLowerCase()] ?? whole;
  });
}
function plain(text: unknown, maximum = 160) { return typeof text === "string" ? decode(text.replace(/<[^>]*>/g, " ")).replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum) : ""; }
function attributes(tag: string) {
  const values: Record<string, string> = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) values[match[1].toLowerCase()] = decode(match[2] ?? match[3] ?? match[4]);
  return values;
}
export function inferProductCategory(name: string): Category | null {
  const value = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\b(sacs?|sachets?)\b/.test(value)) return "Sacs";
  if (/\bgobelets?\b/.test(value)) return "Gobelets";
  if (/\bbarquettes?\b/.test(value)) return "Barquettes";
  if (/\b(couverts?|fourchettes?|cuilleres?|couteaux|couteau)\b/.test(value)) return "Couverts";
  if (/\b(accessoires?|serviettes?|pailles?)\b/.test(value)) return "Accessoires";
  return null;
}
function canonical(value: unknown, base: string) {
  try {
    const u = trustedProductUrl(new URL(String(value), base).href); if (!u) return "";
    u.searchParams.sort();
    return `${u.origin}${u.pathname.replace(/\/$/, "")}${u.search}`;
  } catch { return ""; }
}
function sourceImageUrl(value: unknown, base: string): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const image = new URL(decode(value), base); image.hash = "";
    if (image.href.length > 2048 || !isPublicUrl(image.href) || (image.port && image.port !== "443") ||
        !/\.(png|jpe?g|webp)$/i.test(image.pathname) || /\b(logo|favicon|banner|payment|paiement)\b/i.test(decodeURIComponent(image.pathname))) return null;
    return image.href;
  } catch { return null; }
}

type HtmlNode = DefaultTreeAdapterMap["node"];
type HtmlElement = DefaultTreeAdapterMap["element"];
const attr = (node: HtmlElement, name: string) => node.attrs.find(a => a.name === name)?.value;
// Nested scopes belong to another entity (recommendations, seller, offers), not this product.
function elements(root: HtmlNode, ownScope = false): HtmlElement[] {
  const found: HtmlElement[] = [];
  const stack: HtmlNode[] = "childNodes" in root ? [...root.childNodes].reverse() : [];
  while (stack.length) {
    const node = stack.pop()!;
    if (!("tagName" in node) || ["script", "style", "template", "noscript"].includes(node.tagName)) continue;
    found.push(node);
    if (!ownScope || attr(node, "itemscope") === undefined) stack.push(...node.childNodes.slice().reverse());
  }
  return found;
}
function textContent(root: HtmlNode): string {
  const stack = [root]; const parts: string[] = [];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.nodeName === "#text" && "value" in node) parts.push(node.value);
    else if ("childNodes" in node && !("tagName" in node && ["script", "style", "template"].includes(node.tagName))) stack.push(...node.childNodes.slice().reverse());
  }
  return parts.join(" ");
}
const propertyValue = (node: HtmlElement) => attr(node, "content") ?? attr(node, "href") ?? attr(node, "src") ?? textContent(node);
const hasProperty = (node: HtmlElement, name: string) => (attr(node, "itemprop") ?? "").split(/\s+/).includes(name);
function microdataProduct(html: string, url: string, title: string) {
  const products = elements(parse(html)).filter(node => attr(node, "itemscope") !== undefined &&
    (attr(node, "itemtype") ?? "").split(/\s+/).some(type => /^https?:\/\/schema\.org\/Product\/?$/i.test(type))).slice(0, 50)
    .map(node => {
      const properties = elements(node, true);
      const value = (key: string) => { const property = properties.find(p => hasProperty(p, key)); return property ? propertyValue(property) : ""; };
      return { properties, name: plain(value("name")), url: value("url") || attr(node, "itemid") || "" };
    });
  const product = products.find(p => p.url && canonical(p.url, url) === canonical(url, url)) ??
    products.find(p => !p.url && p.name && p.name.toLowerCase() === title.toLowerCase()) ??
    (products.length === 1 && !products[0].url ? products[0] : undefined);
  if (!product) return null;
  const brandNode = product.properties.find(p => hasProperty(p, "brand"));
  const brandName = brandNode && attr(brandNode, "itemscope") !== undefined ? elements(brandNode, true).find(p => hasProperty(p, "name")) : brandNode;
  const images = product.properties.filter(p => hasProperty(p, "image")).flatMap(node => {
    const candidates = node.tagName === "img" ? [attr(node, "data-image-large-src"), attr(node, "data-zoom-image"), attr(node, "data-src"), attr(node, "src"), attr(node, "content")] :
      attr(node, "itemscope") !== undefined ? elements(node, true).filter(p => hasProperty(p, "contentUrl") || hasProperty(p, "url")).map(propertyValue) : [propertyValue(node)];
    const image = candidates.map(value => sourceImageUrl(value, url)).find(Boolean);
    return image ? [image] : [];
  });
  return { name: product.name, brand: brandName ? plain(propertyValue(brandName), 120) : "", images };
}
export function parseProductSource(html: string, url: string): ProductSource {
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => attributes(m[0]));
  const meta = (key: string) => metas.find(m => (m.property ?? m.name)?.toLowerCase() === key)?.content ?? "";
  const title = plain(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] || meta("og:title"));
  const products: Record<string, unknown>[] = [];
  function visit(value: unknown, depth = 0) {
    if (depth > 5 || products.length > 50 || !value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.slice(0, 50).forEach(v => visit(v, depth + 1)); return; }
    const object = value as Record<string, unknown>;
    if ([object["@type"]].flat().includes("Product")) products.push(object);
    if (object["@graph"]) visit(object["@graph"], depth + 1);
  }
  for (const tag of [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].slice(0, 60)) {
    if (attributes(tag[1]).type?.toLowerCase() !== "application/ld+json") continue;
    try { visit(JSON.parse(tag[2])); } catch { /* Ignore invalid structured data; never execute it. */ }
  }
  const product = products.find(p => typeof p.url === "string" && canonical(p.url, url) === canonical(url, url)) ??
    products.find(p => !p.url && plain(p.name).toLowerCase() === title.toLowerCase()) ??
    (products.length === 1 && !products[0].url ? products[0] : undefined);
  const microdata = microdataProduct(html, url, title);
  const brand = plain(typeof product?.brand === "object" && product.brand ? (product.brand as Record<string, unknown>).name : product?.brand, 120) || microdata?.brand || plain(meta("product:brand"), 120);
  const declaredCategory = typeof product?.category === "string" ? product.category : "";
  const candidates: unknown[] = [meta("og:image"), meta("og:image:secure_url"), ...[product?.image ?? []].flat(), ...microdata?.images ?? []];
  const imageUrls: string[] = [];
  for (const item of candidates) {
    const value = typeof item === "string" ? item : item && typeof item === "object" ? (item as Record<string, unknown>).contentUrl ?? (item as Record<string, unknown>).url : undefined;
    const image = sourceImageUrl(value, url);
    if (image && !imageUrls.includes(image)) imageUrls.push(image);
  }
  const productTitle = title || plain(product?.name) || microdata?.name || "";
  // The existing Jasmin catalogue predates Product markup; keep its known product-page format.
  const legacyJasminProduct = /^https:\/\/(?:www\.)?jasminemballage\.fr\/product\/[^/?#]+\/?$/.test(url) && productTitle && imageUrls.length;
  return { url, title: productTitle, brand, category: inferProductCategory(declaredCategory) ?? inferProductCategory(productTitle), imageUrls: imageUrls.slice(0, 8),
    productIdentified: Boolean(product || microdata || meta("og:type").toLowerCase() === "product" || legacyJasminProduct) };
}
export async function inspectProductSource(input: string, parentSignal?: AbortSignal): Promise<ProductSource | null> {
  const url = trustedProductUrl(input); if (!url) return null;
  const signal = parentSignal ? AbortSignal.any([parentSignal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000);
  const page = await readTrustedPage(url, signal);
  const source = parseProductSource(page.html, page.url);
  return source.productIdentified ? source : null;
}
