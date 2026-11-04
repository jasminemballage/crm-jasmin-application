import type { Order, Product, State } from "./model";

export function seedState(): State {
  const rows: [string, string, Product["category"], number, number, number, number, number][] = [
    ["GOB-KR-25", "Gobelets kraft 25 cl", "Gobelets", 50, 20, 425, 186, 20],
    ["GOB-BL-18", "Gobelets blancs 18 cl", "Gobelets", 100, 10, 580, 124, 15],
    ["BAR-KR-750", "Barquettes kraft 750 ml", "Barquettes", 50, 6, 1290, 73, 10],
    ["BAR-KR-1000", "Barquettes kraft 1 000 ml", "Barquettes", 50, 6, 1540, 58, 10],
    ["SAC-KR-M", "Sacs kraft à poignées · M", "Sacs", 50, 8, 890, 92, 10],
    ["SAC-KR-L", "Sacs kraft à poignées · L", "Sacs", 50, 6, 1140, 34, 10],
    ["FOU-BO-16", "Fourchettes bois 16 cm", "Couverts", 100, 10, 395, 145, 20],
    ["CUI-BO-16", "Cuillères bois 16 cm", "Couverts", 100, 10, 395, 87, 15],
    ["COU-BO-16", "Couteaux bois 16 cm", "Couverts", 100, 10, 395, 11, 10],
    ["SER-2P-33", "Serviettes kraft 33 cm", "Accessoires", 100, 12, 460, 65, 10],
    ["COU-GOB-25", "Couvercles pour gobelets 25 cl", "Accessoires", 50, 20, 325, 19, 10],
    ["PAI-PA-20", "Pailles papier 20 cm", "Accessoires", 100, 20, 285, 215, 20]
  ];
  const products = rows.map((r, i) => ({ id: `prd-${i + 1}`, sku: r[0], name: r[1], category: r[2],
    unitsPerPack: r[3], packsPerCarton: r[4], priceCents: r[5], physicalPacks: r[6], safetyPacks: r[7], weightGrams: 500 }));
  const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
  function order(n: number, channel: Order["channel"], status: Order["status"], product: number, qty: number, factor = 1): Order {
    return { id: `ord-${n}`, externalId: `DEMO-${String(n).padStart(4, "0")}`, channel,
      createdAt: ago(n * 2), customer: `Client fictif ${String(n).padStart(2, "0")}`,
      city: n === 4 ? "Bruxelles (test)" : ["Lyon (test)", "Paris (test)", "Bordeaux (test)"][n % 3], country: n === 4 ? "BE" : "FR",
      status, lines: [{ id: `line-${n}`, productId: `prd-${product}`, quantity: qty, packsPerSale: factor,
        shippedPacks: ["shipped", "archived"].includes(status) ? qty * factor : 0,
        unitPriceCents: products[product - 1].priceCents * factor }] };
  }
  const orders = [order(1, "Amazon", "ready", 1, 6), order(2, "Cdiscount", "ready", 3, 2, 6),
    order(3, "RETIF", "ready", 5, 1, 8), order(4, "METRO", "ready", 7, 8),
    order(5, "Site Jasmin", "review", 4, 4), order(6, "Amazon", "ready", 11, 8),
    order(7, "Cdiscount", "shipped", 2, 4), order(8, "Amazon", "archived", 8, 2)];
  return { version: 1, revision: 0, products, orders, shipments: [], events: [{ id: "evt-initial", at: ago(1),
    type: "system", targetId: "demo", description: "Espace de démonstration initialisé · tous les produits et clients sont fictifs." }] };
}
