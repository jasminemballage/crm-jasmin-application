# CRM Jasmin — version locale 0.3.3

Code source : dépôt public [jasminemballage/crm-jasmin-application](https://github.com/jasminemballage/crm-jasmin-application).

Correctif du 4 novembre : budget de génération adapté aux modèles avec raisonnement, et état de préparation animé dans la fiche produit. Voir le [diagnostic et les vérifications](docs/CORRECTIF_2026-11-04_ENRICHISSEMENT.md).

Cette étape fournit une application utilisable sur cet ordinateur pour valider le parcours métier avec Jasmin. **Toutes les données initiales sont fictives. Aucun canal ni transporteur n’est connecté.**

Le dépôt de code exclut les clés et configurations locales, les données enregistrées, les médias locaux, les sauvegardes, ainsi que les PDF/captures de référence et preuves d’essais. Ces éléments restent dans la copie locale du projet ; certains liens documentaires vers ces pièces nécessitent cette copie.

## Fiche produit Infos et enrichissement IA

Le formulaire **Nouveau produit / Modifier** comprend l’onglet Infos : lien prioritaire, référence de recherche, contexte, EAN/GTIN avec contrôle de clé, marque, catégorie, titre, descriptions courte et longue, galerie d’images, prix HT/TTC avec TVA choisie, disponible calculé, conditionnement, poids/dimensions et attributs spécifiques. Les onglets Diffusion, Cibles marketplaces et Notes sont annoncés pour la suite.

Un brouillon peut être conservé sans titre, poids ou conditionnement connus, avec une référence interne générée si nécessaire. L’activation locale exige les champs métier et la validation des visuels IA. Une fiche active n’est pas automatiquement publiée. Les brouillons ne sont pas proposés pour de nouvelles commandes. Les réservations des commandes déjà reçues restent conservées.

Les photos importées (PNG/JPEG/WebP, 8 Mo par image, 8 images par produit) sont conservées dans `.local/media/` ; le JSON ne contient que leurs métadonnées. Le premier visuel est l’image principale. Les images IA restent des propositions à vérifier avant ajout et activation. La copie JSON seule ne contient pas les fichiers image : conserver aussi le dossier des médias, ou l’archive complète de fin de séance.

Pour l’IA, ouvrir **Paramètres → Enrichissement IA · OpenRouter** et saisir la clé dans le champ prévu, jamais dans la conversation. La clé est enregistrée dans `.env.local`, côté serveur et ignorée par Git ; elle n’est pas renvoyée par l’API ni incluse dans les sauvegardes. Le fichier local n’est pas chiffré. Les modèles et les règles globales d’image sont modifiables. L’enregistrement de la configuration ne lance aucun appel payant ; les boutons de la fiche utilisent ensuite les crédits du compte OpenRouter.

L’enrichissement propose les textes et, en mode web, des faits accompagnés de sources à consulter. Les faits nouveaux sans source sont écartés, ainsi que les EAN dont la clé de contrôle est invalide. L’utilisateur choisit les champs à appliquer ; les propositions ne changent pas le stock, la TVA ou les publications. Une modification du contexte invalide une proposition précédente. La génération d’une image peut utiliser une photo locale comme référence ; elle est alors transmise à OpenRouter lors de la requête.

Depuis la version 0.3.3, les fiches de jasminemballage.fr bénéficient aussi d’une lecture directe des métadonnées du produit : catégorie adaptée, marque explicitement déclarée et photos originales. Le vendeur n’est pas utilisé comme marque. Une marque absente reste vide avec l’indication « À confirmer ». Les photos proposées affichent un aperçu avant ajout à la galerie. Sur le sac poulet de Jasmin, le test réel a confirmé **Sacs**, aucune marque et une photo originale. Voir le [bilan catégorie, marque et images](docs/ENRICHISSEMENT_2026-11-02_CATEGORIE_MARQUE_IMAGES.md).

Voir [la configuration et les limites de l’IA](docs/IA_ET_FICHE_PRODUIT.md). Les textes et images ont été vérifiés réellement le 2 novembre. Le correctif 0.3.2 a ensuite validé l’enrichissement depuis le lien public du sac à poulet fourni par Jasmin, en séparant consultation web et construction contrôlée de la fiche. Les propositions restent à vérifier avant application. Voir le [bilan du correctif](docs/CORRECTIF_2026-11-02_JSON_ENRICHISSEMENT_WEB.md). La recherche sans lien exact et la génération avec photo de référence restent à essayer.

## Ouvrir le CRM

1. Double-cliquer sur **DEMARRER_CRM.cmd** dans ce dossier.
2. Laisser la fenêtre ouverte et attendre le message `Ready`.
3. Ouvrir **http://127.0.0.1:3000** dans le navigateur.
4. Pour arrêter, revenir dans cette fenêtre et utiliser **Ctrl+C**.

Si le port 3000 est déjà occupé, fermer l’autre lancement du CRM. Les dépendances sont déjà installées sur ce poste. Pour une nouvelle installation : Node.js 22 minimum et `pnpm install --frozen-lockfile`.

## Parcours à essayer ensemble

1. Dans **Catalogue**, créer ou modifier une fiche produit, ses pièces par paquet et ses paquets par carton.
2. Dans **Stocks**, saisir une entrée de deux cartons avec son motif. Vérifier la conversion en paquets.
3. Dans **Commandes**, créer une commande test. Le disponible baisse par réservation, le physique reste inchangé.
4. Ouvrir la commande puis **Préparer un colis**. Réduire une quantité pour tester plusieurs colis.
5. Dans **Expéditions**, ouvrir la **Fiche A4**, puis **Simuler la remise**.
6. Vérifier que le physique et le réservé ont baissé du même nombre de paquets. Une répétition de la remise n’effectue aucune nouvelle sortie.
7. Annuler le solde d’une autre commande : ses réservations restantes sont libérées.

La fiche A4 est un document de préparation interne, **non valable pour le transport**. Aucune étiquette Chronopost ni facture n’est générée.

Les filtres, recherches, imports avec aperçu, exports CSV et la copie complète sont disponibles. Les modifications sont conservées dans `.local/demo-state.json`, ignoré par Git. Un fichier illisible est conservé et bloque les modifications, sans retour silencieux au jeu initial. La réinitialisation volontaire se trouve dans **Paramètres** et demande une confirmation. L’export complet permet de conserver ses essais ; sa restauration n’a pas encore d’écran.

## Importer un catalogue ou un inventaire

Dans **Catalogue** ou **Stocks**, choisir **Importer un CSV**. Télécharger le modèle, puis sélectionner son fichier CSV/TSV ou coller directement les colonnes copiées depuis Excel, en-tête compris. Vérifier l’aperçu, corriger les erreurs et cocher la confirmation avant d’enregistrer.

- **Catalogue** : rapprochement par SKU, insensible à la casse. Les références absentes sont créées à zéro stock. Pour les références existantes, les cellules vides conservent les valeurs actuelles. Les colonnes de stock sont ignorées dans cet import. Les nouvelles fiches exigent tous les champs du modèle.
- **Inventaire** : les quantités **remplacent** le stock physique ; elles ne s’ajoutent pas au stock existant. Renseigner soit `StockPaquets`, soit `StockCartons` pour chaque ligne. Les cartons utilisent le coefficient actuel de la fiche produit. Le motif est obligatoire et les écarts sont journalisés.
- Limites : 1 Mo, 1 000 lignes. Séparateurs point-virgule, virgule et tabulation ; prix français avec virgule ou point. UTF-8, UTF-16 avec marque d’encodage et Windows-1252 acceptés.
- Les doublons, quantités invalides, produits inconnus ou stocks inférieurs aux réservations bloquent tout le lot. Si les données changent après l’aperçu, il faut l’actualiser et confirmer de nouveau.
- Réimporter un fichier identique ne crée aucun produit supplémentaire et n’ajoute aucun paquet. Les lignes inchangées ne génèrent pas de nouveaux mouvements.

Le [parcours d’essai guidé](docs/ESSAI_GUIDE.md) utilise uniquement les modèles fictifs fournis. Un fichier XLSX doit être enregistré au format CSV, ou ses cellules peuvent être copiées puis collées dans le formulaire.

## Périmètre de cette étape

- Catalogue et stock en paquets ; coefficient carton propre à chaque produit.
- Import du catalogue et des inventaires avec aperçu, contrôles et confirmation du lot.
- Réservation des commandes, contrôle du stock de sécurité et rejet du surstock vendu.
- Détection des commandes répétées par canal et référence.
- Colis partiels, annulation du solde, déduction lors de la remise simulée, prévention des doubles sorties.
- Commandes historiques closes en consultation, sans impact stock.
- Journal des actions et mouvements ; export CSV protégé contre l’interprétation de formules.
- État réel des six connexions prévues : **non connectées**.

Le stockage de démonstration utilise un fichier et un verrou dans **un seul processus local**. Il n’est pas une base partagée ni un système de sauvegarde. Les routes refusent les hôtes distants et les écritures depuis une origine différente. Le mode production est bloqué par défaut ; `CRM_LOCAL_DEMO=1` ne sert qu’aux essais sur localhost et ne rend pas ce logiciel exploitable sur un serveur.

**Utiliser des clients, adresses et commandes fictifs ; ne pas saisir d’identifiants vendeurs ou transport dans cette version.** La clé OpenRouter peut être renseignée uniquement dans le formulaire serveur prévu dans Paramètres. Les fichiers locaux ne sont pas chiffrés par l’application. Les comptes nominatifs, droits et double authentification ne sont pas encore implémentés.

## Développement et contrôles

Application Next.js 16, React, TypeScript. Les données et les règles sont séparées de l’interface dans `src/lib/`. Les règles ne nécessitent aucun appel externe.

```text
pnpm dev           # serveur local de développement
pnpm test          # réservations, colis, concurrence locale et protection des données
pnpm typecheck     # contrôle TypeScript
pnpm build         # compilation de l’application
pnpm schema:check  # validation du modèle PostgreSQL prévu
```

Les contrôles HTTP de `tests/http-smoke.mjs` nécessitent un serveur de test isolé, par exemple sur `127.0.0.1:3101`, lancé avec `CRM_LOCAL_DEMO=1`, `CRM_AI_DISABLED=1` et `CRM_DEMO_DATA_FILE=.local/test-runs/http-state.json`. Fournir ces mêmes variables, ainsi que `CRM_TEST_BASE_URL=http://127.0.0.1:3101`, au script de contrôle. Le port 3000 et le fichier des essais de Jasmin sont refusés par ce script. La variable de fichier reste limitée au dossier `.local` ; ne jamais partager le même fichier entre plusieurs processus. Les médias et la configuration des tests sont séparés des médias et secrets de l’application utilisateur.

`prisma/schema.prisma` est le modèle initial de la prochaine étape. Il n’est pas encore relié à l’application. Aucun serveur PostgreSQL, migration, client généré ni transaction PostgreSQL n’a été exécuté. Il faudra notamment ajouter les contraintes SQL de quantités, les transactions et verrous de réservation, les tables d’authentification et le stockage chiffré des données destinataires à durée limitée avant activation réelle.

## Prochaine étape du projet

Valider les écrans et les conditionnements avec Jasmin, puis intégrer PostgreSQL, les deux comptes avec double authentification et les procédures de sécurité. Ensuite seulement : VPS, sauvegardes testées, autorisation Amazon, pilote commandes/stock/Chronopost, puis les autres canaux.

Le plan détaillé est conservé dans `PLAN_CRM_JASMIN.md`, l’état des accès dans `AUDIT_CONNEXIONS_CRM_JASMIN.md` et les écarts du questionnaire Amazon dans `docs/AMAZON_QUESTIONNAIRE_SECURITE.md`. Cette démonstration ne constitue pas une preuve de conformité à ces exigences.
