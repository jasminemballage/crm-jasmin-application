"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Download, LoaderCircle, MapPin, Package, RefreshCw, Settings2, Truck } from "lucide-react";
import type { Order, State } from "@/lib/model";
import { getOrderDetails } from "@/lib/order-details";
import { chronopostLabelInput, type ChronopostAddress, type ChronopostLabelStatus, type ChronopostPublicSettings } from "@/lib/chronopost-contract";

type Props = { order: Order; state: State; onPrepare: () => void; onBack: () => void; onBusyChange: (busy: boolean) => void };
const addressFields: { key: keyof ChronopostAddress; label: string; type?: string; optional?: boolean }[] = [
  { key: "name", label: "Destinataire / raison sociale" }, { key: "contactName", label: "Nom et prénom du contact" },
  { key: "address1", label: "Adresse" }, { key: "address2", label: "Complément d’adresse", optional: true },
  { key: "zipCode", label: "Code postal" }, { key: "city", label: "Ville" },
  { key: "email", label: "E-mail", type: "email" }, { key: "phone", label: "Téléphone", type: "tel" }
];

function configKey(settings: ChronopostPublicSettings, channel: Order["channel"]) {
  const service = settings.channels[channel];
  return JSON.stringify([settings.enabled, settings.passwordPresent, settings.ready,
    Object.entries(settings.shipper).sort(([a], [b]) => a.localeCompare(b)),
    service?.accountNumber, service?.subAccount, service?.productCode, service?.service]);
}

