import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import { isPublicUrl } from "./product-info";

type Category = "Gobelets" | "Barquettes" | "Sacs" | "Couverts" | "Accessoires";
export type ProductSource = { url: string; title: string; category: Category | null; brand: string; imageUrls: string[] };
const trustedHosts = new Set(["jasminemballage.fr", "www.jasminemballage.fr"]);

export function trustedProductUrl(input: string): URL | null {
  try {
    const url = new URL(input);
    if (!isPublicUrl(input) || !trustedHosts.has(url.hostname) || (url.port && url.port !== "443") ||
        !/^\/product\/[\p{L}\p{N}_.+-]+\/?$/u.test(decodeURIComponent(url.pathname))) return null;
    url.search = ""; url.hash = ""; return url;
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
    if (!trustedProductUrl(url.href)) throw new Error("Lien produit non autorisé.");
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
function canonical(value: unknown, base: string) { try { const u = new URL(String(value), base); return `${u.origin}${u.pathname.replace(/\/$/, "")}`; } catch { return ""; } }
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
  const brand = plain(typeof product?.brand === "object" && product.brand ? (product.brand as Record<string, unknown>).name : product?.brand, 120) || plain(meta("product:brand"), 120);
  const declaredCategory = typeof product?.category === "string" ? product.category : "";
  const candidates: unknown[] = [meta("og:image"), meta("og:image:secure_url"), ...[product?.image ?? []].flat()];
  const imageUrls: string[] = [];
  for (const item of candidates) {
    const value = typeof item === "string" ? item : item && typeof item === "object" ? (item as Record<string, unknown>).url : undefined;
    if (typeof value !== "string" || !value) continue;
    try {
      const image = new URL(decode(value), url); image.hash = "";
      if (isPublicUrl(image.href) && trustedHosts.has(image.hostname) && /\.(png|jpe?g|webp)$/i.test(image.pathname) &&
          !/\b(logo|favicon|banner|payment|paiement)\b/i.test(decodeURIComponent(image.pathname)) && !imageUrls.includes(image.href)) imageUrls.push(image.href);
    } catch { /* Ignore an invalid URL. */ }
  }
  return { url, title: title || plain(product?.name), brand, category: inferProductCategory(declaredCategory) ?? inferProductCategory(title || plain(product?.name)), imageUrls: imageUrls.slice(0, 8) };
}
export async function inspectProductSource(input: string, parentSignal?: AbortSignal): Promise<ProductSource | null> {
  const url = trustedProductUrl(input); if (!url) return null;
  const signal = parentSignal ? AbortSignal.any([parentSignal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000);
  const page = await readTrustedPage(url, signal);
  return parseProductSource(page.html, page.url);
}
