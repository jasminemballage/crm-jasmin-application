"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Check, CircleAlert, ExternalLink, FileText, ImagePlus, Info, LoaderCircle, Plus, Save, Search, Sparkles, Tags, Trash2, Truck, Upload } from "lucide-react";
import { type Action, type Product } from "@/lib/model";
import { emptyProductInfo, priceExcludingTax, priceIncludingTax, productCategories, productEditorInput, type ImageAsset, type ProductEditorInput, type ProductInfo } from "@/lib/product-info";
import type { AiContext, AiStatus, AiSuggestion } from "@/lib/ai-contract";

type Props = { product?: Product; reserved: number; busy: boolean; onSave: (action: Action, message: string) => Promise<void>; onClose: () => void };
type Proposal = { suggestion: AiSuggestion; contextKey: string; model: string; cost: number | null };
const euro = (n: number) => (n / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const labels: Record<string, string> = { name: "Titre", shortDescription: "Description courte", longDescription: "Description longue", brand: "Marque", ean: "EAN", category: "Catégorie", unitsPerPack: "Pièces / paquet", packsPerCarton: "Paquets / carton", priceCents: "Prix HT / paquet", weightGrams: "Poids du paquet (g)", lengthMm: "Longueur (mm)", widthMm: "Largeur (mm)", heightMm: "Hauteur (mm)", attributes: "Attributs", imageUrls: "Images trouvées" };
const proposalFields = Object.keys(labels) as (keyof typeof labels)[];
function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) { return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
function Section({ title, children, icon }: { title: string; children: ReactNode; icon?: ReactNode }) { return <section className="product-section"><h3>{icon ?? <Tags size={16} />}{title}</h3>{children}</section>; }
function display(value: unknown, field: string) {
  if (field === "priceCents" && typeof value === "number") return euro(value);
  if (Array.isArray(value)) return value.map(v => typeof v === "string" ? v : `${v.name} : ${v.value}`).join("\n");
  return String(value ?? "");
}

export default function ProductEditor({ product, reserved, busy, onSave, onClose }: Props) {
  const [form, setForm] = useState<ProductEditorInput>(() => ({ sku: product?.sku ?? "", name: product?.name ?? "", category: product?.category ?? "Accessoires",
    unitsPerPack: product?.unitsPerPack ?? 0, packsPerCarton: product?.packsPerCarton ?? 0, priceCents: product?.priceCents ?? 0,
    safetyPacks: product?.safetyPacks ?? 0, weightGrams: product?.weightGrams ?? 0,
    info: product?.info ? structuredClone(product.info) : { ...emptyProductInfo(), workflowStatus: product ? "active" : "draft" } }));
  const [net, setNet] = useState(product ? (product.priceCents / 100).toFixed(2) : "");
  const [gross, setGross] = useState(product ? (priceIncludingTax(product.priceCents, product.info?.vatRateBps ?? 2000) / 100).toFixed(2) : "");
  const [kg, setKg] = useState(product?.weightGrams ? String(product.weightGrams / 1000) : "");
  const [initialStock, setInitialStock] = useState(0);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [working, setWorking] = useState("");
  const [enrichmentMode, setEnrichmentMode] = useState<"compose" | "web" | null>(null);
  const [enrichmentNotice, setEnrichmentNotice] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [imageType, setImageType] = useState<"packshot" | "lifestyle" | "detail">("packshot");
  const [imagePrompt, setImagePrompt] = useState("");
  const [globalRules, setGlobalRules] = useState(true);
  const [usePhoto, setUsePhoto] = useState(true);
  const [imageProposal, setImageProposal] = useState<{ image: ImageAsset; contextKey: string; cost: number | null } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const scrolling = useRef<HTMLDivElement>(null);
  const locked = busy || !!working;
  const enriching = enrichmentMode !== null;
  const physical = product?.physicalPacks ?? initialStock;
  const available = Math.max(0, physical - reserved - form.safetyPacks);
  const context: AiContext = { sourceUrl: form.info.sourceUrl, lookupReference: form.info.lookupReference || form.sku,
    researchContext: form.info.researchContext, name: form.name, brand: form.info.brand, ean: form.info.ean, category: form.category,
    unitsPerPack: form.unitsPerPack, packsPerCarton: form.packsPerCarton, weightGrams: form.weightGrams, priceCents: form.priceCents,
    lengthMm: form.info.lengthMm, widthMm: form.info.widthMm, heightMm: form.info.heightMm,
    attributes: form.info.attributes.filter(a => a.name.trim() && a.value.trim()) };
  const contextKey = JSON.stringify(context);
  const stale = !!proposal && proposal.contextKey !== contextKey;
  const localReference = form.info.images.find(image => image.url.startsWith("/api/demo/media/"));
  function field<K extends keyof ProductEditorInput>(key: K, value: ProductEditorInput[K]) { setForm(old => ({ ...old, [key]: value })); }
  function info<K extends keyof ProductInfo>(key: K, value: ProductInfo[K]) { setForm(old => ({ ...old, info: { ...old.info, [key]: value } })); }
  async function refreshStatus() {
    try { const response = await fetch("/api/demo/ai/settings", { cache: "no-store" }); if (response.ok) setStatus(await response.json()); } catch { setStatus(null); }
  }
  useEffect(() => { void refreshStatus(); return () => controller.current?.abort(); }, []);
  function updateNet(raw: string) {
    setNet(raw); const cents = Math.round(Number(raw) * 100); field("priceCents", cents);
    setGross(raw === "" ? "" : (priceIncludingTax(cents, form.info.vatRateBps) / 100).toFixed(2));
  }
  function updateGross(raw: string) {
    setGross(raw); const cents = priceExcludingTax(Math.round(Number(raw) * 100), form.info.vatRateBps); field("priceCents", cents);
    setNet(raw === "" ? "" : (cents / 100).toFixed(2));
  }
  function updateVat(rate: number) { info("vatRateBps", rate); setGross(net === "" ? "" : (priceIncludingTax(form.priceCents, rate) / 100).toFixed(2)); }
  async function save(workflowStatus: "draft" | "active") {
    setError(""); if (locked) return;
    const data = { ...form, info: { ...form.info, workflowStatus, attributes: form.info.attributes.filter(a => a.name.trim() || a.value.trim()) } };
    const valid = productEditorInput.safeParse(data);
    if (!valid.success) { setError(valid.error.issues[0].code === "custom" ? valid.error.issues[0].message : `Vérifiez le champ ${valid.error.issues[0].path.join(" → ")} et ses limites.`); scrolling.current?.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (workflowStatus === "active" && (!form.name.trim() || !form.unitsPerPack || !form.packsPerCarton || !form.weightGrams)) {
      setError("Avant l’activation, renseignez le titre, les pièces par paquet, les paquets par carton et le poids. Vous pouvez aussi enregistrer un brouillon."); scrolling.current?.scrollTo({ top: 0, behavior: "smooth" }); return;
    }
    if (workflowStatus === "active" && form.info.images.some(i => i.kind === "generated" && !i.reviewed)) {
      setError("Validez la fidélité des visuels IA dans la galerie avant d’activer le produit."); scrolling.current?.scrollTo({ top: 0, behavior: "smooth" }); return;
    }
    await onSave({ type: "saveProductInfo", ...(product ? { id: product.id } : { initialPhysicalPacks: initialStock }), product: valid.data },
      workflowStatus === "draft" ? "Brouillon enregistré. Les informations seront conservées pour la suite." : "Fiche activée dans le CRM. Aucune publication externe n’a été effectuée.");
  }
  async function askAi(action: "enrich" | "image", mode: "compose" | "web" = "compose") {
    if (locked || controller.current) return;
    setEnrichmentMode(action === "enrich" ? mode : null);
    if (action === "enrich") setEnrichmentNotice("");
    setError(""); setWorking(action === "image" ? "Génération de l’image…" : mode === "web" ? "Recherche et préparation de la fiche…" : "Préparation des textes…");
    const current = new AbortController(); controller.current = current;
    try {
      const payload = action === "enrich" ? { action, mode, context } : { action, context, type: imageType, prompt: imagePrompt,
        useGlobalRules: globalRules, ...(usePhoto && localReference ? { referenceImage: localReference.url } : {}) };
      const response = await fetch("/api/demo/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: current.signal });
      const body = await response.json(); if (current.signal.aborted) return; if (!response.ok) throw new Error(body.error);
      if (action === "enrich") {
        setProposal({ ...body, contextKey });
        const defaults = ["name", "shortDescription", "longDescription"].filter(key => body.suggestion[key] && !(key === "name" ? form.name : form.info[key as "shortDescription" | "longDescription"]));
        if (body.suggestion.category && body.suggestion.category !== form.category && form.category === "Accessoires") defaults.push("category");
        if (body.suggestion.brand && !form.info.brand) defaults.push("brand");
        if (body.suggestion.imageUrls?.length && !form.info.images.length) defaults.push("imageUrls");
        setChosen(defaults);
        setEnrichmentNotice("Propositions prêtes. Vérifiez-les avant de les appliquer.");
      } else setImageProposal({ image: body.image, contextKey, cost: body.cost });
    } catch (failure) {
      if (!current.signal.aborted) setError(failure instanceof Error ? failure.message : "La requête IA n’a pas abouti.");
      if (action === "enrich") setEnrichmentNotice(current.signal.aborted ? "Préparation annulée. Vos informations sont conservées." : "Préparation interrompue. Vos informations sont conservées ; vous pouvez réessayer.");
    } finally {
      if (controller.current === current) {
        if (current.signal.aborted && action === "enrich") setEnrichmentNotice("Préparation annulée. Vos informations sont conservées.");
        controller.current = null; setWorking(""); setEnrichmentMode(null);
      }
    }
  }
  function applyProposal() {
    if (locked || !proposal || stale || !chosen.length) return;
    const next = structuredClone(form); const suggestion = proposal.suggestion;
    for (const key of chosen) {
      const value = suggestion[key as keyof AiSuggestion];
      if (value === null || value === "") continue;
      if (key === "name") next.name = suggestion.name;
      else if (key === "category" && suggestion.category) next.category = suggestion.category;
      else if (["unitsPerPack", "packsPerCarton", "weightGrams", "priceCents"].includes(key)) {
        const name = key as "unitsPerPack" | "packsPerCarton" | "weightGrams" | "priceCents";
        next[name] = suggestion[name]!;
      } else if (["lengthMm", "widthMm", "heightMm"].includes(key)) {
        const name = key as "lengthMm" | "widthMm" | "heightMm"; next.info[name] = suggestion[name]!;
      } else if (["brand", "ean", "shortDescription", "longDescription"].includes(key)) {
        const name = key as "brand" | "ean" | "shortDescription" | "longDescription"; next.info[name] = suggestion[name];
      } else if (key === "attributes") next.info.attributes = suggestion.attributes;
      else if (key === "imageUrls") {
        const urls = new Set(next.info.images.map(i => i.url));
        next.info.images.push(...suggestion.imageUrls.filter(url => !urls.has(url)).slice(0, 8 - next.info.images.length).map(url => ({ id: crypto.randomUUID(), url, alt: next.name, kind: "remote" as const, reviewed: false, sourceUrl: url, prompt: "" })));
      }
    }
    next.info.sources = [...new Map([...next.info.sources, ...suggestion.sources].map(s => [s.url, s])).values()].slice(0, 12);
    setForm(next); setNet((next.priceCents / 100).toFixed(2)); setGross((priceIncludingTax(next.priceCents, next.info.vatRateBps) / 100).toFixed(2)); setKg(next.weightGrams ? String(next.weightGrams / 1000) : ""); setProposal(null);
  }
  async function upload(files: FileList | File[] | null) {
    if (!files || locked) return;
    const items = [...files];
    if (items.length + form.info.images.length > 8) { setError("La galerie peut contenir au maximum 8 images."); return; }
    setError(""); setWorking("Import des photos…");
    const current = new AbortController(); controller.current = current;
    try {
      for (const file of items) {
        if (file.size > 8 * 1024 * 1024) throw new Error(`${file.name} dépasse 8 Mo.`);
        const mime = file.type || (/\.png$/i.test(file.name) ? "image/png" : /\.webp$/i.test(file.name) ? "image/webp" : "image/jpeg");
        const response = await fetch("/api/demo/media", { method: "POST", headers: { "Content-Type": mime }, body: file, signal: current.signal });
        const image = await response.json(); if (!response.ok) throw new Error(image.error);
        setForm(old => ({ ...old, info: { ...old.info, images: [...old.info.images, { ...image, alt: old.name || "Photo du produit" }] } }));
      }
    } catch (failure) { if (!current.signal.aborted) setError(failure instanceof Error ? failure.message : "Import d’image indisponible."); }
    finally { if (controller.current === current) { controller.current = null; setWorking(""); } }
  }
  function moveImage(index: number, direction: number) {
    const images = [...form.info.images]; const target = index + direction;
    if (target < 0 || target >= images.length) return;
    [images[index], images[target]] = [images[target], images[index]]; info("images", images);
  }

  return <div className="product-editor">
    <div className="product-tabs" role="tablist" aria-label="Onglets de la fiche produit"><button type="button" role="tab" aria-selected="true"><Info size={16} />Infos</button><button type="button" role="tab" aria-selected="false" disabled><Truck size={16} />Diffusion <small>À venir</small></button><button type="button" role="tab" aria-selected="false" disabled><Tags size={16} />Cibles marketplaces <small>À venir</small></button><button type="button" role="tab" aria-selected="false" disabled><FileText size={16} />Notes <small>À venir</small></button></div>
    <form className="product-form" onSubmit={event => { event.preventDefault(); void save("active"); }}>
      <div className="product-scroll" ref={scrolling} role="tabpanel" aria-label="Informations du produit">
        <div className="product-local-status"><span className="badge shipped">Produit local</span><span className={`badge ${form.info.workflowStatus === "draft" ? "ready" : "shipped"}`}>{form.info.workflowStatus === "draft" ? "Brouillon" : "Actif dans le CRM"}</span><span>Aucune diffusion externe à cette étape</span></div>
        {error && <div className="product-error" role="alert"><CircleAlert size={18} /><span>{error}</span></div>}
        <div className={`product-enrich-box${enriching ? " is-enriching" : ""}`} aria-busy={enriching}><div className="product-enrich-title"><Sparkles size={18} /><strong>Identifier le produit et enrichir sa fiche</strong><span>OpenRouter</span></div><div className="product-source-row"><Field label="Lien produit · prioritaire si fourni" hint="Fiche fabricant, fournisseur ou marketplace. Le lien est consulté en priorité lors de la recherche web."><input type="url" readOnly={enriching} value={form.info.sourceUrl} placeholder="https://…" maxLength={2048} onChange={e => info("sourceUrl", e.target.value)} /></Field><button className="button" type="button" disabled={locked || !(form.info.sourceUrl || form.info.lookupReference || form.sku)} onClick={() => void askAi("enrich", "web")}>{enrichmentMode === "web" ? <LoaderCircle className="spin" size={16} aria-hidden="true" /> : <Search size={16} />}<span className="product-ai-button-label"><span style={{ visibility: enrichmentMode === "web" ? "hidden" : "visible" }} aria-hidden={enrichmentMode === "web"}>Enrichir depuis le web</span>{enrichmentMode === "web" && <span>Recherche en cours…</span>}</span></button></div>
          <div className="product-grid two"><Field label="SKU, EAN ou référence pour la recherche"><input readOnly={enriching} value={form.info.lookupReference} onChange={e => info("lookupReference", e.target.value)} maxLength={160} placeholder="Référence fabricant, ASIN, EAN…" /></Field><Field label="Contexte additionnel"><textarea rows={2} readOnly={enriching} value={form.info.researchContext} onChange={e => info("researchContext", e.target.value)} maxLength={3000} placeholder="Famille, matière, usage, fournisseur, informations sûres…" /></Field></div>
          <div className="product-ai-toolbar"><button className="button secondary" type="button" disabled={locked || !(form.name || form.info.lookupReference || form.sku)} onClick={() => void askAi("enrich")}>{enrichmentMode === "compose" ? <LoaderCircle className="spin" size={15} aria-hidden="true" /> : <Sparkles size={15} />}<span className="product-ai-button-label"><span style={{ visibility: enrichmentMode === "compose" ? "hidden" : "visible" }} aria-hidden={enrichmentMode === "compose"}>Proposer les textes</span>{enrichmentMode === "compose" && <span>Textes en cours…</span>}</span></button><span>{status?.keyPresent ? "Clé enregistrée · chaque requête utilise votre compte OpenRouter" : "Clé OpenRouter à configurer"}</span><Link href="/parametres" target="_blank" rel="noreferrer">Configurer l’IA <ExternalLink size={12} /></Link><button className="text-button" type="button" onClick={() => void refreshStatus()} aria-label="Actualiser la configuration IA">Actualiser</button></div>
          <p className="product-ai-notice">L’IA transmet uniquement ces informations produit à OpenRouter. Elle prépare des propositions ; aucun champ n’est remplacé sans votre choix. Prix, EAN, caractéristiques et images restent à vérifier.</p>
          {enriching && <div className="product-enrich-preview" aria-hidden="true"><div className="product-enrich-preview-copy"><strong>Propositions en préparation</strong><span>{enrichmentMode === "web" ? "Recherche des sources et des informations produit." : "Rédaction à partir des informations de votre fiche."}</span></div><div className="product-enrich-skeleton"><span /><span /><span /></div></div>}
        </div>
        <div role="status" aria-live="polite" aria-atomic="true">{working ? <div className="product-working"><LoaderCircle className="spin" size={18} aria-hidden="true" /><span>{working}</span><button className="text-button" type="button" onClick={() => controller.current?.abort()}>Annuler la requête</button></div> : enrichmentNotice && <p className="product-enrich-feedback">{enrichmentNotice}</p>}</div>
        {proposal && <section className="product-proposal"><div className="product-proposal-head"><h3><Sparkles size={17} />Propositions IA à vérifier</h3><span>{proposal.model}{proposal.cost !== null ? ` · ${proposal.cost.toFixed(4)} USD` : ""}</span></div>{stale && <p className="product-error">Les informations de départ ont changé. Relancez une proposition avant de l’appliquer.</p>}
          <div className="product-proposal-list">{proposalFields.filter(key => { const v = proposal.suggestion[key as keyof AiSuggestion]; return v !== null && v !== "" && (!Array.isArray(v) || v.length > 0); }).map(key => {
            const evidence = proposal.suggestion.evidence.find(e => e.field === key);
            return <label className="product-proposal-item" key={key}><input type="checkbox" checked={chosen.includes(key)} disabled={locked || stale} onChange={e => setChosen(old => e.target.checked ? [...old, key] : old.filter(k => k !== key))} /><div><strong>{labels[key]}</strong>{key === "imageUrls" ? <div className="product-proposed-images">{proposal.suggestion.imageUrls.map((url, i) => <img key={url} src={url} alt={`Photo source proposée ${i + 1}`} referrerPolicy="no-referrer" />)}</div> : <p>{display(proposal.suggestion[key as keyof AiSuggestion], key)}</p>}{evidence && <span className="product-evidence">{evidence.note} <a href={evidence.url} target="_blank" rel="noreferrer">Consulter la source <ExternalLink size={11} /></a></span>}</div></label>;
          })}</div>{proposal.suggestion.uncertainties.length > 0 && <div className="product-uncertainties"><strong>Points à compléter ou vérifier</strong><ul>{proposal.suggestion.uncertainties.map((u, i) => <li key={i}>{u}</li>)}</ul></div>}
          {proposal.suggestion.sources.length > 0 && <div className="product-source-links">{proposal.suggestion.sources.map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.title || s.url}<ExternalLink size={12} /></a>)}</div>}
          <div className="product-proposal-actions"><button type="button" className="button secondary" disabled={locked} onClick={() => setProposal(null)}>Écarter la proposition</button><button type="button" className="button" disabled={locked || stale || !chosen.length} onClick={applyProposal}><Check size={15} />Appliquer les champs cochés</button></div></section>}
        <Section title="Identifiants"><div className="product-grid three"><Field label="EAN / GTIN · code-barres"><input inputMode="numeric" maxLength={14} value={form.info.ean} onChange={e => info("ean", e.target.value)} placeholder="À renseigner uniquement s’il est connu" /></Field><Field label="Marque"><input placeholder="À confirmer" maxLength={120} value={form.info.brand} onChange={e => info("brand", e.target.value)} /></Field><Field label="Catégorie"><select value={form.category} onChange={e => field("category", e.target.value as Product["category"])}>{productCategories.map(c => <option key={c}>{c}</option>)}</select></Field></div><div className="product-internal-sku"><Field label="Référence interne SKU" hint="Une référence Jasmin est créée automatiquement si ce champ reste vide."><input value={form.sku} maxLength={40} onChange={e => field("sku", e.target.value)} placeholder="Automatique si vide" /></Field></div></Section>
        <Section title="Contenu" icon={<FileText size={16} />}><div className="product-field-stack"><Field label="Titre du produit · requis pour l’activation"><input value={form.name} maxLength={160} onChange={e => field("name", e.target.value)} placeholder="Un titre précis et lisible" /></Field><Field label="Description courte"><textarea rows={3} maxLength={1000} value={form.info.shortDescription} onChange={e => info("shortDescription", e.target.value)} /></Field><Field label="Description longue"><textarea rows={7} maxLength={16000} value={form.info.longDescription} onChange={e => info("longDescription", e.target.value)} /></Field></div></Section>
        <Section title="Images" icon={<ImagePlus size={16} />}><div className={`product-dropzone ${form.info.images.length ? "with-images" : ""}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void upload(e.dataTransfer.files); }}>
          {!form.info.images.length ? <div className="product-image-empty"><ImagePlus size={36} /><p>Glissez-déposez vos photos ici, importez-les ou préparez un visuel IA.</p><small>PNG, JPEG ou WebP · 8 Mo par image · 8 images maximum</small></div> : <div className="product-gallery">{form.info.images.map((image, i) => <article className="product-image-card" key={image.id}><div className="product-image-preview"><img src={image.url} alt={image.alt || form.name || "Produit"} referrerPolicy="no-referrer" /><span>{i === 0 ? "Principale" : `Image ${i + 1}`}</span></div><span className={`badge ${image.kind === "generated" ? "ready" : "archived"}`}>{image.kind === "generated" ? image.reviewed ? "IA · vérifiée" : "IA · à valider" : image.kind === "remote" ? "Image web" : "Photo importée"}</span><input aria-label={`Description de l’image ${i + 1}`} value={image.alt} maxLength={250} onChange={e => info("images", form.info.images.map((x, j) => j === i ? { ...x, alt: e.target.value } : x))} placeholder="Description de l’image" />{image.kind === "generated" && <label className="product-image-review"><input type="checkbox" checked={image.reviewed} onChange={e => info("images", form.info.images.map((x, j) => j === i ? { ...x, reviewed: e.target.checked } : x))} />J’ai vérifié sa fidélité au produit</label>}<div className="product-image-actions"><button className="icon-button" type="button" disabled={i === 0} onClick={() => moveImage(i, -1)} aria-label={`Remonter l’image ${i + 1}`}><ArrowUp size={14} /></button><button className="icon-button" type="button" disabled={i === form.info.images.length - 1} onClick={() => moveImage(i, 1)} aria-label={`Descendre l’image ${i + 1}`}><ArrowDown size={14} /></button><button className="icon-button" type="button" onClick={() => info("images", form.info.images.filter((_, j) => j !== i))} aria-label={`Retirer l’image ${i + 1}`}><Trash2 size={14} /></button></div></article>)}</div>}
        </div><div className="product-image-buttons"><label className="button secondary product-upload-button"><Upload size={15} />Importer des photos<input type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={locked || form.info.images.length >= 8} onChange={e => { const files = e.currentTarget.files; void upload(files); e.currentTarget.value = ""; }} /></label><a className="button secondary" target="_blank" rel="noreferrer" href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent([form.name, form.info.brand, form.info.lookupReference || form.sku].filter(Boolean).join(" "))}`}><Search size={15} />Chercher sur Google Images</a></div>
          <div className="product-enrich-box product-image-generation"><h4><Sparkles size={16} />Générer un visuel avec l’IA</h4><div className="product-grid image-generation-grid"><Field label="Type d’image"><select value={imageType} onChange={e => setImageType(e.target.value as typeof imageType)}><option value="packshot">Packshot · fond blanc</option><option value="lifestyle">Mise en situation</option><option value="detail">Détail du produit</option></select></Field><Field label="Consignes · facultatif"><textarea rows={3} maxLength={3000} value={imagePrompt} onChange={e => setImagePrompt(e.target.value)} placeholder="Si vide, les consignes utilisent le titre, la marque et les caractéristiques renseignées." /></Field></div><div className="product-generation-controls"><label><input type="checkbox" checked={globalRules} onChange={e => setGlobalRules(e.target.checked)} />Appliquer les règles globales d’image</label>{localReference && <label><input type="checkbox" checked={usePhoto} onChange={e => setUsePhoto(e.target.checked)} />Utiliser la première photo locale comme référence</label>}<button className="button" type="button" disabled={locked || form.info.images.length >= 8 || !(form.name || form.info.lookupReference || form.sku)} onClick={() => void askAi("image")}><Sparkles size={15} />Générer une image</button></div><p className="product-ai-notice">Une image est demandée par clic. La photo de référence, si cochée, est envoyée à OpenRouter. Sans photo, le résultat est illustratif et doit être vérifié. Le visuel reste une proposition avant ajout à la galerie.</p></div>
          {imageProposal && <div className="product-generated-preview"><img src={imageProposal.image.url} alt="Proposition de visuel IA" /><div><strong>Visuel IA à vérifier</strong><p>Contrôlez le produit, le conditionnement, les couleurs et les proportions.</p>{imageProposal.cost !== null && <small>Coût retourné : {imageProposal.cost.toFixed(4)} USD</small>}{imageProposal.contextKey !== contextKey && <p className="product-error">Les informations source ont changé. Relancez une génération pour cette fiche.</p>}<div className="product-image-buttons"><button className="button secondary" type="button" onClick={() => setImageProposal(null)}>Écarter</button><button className="button" type="button" disabled={imageProposal.contextKey !== contextKey || form.info.images.length >= 8} onClick={() => { info("images", [...form.info.images, imageProposal.image]); setImageProposal(null); }}>Ajouter à la galerie</button></div></div></div>}
        </Section>
        <Section title="Prix et stock"><div className="product-grid four"><Field label="Prix TTC du paquet (€)"><input type="number" min="0" max="13000" step="0.01" value={gross} onChange={e => updateGross(e.target.value)} /></Field><Field label="TVA"><select value={form.info.vatRateBps} onChange={e => updateVat(Number(e.target.value))}>{[2000, 1000, 550, 210, 0].map(rate => <option key={rate} value={rate}>{rate / 100} %</option>)}</select></Field><Field label="Prix HT du paquet (€)"><input type="number" min="0" max="10000" step="0.01" value={net} onChange={e => updateNet(e.target.value)} /></Field><Field label="Disponible calculé (paquets)" hint={`${physical} physiques − ${reserved} réservés − ${form.safetyPacks} de sécurité`}><input readOnly value={available} /></Field></div>{!product && <div className="product-internal-sku"><Field label="Inventaire initial (paquets)" hint="Facultatif. Le mouvement initial sera enregistré à la création de la fiche."><input type="number" min="0" max="1000000" step="1" value={initialStock} onChange={e => setInitialStock(Number(e.target.value))} /></Field></div>}{product && <p className="product-help">Le stock physique existant se modifie dans Stocks. Modifier cette fiche ne déplace aucun paquet.</p>}</Section>
        <Section title="Conditionnement"><div className="product-grid three"><Field label="Pièces par paquet"><input type="number" min="0" max="1000000" step="1" value={form.unitsPerPack || ""} onChange={e => field("unitsPerPack", Number(e.target.value))} placeholder="À renseigner" /></Field><Field label="Paquets par carton"><input type="number" min="0" max="1000000" step="1" value={form.packsPerCarton || ""} onChange={e => field("packsPerCarton", Number(e.target.value))} placeholder="À renseigner" /></Field><Field label="Stock de sécurité (paquets)"><input type="number" min="0" max="1000000" step="1" value={form.safetyPacks} onChange={e => field("safetyPacks", Number(e.target.value))} /></Field></div></Section>
        <Section title="Caractéristiques physiques du paquet"><div className="product-grid four"><Field label="Poids (kg)"><input type="number" min="0" max="1000" step="0.001" value={kg} onChange={e => { setKg(e.target.value); field("weightGrams", Math.round(Number(e.target.value) * 1000)); }} placeholder="À renseigner" /></Field>{(["lengthMm", "widthMm", "heightMm"] as const).map((dimension, i) => <Field key={dimension} label={`${["Longueur", "Largeur", "Hauteur"][i]} (cm)`}><input type="number" min="0" max="10000" step="0.1" value={form.info[dimension] ? form.info[dimension] / 10 : ""} onChange={e => info(dimension, Math.round(Number(e.target.value) * 10))} /></Field>)}</div></Section>
        <Section title="Attributs spécifiques"><p className="product-help">Matière, capacité, couleur, usage, référence fabricant… Ces informations serviront ensuite aux adaptations par marketplace.</p><div className="product-attributes">{form.info.attributes.map((a, i) => <div key={i}><input aria-label={`Nom de l’attribut ${i + 1}`} placeholder="Ex. Matière" maxLength={80} value={a.name} onChange={e => info("attributes", form.info.attributes.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /><input aria-label={`Valeur de l’attribut ${i + 1}`} placeholder="Ex. Papier kraft" maxLength={300} value={a.value} onChange={e => info("attributes", form.info.attributes.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} /><button type="button" className="icon-button" onClick={() => info("attributes", form.info.attributes.filter((_, j) => i !== j))} aria-label={`Retirer l’attribut ${i + 1}`}><Trash2 size={16} /></button></div>)}</div><button className="button secondary" type="button" disabled={form.info.attributes.length >= 40} onClick={() => info("attributes", [...form.info.attributes, { name: "", value: "" }])}><Plus size={15} />Ajouter un attribut</button></Section>
        {form.info.sources.length > 0 && <Section title="Sources conservées"><div className="product-source-links">{form.info.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title || source.url}<ExternalLink size={12} /></a>)}</div></Section>}
      </div>
      <footer className="product-footer"><span>Enregistrement local · diffusion et autres onglets à venir</span><div><button className="button secondary" type="button" onClick={onClose}>Annuler</button><button className="button secondary" type="button" disabled={locked} onClick={() => void save("draft")}><Save size={15} />Enregistrer brouillon</button><button className="button" type="submit" disabled={locked}>{busy ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}Enregistrer et activer</button></div></footer>
    </form>
  </div>;
}
