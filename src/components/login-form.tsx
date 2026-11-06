"use client";
import { useState, type FormEvent } from "react";
import { Flower2, LoaderCircle, LockKeyhole } from "lucide-react";

export default function LoginForm({ next, initialError = "" }: { next: string; initialError?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password"), next }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      window.location.assign(data.redirect);
    } catch (error) { setError(error instanceof Error ? error.message : "Connexion indisponible. Réessayez."); setBusy(false); }
  }
  return <main className="login-page"><section className="login-card panel" aria-labelledby="login-title">
    <div className="brand"><span className="brand-icon"><Flower2 size={30} strokeWidth={1.5} /></span><span>jasmin<span className="brand-sub">GESTION COMMERCIALE</span></span></div>
    <span className="eyebrow">JASMIN EMBALLAGE</span><h1 id="login-title">Votre espace partagé<span className="heading-dot">.</span></h1>
    <p className="login-intro">Connectez-vous pour retrouver le catalogue, les stocks et les commandes de votre équipe.</p>
    <form onSubmit={submit} aria-busy={busy}>
      <label className="field"><span>Email</span><input name="email" type="email" autoComplete="username" required maxLength={254} disabled={busy} /></label>
      <label className="field"><span>Mot de passe</span><input name="password" type="password" autoComplete="current-password" required maxLength={1024} disabled={busy} /></label>
      {error && <p className="login-error" role="alert">{error}</p>}
      <button className="button" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <LockKeyhole size={17} />}{busy ? "Connexion…" : "Se connecter"}</button>
    </form><p className="login-help">Accès réservé aux comptes autorisés. Pour obtenir un accès ou retrouver votre mot de passe, contactez l’administrateur de votre espace.</p>
  </section></main>;
}
