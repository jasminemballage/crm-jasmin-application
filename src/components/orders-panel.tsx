"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AlarmClock, ArrowDownUp, ChevronLeft, ChevronRight, CircleAlert, ClipboardCheck, Eye, Globe, Layers3, Package, Search, ShoppingBag, Store, Truck, X } from "lucide-react";
import { type Order, type OrderStatus, type State } from "@/lib/model";
import { getOrderDetails, orderDue, orderTotal } from "@/lib/order-details";
import { isActive } from "@/lib/selectors";

export const orderStatusLabels: Record<OrderStatus, string> = { review: "À accepter", ready: "À expédier", preparing: "En préparation", partial: "Expédition partielle", shipped: "Expédiée", cancelled: "Annulée", archived: "Historique" };
export const orderMoney = (cents: number) => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
export const orderDate = (value: string | null | undefined, time = false) => value ? new Date(value).toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric", ...(time ? { hour: "2-digit", minute: "2-digit" } : {}) }) : "Non transmis";
function parisDay(value: string) { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value)); return ["year", "month", "day"].map(type => parts.find(p => p.type === type)?.value).join("-"); }
export function OrderBadge({ status }: { status: OrderStatus }) { return <span className={`badge order-badge ${status}`}>{orderStatusLabels[status]}</span>; }
export function OrderSource({ channel }: { channel: string }) { const key = channel.toLowerCase().replaceAll(" ", "-"); return <span className={`order-source ${key}`}>{channel === "Site Jasmin" ? <Globe size={12} aria-hidden="true" /> : <Store size={12} aria-hidden="true" />}{channel === "Site Jasmin" ? "Site" : channel}</span>; }

type Props = { state: State; onOpenOrder: (id: string) => void; onChronopost: (id: string) => void; onCreateOrder: () => void };
type Filter = "all" | "review" | "toShip" | "shipped" | "cancelled" | "archived" | "late";
const filters: { key: Exclude<Filter, "late">; label: string }[] = [{ key: "all", label: "Toutes" }, { key: "review", label: "À accepter" }, { key: "toShip", label: "À expédier" }, { key: "shipped", label: "Expédiées" }, { key: "cancelled", label: "Annulées" }, { key: "archived", label: "Historique" }];
const sources = ["all", "RETIF", "METRO", "Amazon", "Cdiscount", "Site Jasmin"];
function Metric({ label, value, icon, tone, active, onClick, hint }: { label: string; value: ReactNode; icon: ReactNode; tone: string; active?: boolean; onClick?: () => void; hint?: string }) {
  const content = <><span className={`orders-metric-icon ${tone}`}>{icon}</span><span><strong>{value}</strong><span>{label}</span>{hint && <small>{hint}</small>}</span></>;
  return onClick ? <button type="button" className={`orders-metric${active ? " is-active" : ""}`} onClick={onClick} aria-pressed={active}>{content}</button> : <div className="orders-metric">{content}</div>;
}

