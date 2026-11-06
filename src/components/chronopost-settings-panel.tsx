"use client";

import { useEffect, useRef, useState, type FormEvent, type HTMLInputTypeAttribute } from "react";
import { Check, CircleAlert, Copy, Eye, EyeOff, LoaderCircle, Save, Truck } from "lucide-react";
import { channels, type Channel } from "@/lib/model";
import { chronopostSettingsInput, type ChronopostPublicSettings, type ChronopostSettingsInput } from "@/lib/chronopost-contract";

const endpoint = "/api/demo/chronopost/settings";
const fieldId = (path: string) => `chronopost-${encodeURIComponent(path)}`;
async function settingsResponse(response: Response): Promise<ChronopostPublicSettings> {
  let data;
  try { data = await response.json(); }
  catch { throw new Error("Le serveur a renvoyé une réponse invalide. Réessayez dans un instant."); }
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "La configuration Chronopost n’a pas pu être traitée.");
  return data;
}
type Errors = Record<string, string>;
type ChannelSettings = ChronopostSettingsInput["channels"][Channel];
type Shipper = ChronopostSettingsInput["shipper"];

function SettingField({ path, label, value, onChange, errors, type = "text", autoComplete, maxLength = 160 }: {
  path: string; label: string; value: string; onChange(value: string): void;
  errors: Errors; type?: HTMLInputTypeAttribute; autoComplete?: string; maxLength?: number;
}) {
  const error = errors[path];
  return <label className="field" htmlFor={fieldId(path)}><span>{label}</span>
    <input id={fieldId(path)} type={type} value={value} onChange={event => onChange(event.target.value)}
      maxLength={maxLength} autoComplete={autoComplete} aria-invalid={Boolean(error)} aria-describedby={error ? `${fieldId(path)}-error` : undefined} />
    {error && <small className="chronopost-field-error" id={`${fieldId(path)}-error`}>{error}</small>}
  </label>;
}

