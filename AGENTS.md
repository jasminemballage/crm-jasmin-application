<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Dépôt du projet

Le dépôt de référence est `https://github.com/jasminemballage/crm-jasmin-application.git`.
Tim demande de publier sur ce dépôt les modifications développées ensemble, après les contrôles adaptés. Ne pas laisser un travail terminé uniquement dans la copie locale ; signaler tout blocage de publication. Les secrets et les données locales restent exclus conformément au `.gitignore`.

## Reprendre sur un autre poste

Lire d’abord `REPRISE_PROJET.md`, puis `docs/REPRISE_2026-11-06.md`. Ils décrivent l’état vérifié le 6 novembre ; les bilans précédents sont historiques. Supabase et les comptes sont déjà provisionnés et utilisés par local/Vercel : une nouvelle copie du code se connecte avec les cinq variables existantes, sans rejouer le setup SQL, l’import, ni changer la clé de chiffrement. Préserver les changements locaux avant de synchroniser Git. Les données peuvent avoir évolué depuis les compteurs documentés.
