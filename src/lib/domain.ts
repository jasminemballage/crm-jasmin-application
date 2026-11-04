import { randomUUID } from "node:crypto";
import { Action, Order, Product, Shipment, State, stateSchema, productInput } from "./model";
import { totalPacks, isActive, reservedPacks, availablePacks, unpreparedPacks } from "./selectors";
import { planCatalogImport, planStockImport } from "./import-plan";
export { totalPacks, isActive, reservedPacks, availablePacks, unpreparedPacks, orderAmount } from "./selectors";

export class DomainError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}
const id = (prefix: string) => `${prefix}-${randomUUID()}`;
const getProduct = (s: State, key: string) => {
  const p = s.products.find(p => p.id === key);
  if (!p) throw new DomainError("Produit introuvable.", 404);
  return p;
};
const getOrder = (s: State, key: string) => {
  const order = s.orders.find(o => o.id === key);
  if (!order) throw new DomainError("Commande introuvable.", 404);
  return order;
};
function record(s: State, type: string, targetId: string, description: string, productId?: string, deltaPacks?: number) {
  s.events.unshift({ id: id("evt"), at: new Date().toISOString(), type, targetId, description,
    ...(productId ? { productId, deltaPacks } : {}) });
}
function checkReservation(s: State, o: Order) {
  const needs = new Map<string, number>();
  for (const l of o.lines) needs.set(l.productId, (needs.get(l.productId) ?? 0) + totalPacks(l) - l.shippedPacks);
  for (const [key, qty] of needs) {
    const p = getProduct(s, key);
    if (p.info?.workflowStatus === "draft") throw new DomainError(`${p.sku} : activez la fiche avant de réserver une nouvelle commande.`);
    if (qty > availablePacks(s, p)) throw new DomainError(`${p.sku} : ${qty} paquets demandés, ${availablePacks(s, p)} disponibles.`);
  }
}
function updateStatus(s: State, o: Order) {
  if (o.lines.every(l => l.shippedPacks === totalPacks(l))) o.status = "shipped";
  else if (o.lines.some(l => l.shippedPacks > 0)) o.status = "partial";
  else o.status = s.shipments.some(x => x.orderId === o.id && x.status === "prepared") ? "preparing" : "ready";
}

