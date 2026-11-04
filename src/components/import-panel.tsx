"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, CircleAlert, Download, FileSpreadsheet, LoaderCircle, RefreshCw, Upload } from "lucide-react";
import { decodeImportFile, IMPORT_LIMITS, parseImportCsv, type CsvResult } from "@/lib/csv-import";
import { fieldLabels, planCatalogImport, planStockImport, type ImportIssue } from "@/lib/import-plan";
import type { Action, State } from "@/lib/model";

type Preview = { fileName: string; data: CsvResult; baseRevision: number; sourceState: State };
type Props = {
  kind: "products" | "stock"; state: State; busy: boolean;
  onCommit: (action: Action, message: string, revision: number) => Promise<void>; onCancel: () => void;
};
const signed = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString("fr-FR")}`;
const fieldValue = (field: string, value?: string | number) => value === undefined ? "—" : field === "priceCents" && typeof value === "number"
  ? (value / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" }) : String(value);

export default function ImportPanel({ kind, state, busy, onCommit, onCancel }: Props) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [fileError, setFileError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const [pasted, setPasted] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const generation = useRef(0);
  const catalog = preview && kind === "products" ? planCatalogImport(preview.sourceState, preview.data.catalogRows) : null;
  const stock = preview && kind === "stock" ? planStockImport(preview.sourceState, preview.data.stockRows) : null;
  const stale = preview !== null && preview.baseRevision !== state.revision;
  const errors: ImportIssue[] = preview ? [...preview.data.errors, ...(catalog?.errors ?? stock?.errors ?? []).map(issue => ({
    ...issue, line: preview.data.sourceLines[issue.line - 2] ?? issue.line
  }))] : [];
  const changed = catalog ? catalog.created + catalog.updated : stock?.updated ?? 0;

  async function chooseFile(file?: File) {
    const token = ++generation.current;
    setFileError(""); setPreview(null); setConfirmed(false); setLoading(false);
    if (!file) return;
    if (!/\.(csv|tsv)$/i.test(file.name)) { setFileError("Choisissez un fichier CSV ou TSV exporté depuis votre tableur."); return; }
    if (file.size > IMPORT_LIMITS.bytes) { setFileError("Le fichier dépasse 1 Mo. Limitez-le à 1 000 lignes par import."); return; }
    setLoading(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const data = parseImportCsv(decodeImportFile(bytes), kind);
      if (generation.current === token) setPreview({ fileName: file.name, data, baseRevision: state.revision, sourceState: state });
    } catch (error) { if (generation.current === token) setFileError(error instanceof Error ? error.message : "Ce fichier ne peut pas être lu."); }
    finally { if (generation.current === token) setLoading(false); }
  }
  function refreshPreview() {
    setConfirmed(false);
    setPreview(current => current ? { ...current, baseRevision: state.revision, sourceState: state } : null);
  }
  function previewPaste() {
    generation.current++;
    setFileError(""); setLoading(false); setConfirmed(false);
    if (new TextEncoder().encode(pasted).length > IMPORT_LIMITS.bytes) {
      setPreview(null); setFileError("Le tableau dépasse 1 Mo. Limitez-le à 1 000 lignes."); return;
    }
    setPreview({ fileName: "Tableau collé", data: parseImportCsv(pasted, kind), baseRevision: state.revision, sourceState: state });
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!preview || errors.length || stale || !confirmed || !changed || busy) return;
    if (kind === "products") {
      await onCommit({ type: "importProducts", rows: preview.data.catalogRows },
        `Import enregistré : ${catalog!.created} produits créés, ${catalog!.updated} modifiés, ${catalog!.unchanged} inchangés.`, preview.baseRevision);
    } else {
      if (reason.trim().length < 5) return;
      await onCommit({ type: "importStock", rows: preview.data.stockRows, reason: reason.trim() },
        `Inventaire enregistré : ${stock!.updated} stocks ajustés, ${stock!.unchanged} inchangés.`, preview.baseRevision);
    }
  }
  return <form className="import-panel" onSubmit={submit}>
    <div className="import-intro"><span className="import-symbol"><FileSpreadsheet size={23} /></span><div>
      <strong>{kind === "products" ? "Un fichier, un catalogue rapproché par SKU" : "Un inventaire physique à vérifier avant remplacement"}</strong>
      <p>{kind === "products" ? "Les références existantes sont mises à jour ; les nouvelles sont créées avec 0 paquet physique. Une cellule vide conserve la valeur existante." : "Les quantités du fichier remplacent le stock physique des références listées. Il s’agit d’un inventaire, pas d’une entrée supplémentaire."}</p>
    </div></div>
    <div className="import-steps"><span className="selected">1 · Choisir le fichier</span><ArrowRight size={12} /><span className={preview ? "selected" : ""}>2 · Vérifier l’aperçu</span><ArrowRight size={12} /><span>3 · Confirmer</span></div>
    <div className="import-file-row"><label className="import-file"><Upload size={20} /><span>Choisir un fichier CSV ou TSV<small>1 Mo maximum · 1 000 lignes · Excel ou autre tableur</small></span><input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" aria-label="Fichier à importer" disabled={busy} onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; void chooseFile(file); }} /></label>
      <a className="button secondary" href={`/api/demo/export?kind=template-${kind}`}><Download size={15} />Modèle CSV</a></div>
    <button className="import-paste-toggle" type="button" onClick={() => setShowPaste(value => !value)} disabled={busy}>{showPaste ? "Masquer la saisie du tableau" : "Ou coller un tableau depuis Excel"}</button>
    {showPaste && <div className="import-paste"><label className="field"><span>Tableau CSV ou colonnes copiées depuis Excel, en-tête compris</span><textarea rows={5} value={pasted} disabled={busy} onChange={e => { setPasted(e.target.value); setPreview(null); setConfirmed(false); generation.current++; setLoading(false); }} placeholder={kind === "products" ? "SKU;Nom\nGOB-KR-25;Nouveau nom fictif" : "SKU;StockPaquets\nGOB-KR-25;200"} /></label><button className="button secondary" type="button" onClick={previewPaste} disabled={busy || !pasted.trim()}>Vérifier le tableau <ArrowRight size={14} /></button></div>}
    {kind === "products" && <p className="import-hint">La colonne SKU est obligatoire. Pour un nouveau produit, renseignez toutes les colonnes du modèle. Les colonnes de stock ne modifient pas l’inventaire.</p>}
    {kind === "stock" && <p className="import-hint">Colonnes : SKU et StockPaquets ou StockCartons. Renseignez une seule des deux quantités par ligne. Les références absentes du fichier restent inchangées.</p>}
    {loading && <p className="import-loading"><LoaderCircle className="spin" size={16} />Lecture du fichier…</p>}
    {fileError && <div className="import-errors" role="alert"><CircleAlert size={17} /><p>{fileError}</p></div>}
    {preview && <>
      <div className="import-file-name"><FileSpreadsheet size={15} /><strong>{preview.fileName}</strong><span>{preview.data.totalRows} lignes de données</span></div>
      <div className="import-summary">{catalog ? <><div><strong>{catalog.created}</strong><span>Créations</span></div><div><strong>{catalog.updated}</strong><span>Modifications</span></div><div><strong>{catalog.unchanged}</strong><span>Inchangés</span></div></> : <><div><strong>{stock?.updated ?? 0}</strong><span>Stocks à ajuster</span></div><div><strong>{stock?.unchanged ?? 0}</strong><span>Inchangés</span></div><div><strong>{signed(stock?.entries.reduce((n, e) => n + e.delta, 0) ?? 0)}</strong><span>Écart en paquets</span></div></>}<div className={errors.length ? "has-errors" : ""}><strong>{errors.length}</strong><span>Erreurs</span></div></div>
      {preview.data.warnings.map(warning => <p className="import-hint" key={warning}>{warning}</p>)}
      {stale && <div className="import-stale" role="alert"><CircleAlert size={18} /><div><strong>Les données ont changé depuis cet aperçu.</strong><p>Recalculez les écarts et vérifiez de nouveau avant de confirmer.</p></div><button className="button secondary" type="button" onClick={refreshPreview}><RefreshCw size={14} />Actualiser l’aperçu</button></div>}
      {errors.length > 0 && <section className="import-errors" role="alert"><CircleAlert size={19} /><div><strong>Aucune ligne ne sera enregistrée tant qu’une erreur subsiste.</strong><ul>{errors.slice(0, 30).map((e, i) => <li key={`${e.line}-${i}`}><b>Ligne {e.line}{e.sku ? ` · ${e.sku}` : ""}</b> — {e.message}</li>)}</ul>{errors.length > 30 && <p>Et {errors.length - 30} autres erreurs. Corrigez le fichier puis sélectionnez-le à nouveau.</p>}</div></section>}
      {(catalog?.entries.length || stock?.entries.length) ? <div className="import-preview table-scroll"><table><thead><tr><th>Référence / produit</th>{kind === "products" ? <><th>Action</th><th>Changements proposés</th></> : <><th>Physique actuel</th><th>Inventaire proposé</th><th>Écart / disponible</th></>}</tr></thead><tbody>
        {catalog?.entries.slice(0, 100).map(e => <tr key={`${e.line}-${e.sku}`}><td><strong>{e.sku}</strong><small>{e.after.name}</small></td><td><span className={`badge ${e.operation === "create" ? "shipped" : e.operation === "update" ? "ready" : "archived"}`}>{e.operation === "create" ? "Créer" : e.operation === "update" ? "Modifier" : "Inchangé"}</span></td><td><div className="import-changes">{e.changes.length ? e.changes.map(c => <div key={c.field}><span>{fieldLabels[c.field]}</span><small>{fieldValue(c.field, c.before)} <ArrowRight size={11} /> <b>{fieldValue(c.field, c.after)}</b></small></div>) : <span>Aucune modification</span>}</div></td></tr>)}
        {stock?.entries.slice(0, 100).map(e => <tr key={`${e.line}-${e.sku}`}><td><strong>{e.sku}</strong><small>{e.name}</small></td><td>{e.before} paquets<small>{e.reserved} réservés</small></td><td><strong>{e.after} paquets</strong>{e.unit === "carton" && <small>{e.quantity} cartons × {e.factor} paquets</small>}</td><td><strong className={e.delta < 0 ? "stock-decrease" : "primary-text"}>{signed(e.delta)}</strong><small>{Math.max(0, e.after - e.reserved - e.safety)} disponibles après import</small></td></tr>)}
      </tbody></table>{Math.max(catalog?.entries.length ?? 0, stock?.entries.length ?? 0) > 100 && <p className="import-hint">Aperçu limité aux 100 premières lignes. Toutes les lignes ont été contrôlées et seront traitées ensemble.</p>}</div> : null}
      {!errors.length && changed === 0 && <p className="import-success"><Check size={16} />Ce fichier ne propose aucune modification à enregistrer.</p>}
      {kind === "stock" && <label className="field import-reason"><span>Motif de cet inventaire</span><textarea value={reason} onChange={e => setReason(e.target.value)} minLength={5} maxLength={250} required rows={2} placeholder="Ex. Inventaire de contrôle du 26 octobre" disabled={busy} /></label>}
      <label className="import-confirm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} required disabled={busy || !!errors.length || stale || changed === 0} /><span>{kind === "products" ? "J’ai vérifié les créations et les modifications proposées." : "J’ai vérifié cet inventaire et je confirme le remplacement des stocks physiques affichés."}</span></label>
    </>}
    <div className="modal-foot"><button className="button secondary" type="button" onClick={onCancel} disabled={busy}>Fermer</button><button className="button" type="submit" disabled={busy || loading || !preview || !!errors.length || stale || !confirmed || changed === 0 || (kind === "stock" && reason.trim().length < 5)}>{busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}{kind === "products" ? "Enregistrer le catalogue" : "Confirmer l’inventaire"}</button></div>
  </form>;
}
