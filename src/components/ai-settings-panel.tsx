"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Check, CircleAlert, ExternalLink, LoaderCircle, Save, Sparkles } from "lucide-react";
import type { AiStatus } from "@/lib/ai-contract";
export default function AiSettingsPanel() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [key, setKey] = useState(""); const [textModel, setTextModel] = useState(""); const [imageModel, setImageModel] = useState("");
  const [rules, setRules] = useState(""); const [enabled, setEnabled] = useState(true); const [clear, setClear] = useState(false);
  const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true); setError(""); setMessage("");
    await fetch("/api/demo/ai/settings", { cache: "no-store" }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setKey(""); setClear(false); setStatus(data); setTextModel(data.textModel); setImageModel(data.imageModel); setRules(data.imageRules); setEnabled(data.keyPresent ? data.enabled : true);
    }).catch(() => setError("La configuration IA ne peut pas être chargée.")).finally(() => setBusy(false));
  }
  useEffect(() => { void load(); }, []);
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/demo/ai/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: status?.revision, enabled, ...(key.trim() ? { apiKey: key.trim() } : {}), clearKey: clear, textModel, imageModel, imageRules: rules }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setStatus(data); setKey(""); setClear(false); setMessage("Configuration enregistrée côté serveur. Aucun appel payant n’a été lancé.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Configuration non enregistrée."); }
    finally { setBusy(false); }
  }
  return <section className="panel ai-settings-panel" id="enrichissement-ia"><div className="panel-head"><div><h2>Enrichissement IA · OpenRouter</h2><p>Textes, recherche de fiches et visuels produit</p></div><Sparkles size={22} /></div><form className="ai-settings-form" onSubmit={save}>
    <div className="ai-settings-status"><span className={`badge ${status?.keyPresent ? "shipped" : "ready"}`}>{status?.keyPresent ? "Clé enregistrée" : "Clé à configurer"}</span><small>Les accès du compte et les modèles seront vérifiés lors du premier essai.</small></div>
    <p className="product-help">Saisis la clé ici, jamais dans la conversation. Elle reste côté serveur, hors du catalogue et des exports de données. Les informations produit sont transmises à OpenRouter uniquement lorsque tu lances une requête depuis la fiche.</p>
    <label className="field"><span>Clé API OpenRouter</span><input type="password" autoComplete="new-password" spellCheck={false} value={key} onChange={e => setKey(e.target.value)} maxLength={512} placeholder={status?.keyPresent ? "Laisser vide pour conserver la clé enregistrée" : "Coller la clé ici"} /></label>
    <div className="product-grid two"><label className="field"><span>Modèle pour les textes et la recherche</span><input value={textModel} onChange={e => setTextModel(e.target.value)} required maxLength={160} placeholder="fournisseur/modele" /></label><label className="field"><span>Modèle pour les images</span><input value={imageModel} onChange={e => setImageModel(e.target.value)} required maxLength={160} placeholder="fournisseur/modele-image" /></label></div>
    <label className="field"><span>Règles globales pour les images</span><textarea rows={4} maxLength={3000} value={rules} onChange={e => setRules(e.target.value)} /></label>
    <div className="ai-settings-options"><label><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />Autoriser les requêtes IA depuis ce CRM</label><label><input type="checkbox" checked={clear} onChange={e => setClear(e.target.checked)} />Effacer la clé enregistrée lors de l’enregistrement</label></div>
    <p className="product-help">Chaque requête consomme les crédits de ton compte OpenRouter selon le modèle et les outils utilisés. Les modèles ci-dessus sont modifiables. {status?.revision !== undefined ? "Les accès sont chiffrés dans l’espace partagé." : "Cette installation locale ne chiffre pas son fichier de configuration."}</p>
    <div className="ai-settings-links"><a href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer">Ouvrir les clés OpenRouter <ExternalLink size={12} /></a><a href="https://openrouter.ai/models" target="_blank" rel="noreferrer">Consulter les modèles et tarifs <ExternalLink size={12} /></a></div>
    {error && <p className="product-error" role="alert"><CircleAlert size={17} />{error}</p>}{message && <p className="import-success" role="status"><Check size={17} />{message}</p>}
    <div className="ai-settings-save">{error && <button className="button secondary" type="button" disabled={busy} onClick={() => void load()}>Recharger les réglages (remplace mes saisies)</button>}<button className="button" disabled={busy || !status} type="submit">{busy ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}Enregistrer la configuration IA</button></div>
  </form></section>;
}