/** All mutations happen on a copy under the repository lock. A thrown error commits nothing. */
export function applyAction(s: State, action: Exclude<Action, { type: "reset" }>): string {
  switch (action.type) {
    case "saveProductInfo": {
      const previous = action.id ? getProduct(s, action.id) : undefined;
      const sku = (action.product.sku || previous?.sku || `JAS-${randomUUID().slice(0, 12)}`).toUpperCase();
      if (s.products.some(p => p.sku.toUpperCase() === sku && p.id !== previous?.id)) throw new DomainError("Cette référence existe déjà.");
      const data = { ...action.product, sku };
      if (data.info.workflowStatus === "active") {
        if (!productInput.safeParse(data).success) throw new DomainError("Pour activer la fiche, renseignez le titre, les pièces par paquet, les paquets par carton et un poids positif.");
        if (data.info.images.some(image => image.kind === "generated" && !image.reviewed))
          throw new DomainError("Vérifiez les visuels IA et cochez leur validation avant d’activer la fiche.");
      }
      if (previous) {
        if (action.initialPhysicalPacks !== undefined) throw new DomainError("Le stock physique d’un produit existant se modifie dans Stocks.");
        Object.assign(previous, data);
        record(s, "product", previous.id, `Fiche ${sku} enregistrée · ${data.info.workflowStatus === "draft" ? "brouillon" : "active localement"}.`);
        return previous.id;
      }
      const product: Product = { ...data, id: id("prd"), physicalPacks: action.initialPhysicalPacks ?? 0 };
      s.products.push(product);
      record(s, "product", product.id, `Fiche ${sku} créée · ${data.info.workflowStatus === "draft" ? "brouillon" : "active localement"}.`);
      if (product.physicalPacks) record(s, "stock", product.id, `${sku} · inventaire initial de ${product.physicalPacks} paquets.`, product.id, product.physicalPacks);
      return product.id;
    }
    case "importProducts": {
      const plan = planCatalogImport(s, action.rows);
      if (plan.errors.length) throw new DomainError(`Import refusé · ${plan.errors[0].sku} : ${plan.errors[0].message}`);
      for (const row of plan.entries) {
        if (row.operation === "unchanged") continue;
        applyAction(s, row.before ? { type: "updateProduct", id: row.before.id, product: row.after } : { type: "createProduct", product: row.after });
      }
      if (plan.created || plan.updated) record(s, "import", "catalogue", `Import catalogue · ${plan.created} créations, ${plan.updated} mises à jour, ${plan.unchanged} inchangés.`);
      return "catalogue";
    }
    case "importStock": {
      const plan = planStockImport(s, action.rows);
      if (plan.errors.length) throw new DomainError(`Import refusé · ${plan.errors[0].sku} : ${plan.errors[0].message}`);
      for (const row of plan.entries) {
        if (row.delta === 0) continue;
        getProduct(s, row.productId).physicalPacks = row.after;
        record(s, "stock", row.productId, `${row.sku} · inventaire ${row.before} → ${row.after} paquets · ${action.reason}`, row.productId, row.delta);
      }
      if (plan.updated) record(s, "import", "stocks", `Import inventaire · ${plan.updated} stocks ajustés, ${plan.unchanged} inchangés · ${action.reason}`);
      return "stocks";
    }
    case "createProduct":
    case "updateProduct": {
      const sku = action.product.sku.toUpperCase();
      const existing = action.type === "updateProduct" ? getProduct(s, action.id) : undefined;
      if (s.products.some(p => p.sku.toUpperCase() === sku && p.id !== existing?.id)) throw new DomainError("Cette référence existe déjà.");
      if (existing) {
        Object.assign(existing, action.product, { sku });
        record(s, "product", existing.id, `Fiche ${sku} mise à jour.`);
        return existing.id;
      }
      const p: Product = { ...action.product, sku, id: id("prd"), physicalPacks: 0 };
      s.products.push(p);
      record(s, "product", p.id, `Fiche ${sku} créée. Stock initial : 0 paquet.`);
      return p.id;
    }
    case "adjustStock": {
      const p = getProduct(s, action.productId);
      if (action.unit === "carton" && p.packsPerCarton === 0) throw new DomainError("Renseignez le nombre de paquets par carton avant ce mouvement.");
      const delta = action.quantity * (action.unit === "carton" ? p.packsPerCarton : 1) * (action.direction === "in" ? 1 : -1);
      if (p.physicalPacks + delta < reservedPacks(s, p.id)) throw new DomainError("Ce retrait consommerait du stock déjà réservé.");
      p.physicalPacks += delta;
      record(s, "stock", p.id, `${p.sku} : ${delta > 0 ? "+" : ""}${delta} paquets · ${action.reason}`, p.id, delta);
      return p.id;
    }
    case "createOrder": {
      const existing = s.orders.find(o => o.channel === action.channel && o.externalId.toLowerCase() === action.externalId.toLowerCase());
      if (existing) return existing.id; // Re-importing the same channel/reference cannot reserve twice.
      const order: Order = { id: id("ord"), externalId: action.externalId, channel: action.channel,
        createdAt: new Date().toISOString(), customer: action.customer, city: action.city, country: action.country,
        status: "ready", lines: action.lines.map(line => {
          const p = getProduct(s, line.productId);
          const factor = line.unit === "carton" ? p.packsPerCarton : 1;
          return { id: id("line"), productId: p.id, quantity: line.quantity, packsPerSale: factor,
            unitPriceCents: p.priceCents * factor, shippedPacks: 0 };
        }) };
      checkReservation(s, order);
      s.orders.unshift(order);
      record(s, "order", order.id, `${order.externalId} · commande test créée et stock réservé.`);
      return order.id;
    }
    case "releaseOrder": {
      const o = getOrder(s, action.id);
      if (o.status !== "review") throw new DomainError("Cette commande n’est pas en attente de validation.");
      checkReservation(s, o);
      o.status = "ready";
      record(s, "order", o.id, `${o.externalId} · données fictives validées, stock réservé.`);
      return o.id;
    }
    case "cancelOrder": {
      const o = getOrder(s, action.id);
      if (o.status === "cancelled") return o.id;
      if (["shipped", "archived"].includes(o.status)) throw new DomainError("Une commande close ne peut plus être annulée.");
      o.status = "cancelled";
      for (const sh of s.shipments.filter(x => x.orderId === o.id && x.status === "prepared")) sh.status = "cancelled";
      record(s, "order", o.id, `${o.externalId} · solde annulé, réservations restantes libérées.`);
      return o.id;
    }
    case "prepareShipment": {
      const o = getOrder(s, action.orderId);
      if (!isActive(o)) throw new DomainError("Cette commande n’est pas ouverte à la préparation.");
      if (new Set(action.allocations.map(a => a.lineId)).size !== action.allocations.length)
        throw new DomainError("Une ligne ne peut apparaître deux fois dans le même colis.");
      for (const a of action.allocations) {
        if (!o.lines.some(l => l.id === a.lineId) || a.packs > unpreparedPacks(s, o, a.lineId))
          throw new DomainError("Quantité supérieure au solde disponible pour ce colis.");
      }
      const shipment: Shipment = { ...action, id: id("col"), createdAt: new Date().toISOString(), dispatchedAt: null,
        status: "prepared" };
      s.shipments.unshift(shipment);
      updateStatus(s, o);
      record(s, "shipment", shipment.id, `${o.externalId} · colis de démonstration préparé.`);
      return shipment.id;
    }
    case "dispatchShipment": {
      const sh = s.shipments.find(x => x.id === action.id);
      if (!sh) throw new DomainError("Colis introuvable.", 404);
      if (sh.status === "dispatched") return sh.id;
      if (sh.status !== "prepared") throw new DomainError("Ce colis a été annulé.");
      const o = getOrder(s, sh.orderId);
      if (!isActive(o)) throw new DomainError("Cette commande ne peut plus être expédiée.");
      for (const a of sh.allocations) {
        const l = o.lines.find(l => l.id === a.lineId)!;
        const p = getProduct(s, l.productId);
        p.physicalPacks -= a.packs;
        l.shippedPacks += a.packs;
        record(s, "stock", sh.id, `${p.sku} · sortie simulée pour ${o.externalId}`, p.id, -a.packs);
      }
      sh.status = "dispatched";
      sh.dispatchedAt = new Date().toISOString();
      updateStatus(s, o);
      record(s, "shipment", sh.id, `${o.externalId} · remise simulée, stock déduit une seule fois.`);
      return sh.id;
    }
  }
}

