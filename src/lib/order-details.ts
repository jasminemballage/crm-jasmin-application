import type { Order, Product } from "./model";
import { orderAmount, totalPacks } from "./selectors";

export type OrderTotal = { cents: number; taxBasis: "HT" | "TTC" };

/** A supplied gross total is authoritative; never infer missing VAT from today's catalog. */
export function orderTotal(order: Order): OrderTotal {
  if (order.details?.totalTtcCents !== undefined)
    return { cents: order.details.totalTtcCents, taxBasis: "TTC" };
  if (order.lines.length && order.lines.every(line => line.details?.totalTtcCents !== undefined))
    return { cents: order.lines.reduce((sum, line) => sum + line.details!.totalTtcCents!, 0), taxBasis: "TTC" };
  return { cents: orderAmount(order), taxBasis: "HT" };
}

/** Shipping deadline supplied by a connector; no deadline is guessed for legacy orders. */
export const orderDue = (order: Order): string | null => order.details?.shipBy ?? null;
const knownText = (value?: string) => value?.trim() || null;

export function getOrderDetails(order: Order, products: readonly Product[]) {
  const details = order.details;
  const recipient = details?.recipient;
  return {
    purchasedAt: details?.purchasedAt ?? order.createdAt,
    marketplace: knownText(details?.marketplace), salesChannel: knownText(details?.salesChannel),
    orderChannel: knownText(details?.orderChannel), paymentMethod: knownText(details?.paymentMethod),
    paymentDetails: knownText(details?.paymentDetails), serviceLevel: knownText(details?.serviceLevel),
    syncedAt: details?.syncedAt ?? null, fulfillment: details?.fulfillment ?? null,
    prime: details?.prime ?? null, b2b: details?.b2b ?? null,
    premium: details?.premium ?? null, replacement: details?.replacement ?? null,
    shipFrom: details?.shipFrom ?? null, shipBy: details?.shipBy ?? null,
    deliverFrom: details?.deliverFrom ?? null, deliverBy: details?.deliverBy ?? null,
    recipient: {
      company: knownText(recipient?.company), lastName: knownText(recipient?.lastName), firstName: knownText(recipient?.firstName),
      email: knownText(recipient?.email), phone: knownText(recipient?.phone),
      address1: knownText(recipient?.address1), address2: knownText(recipient?.address2),
      postalCode: knownText(recipient?.postalCode), city: knownText(recipient?.city) ?? knownText(order.city),
      region: knownText(recipient?.region), country: knownText(recipient?.country) ?? order.country
    },
    total: orderTotal(order), dueAt: orderDue(order),
    articleCount: order.lines.reduce((sum, line) => sum + line.quantity, 0),
    packCount: order.lines.reduce((sum, line) => sum + totalPacks(line), 0),
    lines: order.lines.map(line => {
      const product = products.find(product => product.id === line.productId);
      const info = line.details;
      const total: OrderTotal = info?.totalTtcCents !== undefined
        ? { cents: info.totalTtcCents, taxBasis: "TTC" }
        : { cents: line.quantity * line.unitPriceCents, taxBasis: "HT" };
      return { ...line, sku: knownText(info?.sku) ?? knownText(product?.sku), asin: knownText(info?.asin),
        title: knownText(info?.title) ?? knownText(product?.name), totalPacks: totalPacks(line),
        shippingCents: info?.shippingCents ?? null, taxCents: info?.taxCents ?? null,
        discountCents: info?.discountCents ?? null, total };
    })
  };
}