export default function ChronopostPanel({ order, state, onPrepare, onBack, onBusyChange }: Props) {
  const shipments = state.shipments.filter(shipment => shipment.orderId === order.id);
  const [shipmentId, setShipmentId] = useState(shipments.find(shipment => shipment.status === "prepared")?.id ?? shipments[0]?.id ?? "");
  const [recipient, setRecipient] = useState<ChronopostAddress>(() => {
    const source = getOrderDetails(order, state.products).recipient;
    const contactName = [source.firstName, source.lastName].filter(Boolean).join(" ");
    return { name: source.company || contactName, contactName, address1: source.address1 ?? "", address2: source.address2 ?? "",
      zipCode: source.postalCode ?? "", city: source.city ?? "", country: "FR", email: source.email ?? "", phone: source.phone ?? "" };
  });
  const [settings, setSettings] = useState<ChronopostPublicSettings | null>(null);
  const [label, setLabel] = useState<ChronopostLabelStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState<string[]>([]);
  const [refresh, setRefresh] = useState(0);
  const inflight = useRef(false);
  const unresolvedAttempts = useRef(new Set<string>());
  const form = useRef<HTMLFormElement>(null);
  const shipment = shipments.find(item => item.id === shipmentId);
  const channel = settings?.channels[order.channel];
  const channelComplete = !!channel && Number(channel.accountNumber) > 0 && !!channel.subAccount.trim() && !!channel.productCode.trim() && !!channel.service.trim();
  const country = getOrderDetails(order, state.products).recipient.country;
  const international = country !== "FR";
  const uncertain = label?.status === "pending" || label?.status === "uncertain";
  const created = label?.status === "created";
  const canPrepare = ["ready", "preparing", "partial"].includes(order.status) && order.lines.some(line => line.shippedPacks < line.quantity * line.packsPerSale);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let timedOut = false;
    let initialLoading = true;
    let settingsSnapshot = settings;
    let backgroundController: AbortController | null = null;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 20_000);
    setLoading(true); setError(""); setLabel(null);
    async function load() {
      try {
        const requests = [fetch("/api/demo/chronopost/settings", { signal: controller.signal, cache: "no-store" })];
        if (shipmentId) requests.push(fetch(`/api/demo/chronopost/labels?shipmentId=${encodeURIComponent(shipmentId)}`, { signal: controller.signal, cache: "no-store" }));
        const responses = await Promise.all(requests);
        const bodies = await Promise.all(responses.map(response => response.json()));
        if (!active) return;
        if (controller.signal.aborted) throw new Error("Chargement interrompu.");
        const failed = responses.findIndex(response => !response.ok);
        if (failed !== -1) throw new Error(bodies[failed].error || "Impossible de lire la configuration Chronopost.");
        const nextSettings = bodies[0] as ChronopostPublicSettings;
        if (settingsSnapshot && configKey(settingsSnapshot, order.channel) !== configKey(nextSettings, order.channel)) setConfirmed(false);
        settingsSnapshot = nextSettings;
        setSettings(nextSettings);
        const saved = bodies[1] as ChronopostLabelStatus | undefined;
        if (saved?.status === "created" || saved?.status === "rejected") unresolvedAttempts.current.delete(shipmentId);
        else if (saved?.status === "pending" || saved?.status === "uncertain") unresolvedAttempts.current.add(shipmentId);
        setLabel(saved?.status === "none" && unresolvedAttempts.current.has(shipmentId) ? { shipmentId, status: "uncertain", message: "La dernière demande n’a pas encore été confirmée. Vérifiez l’envoi dans Chronopost avant toute nouvelle création." } : saved ?? null);
      } catch (failure) {
        if (active) setError(timedOut ? "Le chargement a dépassé 20 secondes. Rechargez la configuration et l’état de l’étiquette." : failure instanceof Error ? failure.message : "Chronopost est indisponible. Réessayez le chargement.");
      } finally {
        clearTimeout(timeout);
        initialLoading = false;
        if (active) setLoading(false);
      }
    }
    async function refreshSettings() {
      if (!active || initialLoading || inflight.current || document.visibilityState !== "visible" || backgroundController) return;
      const current = new AbortController();
      backgroundController = current;
      const backgroundTimeout = setTimeout(() => current.abort(), 20_000);
      try {
        const response = await fetch("/api/demo/chronopost/settings", { signal: current.signal, cache: "no-store" });
        if (!response.ok) return;
        const nextSettings = await response.json() as ChronopostPublicSettings;
        if (!active || current.signal.aborted || inflight.current) return;
        if (!settingsSnapshot || configKey(settingsSnapshot, order.channel) !== configKey(nextSettings, order.channel)) {
          if (settingsSnapshot) setConfirmed(false);
          settingsSnapshot = nextSettings;
          setSettings(nextSettings);
        }
      } catch {
        // A background settings read never clears the form, label, or last known configuration.
      } finally {
        clearTimeout(backgroundTimeout);
        if (backgroundController === current) backgroundController = null;
      }
    }
    function refreshWhenVisible() { void refreshSettings(); }
    function visibilityChanged() {
      if (document.visibilityState !== "visible") backgroundController?.abort();
      else refreshWhenVisible();
    }
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", visibilityChanged);
    const interval = setInterval(refreshWhenVisible, 10_000);
    void load();
    return () => {
      active = false;
      clearTimeout(timeout); clearInterval(interval);
      controller.abort(); backgroundController?.abort();
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, [shipmentId, refresh, order.channel]);

  async function generate(event: FormEvent) {
    event.preventDefault();
    if (inflight.current || loading || !settings?.ready || !channelComplete || !shipment || shipment.status !== "prepared" || !label || uncertain || created || international) return;
    const checked = chronopostLabelInput.safeParse({ shipmentId, recipient, confirmed });
    if (!checked.success) {
      const fields = checked.error.issues.map(issue => String(issue.path[1] ?? issue.path[0]));
      setInvalid(fields); setError("Vérifiez les coordonnées du destinataire et confirmez les informations de l’envoi.");
      requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    inflight.current = true; setCreating(true); onBusyChange(true); setError(""); setInvalid([]);
    try {
      unresolvedAttempts.current.add(shipmentId);
      const response = await fetch("/api/demo/chronopost/labels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(checked.data), signal: AbortSignal.timeout(75_000) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Chronopost n’a pas confirmé la création de l’étiquette.");
      if (body.status === "created" || body.status === "rejected") unresolvedAttempts.current.delete(shipmentId);
      setLabel(body); setConfirmed(false);
    } catch (failure) {
      setError(failure instanceof Error && failure.name === "TimeoutError" ? "La création n’a pas été confirmée après 75 secondes. Vérification de l’état enregistré…" : failure instanceof Error ? failure.message : "La réponse a été interrompue. Vérifiez l’état de l’étiquette avant de poursuivre.");
      setConfirmed(false);
      setLabel({ shipmentId, status: "uncertain" });
      // Reading the saved attempt is safe; never repeat the paid creation automatically.
      try {
        const response = await fetch(`/api/demo/chronopost/labels?shipmentId=${encodeURIComponent(shipmentId)}`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
        if (!response.ok) throw new Error();
        const saved = await response.json() as ChronopostLabelStatus;
        if (saved.status === "created" || saved.status === "rejected") unresolvedAttempts.current.delete(shipmentId);
        if (saved.status === "created") setError("");
        setLabel(saved.status === "none" ? { shipmentId, status: "uncertain" } : saved);
      } catch { setLabel({ shipmentId, status: "uncertain" }); }
    } finally { inflight.current = false; setCreating(false); onBusyChange(false); }
  }

  return <div className="chrono-panel">
    <div className="chrono-context"><span><Truck size={17} />{order.channel} · {order.externalId}</span><div className="chrono-context-actions"><button type="button" className="text-button" disabled={creating || loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={14} />Recharger</button><button type="button" className="text-button" disabled={creating} onClick={onBack}><ArrowLeft size={14} />Voir la commande</button></div></div>
    {error && <p className="form-error" role="alert" id="chrono-error">{error}</p>}
    {loading ? <div className="loading" role="status"><LoaderCircle className="spin" />Chargement de l’expédition…</div> : <>
      {settings && (!settings.ready || !channelComplete) && <div className="chrono-callout"><Settings2 size={20} /><div><strong>{!channelComplete ? `Configurer le canal ${order.channel}` : "Configurer le contrat Chronopost"}</strong><p>{!channelComplete ? `Renseignez le compte Chronopost, le sous-compte et les codes produit et service du canal ${order.channel} avant de créer son étiquette.` : "Renseignez les accès webservices et l’expéditeur pour créer une étiquette."}</p><Link className="text-link" href="/parametres#chronopost" target="_blank" rel="noreferrer">Ouvrir les paramètres Chronopost</Link></div></div>}
      {!shipments.length ? <div className="chrono-empty"><Package size={32} /><h3>Préparez d’abord le colis</h3><p>Choisissez les articles, le poids et les dimensions avant la création de son étiquette.</p>{canPrepare ? <button className="button" type="button" onClick={onPrepare}>Préparer un colis</button> : <p>Cette commande doit être validée et avoir des articles à expédier.</p>}</div> : <form ref={form} noValidate onSubmit={generate}>
        <div className="chrono-columns"><section className="chrono-recipient"><h3><MapPin size={18} />Destinataire</h3><p className="chrono-help">Vérifiez les coordonnées transmises et complétez les informations manquantes.</p>
          <div className="chrono-address-fields">{addressFields.map(({ key, label: fieldLabel, type, optional }) => <label className={`field ${["name", "address1", "address2"].includes(key) ? "chrono-full" : ""}`} key={key}><span>{fieldLabel}{optional ? " (facultatif)" : " *"}</span><input type={type ?? "text"} value={recipient[key]} maxLength={key === "email" ? 100 : key === "phone" ? 25 : key === "zipCode" ? 10 : 80} readOnly={creating || created || uncertain} aria-invalid={invalid.includes(key)} aria-describedby={invalid.includes(key) ? "chrono-error" : undefined} onChange={event => { setRecipient(old => ({ ...old, [key]: event.target.value })); setConfirmed(false); }} /></label>)}</div>
          <p className="chrono-help">Pays : France métropolitaine · livraison à domicile</p>
          {international && <p className="form-error">Le pays de cette commande est {country}. L’expédition internationale n’est pas encore disponible dans ce parcours.</p>}
        </section><section className="chrono-shipment"><h3><Package size={18} />Colis et service</h3>
          <label className="field"><span>Colis de la commande</span><select value={shipmentId} disabled={creating} onChange={event => { setShipmentId(event.target.value); setConfirmed(false); }}>{shipments.map(item => <option key={item.id} value={item.id}>COL-{item.id.slice(-8).toUpperCase()} · {item.weightGrams / 1000} kg · {item.status === "prepared" ? "Préparé" : item.status === "dispatched" ? "Remis" : "Annulé"}</option>)}</select></label>
          {shipment && <dl className="chrono-summary"><div><dt>Poids</dt><dd>{(shipment.weightGrams / 1000).toLocaleString("fr-FR")} kg</dd></div><div><dt>Dimensions</dt><dd>{shipment.lengthCm} × {shipment.widthCm} × {shipment.heightCm} cm</dd></div><div><dt>Paquets affectés</dt><dd>{shipment.allocations.reduce((sum, item) => sum + item.packs, 0)}</dd></div><div><dt>Canal</dt><dd>{order.channel}</dd></div><div><dt>Compte Chronopost</dt><dd>{channel?.accountNumber || "À configurer"}</dd></div><div><dt>Produit / service</dt><dd>{channel?.productCode && channel?.service ? `${channel.productCode} / ${channel.service}` : "À configurer"}</dd></div><div><dt>Format</dt><dd>PDF A4</dd></div></dl>}
          {settings?.shipper.name && <div className="chrono-sender"><strong>Expéditeur</strong><p>{settings.shipper.name}<br />{settings.shipper.address1}<br />{settings.shipper.zipCode} {settings.shipper.city}</p></div>}
          {created ? <div className="chrono-success" role="status"><CheckCircle2 size={24} /><h4>Étiquette créée</h4><p>Suivi : <strong>{label.trackingNumber}</strong></p>{label.pdfUrl && <a className="button" href={label.pdfUrl} target="_blank" rel="noreferrer"><Download size={16} />Ouvrir le PDF</a>}<p>L’ouverture du PDF réutilise cette étiquette.</p></div> : uncertain ? <div className="chrono-callout" role="status"><div><strong>Création à vérifier</strong><p>{label?.message || "Une demande a déjà été envoyée. Vérifiez l’envoi dans Chronopost avant toute nouvelle création."}</p><button type="button" className="text-button" disabled={creating} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={14} />Vérifier l’état</button></div></div> : <>
            {label?.status === "rejected" && label.message && <p className="chrono-help" role="status">{label.message}</p>}
            {shipment?.status !== "prepared" && <p className="chrono-help">Seul un colis préparé peut recevoir une nouvelle étiquette.</p>}
            <label className="chrono-confirm"><input type="checkbox" checked={confirmed} disabled={creating || loading || !settings?.ready || !channelComplete || !label || international || shipment?.status !== "prepared"} aria-invalid={invalid.includes("confirmed")} onChange={event => setConfirmed(event.target.checked)} /><span>Je confirme le destinataire et le colis. Cette étiquette sera créée sur mon contrat Chronopost, selon ses tarifs.</span></label>
            <button className="button chrono-generate" type="submit" disabled={creating || loading || !settings?.ready || !channelComplete || !label || !confirmed || international || shipment?.status !== "prepared"}>{creating ? <LoaderCircle size={17} className="spin" /> : <Truck size={17} />}{creating ? "Création de l’étiquette…" : "Créer l’étiquette Chronopost"}</button>
            <p className="chrono-help">La création de l’étiquette ne confirme pas la remise du colis ni l’expédition auprès de la marketplace.</p>
          </>}
        </section></div>
      </form>}
    </>}
  </div>;
}
