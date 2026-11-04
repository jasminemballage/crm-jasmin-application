import { expect, test, type Page } from "@playwright/test";
import { seedState } from "../../src/lib/seed";
import { emptyChronopostAddress, emptyChronopostChannels } from "../../src/lib/chronopost-contract";

// All API traffic is intercepted. These browser tests cannot create a real shipment,
// change the local catalogue or save credentials.
function fixture() {
  const state = seedState();
  const order = state.orders[0];
  order.details = { totalTtcCents: 3060, marketplace: "France", salesChannel: "Amazon.fr", fulfillment: "FBM",
    prime: true, b2b: true, paymentMethod: "Facture", serviceLevel: "Standard", shipBy: "2026-11-05T22:59:00Z",
    recipient: { company: "Entreprise fictive", firstName: "Alex", lastName: "Exemple", address1: "1 rue du Test",
      postalCode: "75001", city: "Paris", country: "FR", email: "destinataire@example.invalid", phone: "0100000000" } };
  order.lines[0].details = { asin: "TESTASIN01", taxCents: 510, totalTtcCents: 3060 };
  state.shipments.push({ id: "parcel-ui", orderId: order.id, status: "prepared", createdAt: order.createdAt,
    dispatchedAt: null, weightGrams: 1500, lengthCm: 30, widthCm: 20, heightCm: 10, allocations: [{ lineId: order.lines[0].id, packs: 6 }] });
  return state;
}
async function mockApi(page: Page, mode: "ready" | "missing" | "uncertain" | "other-channel" | "offline-once" = "ready") {
  const state = fixture();
  const channels = emptyChronopostChannels();
  channels[mode === "other-channel" ? "RETIF" : "Amazon"] = { accountNumber: "12345678", subAccount: "1", productCode: "01", service: "0" };
  const settings = { enabled: mode !== "missing", passwordPresent: mode !== "missing", ready: mode !== "missing", verified: false,
    shipper: { ...emptyChronopostAddress(), name: "Expéditeur fictif", contactName: "Contact fictif", address1: "2 rue du Test", zipCode: "75002", city: "Paris", email: "sender@example.invalid", phone: "0100000000" }, channels };
  let label: Record<string, unknown> = { shipmentId: "parcel-ui", status: "none" };
  let posts = 0, saved: Record<string, unknown> | null = null, failOnce = mode === "offline-once";
  await page.route("**/api/demo/**", async route => {
    const request = route.request(); const url = new URL(request.url());
    const respond = (json: unknown, status = 200) => route.fulfill({ status, json });
    if (url.pathname === "/api/demo/state") return respond(state);
    if (url.pathname === "/api/demo/chronopost/settings") {
      if (failOnce) { return respond({ error: "Erreur réseau simulée" }, 503); }
      if (request.method() === "POST") { saved = request.postDataJSON(); return respond(settings); }
      return respond(settings);
    }
    if (url.pathname === "/api/demo/chronopost/labels") {
      if (request.method() === "GET") return respond(label);
      posts++;
      if (mode === "uncertain") { label = { shipmentId: "parcel-ui", status: "uncertain", message: "Résultat incertain simulé" }; return respond({ error: "Résultat incertain simulé" }, 409); }
      label = { shipmentId: "parcel-ui", status: "created", trackingNumber: "TEST123456789FR", pdfUrl: "/api/demo/chronopost/labels/parcel-ui/pdf" };
      return respond(label);
    }
    if (url.pathname === "/api/demo/ai/settings") return respond({ configured: false, enabled: false });
    return respond({ error: "API interdite par le test navigateur" }, 403);
  });
  return { posts: () => posts, saved: () => saved, recover: () => { failOnce = false; },
    markRejected: () => { label = { shipmentId: "parcel-ui", status: "rejected", message: "Rejet confirmé après vérification" }; },
    configure: () => { settings.enabled = true; settings.ready = true; settings.passwordPresent = true; } };
}
async function openLabel(page: Page) {
  await page.goto("/commandes");
  await page.getByRole("button", { name: "Étiquette Chronopost pour DEMO-0001", exact: true }).click();
  await expect(page.getByLabel("Destinataire / raison sociale")).toBeVisible();
}

