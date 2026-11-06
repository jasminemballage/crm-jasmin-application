# Reprendre le CRM Jasmin

Point de reprise mis à jour le **6 novembre 2026**. Lire ce fichier puis [le bilan détaillé du 6 novembre](docs/REPRISE_2026-11-06.md). Les bilans plus anciens décrivent des étapes historiques et ne remplacent pas cet état.

## État actuel

- Dépôt de référence : https://github.com/jasminemballage/crm-jasmin-application.git, branche `main`.
- Application en ligne : https://crm-jasmin-application.vercel.app.
- Local et Vercel utilisent le même projet Supabase : `https://xtybdcqsqcgzhzjbgehs.supabase.co`. Les tables, membres autorisés, données, réglages chiffrés et documents privés sont déjà provisionnés/importés.
- Connexion email/mot de passe, lecture des mêmes données, accès au PDF Chronopost existant et déconnexion vérifiés sur les deux environnements. Tim a confirmé que la connexion fonctionne.
- Catalogue, stock, brouillons, imports/exports, commandes multicanales et détail destinataire, préparation de colis et intégration Chronopost sont présents. Les dernières créations du catalogue sont affichées en premier.
- OpenRouter propose les textes et faits sourcés, avec aperçu et choix des champs. L’indicateur d’attente est animé. Les images de fiches publiques HTTPS sont lues directement, y compris les galeries à chargement différé et les images sur CDN.
- Dernier correctif applicatif : `7047ca5`, publié et déployé sur Vercel. La fiche Duncan K/Loom restitue quatre photos en 800 × 800. Contrôle visuel local réussi avec réponses IA simulées, sans appel payant ni enregistrement de produit.
- Contrôles du correctif `7047ca5` : 151 tests automatisés, TypeScript, compilation de production et revue indépendante réussis.

Les 13 produits, 8 commandes et la révision 3 du bilan d’import sont un instantané du contrôle, pas des compteurs à rétablir. Relire l’état actuel via l’application : les utilisateurs peuvent l’avoir modifié depuis.

## Reprise locale sous Windows du 6 novembre 2026

