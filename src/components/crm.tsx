"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Box, Boxes, Check, CheckCircle2, ChevronRight, CircleAlert,
  ClipboardList, Download, Flower2, LayoutDashboard, Link2, LoaderCircle, Package, PackageCheck,
  Plus, Printer, RefreshCw, Search, Settings2, ShieldCheck, ShoppingBag, SlidersHorizontal, Truck, Upload, X } from "lucide-react";
import ImportPanel from "./import-panel";
import ProductEditor from "./product-editor";
import AiSettingsPanel from "./ai-settings-panel";
import { channels, type Action, type Order, type OrderStatus, type Product, type State } from "@/lib/model";
import { availablePacks, isActive, orderAmount, reservedPacks, totalPacks, unpreparedPacks } from "@/lib/selectors";

const money = (cents: number) => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const number = (n: number) => n.toLocaleString("fr-FR");
const date = (v: string) => new Date(v).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
const labels: Record<OrderStatus, string> = { ready: "À préparer", review: "À vérifier", preparing: "En préparation", partial: "Partiellement expédiée", shipped: "Expédiée", cancelled: "Annulée", archived: "Historique" };
const nav = [
  { path: "", label: "Vue d’ensemble", icon: LayoutDashboard }, { path: "catalogue", label: "Catalogue", icon: ShoppingBag },
  { path: "stocks", label: "Stocks", icon: Boxes }, { path: "commandes", label: "Commandes", icon: ClipboardList },
  { path: "expeditions", label: "Expéditions", icon: Truck }, { path: "connexions", label: "Connexions", icon: Link2 },
  { path: "parametres", label: "Paramètres", icon: Settings2 }
];
type Modal = { kind: "product"; id?: string } | { kind: "stock"; id: string } | { kind: "order" } |
  { kind: "detail"; id: string } | { kind: "prepare"; id: string } | { kind: "cancel"; id: string } |
  { kind: "dispatch"; id: string } | { kind: "reset" } | { kind: "import"; target: "products" | "stock" };

function Badge({ status }: { status: OrderStatus }) { return <span className={`badge ${status}`}>{labels[status]}</span>; }
function Channel({ name }: { name: string }) { return <span className="channel"><i className={`channel-dot ${name.replaceAll(" ", "-")}`} />{name}</span>; }
function Empty({ children }: { children: ReactNode }) { return <div className="empty"><Box size={30} /><p>{children}</p></div>; }
function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
function Dialog({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const selectors = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]';
    ref.current?.querySelector<HTMLElement>(selectors)?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const items = [...(ref.current?.querySelectorAll<HTMLElement>(selectors) ?? [])];
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, [close]);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
    <div className={`modal ${title.startsWith("Importer") ? "modal-wide" : ""} ${title === "Nouveau produit" || title === "Modifier le produit" ? "product-dialog" : ""}`} ref={ref} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-head"><div><span className="eyebrow">ESPACE DE DÉMONSTRATION</span><h2 id="modal-title">{title}</h2></div><button className="icon-button" aria-label="Fermer" onClick={close}><X size={20} /></button></div>
      {children}
    </div>
  </div>;
}