export function validateState(input: unknown): State {
  const s = stateSchema.parse(input);
  for (const p of s.products) if (p.info?.workflowStatus !== "draft" && !productInput.safeParse(p).success)
    throw new DomainError("Une fiche active contient des données obligatoires invalides.");
  const unique = (values: string[]) => new Set(values).size === values.length;
  if (!unique(s.products.map(p => p.id)) || !unique(s.products.map(p => p.sku.toUpperCase())) ||
      !unique(s.orders.map(o => o.id)) || !unique(s.orders.map(o => `${o.channel}:${o.externalId.toLowerCase()}`)) ||
      !unique(s.shipments.map(x => x.id)) || !unique(s.orders.flatMap(o => o.lines.map(l => l.id))))
    throw new DomainError("Données incohérentes : identifiants en double.");
  for (const o of s.orders) {
    for (const l of o.lines) {
      getProduct(s, l.productId);
      if (totalPacks(l) > 1_000_000 || l.shippedPacks > totalPacks(l)) throw new DomainError("Quantités incohérentes.");
    }
  }
  for (const sh of s.shipments) {
    const o = getOrder(s, sh.orderId);
    if (sh.status === "prepared" && !isActive(o)) throw new DomainError("Colis préparé sur une commande close.");
    if (!unique(sh.allocations.map(a => a.lineId))) throw new DomainError("Lignes de colis en double.");
    for (const a of sh.allocations) {
      if (!o.lines.some(l => l.id === a.lineId)) throw new DomainError("Ligne de colis inconnue.");
    }
  }
  for (const o of s.orders) for (const l of o.lines) {
    const all = s.shipments.filter(sh => sh.orderId === o.id);
    const prepared = all.filter(sh => sh.status === "prepared").flatMap(sh => sh.allocations)
      .filter(a => a.lineId === l.id).reduce((n, a) => n + a.packs, 0);
    const dispatched = all.filter(sh => sh.status === "dispatched").flatMap(sh => sh.allocations)
      .filter(a => a.lineId === l.id).reduce((n, a) => n + a.packs, 0);
    if (prepared + l.shippedPacks > totalPacks(l) || dispatched > l.shippedPacks)
      throw new DomainError("Quantités de colis incohérentes avec la commande.");
  }
  for (const p of s.products) if (p.physicalPacks < reservedPacks(s, p.id))
    throw new DomainError("Le stock physique est inférieur aux réservations.");
  return s;
}
