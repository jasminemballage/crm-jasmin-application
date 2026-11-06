"use client";
import { useEffect, useState, use } from "react";
import type { State } from "@/lib/model";
import Link from "next/link";
import { Printer } from "lucide-react";

export default function Preparation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/demo/state", { cache: "no-store" }).then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); setState(data); })
      .catch(e => setError(e.message));
  }, []);
  const sh = state?.shipments.find(s => s.id === id);
  const order = state?.orders.find(o => o.id === sh?.orderId);
  return <article className="print-page"><span className="eyebrow">JASMIN EMBALLAGE · DÉMONSTRATION</span><h1>Fiche de préparation</h1><div className="print-warning">DOCUMENT INTERNE — NON VALABLE POUR LE TRANSPORT</div>
    {error ? <p role="alert">{error}</p> : !state ? <p>Chargement…</p> : !sh || !order ? <p>Colis introuvable.</p> : <>
      <div className="print-info"><div><strong>Commande :</strong> {order.externalId}</div><div><strong>Canal simulé :</strong> {order.channel}</div><div><strong>Colis :</strong> COL-{sh.id.slice(-8).toUpperCase()}</div><div><strong>État :</strong> {sh.status === "cancelled" ? "ANNULÉ" : sh.status === "dispatched" ? "Remise simulée" : "Préparé"}</div><div><strong>Destinataire fictif :</strong> {order.customer}</div><div>{order.city} · {order.country}</div><div><strong>Poids :</strong> {sh.weightGrams / 1000} kg</div><div><strong>Dimensions :</strong> {sh.lengthCm} × {sh.widthCm} × {sh.heightCm} cm</div></div>
      <table><thead><tr><th>Référence</th><th>Produit fictif</th><th>Paquets</th><th>Contrôle</th></tr></thead><tbody>{sh.allocations.map(a => { const line = order.lines.find(l => l.id === a.lineId)!; const p = state.products.find(p => p.id === line.productId)!; return <tr key={a.lineId}><td>{p.sku}</td><td>{p.name}</td><td>{a.packs}</td><td>□</td></tr>; })}</tbody></table>
      <p className="print-note">Jeu de données fictif. Cette fiche ne constitue ni une étiquette Chronopost, ni une preuve de dépôt, ni une facture.</p>
      <div className="print-actions"><button className="button" onClick={() => window.print()}><Printer size={16} />Imprimer en A4</button><Link className="button secondary" href="/expeditions">Retour aux expéditions</Link></div>
    </>}
  </article>;
}