export default function ChronopostSettingsPanel() {
  const [settings, setSettings] = useState<ChronopostPublicSettings | null>(null);
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [clearPassword, setClearPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const submitting = useRef(false);
  const saveController = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    fetch(endpoint, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) })
      .then(settingsResponse).then(data => {
        if (!controller.signal.aborted) { setSettings(data); setPassword(""); setVisible(false); setClearPassword(false); setErrors({}); setMessage(""); }
      }).catch(failure => {
        if (!controller.signal.aborted) setError(failure instanceof TypeError ? "Le serveur est inaccessible. Vérifiez la connexion puis réessayez." : failure instanceof Error && failure.name !== "TimeoutError" ? failure.message : "Le chargement a expiré. Réessayez.");
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);
  useEffect(() => () => saveController.current?.abort(), []);

  function updateShipper(key: keyof Shipper, value: string) {
    setSettings(current => current ? { ...current, shipper: { ...current.shipper, [key]: value } } : current);
    setMessage("");
  }
  function updateChannel(channel: Channel, key: keyof ChannelSettings, value: string) {
    setSettings(current => current ? { ...current, channels: { ...current.channels, [channel]: { ...current.channels[channel], [key]: value } } } : current);
    setMessage("");
  }
  function copyChannel(channel: Channel) {
    setSettings(current => current ? { ...current, channels: Object.fromEntries(channels.map(name => [name, { ...current.channels[channel] }])) as ChronopostPublicSettings["channels"] } : current);
    setErrors({}); setError("");
    setMessage(`Les réglages ${channel} ont été recopiés sur tous les canaux. Enregistrez pour les appliquer.`);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings || submitting.current) return;
    setError(""); setMessage(""); setErrors({});
    const parsed = chronopostSettingsInput.safeParse({ revision: settings.revision, enabled: settings.enabled, shipper: settings.shipper,
      channels: settings.channels, clearPassword, ...(password ? { password } : {}) });
    if (!parsed.success) {
      const nextErrors: Errors = {};
      for (const issue of parsed.error.issues) nextErrors[issue.path.join(".")] ??= issue.code === "too_big"
        ? `Ce champ doit contenir ${issue.maximum} caractères au maximum.`
        : issue.code === "too_small" ? "Renseignez ce champ."
        : issue.code === "invalid_format" && !/[àéèêîôùç]/i.test(issue.message) ? "Vérifiez le format de ce champ." : issue.message;
      setErrors(nextErrors); setError("Vérifiez les champs indiqués avant d’enregistrer.");
      const first = parsed.error.issues[0]?.path.join(".");
      if (first) document.getElementById(fieldId(first))?.focus();
      return;
    }
    submitting.current = true; setBusy(true);
    const controller = new AbortController(); saveController.current = controller;
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) });
      const data = await settingsResponse(response);
      if (controller.signal.aborted) return;
      setSettings(data); setPassword(""); setVisible(false); setClearPassword(false);
      setMessage("Configuration Chronopost enregistrée. La connexion n’a pas été testée et aucune étiquette n’a été générée.");
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof TypeError ? "Le serveur est inaccessible. Vos saisies sont conservées ; vérifiez la connexion puis réessayez." : failure instanceof Error && failure.name !== "TimeoutError" ? failure.message : "L’enregistrement a expiré. Vérifiez la configuration avant de réessayer.");
    } finally {
      submitting.current = false;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return <section className="panel chronopost-settings-panel" id="chronopost" aria-labelledby="chronopost-settings-title">
    <div className="panel-head"><div><h2 id="chronopost-settings-title">Expéditions · Chronopost</h2><p>Accès Web Services, expéditeur et contrats par canal</p></div><Truck size={22} aria-hidden="true" /></div>
    {loading && <p className="chronopost-feedback" role="status"><LoaderCircle className="spin" size={17} aria-hidden="true" />Chargement de la configuration…</p>}
    {!loading && !settings && <div className="chronopost-load-error"><p className="product-error" role="alert"><CircleAlert size={17} aria-hidden="true" />{error}</p><button className="button secondary" type="button" onClick={() => setReload(value => value + 1)}>Réessayer le chargement</button></div>}
    {settings && <form className="chronopost-settings-form" noValidate onSubmit={save} aria-busy={busy}>
      <div className="chronopost-settings-status"><span className={`badge ${settings.passwordPresent ? "shipped" : "ready"}`}>{settings.passwordPresent ? "Mot de passe enregistré" : "Accès à configurer"}</span><small>{settings.ready ? "Configuration enregistrée · connexion à vérifier lors d’un envoi" : "Complétez les accès, l’expéditeur et les contrats utilisés."}</small></div>
      <p className="chronopost-help">Utilisez le mot de passe <strong>Web Services Chronopost</strong>  : il correspond au code Chronotrace à six chiffres de l’e-mail de bienvenue, lié à votre contrat. Le mot de passe de votre espace client ne suffit pas. L’enregistrement conserve les réglages ; il ne teste pas la connexion.</p>
      <fieldset disabled={busy || loading} className="chronopost-settings-fields">
        <legend className="chronopost-section-title">Accès Web Services</legend>
        <div className="chronopost-password-field"><label className="field" htmlFor={fieldId("password")}><span>Mot de passe Web Services</span></label><div className="chronopost-password-input"><input id={fieldId("password")} type={visible ? "text" : "password"} autoComplete="new-password" spellCheck={false} maxLength={512}
          value={password} disabled={clearPassword} onChange={event => { setPassword(event.target.value); setMessage(""); }} aria-invalid={Boolean(errors.password)} aria-describedby={`chronopost-password-help${errors.password ? ` ${fieldId("password")}-error` : ""}`}
          placeholder={settings.passwordPresent ? "Laisser vide pour conserver le mot de passe enregistré" : "Saisir le mot de passe Web Services"} />
          <button type="button" className="chronopost-password-toggle" disabled={clearPassword} aria-pressed={visible} aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"} onClick={() => setVisible(value => !value)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
          <small id="chronopost-password-help">Laisser ce champ vide conserve le mot de passe enregistré.</small>{errors.password && <small className="chronopost-field-error" id={`${fieldId("password")}-error`}>{errors.password}</small>}
        </div>
        <div className="chronopost-options"><label><input id={fieldId("enabled")} type="checkbox" checked={settings.enabled} onChange={event => { setSettings({ ...settings, enabled: event.target.checked }); setMessage(""); }} />Autoriser la génération d’étiquettes Chronopost</label><label><input id={fieldId("clearPassword")} type="checkbox" checked={clearPassword} onChange={event => { setClearPassword(event.target.checked); if (event.target.checked) { setPassword(""); setVisible(false); } setMessage(""); }} />Effacer le mot de passe enregistré lors de l’enregistrement</label></div>
      </fieldset>
      <fieldset disabled={busy || loading} className="chronopost-settings-fields">
        <legend className="chronopost-section-title">Expéditeur</legend>
        <p className="chronopost-help">Départ de France métropolitaine. Renseignez l’adresse, le contact, l’e-mail et le téléphone ; le complément d’adresse est facultatif. Vous pouvez enregistrer une configuration incomplète et la terminer plus tard.</p>
        <div className="chronopost-fields-grid">
          {([ ["name", "Entreprise / nom de l’expéditeur", "organization"], ["contactName", "Nom du contact", "name"], ["address1", "Adresse", "address-line1"], ["address2", "Complément d’adresse", "address-line2"], ["zipCode", "Code postal", "postal-code"], ["city", "Ville", "address-level2"], ["email", "E-mail", "email"], ["phone", "Téléphone", "tel"] ] as const).map(([key, label, autoComplete]) => <SettingField key={key} path={`shipper.${key}`} label={label} value={settings.shipper[key]} errors={errors} type={key === "email" ? "email" : key === "phone" ? "tel" : "text"} autoComplete={autoComplete} maxLength={key === "zipCode" ? 10 : key === "email" ? 100 : key === "phone" ? 25 : 80} onChange={value => updateShipper(key, value)} />)}
          <label className="field"><span>Pays de départ</span><input value="France (FR)" readOnly aria-readonly="true" /></label>
        </div>
      </fieldset>
      <fieldset disabled={busy || loading} className="chronopost-settings-fields">
        <legend className="chronopost-section-title">Contrats par canal de vente</legend>
        <p className="chronopost-help">Le code produit désigne l’offre : 01 pour Chrono 13 sous contrat. Le code service précise la livraison : 0 pour la livraison normale, 6 pour l’option samedi si elle est prévue au contrat. Renseignez aussi le compte et son sous-compte pour chaque canal utilisé. Le mot de passe Web Services est commun aux canaux. Si le même contrat s’applique à tous les canaux, renseignez un canal puis recopiez ses réglages.</p>
        <div className="chronopost-channel-list">{channels.map(channel => <div className="chronopost-channel" key={channel}><div className="chronopost-channel-heading"><h3>{channel}</h3><button className="button secondary" type="button" onClick={() => copyChannel(channel)}><Copy size={13} aria-hidden="true" />Recopier sur tous les canaux</button></div><div className="chronopost-channel-grid">{([ ["accountNumber", "N° de compte"], ["subAccount", "Sous-compte"], ["productCode", "Code produit"], ["service", "Code service"] ] as const).map(([key, label]) => <SettingField key={key} path={`channels.${channel}.${key}`} label={label} value={settings.channels[channel][key]} errors={errors} autoComplete="off" maxLength={key === "accountNumber" || key === "subAccount" ? 9 : 3} onChange={value => updateChannel(channel, key, value)} />)}</div></div>)}</div>
      </fieldset>
      <div className="chronopost-feedback-slot" aria-live="polite">{error && <p className="product-error" role="alert"><CircleAlert size={17} aria-hidden="true" />{error}</p>}{message && <p className="import-success" role="status"><Check size={17} aria-hidden="true" />{message}</p>}</div>
      <div className="chronopost-settings-save">{error && <button className="button secondary" type="button" disabled={busy || loading} onClick={() => setReload(value => value + 1)}>Recharger les réglages (remplace mes saisies)</button>}<small>Aucune expédition n’est créée depuis ces paramètres.</small><button className="button" type="submit" disabled={busy || loading}>{busy ? <LoaderCircle className="spin" size={16} aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}Enregistrer la configuration Chronopost</button></div>
    </form>}
  </section>;
}