test("tableau multicanal, filtres, détails et données absentes", async ({ page }, testInfo) => {
  await mockApi(page); await page.goto("/commandes");
  await expect(page.getByRole("button", { name: "Ouvrir la commande DEMO-0001", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("commandes-desktop.png"), fullPage: true });
  await page.getByLabel("Filtrer par canal").getByRole("button", { name: "RETIF" }).click();
  await expect(page.getByRole("button", { name: "Ouvrir la commande DEMO-0003", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ouvrir la commande DEMO-0001", exact: true })).toHaveCount(0);
  await page.getByLabel("Filtrer par canal").getByRole("button", { name: "Toutes" }).click();
  await page.getByLabel("Rechercher par référence, client ou email").fill("destinataire@example.invalid");
  await expect(page.locator(".orders-table tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Ouvrir la commande DEMO-0001", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("1 rue du Test", { exact: true })).toBeVisible();
  await expect(dialog.getByText("TESTASIN01")).toBeVisible();
  await expect(dialog.getByText("Total TTC", { exact: true }).first()).toBeVisible();
  await expect(dialog.getByText("Client fictif 01", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("commande-detail.png"), fullPage: true });
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
  await page.getByLabel("Rechercher par référence, client ou email").fill("DEMO-0003");
  await page.getByRole("button", { name: "Ouvrir la commande DEMO-0003", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("Adresse incomplète", { exact: true })).toBeVisible();
});

test("création confirmée une fois, PDF réutilisé après fermeture", async ({ page }, testInfo) => {
  const api = await mockApi(page); await openLabel(page);
  const create = page.getByRole("button", { name: "Créer l’étiquette Chronopost", exact: true });
  await expect(create).toBeDisabled();
  await page.getByLabel(/^Adresse \*/).fill("");
  await page.getByRole("checkbox", { name: /Je confirme/ }).check(); await create.click();
  await expect(page.locator("p[role=alert]")).toContainText("Vérifiez les coordonnées"); expect(api.posts()).toBe(0);
  await page.getByLabel(/^Adresse \*/).fill("1 rue du Test");
  await page.getByRole("checkbox", { name: /Je confirme/ }).check();
  await page.screenshot({ path: testInfo.outputPath("chronopost-form.png"), fullPage: true });
  await create.click(); await expect(page.getByRole("link", { name: "Ouvrir le PDF" })).toBeVisible();
  expect(api.posts()).toBe(1);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Étiquette Chronopost pour DEMO-0001", exact: true }).click();
  await expect(page.getByRole("link", { name: "Ouvrir le PDF" })).toBeVisible(); expect(api.posts()).toBe(1);
});

test("résultat incertain interdit une deuxième création", async ({ page }) => {
  const api = await mockApi(page, "uncertain"); await openLabel(page);
  await page.getByRole("checkbox", { name: /Je confirme/ }).check();
  await page.getByRole("button", { name: "Créer l’étiquette Chronopost", exact: true }).click();
  await expect(page.getByText("Création à vérifier", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Créer l’étiquette Chronopost", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Vérifier l’état", exact: true }).click();
  await expect(page.getByText("Création à vérifier", { exact: true })).toBeVisible(); expect(api.posts()).toBe(1);
  api.markRejected();
  await page.getByRole("button", { name: "Vérifier l’état", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: /Je confirme/ })).toBeEnabled();
  await expect(page.getByText("Rejet confirmé après vérification")).toBeVisible();
  expect(api.posts()).toBe(1);
});

for (const mode of ["missing", "other-channel"] as const) test(`configuration ${mode} bloque le canal courant`, async ({ page }) => {
  const api = await mockApi(page, mode); await openLabel(page);
  await expect(page.getByRole("button", { name: "Créer l’étiquette Chronopost", exact: true })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Ouvrir les paramètres" })).toHaveAttribute("href", "/parametres#chronopost"); expect(api.posts()).toBe(0);
});

test("mobile : détail et formulaire accessibles sans débordement de page", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 }); await mockApi(page); await openLabel(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Créer l’étiquette Chronopost", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("chronopost-mobile.png") });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Ouvrir la commande DEMO-0001", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("Livraison", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("paramètres : ancre, sauvegarde et champ secret vidé", async ({ page }) => {
  const api = await mockApi(page); await page.goto("/parametres#chronopost");
  const panel = page.locator("#chronopost");
  await expect(panel.getByRole("heading", { name: "Expéditions · Chronopost" })).toBeVisible();
  const password = panel.getByLabel("Mot de passe Web Services", { exact: true });
  await password.fill("secret-fictif-test");
  await panel.getByRole("button", { name: "Enregistrer la configuration Chronopost" }).click();
  await expect(panel.getByRole("status")).toContainText("Configuration Chronopost enregistrée");
  await expect(password).toHaveValue(""); expect(api.saved()?.password).toBe("secret-fictif-test");
});

test("erreur de chargement récupérable sans création", async ({ page }) => {
  const api = await mockApi(page, "offline-once"); await page.goto("/commandes");
  await page.getByRole("button", { name: "Étiquette Chronopost pour DEMO-0001", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toContainText("Erreur réseau simulée");
  api.recover(); await page.getByRole("button", { name: "Recharger", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: /Je confirme/ })).toBeEnabled(); expect(api.posts()).toBe(0);
});

test("tri, statuts, montants et dates incohérentes", async ({ page }) => {
  await mockApi(page); await page.goto("/commandes");
  await page.getByLabel("Trier les commandes").selectOption("oldest");
  await expect(page.locator(".orders-table tbody tr").first()).toContainText("DEMO-0008");
  await page.getByLabel("Montant minimum en euros").fill("100");
  await expect(page.locator(".orders-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".orders-table tbody tr")).toContainText("DEMO-0002");
  await page.getByLabel("Montant maximum en euros").fill("20");
  await expect(page.locator("p[role=alert]")).toContainText("minimum doit être inférieur");
  await page.getByRole("button", { name: "Réinitialiser les filtres", exact: true }).click();
  await page.locator(".orders-statuses").getByRole("button", { name: "À accepter" }).click();
  await expect(page.locator(".orders-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".orders-table tbody tr")).toContainText("DEMO-0005");
  await page.getByLabel("Date d’achat minimum").fill("2026-11-06");
  await page.getByLabel("Date d’achat maximum").fill("2026-11-04");
  await expect(page.locator("p[role=alert]")).toContainText("date de début doit précéder");
});

test("contrat configuré dans un autre onglet : actualisation sans perdre le destinataire", async ({ page }) => {
  const api = await mockApi(page, "missing"); await openLabel(page);
  const recipient = page.getByLabel("Destinataire / raison sociale");
  const confirmation = page.getByRole("checkbox", { name: /Je confirme/ });
  await recipient.fill("Destinataire modifié dans la fenêtre");
  await expect(confirmation).toBeDisabled();
  api.configure();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(confirmation).toBeEnabled();
  await expect(recipient).toHaveValue("Destinataire modifié dans la fenêtre");
  await confirmation.check();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(confirmation).toBeChecked(); expect(api.posts()).toBe(0);
});
