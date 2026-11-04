# Reprendre le CRM Jasmin

**Reprise du 4 novembre 2026 :** CRM relancé sur `127.0.0.1:3000`. La fiche du sac poulet est maintenant enregistrée en **brouillon**, référence interne **JAS-8144620D-323**, catégorie Sacs, photo originale copiée dans les médias locaux et marque vide, à confirmer. Jasmin confirme la vente par carton entier de **500 sacs à 39,99 € HT**. Dans le modèle actuel, une unité de stock correspond à un carton : 500 pièces par unité et une unité par carton. Le poids et les dimensions d’expédition seront complétés plus tard, à sa demande. Le format 20+8x35 cm décrit le sac individuel.

Les données comptent désormais **14 produits, 8 commandes, aucun colis, révision 3** ; les 13 produits précédents et les commandes sont conservés. La photo enregistrée a été relue et son empreinte comparée à la copie source : identique. Aucun nouvel appel IA n’a été lancé. Jasmin a ensuite demandé la publication de tout le code sur GitHub et a terminé l’authentification. Le dépôt public est [jasminemballage/crm-jasmin-application](https://github.com/jasminemballage/crm-jasmin-application). Les secrets, les données locales et les pièces de référence sont exclus du suivi Git.

**Fin de séance enregistrée le 2 novembre 2026, version 0.3.3, à la demande de Jasmin.** Le code, les documents, les médias et les données enregistrées sont sauvegardés dans une nouvelle archive vérifiée de `sauvegardes/`. Aucun nouvel appel IA ni changement de données métier n’a été effectué pour cette sauvegarde. La clé OpenRouter reste configurée sur le poste et exclue de l’archive.

**À reprendre en premier :** vérifier à l’écran l’enrichissement du sac poulet : catégorie **Sacs**, **photo originale** et **marque vide, à confirmer**. Le contrôle du navigateur intégré n’avait pas abouti. Le dernier résultat réel de l’IA est conservé dans [la copie de reprise](docs/REPRISE_FICHE_SAC_POULET_2026-11-02.json), pour le consulter sans nouvel appel payant. Cette copie est une proposition, pas un produit enregistré ni une capture de la saisie actuelle du formulaire. Ne pas appliquer les prix, dimensions ou conditionnements sans les vérifier. Préserver toute saisie encore ouverte avant un rechargement.

**Dernière extension — 2 novembre, version 0.3.3 :** enrichissement catégorie, marque et images renforcé pour les fiches du site Jasmin. Un essai réel de la route du CRM sur le sac poulet a retourné **Sacs**, une marque vide et la photo originale. Jasmin a demandé de laisser la marque à confirmer : ne pas la remplacer par le nom du vendeur. Aperçus des photos et sélection des champs ajoutés. **74 tests, TypeScript et compilation réussis.** Le contrôle du navigateur intégré a expiré ; l’affichage de cette nouvelle proposition et son application restent à vérifier à l’écran. Aucun produit enregistré. Voir le [bilan de l’extension](docs/ENRICHISSEMENT_2026-11-02_CATEGORIE_MARQUE_IMAGES.md).

**Dernier correctif — 2 novembre, version 0.3.2 :** erreur JSON de l’enrichissement web reproduite puis corrigée sur le lien du sac à poulet fourni par Jasmin. Consultation web et mise en forme séparées, lecture des blocs Markdown et validation stricte, protection de la conversion pièces/paquets. 64 tests réussis. La fiche utilisateur reste ouverte avec sa saisie et les propositions à vérifier, sans application ni enregistrement par l’agent. Voir le [bilan du correctif](docs/CORRECTIF_2026-11-02_JSON_ENRICHISSEMENT_WEB.md).

Point mis à jour le 2 novembre 2026, après les essais réels d’OpenRouter.

**Sauvegarde précédente du 26 octobre 2026 à 19 h 22 (Paris), à la demande de Jasmin.** Reprendre par l’essai de la fiche Infos et la configuration OpenRouter, puis les captures des autres onglets. Aucun nouvel appel IA ni changement de données n’a été effectué lors de cette sauvegarde.

**Reprise du 2 novembre — version 0.3.1 :** Jasmin a enregistré sa clé directement dans le CRM. Les textes et les images ont été testés avec succès, y compris l’application des textes et l’ajout d’un visuel à la galerie dans le navigateur. Le modèle d’image initial a été refusé ; la configuration utilise maintenant `google/gemini-2.5-flash-image`. Les essais ont consommé des crédits OpenRouter et sont documentés dans le [bilan de cette reprise](docs/SESSION_2026-11-02_ESSAI_OPENROUTER.md). Les modifications fictives de formulaire ont été refermées sans enregistrement : les données existantes sont inchangées.

## Où nous en sommes

Le socle local **version 0.3.3** comprend le catalogue, le stock en paquets/cartons, les réservations, les annulations, les colis partiels, la remise simulée, la fiche A4 interne, le journal et les imports/exports avec aperçu.

La fiche **Nouveau produit → Infos** reprend les cinq captures de Jasmin : lien et référence de recherche, contexte, EAN, marque, catégorie, titre, descriptions, galerie, prix HT/TTC et TVA, stock disponible calculé, conditionnement, poids, dimensions et attributs. Les brouillons peuvent rester incomplets ; l’activation locale exige les champs métier et la validation des visuels IA. Elle ne publie rien sur les marketplaces. Les autres onglets restent à définir.

OpenRouter est raccordé pour proposer des textes, consulter un lien ou rechercher une référence, et générer un visuel. Les propositions sont sélectionnées puis appliquées par l’utilisateur. La clé est déjà configurée côté serveur : ne pas la redemander ni l’afficher. Les textes, les visuels sans photo et le web depuis un lien exact sont vérifiés ; la recherche sans lien et la photo de référence restent à essayer.

Les essais existants sont conservés, avec le nouveau brouillon du sac poulet : **14 produits, 8 commandes, aucun colis, révision 3**. La copie avant création du brouillon est dans `.local/sauvegardes/`. Ne pas réinitialiser ces données sans demande de Jasmin.

## Pour rouvrir

1. Si le CRM n’est pas déjà lancé, double-cliquer sur `DEMARRER_CRM.cmd` et attendre « Ready ».
2. Ouvrir `http://127.0.0.1:3000/catalogue`.
3. Laisser la fenêtre du lanceur ouverte pendant les essais.

Le serveur de développement a été laissé en marche sur le port 3000. Lire le [guide de démarrage](README.md) si nécessaire.

## Prochaine séance

1. Faire essayer Infos à Jasmin sur un produit fictif : brouillon, modification, photos, HT/TTC, conditionnement et activation.
2. Vérifier la fiche du sac poulet et consulter d’abord [la proposition conservée](docs/REPRISE_FICHE_SAC_POULET_2026-11-02.json) : catégorie Sacs, photo originale et marque à confirmer. Vérifier les aperçus et appliquer les champs souhaités, sans écraser la saisie existante. Ne pas recharger une fiche non enregistrée. Si une nouvelle consultation est nécessaire, utiliser **Enrichir depuis le web**. Le test réel du lien exact est réussi ; la photo de référence reste à essayer. La clé est déjà enregistrée : ne pas relancer les essais payants sans nécessité.
3. Recueillir les captures et règles de **Diffusion**, **Cibles marketplaces** et **Notes**, puis développer ces onglets. Leurs boutons sont indiqués « À venir ».
4. Jasmin n’avait pas encore essayé les mouvements de stock et les colis au point précédent : conserver le [parcours guidé](docs/ESSAI_GUIDE.md) pour les valider ensemble et vérifier la présentation A4 avant impression.
5. Poursuivre PostgreSQL, les deux comptes nominatifs et la double authentification, puis le VPS et les protections nécessaires aux connexions réelles.

Pour les imports, l’inventaire remplace le physique. Une réception supplémentaire passe par un mouvement d’entrée. Les réservations sont protégées ; les modifications de fiche ne changent pas le physique. Les brouillons ne sont pas proposés pour les nouvelles commandes.

## Vérifications

- **74 tests** réussis après l’extension catégorie/marque/images, dont les protections JSON, les deux étapes, les interruptions, le conditionnement et dix cas de lecture des fiches source.
- Contrôle TypeScript, compilation et validation syntaxique du schéma PostgreSQL réussis.
- **47 contrôles HTTP** vérifiés le 26 octobre sur un serveur et un fichier séparés, avec IA réelle désactivée. Ils n’ont pas été relancés intégralement pour cette correction du connecteur IA.
- Essais réels du 2 novembre : textes proposés, sélectionnés et appliqués ; image générée, prévisualisée et ajoutée à la galerie ; badge « IA · à valider » et validation de fidélité non cochée. Formulaires refermés sans sauvegarder les données fictives. La clé a été renseignée par Jasmin, sans affichage par l’agent.
- [Capture de la fiche](docs/apercus/fiche-produit-infos.png) conservée. La recette complète avec Jasmin, les différentes tailles d’écran et l’impression A4 restent à effectuer.

## Sauvegardes et secrets

Les archives datées se trouvent dans `sauvegardes/`, avec sources, documents, tests et copie cohérente des données. L’archive **v0.3.1 du 2 novembre** inclut les deux médias de test générés et un fichier de vérification. Dépendances, compilations, fichiers de test et secrets sont exclus.

La sauvegarde **v0.3.3** ajoute les améliorations de lecture des fiches, les dix tests et la preuve résumée de l’essai réel, avec une copie de la photo source dans `docs/apercus/`. Les photos web de la galerie restent des liens externes ; cette copie documentaire ne les transforme pas en médias locaux de la fiche.

Le cahier des charges PDF et les cinq captures de référence de l’onglet Infos sont également copiés dans `docs/references/`, pour être disponibles lors de la reprise et dans l’archive de fin de séance.

Les photos sont dans `.local/media/` : une copie JSON seule ne les contient pas. La configuration OpenRouter est dans `.env.local`, uniquement sur le poste et sans chiffrement applicatif. L’archive ne sauvegarde pas cette clé ; il faut la reconfigurer lors d’une restauration sur un autre poste. Aucun secret ne doit être ajouté aux documents de reprise.

## Points à conserver

- Environ 300 produits réels ; un seul entrepôt ; paquet indivisible comme unité de stock.
- Cinq canaux prévus : Amazon, Cdiscount, RETIF, METRO et le site Jasmin. Connexions vendeurs et Chronopost désactivées.
- Amazon : profil développeur approuvé pour les rôles précédemment demandés, application BAZ Production en brouillon ; accès restreint d’expédition et autorisation vendeur à finaliser et vérifier.
- Au dernier point confirmé, le VPS n’était pas commandé et aucune procédure de sécurité écrite existante n’était connue. Aucun changement communiqué depuis.
- Les deux parties du questionnaire Amazon sont reçues : ne pas les redemander. Décrire uniquement les protections réellement mises en place et vérifiées.
- Chronopost : compte client existant ; services web et contrat à confirmer.
- La note pour le développeur du site est préparée et n’a pas été envoyée.
- Utiliser des données clients/commandes fictives : stockage local non chiffré, comptes sécurisés et base partagée non intégrés.

Documents : [plan](PLAN_CRM_JASMIN.md), [audit](AUDIT_CONNEXIONS_CRM_JASMIN.md), [bilan Infos et IA](docs/SESSION_2026-10-26_FICHE_INFOS_IA.md), [guide IA](docs/IA_ET_FICHE_PRODUIT.md), [bilan imports](docs/SESSION_2026-10-26_IMPORTS.md), [questionnaire Amazon](docs/AMAZON_QUESTIONNAIRE_SECURITE.md).
