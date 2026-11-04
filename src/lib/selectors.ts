import type { Order, Product, State } from "./model";
export const totalPacks = (line: Order["lines"][number]) => line.quantity * line.packsPerSale;
export const isActive = (order: Order) => ["ready", "preparing", "partial"].includes(order.status);
export function reservedPacks(state: State, productId: string) {
  return state.orders.filter(isActive).flatMap(o => o.lines).filter(l => l.productId === productId)
    .reduce((sum, l) => sum + totalPacks(l) - l.shippedPacks, 0);
}
export const availablePacks = (state: State, p: Product) => Math.max(0, p.physicalPacks - reservedPacks(state, p.id) - p.safetyPacks);
export function unpreparedPacks(state: State, order: Order, lineId: string) {
  const line = order.lines.find(l => l.id === lineId)!;
  const prepared = state.shipments.filter(s => s.orderId === order.id && s.status === "prepared")
    .flatMap(s => s.allocations).filter(a => a.lineId === lineId).reduce((n, a) => n + a.packs, 0);
  return totalPacks(line) - line.shippedPacks - prepared;
}
export const orderAmount = (o: Order) => o.lines.reduce((sum, l) => sum + l.quantity * l.unitPriceCents, 0);
