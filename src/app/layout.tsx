import type { Metadata } from "next";
import "./globals.css";
import "./product-editor.css";
export const metadata: Metadata = { title: "Jasmin · Gestion commerciale", description: "CRM Jasmin — démonstration locale", robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="fr"><body>{children}</body></html>;
}