- La copie locale a été synchronisée sur `main` au commit `9edc38e`. L’ancienne branche locale `codex/publication-initiale` a été conservée. L’installation verrouillée a réussi avec Node.js 24 et pnpm 11.25.0. Après un arrêt, relancer avec `pnpm dev` et ouvrir [la page de connexion locale](http://127.0.0.1:3000/connexion).
- Les cinq variables Supabase ont été complétées dans `.env.local`. Supabase Auth renvoyait HTTP 401 avec la première valeur de `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Après remplacement par la clé publique existante du projet Jasmin, Next.js a rechargé le fichier et Supabase Auth a répondu HTTP 200.
- La page locale de connexion répond. Le contrôle en lecture seule a confirmé l’accès à la base avec la clé serveur et le déchiffrement des réglages OpenRouter et Chronopost avec la clé existante. Pour valider une session complète sur ce poste, se connecter avec le compte CRM habituel et ouvrir le catalogue.
- Sur Windows, 147 tests sur 151 passent. Trois échecs portent sur le mode de fichier POSIX `0600` attendu par les tests Chronopost. Le quatrième reçoit `EPERM` lors de la création d’un lien symbolique par un test d’import.

## Installer sur un autre ordinateur

Prévoir Git, Node.js 22 ou plus récent et pnpm (version déclarée dans `package.json`).

Nouvelle copie :

```sh
git clone https://github.com/jasminemballage/crm-jasmin-application.git
cd crm-jasmin-application
pnpm install --frozen-lockfile
```

Copie Git existante : examiner `git status` et la branche avant toute mise à jour. Préserver les changements non publiés et les fichiers privés ; ne pas utiliser de reset forcé. Sur une copie propre :

```sh
git switch main
git pull --ff-only origin main
pnpm install --frozen-lockfile
```

Si la mise à jour refuse d’avancer, examiner les commits ou modifications locales avant de les intégrer. Ne pas les supprimer pour forcer le pull.

À la racine, créer `.env.local` avec les **cinq mêmes valeurs que sur le poste de Tim / Vercel Production** :

```dotenv
CRM_STORAGE_BACKEND=supabase
NEXT_PUBLIC_SUPABASE_URL=https://xtybdcqsqcgzhzjbgehs.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<valeur existante>
SUPABASE_SECRET_KEY=<valeur existante>
CRM_SETTINGS_ENCRYPTION_KEY=<valeur existante, inchangée>
```

Les valeurs privées sont à transférer par un canal privé depuis le fichier `.env.supabase.local` du poste de Tim. GitHub ne les contient pas. Si une valeur Secret est masquée dans Vercel, utiliser la copie privée existante. **Ne pas générer une nouvelle clé de chiffrement** : les réglages déjà enregistrés en dépendent.

Puis :

```sh
pnpm dev
```

Ouvrir http://127.0.0.1:3000 et utiliser le compte CRM existant. Les mots de passe des comptes sont disponibles auprès de Tim dans son fichier privé `.local/access/identifiants-crm.txt`, exclu de Git. Les clés OpenRouter et Chronopost sont déjà dans les réglages chiffrés de la base partagée : inutile de les recréer sur ce poste.

**Ne pas réexécuter `supabase/setup.sql`, réimporter les données, recréer les comptes ou réinitialiser le catalogue pour installer un autre poste.** Une nouvelle copie du code se connecte à la base existante. Les modifications faites en local touchent la même base que Vercel.

## Reprise du développement

Lire `AGENTS.md`, ce document, `docs/REPRISE_2026-11-06.md`, puis les fichiers liés à la tâche. Vérifier les fichiers et la branche réellement présents sur ce poste. Lire les guides Next.js locaux avant un changement de code, comme indiqué dans `AGENTS.md`.

- Publier les modifications terminées sur le dépôt de référence après les contrôles adaptés ; ne jamais publier secrets, données privées, sauvegardes ni PDF clients.
- Ne pas lancer de nouvelle étiquette réelle ni requête IA payante pour un simple contrôle technique.
- Conserver les états Chronopost incertains et réutiliser les PDF existants. La création d’une étiquette ne confirme pas l’expédition à la marketplace.
- Les règles métier restent celles du dépôt : réservations protégées, conditionnement en paquets/cartons, aucun mouvement de stock implicite par modification d’une fiche produit.
- La base active utilise les migrations de `supabase/migrations`. `prisma/schema.prisma` est historique et n’est pas le schéma utilisé à l’exécution.

## Ce qui reste à faire

- Les connexions Amazon, Cdiscount, RETIF, METRO et site Jasmin ne sont pas réalisées ; les commandes initiales restent des exemples.
- La double authentification n’est pas implémentée. Ne pas la présenter comme acquise ni annoncer une conformité Amazon globale.
- Les onglets produit Diffusion, Cibles marketplaces et Notes sont encore à venir.
- La vérification d’une étiquette ne prouve ni sa remise physique au transporteur ni un suivi complet. Les pages web qui exigent JavaScript ou bloquent les robots peuvent nécessiter un import manuel des photos.
- L’état métier est un JSONB versionné avec contrôle de concurrence. Prévoir normalisation/pagination avant une forte augmentation du volume ; aucun test de concurrence avec écritures sur la base réelle n’a été exécuté.

## Documents utiles

- [Bilan actuel et limites de validation](docs/REPRISE_2026-11-06.md)
- [Configuration Supabase et procédure de migration initiale](docs/SUPABASE.md)
- [Plan du projet](PLAN_CRM_JASMIN.md) et [audit des accès](AUDIT_CONNEXIONS_CRM_JASMIN.md) : historiques à revalider avant décisions externes.
- [Questionnaire Amazon](docs/AMAZON_QUESTIONNAIRE_SECURITE.md)