export default function OrdersPanel({ state, onOpenOrder, onChronopost, onCreateOrder }: Props) {
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [sort, setSort] = useState("recent");
  const [size, setSize] = useState(25);
  const [page, setPage] = useState(1);
  const today = parisDay(new Date().toISOString());
  const late = (order: Order) => { const due = orderDue(order); return (isActive(order) || order.status === "review") && !!due && parisDay(due) < today; };
  const matchesStatus = (order: Order, filter: Filter) => filter === "all" || (filter === "toShip" ? isActive(order) : filter === "late" ? late(order) : order.status === filter);
  const scoped = state.orders.filter(order => channel === "all" || order.channel === channel);
  const invalidDates = !!from && !!to && from > to;
  const invalidAmounts = min !== "" && max !== "" && Number(min) > Number(max);
  const filtered = useMemo(() => scoped.filter(order => {
    const details = getOrderDetails(order, state.products);
    const day = parisDay(details.purchasedAt);
    const term = query.trim().toLocaleLowerCase("fr-FR");
    const text = `${order.externalId} ${order.customer} ${details.recipient.email ?? ""}`.toLocaleLowerCase("fr-FR");
    return !invalidDates && !invalidAmounts && matchesStatus(order, status) && text.includes(term) && (!from || day >= from) && (!to || day <= to) && (min === "" || details.total.cents >= Number(min) * 100) && (max === "" || details.total.cents <= Number(max) * 100);
  }).sort((a, b) => sort === "amount-desc" ? orderTotal(b).cents - orderTotal(a).cents : sort === "amount-asc" ? orderTotal(a).cents - orderTotal(b).cents : sort === "oldest" ? getOrderDetails(a, state.products).purchasedAt.localeCompare(getOrderDetails(b, state.products).purchasedAt) : getOrderDetails(b, state.products).purchasedAt.localeCompare(getOrderDetails(a, state.products).purchasedAt)), [state, channel, status, query, from, to, min, max, sort, today]); // Local filters: no remote request or delayed search.
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const currentPage = Math.min(page, pages);
  const rows = filtered.slice((currentPage - 1) * size, currentPage * size);
  const todays = state.orders.filter(order => parisDay(getOrderDetails(order, state.products).purchasedAt) === today);
  const todayTotals = todays.reduce((totals, order) => { const total = orderTotal(order); totals[total.taxBasis] += total.cents; return totals; }, { HT: 0, TTC: 0 });
  const todaySummary = (["HT", "TTC"] as const).filter(basis => todays.some(order => orderTotal(order).taxBasis === basis)).map(basis => `${orderMoney(todayTotals[basis])} ${basis}`).join(" · ") || "Aucun achat aujourd’hui";
  const hasFilters = channel !== "all" || status !== "all" || !!query || !!from || !!to || min !== "" || max !== "";
  function change(action: () => void) { action(); setPage(1); }
  function reset() { change(() => { setChannel("all"); setStatus("all"); setQuery(""); setFrom(""); setTo(""); setMin(""); setMax(""); }); }

  return <div className="orders-workspace">
    <div className="orders-metrics" aria-label="Résumé des commandes">
      <Metric label="À accepter" value={state.orders.filter(o => o.status === "review").length} icon={<ClipboardCheck size={21} />} tone="sand" active={status === "review"} onClick={() => change(() => setStatus(status === "review" ? "all" : "review"))} />
      <Metric label="À expédier" value={state.orders.filter(isActive).length} icon={<Truck size={21} />} tone="blue" active={status === "toShip"} onClick={() => change(() => setStatus(status === "toShip" ? "all" : "toShip"))} />
      <Metric label="En retard" value={state.orders.filter(late).length} icon={<AlarmClock size={21} />} tone="red" hint="Échéances renseignées" active={status === "late"} onClick={() => change(() => setStatus(status === "late" ? "all" : "late"))} />
      <Metric label="Incidents" value="—" icon={<CircleAlert size={21} />} tone="purple" hint="Données non transmises" />
      <Metric label="Aujourd’hui" value={todays.length} icon={<ShoppingBag size={21} />} tone="green" hint={todaySummary} />
    </div>
    <section className="panel orders-panel" aria-label="Liste des commandes">
      <div className="orders-channels" aria-label="Filtrer par canal">{sources.map(source => <button type="button" key={source} className={channel === source ? "is-active" : ""} aria-pressed={channel === source} onClick={() => change(() => setChannel(source))}>{source === "all" ? <Layers3 size={15} /> : source === "Site Jasmin" ? <Globe size={15} /> : <Store size={15} />}<span>{source === "all" ? "Toutes" : source === "Site Jasmin" ? "Site" : source}</span><b>{state.orders.filter(order => source === "all" || order.channel === source).length}</b></button>)}</div>
      <div className="orders-statuses" aria-label="Filtrer par statut ; livraisons et remboursements non transmis">{filters.map(filter => <button type="button" key={filter.key} className={status === filter.key ? "is-active" : ""} aria-pressed={status === filter.key} onClick={() => change(() => setStatus(filter.key))}>{filter.label}<span>{scoped.filter(o => matchesStatus(o, filter.key)).length}</span></button>)}<button type="button" disabled title="Le statut de livraison n’est pas transmis par les connecteurs">Livrées <span>—</span></button><button type="button" disabled title="Les remboursements ne sont pas transmis par les connecteurs">Remboursées <span>—</span></button>{status === "late" && <button type="button" className="is-active" aria-pressed="true" onClick={() => change(() => setStatus("all"))}>En retard <X size={12} /></button>}</div>
      <div className="orders-filters">
        <label className="orders-search"><Search size={16} aria-hidden="true" /><input aria-label="Rechercher par référence, client ou email" value={query} placeholder="N° de commande, client, e-mail…" onChange={e => change(() => setQuery(e.target.value))} />{query && <button type="button" aria-label="Effacer la recherche" onClick={() => change(() => setQuery(""))}><X size={14} /></button>}</label>
        <div className="orders-filter-group"><label>Du<input type="date" aria-label="Date d’achat minimum" value={from} max={to || undefined} onChange={e => change(() => setFrom(e.target.value))} /></label><label>au<input type="date" aria-label="Date d’achat maximum" value={to} min={from || undefined} onChange={e => change(() => setTo(e.target.value))} /></label></div>
        <div className="orders-filter-group"><span>Montant</span><input type="number" aria-label="Montant minimum en euros" min="0" step="0.01" placeholder="min €" value={min} onChange={e => change(() => setMin(e.target.value))} /><input type="number" aria-label="Montant maximum en euros" min="0" step="0.01" placeholder="max €" value={max} onChange={e => change(() => setMax(e.target.value))} /></div>
        <label className="orders-sort"><ArrowDownUp size={14} aria-hidden="true" /><select aria-label="Trier les commandes" value={sort} onChange={e => change(() => setSort(e.target.value))}><option value="recent">Plus récentes</option><option value="oldest">Plus anciennes</option><option value="amount-desc">Montant décroissant</option><option value="amount-asc">Montant croissant</option></select></label>
        <select aria-label="Commandes par page" className="orders-page-size" value={size} onChange={e => change(() => setSize(Number(e.target.value)))}>{[25, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}</select>
      </div>
      {(invalidDates || invalidAmounts) && <p className="orders-filter-error" role="alert">{invalidDates ? "La date de début doit précéder la date de fin." : "Le montant minimum doit être inférieur au maximum."}</p>}
      <div className="orders-table-scroll"><table className="orders-table"><thead><tr><th>Source</th><th>N° de commande</th><th>Date d’achat</th><th>Client</th><th>Articles</th><th>Échéance</th><th>Statut</th><th className="numeric">Total</th><th><span className="orders-sr-only">Actions</span></th></tr></thead><tbody>{rows.map(order => { const details = getOrderDetails(order, state.products); const isLate = late(order); return <tr key={order.id}>
        <td><OrderSource channel={order.channel} /><small>{details.fulfillment ?? "Mode non transmis"}</small></td>
        <td><button type="button" className="orders-open" onClick={() => onOpenOrder(order.id)} aria-label={`Ouvrir la commande ${order.externalId}`}>{order.externalId}</button></td>
        <td><span>{orderDate(details.purchasedAt)}</span><small>{new Date(details.purchasedAt).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })}</small></td>
        <td><span className="orders-client">{order.customer || "Non transmis"}</span><small>{order.city} · {order.country}</small></td>
        <td><span>{details.articleCount} article{details.articleCount > 1 ? "s" : ""}</span><small className="orders-article-title">{details.lines.map(line => line.title ?? line.sku ?? "Produit non transmis").join(" · ")}</small></td>
        <td className={isLate ? "orders-overdue" : ""}>{details.dueAt ? <><span>{orderDate(details.dueAt)}</span><small>{isLate ? "En retard" : "Date limite d’expédition"}</small></> : <span className="orders-muted">Non transmise</span>}</td>
        <td><OrderBadge status={order.status} /></td><td className="numeric"><strong>{orderMoney(details.total.cents)}</strong><small>{details.total.taxBasis}</small></td>
        <td><div className="orders-row-actions"><button type="button" className="orders-chrono" onClick={() => onChronopost(order.id)} aria-label={`Étiquette Chronopost pour ${order.externalId}`}><Truck size={14} />Chronopost</button><button type="button" className="icon-button" onClick={() => onOpenOrder(order.id)} aria-label={`Voir le détail de ${order.externalId}`}><Eye size={16} /></button></div></td>
      </tr>; })}</tbody></table></div>
      {rows.length === 0 && <div className="orders-empty"><Package size={30} /><strong>{state.orders.length ? "Aucune commande ne correspond" : "Aucune commande pour le moment"}</strong><p>{state.orders.length ? "Ajustez les filtres pour retrouver vos commandes." : "Créez une commande test pour découvrir la préparation."}</p><button type="button" className="button secondary" onClick={hasFilters ? reset : onCreateOrder}>{hasFilters ? "Effacer les filtres" : "Créer une commande test"}</button></div>}
      <div className="orders-pagination"><span>{filtered.length ? `${(currentPage - 1) * size + 1}–${Math.min(currentPage * size, filtered.length)} sur ${filtered.length}` : "0 commande"}{hasFilters && <button type="button" onClick={reset}>Réinitialiser les filtres</button>}</span><nav aria-label="Pagination des commandes"><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} aria-label="Page précédente"><ChevronLeft size={16} /></button><span>Page {currentPage} / {pages}</span><button type="button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)} aria-label="Page suivante"><ChevronRight size={16} /></button></nav></div>
      <p className="orders-data-note">Données de démonstration · Horaires de Paris · HT ou TTC selon les données reçues. Les informations absentes restent signalées.</p>
    </section>
  </div>;
}