export default function CRM({ page }: { page: string }) {
  const [state, setState] = useState<State | null>(null);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [channel, setChannel] = useState("all");
  const [modal, setModal] = useState<Modal | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [formError, setFormError] = useState("");
  const [stockUnit, setStockUnit] = useState("pack");
  const [stockQty, setStockQty] = useState(1);
  async function reload() {
    try {
      const response = await fetch("/api/demo/state", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setState(body); setLoadError("");
    } catch (error) { setLoadError(error instanceof Error ? error.message : "Chargement indisponible."); }
  }
  useEffect(() => { void reload(); }, []);
  useEffect(() => { setQuery(""); setFilter("all"); setChannel("all"); setModal(null); }, [page]);
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(null), 7000); return () => clearTimeout(timer); } }, [toast]);
  const close = useRef(() => {});
  close.current = () => { if (!busy) { setModal(null); setFormError(""); } };
  const closeStable = useRef(() => close.current()).current;
  function open(value: Modal) { setFormError(""); setStockQty(1); setStockUnit("pack"); setModal(value); }
  async function mutate(action: Action, message: string, expectedRevision = state?.revision) {
    if (!state || busy) return;
    setBusy(true); setFormError("");
    try {
      const response = await fetch("/api/demo/actions", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: expectedRevision, action }) });
      const result = await response.json();
      if (!response.ok) { if (response.status === 409) await reload(); throw new Error(result.error); }
      setState(result.state); setModal(null); setToast({ text: message });
    } catch (error) {
      const text = error instanceof Error ? error.message : "Enregistrement indisponible.";
      setFormError(text); setToast({ text, error: true });
    } finally { setBusy(false); }
  }
  function form(fn: (data: FormData) => Action, message: string) {
    return (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void mutate(fn(new FormData(event.currentTarget)), message); };
  }
  const name = nav.find(n => n.path === page)?.label ?? "Jasmin";
  const products = state?.products.filter(p => `${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase()) &&
    (filter === "all" || (page === "stocks" ? availablePacks(state!, p) <= 5 : p.category === filter))) ?? [];
  const orders = state?.orders.filter(o => `${o.externalId} ${o.customer} ${o.city}`.toLowerCase().includes(query.toLowerCase()) &&
    (filter === "all" || o.status === filter) && (channel === "all" || o.channel === channel)) ?? [];
  const active = state?.orders.filter(isActive) ?? [];
  const low = state?.products.filter(p => availablePacks(state, p) <= 5) ?? [];
  const pendingShipments = state?.shipments.filter(s => s.status === "prepared") ?? [];
  const submit = (text: string) => <div className="modal-foot"><button type="button" className="button secondary" onClick={closeStable} disabled={busy}>Annuler</button><button className="button" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}{text}</button></div>;
  const modalError = formError && <div className="form-error" role="alert"><CircleAlert size={16} />{formError}</div>;

  function orderTable(list: Order[], compact = false) {
    return <div className="table-scroll"><table><thead><tr><th>Commande</th><th>Canal</th>{!compact && <th>Client fictif</th>}<th>Montant HT</th><th>Statut</th><th><span className="sr-only">Actions</span></th></tr></thead>
      <tbody>{list.map(o => <tr key={o.id}><td><button className="text-button strong" onClick={() => open({ kind: "detail", id: o.id })}>{o.externalId}</button><small>{date(o.createdAt)}</small></td><td><Channel name={o.channel} /></td>{!compact && <td>{o.customer}<small>{o.city} · {o.country}</small></td>}<td className="numeric">{money(orderAmount(o))}</td><td><Badge status={o.status} /></td><td><button className="icon-button" aria-label={`Ouvrir ${o.externalId}`} onClick={() => open({ kind: "detail", id: o.id })}><ChevronRight size={18} /></button></td></tr>)}</tbody></table>{list.length === 0 && <Empty>Aucune commande ne correspond à ces filtres.</Empty>}</div>;
  }

  return <div className="shell">
    <aside className="sidebar"><Link className="brand" href="/"><span className="brand-icon"><Flower2 size={28} strokeWidth={1.5} /></span><span>jasmin<span className="brand-sub">GESTION COMMERCIALE</span></span></Link>
      <div className="workspace-name"><span className="workspace-avatar">JE</span><div><strong>Jasmin Emballage</strong><small>Espace de travail</small></div></div>
      <p className="nav-label">PILOTER MON ACTIVITÉ</p>
      <nav aria-label="Navigation principale">{nav.map(({ path, label, icon: Icon }) => <Link key={path} href={`/${path}`} aria-label={label} title={label} aria-current={page === path ? "page" : undefined} className={`nav-item ${page === path ? "active" : ""}`}><Icon size={19} strokeWidth={1.7} /><span>{label}</span>{path === "commandes" && active.length > 0 && <b>{active.length}</b>}</Link>)}</nav>
      <div className="sidebar-bottom"><span className="local-dot" /><div><strong>Votre entrepôt</strong><small>1 lieu de stockage · paquets</small></div><Package size={19} /></div>
      <div className="sidebar-version">JASMIN CRM <span>v0.3 · local</span></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb">Espace Jasmin <ChevronRight size={14} /><strong>{name}</strong></div><div className="topbar-right"><span className="local-tag"><i />Sur cet ordinateur</span><span className="avatar" title="Espace de démonstration">JE</span></div></header>
      <div className="demo-strip"><span><span className="demo-label">DÉMONSTRATION</span>Produits, clients et commandes fictifs. Aucun échange avec vos plateformes.</span><Link href="/connexions">Voir les connexions <ArrowRight size={14} /></Link></div>
      <main><div className="page-heading"><div><span className="eyebrow">{page === "" ? "VOTRE ACTIVITÉ EN UN REGARD" : "GESTION COMMERCIALE"}</span><h1>{page === "" ? "Bonjour Jasmin" : name}<span className="heading-dot">.</span></h1><p>{({ "": "L’essentiel pour préparer les commandes et garder le stock à jour.", catalogue: "Un catalogue commun, des conditionnements bien définis.", stocks: "Chaque paquet compte. Un seul stock pour tous vos canaux.", commandes: "De la commande à la remise du colis, suivez chaque étape.", expeditions: "Préparez vos colis et essayez le parcours d’expédition.", connexions: "Retrouvez les accès à préparer pour vos canaux de vente.", parametres: "Les réglages et les prochaines étapes de votre espace." } as Record<string, string>)[page]}</p></div>
        <div className="heading-actions">{page === "" && <span className="today">{new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span>}
          {["catalogue", "stocks", "commandes"].includes(page) && <a className="button secondary" href={`/api/demo/export?kind=${page === "commandes" ? "orders" : page === "stocks" ? "stock" : "products"}`}><Download size={16} />Exporter</a>}
          {["catalogue", "stocks"].includes(page) && <button className="button secondary" onClick={() => open({ kind: "import", target: page === "catalogue" ? "products" : "stock" })} disabled={!state}><Upload size={16} />Importer un CSV</button>}
          {page === "catalogue" && <button className="button" onClick={() => open({ kind: "product" })}><Plus size={17} />Nouveau produit</button>}
          {page === "commandes" && <button className="button" onClick={() => open({ kind: "order" })}><Plus size={17} />Commande test</button>}
        </div></div>
      {loadError ? <div className="error-panel"><CircleAlert /><h2>Chargement indisponible</h2><p>{loadError}</p><button className="button" onClick={() => void reload()}><RefreshCw size={16} />Réessayer</button></div> : !state ? <div className="loading"><LoaderCircle className="spin" />Ouverture de votre espace…</div> : <>
      {page === "" && <>
        <div className="kpi-grid">
          <KPI title="Commandes à traiter" value={active.length} icon={<ClipboardList />} detail="Stock réservé, prêtes à avancer" href="/commandes" />
          <KPI title="Colis préparés" value={pendingShipments.length} icon={<PackageCheck />} detail="En attente de remise simulée" href="/expeditions" />
          <KPI title="Références en stock" value={state.products.filter(p => p.physicalPacks > 0).length} icon={<Boxes />} detail={`${number(state.products.reduce((s, p) => s + p.physicalPacks, 0))} paquets physiques au total`} href="/stocks" />
          <KPI title="Stocks à surveiller" value={low.length} icon={<CircleAlert />} detail="5 paquets disponibles ou moins" href="/stocks" warm />
        </div>
        <div className="dashboard-grid"><section className="panel"><div className="panel-head"><div><h2>Commandes en cours <span className="count-pill">{active.length}</span></h2><p>Les prochaines préparations de l’entrepôt</p></div><Link className="text-link" href="/commandes">Tout voir <ArrowRight size={15} /></Link></div>{orderTable(active.slice(0, 5), true)}</section>
          <section className="panel attention-panel"><div className="panel-head"><div><span className="eyebrow">À SUIVRE</span><h2>Votre point d’attention</h2></div><CircleAlert size={21} /></div>
            <div className="attention-item"><div className="attention-icon amber"><Boxes size={19} /></div><div><strong>{low.length} références à surveiller</strong><p>Anticipez les réapprovisionnements.</p><Link href="/stocks">Consulter le stock <ArrowRight size={14} /></Link></div></div>
            <div className="attention-item"><div className="attention-icon blue"><ClipboardList size={19} /></div><div><strong>{state.orders.filter(o => o.status === "review").length} commande à vérifier</strong><p>Validez les données test avant préparation.</p><Link href="/commandes">Ouvrir les commandes <ArrowRight size={14} /></Link></div></div>
            <div className="next-step"><span className="eyebrow">NOTRE PROCHAINE ÉTAPE</span><h3>Relier vos ventes</h3><p>Le socle local est prêt à essayer. Les accès Amazon et Chronopost restent à finaliser.</p><Link className="button secondary" href="/connexions">Suivre les connexions <ArrowRight size={15} /></Link></div>
          </section></div>
        <div className="dashboard-lower"><section className="panel"><div className="panel-head"><div><h2>Activité récente</h2><p>Les actions enregistrées dans cet espace</p></div><span className="soft-label">Enregistré localement</span></div><div className="timeline">{state.events.slice(0, 5).map(e => <div className="timeline-item" key={e.id}><span className="timeline-dot" /><div><p>{e.description}</p><small>{date(e.at)}</small></div></div>)}</div></section>
          <section className="workflow-card"><span className="eyebrow">UN FLUX SIMPLE</span><h2>Du stock au colis.</h2><p>Les réservations protègent le stock pendant la préparation.</p><ol><li><b>1</b>Commande reçue<span>Le stock est réservé</span></li><li><b>2</b>Colis préparé<span>Le physique reste inchangé</span></li><li><b>3</b>Remise confirmée<span>Le stock physique est déduit</span></li></ol></section></div>
      </>}

      {(page === "catalogue" || page === "stocks") && <>
        {page === "stocks" && <div className="stock-summary"><span><i className="local-dot" />Entrepôt principal</span><strong>{number(state.products.reduce((n, p) => n + p.physicalPacks, 0))} <small>paquets physiques</small></strong><strong>{number(state.products.reduce((n, p) => n + reservedPacks(state, p.id), 0))} <small>paquets réservés</small></strong><span className="soft-label">Disponible = physique − réservé − sécurité</span></div>}
        <section className="panel"><div className="toolbar"><label className="search"><Search size={17} /><input aria-label="Rechercher un produit" placeholder="Rechercher un produit, une référence…" value={query} onChange={e => setQuery(e.target.value)} /></label>
          <label className="filter"><SlidersHorizontal size={16} /><select aria-label={page === "stocks" ? "Filtrer le stock" : "Filtrer par catégorie"} value={filter} onChange={e => setFilter(e.target.value)}><option value="all">{page === "stocks" ? "Tout le stock" : "Toutes les catégories"}</option>{page === "stocks" ? <option value="low">À surveiller (≤ 5 disponibles)</option> : ["Gobelets", "Barquettes", "Sacs", "Couverts", "Accessoires"].map(c => <option key={c}>{c}</option>)}</select></label><span className="result-count">{products.length} produits</span></div>
          <div className="table-scroll"><table><thead><tr><th>Produit</th>{page === "catalogue" ? <><th>Conditionnement</th><th>Prix HT / paquet</th><th>Disponible</th></> : <><th>Physique</th><th>Réservé</th><th>Sécurité</th><th>Disponible</th></>}<th>Action</th></tr></thead><tbody>{products.map(p => <tr key={p.id}><td><div className="product-cell"><span className={`product-icon cat-${p.category}`}><Package size={22} strokeWidth={1.4} /></span><div><strong>{p.name || "Brouillon sans titre"}</strong>{p.info?.workflowStatus === "draft" && <span className="badge ready">Brouillon</span>}<small>{p.sku} <span className="sku-divider">/</span> {p.category}</small></div></div></td>
            {page === "catalogue" ? <><td>{p.unitsPerPack} pièces / paquet<small>{p.packsPerCarton} paquets / carton</small></td><td className="numeric">{money(p.priceCents)}</td><td><span className={`stock-number ${availablePacks(state, p) <= 5 ? "low" : ""}`}>{number(availablePacks(state, p))} <small>paq.</small></span></td></> : <><td className="numeric">{number(p.physicalPacks)}</td><td className="numeric muted">{reservedPacks(state, p.id)}</td><td className="numeric muted">{p.safetyPacks}</td><td><span className={`stock-number ${availablePacks(state, p) <= 5 ? "low" : ""}`}>{number(availablePacks(state, p))}</span></td></>}
            <td><button className="row-button" onClick={() => open(page === "catalogue" ? { kind: "product", id: p.id } : { kind: "stock", id: p.id })}>{page === "catalogue" ? "Modifier" : "Mouvement"}<ArrowUpRight size={14} /></button></td></tr>)}</tbody></table>{products.length === 0 && <Empty>Aucun produit ne correspond à votre recherche.</Empty>}</div>
          <div className="panel-footer"><span>{products.length} référence{products.length > 1 ? "s" : ""} affichée{products.length > 1 ? "s" : ""}</span><span>Unité de stock : paquet indivisible</span></div></section>
      </>}

      {page === "commandes" && <section className="panel"><div className="toolbar"><label className="search"><Search size={17} /><input aria-label="Rechercher une commande" placeholder="Référence, client fictif, ville…" value={query} onChange={e => setQuery(e.target.value)} /></label><label className="filter"><select aria-label="Filtrer par canal" value={channel} onChange={e => setChannel(e.target.value)}><option value="all">Tous les canaux</option>{channels.map(c => <option key={c}>{c}</option>)}</select></label><label className="filter"><select aria-label="Filtrer par statut" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Tous les statuts</option>{Object.entries(labels).map(([v, label]) => <option value={v} key={v}>{label}</option>)}</select></label></div>{orderTable(orders)}<div className="panel-footer"><span>{orders.length} commandes affichées</span><span>L’historique ne modifie jamais le stock.</span></div></section>}

      {page === "expeditions" && <><div className="notice"><PackageCheck size={20} /><div><strong>Essayez la préparation et la remise d’un colis</strong><p>La fiche A4 est un document interne. Les étiquettes et le suivi Chronopost seront disponibles après connexion.</p></div></div>
        <section className="panel"><div className="panel-head"><div><h2>File de préparation</h2><p>Commandes avec des paquets restant à mettre en colis</p></div><span className="count-pill">{active.filter(o => o.lines.some(l => unpreparedPacks(state, o, l.id) > 0)).length}</span></div><div className="preparation-list">{active.filter(o => o.lines.some(l => unpreparedPacks(state, o, l.id) > 0)).map(o => <div className="preparation-row" key={o.id}><span className="product-icon"><Box size={22} /></span><div><strong>{o.externalId}</strong><small><Channel name={o.channel} /> · {o.lines.reduce((n, l) => n + unpreparedPacks(state, o, l.id), 0)} paquets à préparer</small></div><Badge status={o.status} /><button className="button secondary" onClick={() => open({ kind: "prepare", id: o.id })}>Préparer un colis <ArrowRight size={15} /></button></div>)}{!active.some(o => o.lines.some(l => unpreparedPacks(state, o, l.id) > 0)) && <Empty>Toutes les commandes ouvertes ont été mises en colis.</Empty>}</div></section>
        <section className="panel space-top"><div className="panel-head"><div><h2>Colis de démonstration</h2><p>Une confirmation déduit les paquets une seule fois.</p></div></div><div className="table-scroll"><table><thead><tr><th>Colis / commande</th><th>Poids et dimensions</th><th>Paquets</th><th>État</th><th>Actions</th></tr></thead><tbody>{state.shipments.map(s => { const o = state.orders.find(o => o.id === s.orderId)!; return <tr key={s.id}><td><strong>COL-{s.id.slice(-8).toUpperCase()}</strong><small>{o.externalId} · {date(s.createdAt)}</small></td><td>{(s.weightGrams / 1000).toLocaleString("fr-FR")} kg<small>{s.lengthCm} × {s.widthCm} × {s.heightCm} cm</small></td><td>{s.allocations.reduce((n, a) => n + a.packs, 0)}</td><td><span className={`badge ${s.status === "prepared" ? "preparing" : s.status === "dispatched" ? "shipped" : "cancelled"}`}>{s.status === "prepared" ? "Préparé" : s.status === "dispatched" ? "Remise simulée" : "Annulé"}</span></td><td><div className="row-actions"><Link className="row-button" href={`/preparation/${s.id}`} target="_blank" rel="noreferrer"><Printer size={15} />Fiche A4</Link>{s.status === "prepared" && <button className="row-button primary-text" onClick={() => open({ kind: "dispatch", id: s.id })}>Simuler la remise <ArrowRight size={14} /></button>}</div></td></tr>; })}</tbody></table>{state.shipments.length === 0 && <Empty>Préparez votre premier colis à partir d’une commande ci-dessus.</Empty>}</div></section></>}

      {page === "connexions" && <><div className="notice"><Link2 size={20} /><div><strong>Les comptes existants restent à relier au CRM</strong><p>Chaque connexion sera activée après vérification de ses droits et d’un premier échange de test.</p></div></div><div className="connections-grid">{[
        ["Amazon", "A", "Profil développeur approuvé", "L’application BAZ Production est en brouillon. Autorisation du compte vendeur et accès aux adresses d’expédition à valider après mise en place de la sécurité."],
        ["Chronopost", "C", "Compte client professionnel existant", "Les étiquettes sont créées dans votre espace client. Accès aux services web, services du contrat et format A4 à confirmer."],
        ["Cdiscount", "C", "Accès vendeur à vérifier", "Identifier les accès disponibles pour les offres, les commandes, les stocks et les retours de suivi."],
        ["RETIF", "R", "Interface à confirmer", "Vérifier le portail vendeur, les accès de connexion et les références produits à rapprocher."],
        ["METRO", "M", "Interface à confirmer", "Valider les accès du compte vendeur et les échanges de commandes, catalogue, stock et suivi."],
        ["Site Jasmin", "J", "Contact développeur disponible", "Définir les échanges avec le développeur de jasminemballage.fr. Le code source n’est pas encore disponible."]
      ].map(([title, letter, subtitle, description]) => <section className="panel connection-card" key={title}><div className="connection-top"><span className={`connection-logo logo-${title.replaceAll(" ", "-")}`}>{letter}</span><span className="badge disconnected">Non connecté</span></div><h2>{title}</h2><strong className="connection-subtitle">{subtitle}</strong><p>{description}</p><div className="connection-foot"><span>Dernier échange : aucun</span><span>À préparer <ArrowUpRight size={14} /></span></div></section>)}</div><p className="footnote">Les accès vendeurs et transport seront ajoutés au moment de leur connexion sécurisée. Aucun identifiant de ces services n’est configuré.</p></>}

      {page === "parametres" && <div className="settings-grid"><AiSettingsPanel /><section className="panel"><div className="panel-head"><div><h2>Votre organisation</h2><p>Les décisions prises ensemble</p></div><Flower2 size={23} /></div><dl className="settings-list"><div><dt>Entreprise</dt><dd>Jasmin Emballage</dd></div><div><dt>Entrepôts</dt><dd>1 entrepôt principal</dd></div><div><dt>Unité de stock</dt><dd>Paquet indivisible</dd></div><div><dt>Conditionnement</dt><dd>Paquets par carton, par produit</dd></div><div><dt>Utilisateurs prévus</dt><dd>2 comptes individuels</dd></div><div><dt>Transporteur prévu</dt><dd>Chronopost · A4 · France et UE</dd></div></dl></section>
        <section className="panel"><div className="panel-head"><div><h2>Avant la mise en service</h2><p>Protections à construire et à vérifier</p></div><ShieldCheck size={22} /></div><div className="checklist">{[["Comptes individuels et double authentification", "À développer"], ["Base de données partagée", "À intégrer"], ["VPS et accès HTTPS", "À préparer"], ["Sauvegardes chiffrées hors serveur", "À préparer"], ["Procédures et preuves de sécurité Amazon", "À établir"]].map(([a, b]) => <div key={a}><span className="pending-circle" /><span>{a}</span><small>{b}</small></div>)}</div></section>
        <section className="panel"><div className="panel-head"><div><h2>Données de démonstration</h2><p>Vos essais sont conservés sur cet ordinateur.</p></div><Download size={21} /></div><div className="settings-body"><p>Exportez le catalogue et les commandes pour consulter les données dans votre tableur, ou conservez une copie complète de vos essais.</p><div className="settings-actions"><a className="button secondary" href="/api/demo/export?kind=products"><Download size={16} />Catalogue CSV</a><a className="button secondary" href="/api/demo/export?kind=orders"><Download size={16} />Commandes CSV</a><a className="button secondary" href="/api/demo/export?kind=backup"><Download size={16} />Copie des donnees JSON</a></div></div></section>
        <section className="panel"><div className="panel-head"><div><h2>Recommencer les essais</h2><p>Retrouver le jeu initial de produits et commandes.</p></div><RefreshCw size={21} /></div><div className="settings-body"><p>La réinitialisation efface les modifications de cet espace de démonstration. Exportez une copie si vous souhaitez les conserver.</p><button className="button danger-outline" onClick={() => open({ kind: "reset" })}><RefreshCw size={16} />Réinitialiser la démonstration</button></div></section></div>}
      </>}
      <footer className="page-footer"><span><Flower2 size={14} />Jasmin · Votre activité, au même endroit.</span><span>Données de démonstration · v0.3</span></footer></main>
    </div>
    {toast && <div className={`toast ${toast.error ? "toast-error" : ""}`} role="status">{toast.error ? <CircleAlert size={19} /> : <CheckCircle2 size={19} />}<span>{toast.text}</span><button aria-label="Masquer le message" className="icon-button" onClick={() => setToast(null)}><X size={16} /></button></div>}
    {state && modal && <Dialog title={modal.kind === "import" ? modal.target === "products" ? "Importer le catalogue" : "Importer un inventaire" : modal.kind === "product" ? modal.id ? "Modifier le produit" : "Nouveau produit" : modal.kind === "stock" ? "Enregistrer un mouvement" : modal.kind === "order" ? "Créer une commande test" : modal.kind === "detail" ? "Détail de la commande" : modal.kind === "prepare" ? "Préparer un colis" : modal.kind === "cancel" ? "Annuler le solde de la commande" : modal.kind === "dispatch" ? "Simuler la remise du colis" : "Réinitialiser les essais"} close={closeStable}>
      {modalError}
      {modal.kind === "import" && <ImportPanel kind={modal.target} state={state} busy={busy} onCommit={mutate} onCancel={closeStable} />}
      {modal.kind === "product" && <ProductEditor product={state.products.find(p => p.id === modal.id)} reserved={modal.id ? reservedPacks(state, modal.id) : 0} busy={busy} onSave={mutate} onClose={closeStable} />}
      {modal.kind === "stock" && (() => { const p = state.products.find(p => p.id === modal.id)!; return <form onSubmit={form(d => ({ type: "adjustStock", productId: p.id, direction: String(d.get("direction")) as "in" | "out", quantity: Number(d.get("quantity")), unit: String(d.get("unit")) as "pack" | "carton", reason: String(d.get("reason")) }), "Mouvement enregistré dans le stock et le journal.")}><div className="form-context"><strong>{p.name || "Brouillon sans titre"}</strong>{p.info?.workflowStatus === "draft" && <span className="badge ready">Brouillon</span>}<small>{p.sku} · {p.physicalPacks} physiques · {reservedPacks(state, p.id)} réservés</small></div><div className="form-grid"><Field label="Type de mouvement"><select name="direction"><option value="in">Entrée de stock</option><option value="out">Sortie / correction</option></select></Field><Field label="Unité saisie"><select name="unit" value={stockUnit} onChange={e => setStockUnit(e.target.value)}><option value="pack">Paquets</option><option value="carton">Cartons ({p.packsPerCarton} paquets)</option></select></Field><Field label="Quantité"><input name="quantity" type="number" min="1" max="1000000" required value={stockQty} onChange={e => setStockQty(Number(e.target.value))} /></Field><div className="conversion"><ArrowDownLeft size={19} /><strong>{number(stockQty * (stockUnit === "carton" ? p.packsPerCarton : 1))} paquets</strong><small>seront ajoutés ou retirés</small></div><div className="span-two"><Field label="Motif du mouvement"><textarea name="reason" required minLength={5} maxLength={250} rows={3} placeholder="Réception, inventaire, casse…" /></Field></div></div>{submit("Enregistrer le mouvement")}</form>; })()}
      {modal.kind === "order" && <form onSubmit={form(d => ({ type: "createOrder", externalId: String(d.get("externalId")), channel: String(d.get("channel")) as Order["channel"], customer: "Client fictif · essai manuel", city: "Ville fictive", country: String(d.get("country")) as Order["country"], lines: [{ productId: String(d.get("productId")), quantity: Number(d.get("quantity")), unit: String(d.get("unit")) as "pack" | "carton" }] }), "Commande test enregistrée et stock réservé.")}><p className="form-note">Cette commande utilise un destinataire fictif. Sa création réserve le stock disponible.</p><div className="form-grid"><Field label="Référence de commande"><input name="externalId" required maxLength={80} defaultValue={`TEST-${Date.now().toString().slice(-7)}`} /></Field><Field label="Canal simulé"><select name="channel">{channels.map(c => <option key={c}>{c}</option>)}</select></Field><div className="span-two"><Field label="Produit"><select name="productId">{state.products.filter(p => p.info?.workflowStatus !== "draft").map(p => <option value={p.id} key={p.id}>{p.sku} · {p.name} · {availablePacks(state, p)} paquets disponibles</option>)}</select></Field></div><Field label="Quantité"><input name="quantity" type="number" min="1" max="1000000" defaultValue={1} required /></Field><Field label="Conditionnement vendu"><select name="unit"><option value="pack">Paquet</option><option value="carton">Carton complet</option></select></Field><Field label="Pays de test"><select name="country">{["FR", "BE", "DE", "ES", "IT", "NL", "LU"].map(c => <option key={c}>{c}</option>)}</select></Field></div>{submit("Créer et réserver")}</form>}
      {modal.kind === "detail" && (() => { const o = state.orders.find(o => o.id === modal.id)!; return <><div className="order-detail-head"><div><h3>{o.externalId}</h3><Channel name={o.channel} /></div><Badge status={o.status} /></div><div className="detail-info"><span>{o.customer}</span><span>{o.city} · {o.country}</span><span>{date(o.createdAt)}</span></div><div className="table-scroll"><table><thead><tr><th>Produit</th><th>Commandé</th><th>Expédié</th></tr></thead><tbody>{o.lines.map(l => { const p = state.products.find(p => p.id === l.productId)!; return <tr key={l.id}><td><strong>{p.name || "Brouillon sans titre"}</strong>{p.info?.workflowStatus === "draft" && <span className="badge ready">Brouillon</span>}<small>{p.sku}</small></td><td>{totalPacks(l)} paquets<small>{l.quantity} × {l.packsPerSale} paquet(s)</small></td><td>{l.shippedPacks} paquets</td></tr>; })}</tbody></table></div><div className="order-total"><span>Total HT</span><strong>{money(orderAmount(o))}</strong></div>{o.status === "archived" && <p className="form-note">Commande historique en consultation. Aucun mouvement de stock ni action d’expédition.</p>}{o.status === "review" && <p className="form-note">Commande test à vérifier : le stock n’est pas encore réservé.</p>}<div className="modal-foot">{!["shipped", "archived", "cancelled"].includes(o.status) && <button className="button danger-outline" disabled={busy} onClick={() => open({ kind: "cancel", id: o.id })}>Annuler le solde</button>}{o.status === "review" && <button className="button" disabled={busy} onClick={() => void mutate({ type: "releaseOrder", id: o.id }, "Commande test validée et stock réservé.")}>Valider les données test <Check size={16} /></button>}{isActive(o) && o.lines.some(l => unpreparedPacks(state, o, l.id) > 0) && <button className="button" onClick={() => open({ kind: "prepare", id: o.id })}>Préparer un colis <ArrowRight size={16} /></button>}</div></>; })()}
      {modal.kind === "prepare" && (() => { const o = state.orders.find(o => o.id === modal.id)!; const lines = o.lines.filter(l => unpreparedPacks(state, o, l.id) > 0); return <form onSubmit={form(d => ({ type: "prepareShipment", orderId: o.id, weightGrams: Math.round(Number(d.get("kg")) * 1000), lengthCm: Number(d.get("length")), widthCm: Number(d.get("width")), heightCm: Number(d.get("height")), allocations: lines.map(l => ({ lineId: l.id, packs: Number(d.get(l.id)) })).filter(a => a.packs > 0) }), "Colis préparé. La fiche A4 est disponible dans Expéditions.")}><div className="form-context"><strong>{o.externalId}</strong><small>Choisissez les paquets à inclure. Vous pouvez préparer plusieurs colis.</small></div>{lines.map(l => { const p = state.products.find(p => p.id === l.productId)!; return <div className="parcel-line" key={l.id}><div><strong>{p.name}</strong><small>{unpreparedPacks(state, o, l.id)} paquets restant à préparer</small></div><input name={l.id} aria-label={`Paquets de ${p.name}`} type="number" min="0" max={unpreparedPacks(state, o, l.id)} defaultValue={unpreparedPacks(state, o, l.id)} required /></div>; })}<div className="form-grid space-top"><Field label="Poids total (kg)"><input type="number" name="kg" min="0.001" max="1000" step="0.001" defaultValue={3} required /></Field><Field label="Longueur (cm)"><input type="number" name="length" min="1" max="300" defaultValue={40} required /></Field><Field label="Largeur (cm)"><input type="number" name="width" min="1" max="300" defaultValue={30} required /></Field><Field label="Hauteur (cm)"><input type="number" name="height" min="1" max="300" defaultValue={25} required /></Field></div><p className="form-note">La préparation conserve le stock réservé. Aucune étiquette de transport n’est achetée.</p>{submit("Préparer le colis test")}</form>; })()}
      {modal.kind === "cancel" && <form onSubmit={form(() => ({ type: "cancelOrder", id: modal.id }), "Solde annulé et réservations restantes libérées.")}><p className="confirm-text">Les paquets restant à expédier seront libérés et les colis encore préparés seront annulés. Les sorties déjà confirmées seront conservées.</p>{submit("Confirmer l’annulation")}</form>}
      {modal.kind === "dispatch" && <form onSubmit={form(() => ({ type: "dispatchShipment", id: modal.id }), "Remise simulée : le stock physique a été déduit.")}><p className="confirm-text">Cette simulation retire du stock physique les paquets de ce colis et libère leurs réservations. Elle n’envoie aucun suivi au canal de vente.</p>{submit("Confirmer la remise simulée")}</form>}
      {modal.kind === "reset" && <form onSubmit={form(() => ({ type: "reset" }), "Le jeu de démonstration initial a été restauré.")}><p className="confirm-text">Tous les produits ajoutés, mouvements et colis de test seront effacés. Les 12 produits et 8 commandes du jeu initial seront restaurés.</p><label className="confirm-check"><input type="checkbox" required />Je confirme la suppression de mes essais.</label>{submit("Réinitialiser")}</form>}
    </Dialog>}
  </div>;
}

function KPI({ title, value, icon, detail, href, warm = false }: { title: string; value: number; icon: ReactNode; detail: string; href: string; warm?: boolean }) {
  return <Link href={href} className={`kpi ${warm ? "kpi-warm" : ""}`}><div className="kpi-top"><span>{title}</span><span className="kpi-icon">{icon}</span></div><strong>{number(value)}</strong><div className="kpi-bottom"><span>{detail}</span><ArrowUpRight size={15} /></div></Link>;
}
