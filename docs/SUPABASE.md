# Configurer les données partagées

**Projet Jasmin actuel — 6 novembre 2026 :** migrations, import, comptes et connexion locale/Vercel sont terminés et vérifiés. Pour installer un autre ordinateur, suivre [Reprendre le CRM Jasmin](../REPRISE_PROJET.md) : reprendre les cinq variables existantes et lancer le code. **Ne pas rejouer la procédure initiale ci-dessous sur la base active.** Voir [le bilan de validation](REPRISE_2026-11-06.md).

## Procédure initiale pour une nouvelle base vide

Les étapes suivantes sont conservées comme procédure de provisionnement, pas comme tâches restantes pour Jasmin. Les contrôles locaux ne prouvent pas une connexion réelle : toute nouvelle base doit être vérifiée après son propre import.

1. Dans le projet Supabase cible, Sofiane ouvre **SQL Editor**, colle le contenu de [`supabase/setup.sql`](../supabase/setup.sql) et exécute le script une seule fois. Celui-ci regroupe les migrations `supabase/migrations` dans une transaction : cœur CRM/Storage puis Chronopost. Conserver le bucket `crm-private` privé et les RLS actives. Les tables métier ne sont pas accessibles aux clés publiques.
2. Provisionner manuellement les comptes email/mot de passe dans Supabase Auth, sans invitation ni email automatique. Désactiver l’inscription publique. Ajouter leurs UUID Auth dans `crm_members(user_id, enabled)` ; aucun UUID ne doit être inventé.
3. Depuis **Settings → API Keys**, Sofiane transmet par un canal privé la Publishable key et une Secret key du projet. Tim les renseigne dans le fichier privé `.env.supabase.local` préparé sur son poste (jamais dans la conversation). L’URL et la clé de chiffrement y sont déjà renseignées. Après validation de l’import, copier ces seules variables dans `.env.local`, sans remplacer ses autres réglages. Configurer les mêmes valeurs dans **Vercel → projet → Settings → Environment Variables**, puis redéployer : `CRM_STORAGE_BACKEND=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` et `CRM_SETTINGS_ENCRYPTION_KEY` (32 octets aléatoires encodés base64). La clé serveur et la clé de chiffrement restent secrètes, jamais préfixées `NEXT_PUBLIC_`. Préserver la clé de chiffrement : les réglages existants en dépendent. Ne pas committer `.env.local`.
4. Arrêter les modifications locales et les processus de développement pendant l’import. Sauvegarder `.local` et `.env.local`. L’outil ne supprime ni ne modifie ces sources et ne contacte jamais IA/Chronopost.

Aperçu local sans écriture distante, avec nombres et empreinte seulement :

```sh
node --env-file=.env.local --import tsx scripts/import-supabase.ts
```

Après vérification du bon projet et sauvegarde, appliquer explicitement :

```sh
node --env-file=.env.local --env-file=.env.supabase.local --import tsx scripts/import-supabase.ts --apply
```

La destination ne doit contenir aucun `crm_state`. L’import conserve IDs et révision, chiffre les réglages locaux, conserve tous les médias, les historiques/audits Chronopost et les verrous orphelins. `.local/test-runs` est exclu. Un verrou orphelin devient un historique incertain durable ; un PDF manquant ne transforme jamais une étiquette créée en autorisation de recréer. Le compteur `missingPdfs` appelle une récupération du PDF existant auprès du transporteur.

Les objets existants sont relus et comparés par SHA-256, jamais écrasés. Les réglages/historiques existants doivent être identiques, sinon l’import s’arrête. Une interruption avant publication peut laisser des objets ou réglages privés ; relancer reprend sans écrasement. L’état CRM est inséré en dernier après vérification des lectures et d’une empreinte de source inchangée. Après publication, une nouvelle importation est refusée. Les vérifications de source ne remplacent pas l’arrêt des écritures locales.

`.local/supabase-import.lock` empêche deux imports locaux concurrents. Après un arrêt brutal, vérifier qu’aucun import ne tourne avant de retirer ce seul verrou d’import ; ne jamais retirer les verrous Chronopost pour autoriser une nouvelle étiquette. Le verrou n’est pas distribué : lancer un seul import depuis une seule machine.

Après application, vérifier connexion d’un membre autorisé, refus d’un non-membre, lecture/modification depuis local et Vercel avec la même révision, images privées et PDF existant. Aucun envoi transporteur ou appel IA payant n’est nécessaire pour ces contrôles. Ne pas annoncer ces contrôles distants comme réussis avant exécution.

## Points de contrôle

Les utilisateurs doivent être créés dans **Authentication → Users → Add user** (email/mot de passe, pas d’invitation), puis autorisés dans `crm_members` avec leurs vrais UUID. L’interface de connexion ne crée pas de compte. Les deux comptes de Jasmin sont déjà créés et autorisés ; leurs mots de passe sont transmis séparément, jamais via GitHub.

Ne pas activer le mode partagé tant que l’import et au moins un membre ne sont pas prêts. Les aperçus Vercel ne doivent pas recevoir les clés de production par défaut. Activer les variables sur Production et sur le poste local choisi, puis vérifier avant d’étendre aux autres environnements.

La version initiale conserve un état métier JSONB complet avec contrôle transactionnel de révision. Les règles métier sont exécutées côté serveur ; les tables et fonctions sont interdites aux rôles publics. Les images et PDF sont délivrés par des liens signés valides 60 secondes après contrôle de session. Avant une forte augmentation du catalogue, prévoir pagination/normalisation de l’état pour ne pas atteindre la limite de taille de réponse de Vercel.

Références : [clés Supabase](https://supabase.com/docs/guides/getting-started/api-keys), [sessions serveur](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [variables et redéploiement Vercel](https://vercel.com/docs/environment-variables/managing-environment-variables).
