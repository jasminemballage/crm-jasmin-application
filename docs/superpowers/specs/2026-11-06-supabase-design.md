# Données partagées Supabase

Suite de docs/REPRISE_2026-11-04.md. Tim demande le 6 novembre de connecter le projet Supabase qu'il a créé, pour modifier et retrouver les mêmes données en local et sur Vercel. Il connecte les accès. La publication sur le dépôt de référence est autorisée.

## Approche retenue pour cette migration

Conserver le domaine et les identifiants existants : état métier versionné JSONB dans PostgreSQL, écriture conditionnelle atomique par révision ; Auth Supabase et liste de membres autorisés ; Storage privé pour médias et documents. Ce choix d'implémentation conserve les validations métier existantes et les parcours déjà testés. Une normalisation relationnelle complète du schéma Prisma inutilisé pourra suivre : elle multiplierait ici les changements métier sans être nécessaire au partage. Le stockage temporaire Vercel est exclu.

## Contrats

- CRM_STORAGE_BACKEND=supabase active explicitement le mode partagé. Une configuration incomplète ou une panne distante échoue sans retour aux fichiers locaux.
- Tables privées, RLS activée, aucun accès direct anon/authenticated aux données métier. Les routes serveur vérifient utilisateur Supabase et appartenance crm_members avant usage de la clé serveur. Aucune inscription publique au CRM.
- crm_state : id=1, revision, payload JSONB. Compare-and-swap SQL pour toute mutation ; pas de relance automatique ni de reset en mode partagé. État absent = initialisation nécessaire, jamais de seed automatique.
- crm_settings : id provider, revision, payload chiffré AES-256-GCM. CRM_SETTINGS_ENCRYPTION_KEY identique sur les deux serveurs ; secret omis conservé, clear explicite, conflit signalé.
- Bucket privé crm-private, chemins media/<filename> et chronopost/<shipment>/<attempt>/*. Le chemin API des images et PDF reste stable. Réponses brutes accessibles seulement au serveur.
- Chronopost : claim SQL atomique par colis ; pending écrit avant appel, attempt_id pour finalisation conditionnelle ; pending/uncertain jamais recyclés automatiquement. Validation du colis/commande dans l'état courant au claim. PDF créé réutilisé, même absent du stockage : jamais recréation automatique.
- Import explicite local : validation, aperçu sans secrets, objets vérifiés par hash, conservation états/incertitudes/verrous orphelins. Publication de l'état métier seulement à la fin ; destination déjà initialisée refusée. Aucun écrasement des données locales.
- Connexion email/mot de passe des comptes provisionnés ; session cookie vérifiée serveur. Aucun email envoyé sans demande explicite. Origin contrôlé sur mutations.
- L'activation distante nécessite les accès projet et déploiement. Un build ou des tests simulés ne valent pas preuve de partage réel.

## Limites

Les marketplaces ne sont pas connectées. Les commandes de démonstration existantes restent telles quelles. Aucun essai transporteur facturable pour valider la migration. Upload images via serveur limité à 4 Mo, compatible avec Vercel ; les images historiques plus grandes sont importées via Storage.
