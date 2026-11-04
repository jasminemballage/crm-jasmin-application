# CRM Jasmin — plan de développement de la première version

Date de cadrage : 16 octobre 2026.

Ce document conserve le plan et les décisions prises avec Jasmin pour reprendre le projet lors d’une prochaine session. Le cadrage a commencé le 16 octobre ; un premier socle local sur données fictives a été développé le 19 octobre 2026.

## 1. Résultat attendu

Développer une application web sur mesure, en français, accessible aux deux utilisateurs et hébergée sur le VPS de Jasmin.

La première version couvrira **le catalogue, la publication, les commandes, le stock et Chronopost** pour les cinq canaux déjà actifs : Amazon, Cdiscount, RETIF, METRO et jasminemballage.fr. La prospection sera développée dans un lot distinct après stabilisation des ventes.

Base fonctionnelle : [Cahier des charges CRM SARL Jasmin v1](docs/references/Cahier_des_charges_CRM_SARL_Jasmin_v1.pdf) et décisions prises avec Jasmin dans la conversation de cadrage.

### Données et décisions confirmées

- Environ 300 produits, dont les fiches se trouvent principalement sur Amazon.
- Un seul entrepôt.
- Paquet indivisible comme unité de stock ; les paquets sont rangés dans des cartons.
- Stock actuellement suivi sur Excel ou papier.
- Le CRM deviendra la référence du stock après vérification et bascule.
- Toutes les commandes Amazon sont expédiées par Jasmin.
- Les cinq canaux sont déjà actifs.
- Deux utilisateurs accéderont au CRM depuis leur navigateur.
- Hébergement sur un VPS que Jasmin prévoit de prendre.
- Destinations à prendre en charge : France et Union européenne.
- Impression des étiquettes Chronopost sur imprimante A4.
- Reprise souhaitée : tout l’historique disponible.
- Jasmin dispose d’un contact avec le développeur de jasminemballage.fr, mais n’a pas le code source du site.
- Priorités de la première version : catalogue et publication, ainsi que commandes, stocks et expéditions.
- Prospection des restaurants après stabilisation des flux de vente.

## 2. Architecture et interfaces

- **Application** : Next.js 16 avec TypeScript, PostgreSQL et Prisma. Interface claire avec navigation latérale, tableaux filtrables, fiches détaillées et actions groupées avec aperçu.
- **Synchronisations** : processus séparé utilisant pg-boss et PostgreSQL pour les tâches planifiées, les reprises et les files par connexion. Les traitements continueront lorsque les navigateurs sont fermés. [Documentation pg-boss](https://github.com/timgit/pg-boss)
- **Accès** : Better Auth, deux comptes nominatifs, rôles administrateur et opérateur, double authentification obligatoire pour les deux comptes afin d’intégrer les exigences Amazon identifiées pendant l’audit.
- **VPS** : Docker Compose, application et processus de synchronisation séparés, PostgreSQL privé, Caddy pour HTTPS et stockage persistant des images, justificatifs et étiquettes. Cette architecture permet l’auto-hébergement de Next.js. [Documentation Next.js](https://nextjs.org/docs/app/guides/self-hosting)
- **Connecteurs** : un adaptateur par canal, avec contrôle des données, transmission, consultation des résultats et rapprochement. Chaque connexion affichera sa dernière réussite, ses erreurs et ses éléments en attente.
- **Site sur mesure** : fournir au développeur un contrat REST versionné pour les produits, offres, commandes, disponibilités et suivis. Le CRM sera maître du catalogue validé et du stock ; le site transmettra ses commandes. Les adaptations du site seront réalisées avec son développeur.

## 3. Réalisation par lots

| Lot | Contenu et condition de sortie |
|---|---|
| **0 — Audit des connexions** | Vérifier les droits, interfaces et exemples réels sur les cinq canaux et Chronopost. Documenter les données récupérables, limites, services de transport et adaptations nécessaires au site. |
| **1 — Socle et écrans** | Créer l’authentification, les droits, les paramètres, le journal des actions et les écrans Catalogue, Stocks, Commandes, Expéditions et Connexions. |
| **2 — Catalogue et reprise** | Importer environ 300 produits, principalement depuis Amazon, avec aperçu, rapprochement des références, images et rapport d’erreurs. Importer le stock initial et tout l’historique accessible. |
| **3 — Pilote Amazon et Chronopost** | Réaliser le parcours complet : produit, offre, commande, réservation, colis, étiquette A4, confirmation d’expédition et retour du suivi. Valider sur un petit ensemble de produits. |
| **4 — Autres canaux** | Connecter Cdiscount, RETIF, METRO et le site, dans cet ordre. Valider publication, commandes, stock et suivi avant d’activer chaque connexion en production. |
| **5 — Mise en service** | Déployer sur le VPS, rapprocher les stocks, activer progressivement les échanges, tester les sauvegardes et fournir la documentation française. |

La prospection restera prévue au projet, avec un cadrage séparé portant sur la messagerie, les audiences, les campagnes, les oppositions et les relances.

L’enrichissement IA des fiches produit fait partie de la première version à la demande de Jasmin du 26 octobre 2026 : textes, recherche à partir d’un lien ou d’une référence, caractéristiques sourcées et propositions d’images, avec validation avant application. Les autres fonctions IA, le repricing, les SMS et WhatsApp restent des options. La comptabilité et la facturation complète sont hors du socle décrit dans cette version.

## 4. Règles métier à implémenter

- **Stock** : un seul entrepôt ; paquet indivisible comme unité de base ; nombre de paquets par carton défini pour chaque produit. Les offres consommeront les références physiques correspondantes, sans créer de stocks indépendants.
- **Disponibilité** : stock physique moins réservations et stock de sécurité paramétrable. Réservation transactionnelle des commandes éligibles ; annulation libérant la réservation ; expédition déduisant le physique et libérant la réservation une seule fois.
- **Reprise** : établir une date de bascule et valider le stock physique initial. Importer les commandes closes en consultation, sans mouvement de stock ni action externe. Rapprocher les commandes ouvertes et leurs réservations avant activation.
- **Historique** : récupérer tout ce que chaque canal autorise, compléter par les exports disponibles et indiquer les périodes effectivement reprises.
- **Publication** : conserver les adaptations par canal, distinguer produit et offre, contrôler les champs obligatoires et suivre le résultat distant. Une transmission réussie restera distincte d’une publication confirmée.
- **Chronopost** : France et Union européenne, services autorisés par le contrat, un ou plusieurs colis, PDF A4 conservés pour réimpression. Bloquer les destinataires incomplets. Confirmer l’expédition par une action manuelle lors de la remise au transporteur.
- **Fiabilité** : clés uniques pour les commandes, journal des mouvements, prévention des doubles actions et reprise contrôlée. Une réponse Chronopost incertaine entraînera une vérification avant toute nouvelle création.
- **Synchronisation** : relève des commandes toutes les cinq minutes et transmission du stock visée sous cinq minutes, selon les quotas externes. Rapprochement quotidien et alertes visibles en cas d’écart.
- **Données Amazon** : distinguer la reprise de l’historique et la conservation des données personnelles. Définir et vérifier la purge applicable aux coordonnées, étiquettes, exports et sauvegardes avant l’utilisation réelle des données ; le délai de conservation ne doit pas être déduit de la seule durée de l’historique importé.

## 5. Validation, exploitation et hypothèses

### Tests de réception

- Réimporter produits et commandes sans doublons.
- Traiter deux commandes simultanées sur les derniers paquets disponibles.
- Vérifier les conversions carton/paquet, annulations et expéditions partielles.
- Vérifier que l’historique ne modifie jamais le stock.
- Publier ou rattacher un produit sur chacun des cinq canaux et constater le résultat distant.
- Générer une étiquette A4 et un envoi multicolis, puis réimprimer sans nouvelle expédition.
- Simuler coupure, délai dépassé et limitation d’API ; reprendre sans doublon.
- Contrôler les droits, les exports et une restauration complète.

### Exploitation

Sauvegarde quotidienne chiffrée hors VPS, cible de conservation glissante de 30 jours à adapter aux catégories de données et aux obligations de suppression Amazon, objectif de perte maximale de 24 heures et restauration sous un jour ouvré. La stratégie de sauvegarde ne doit pas prolonger implicitement la conservation de données personnelles arrivées à échéance. Documenter le retour à la version précédente avec rapprochement des actions déjà transmises.

Le questionnaire Amazon ajoute des travaux de sécurité à réaliser et prouver : chiffrement et gestion des clés, journaux de sécurité conservés au moins 12 mois, environnements séparés, analyses du code, gestion des vulnérabilités et tests d’intrusion, procédures d’accès, changements et incidents. Les détails figurent dans la [fiche de préparation du questionnaire](docs/AMAZON_QUESTIONNAIRE_SECURITE.md). Ces exigences n’ont pas encore été mises en place ou validées pour le nouveau CRM.

### Hypothèses retenues

Environ 50 commandes quotidiennes ; expéditions effectuées par Jasmin ; CRM maître du stock après bascule ; Excel utilisé pour les imports et exports ; interface française et prix en euros par défaut. Les secrets resteront côté serveur, hors journaux et exports.

Le VPS, les accès techniques et la participation du développeur du site constituent les dépendances de déploiement. Le calendrier sera chiffré après le lot d’audit. Une connexion sans preuve de fonctionnement restera signalée comme non validée.

## Reprise à la prochaine session

**Fin de séance du 2 novembre 2026 :** Jasmin a demandé d’enregistrer tout le projet pour la prochaine séance. Nouvelle archive vérifiée du code, des documents, médias et données, hors secrets. Le [point de reprise](REPRISE_PROJET.md) précise de vérifier en premier le sac poulet : Sacs, photo originale et marque à confirmer. Le dernier résultat IA est conservé comme proposition à revoir, sans nouvel appel payant ni produit enregistré pendant la sauvegarde.

**Enrichissement du 2 novembre — version 0.3.3 :** catégorie, marque et images complétées par une lecture directe des métadonnées des fiches Jasmin. Catégorie Sacs et photo originale vérifiées lors d’un essai réel sur le sac poulet ; marque laissée vide et à confirmer à la demande de Jasmin. Le vendeur n’est pas une preuve de marque. Aperçus des photos avant application, 74 tests réussis, TypeScript et compilation validés. Le contrôle du navigateur intégré n’a pas abouti : vérifier la nouvelle proposition à l’écran lors de la reprise. Aucun produit enregistré. Voir le [bilan de l’extension](docs/ENRICHISSEMENT_2026-11-02_CATEGORIE_MARQUE_IMAGES.md).

**Correctif web du 2 novembre — version 0.3.2 :** l’erreur JSON signalée sur le sac à poulet de Jasmin a été reproduite et corrigée. Le mode web consulte la source puis construit la fiche dans un appel structuré sans outil web. Les réponses tronquées ou invalides sont refusées, un bloc Markdown unique peut être lu et les pièces ne sont pas assimilées à des paquets. 64 tests réussis, deux essais réels réussis depuis le lien exact, fiche laissée ouverte pour validation sans enregistrement. Voir le [bilan du correctif](docs/CORRECTIF_2026-11-02_JSON_ENRICHISSEMENT_WEB.md).

**Essais IA du 2 novembre 2026 — version 0.3.1 :** clé configurée par Jasmin et génération réelle des textes et images vérifiée, avec sélection/application des textes et ajout du visuel à la galerie dans le navigateur. Le modèle d’image refusé a été remplacé par `google/gemini-2.5-flash-image`. Consignes de texte resserrées pour les caractéristiques et usages non prouvés. Les données des produits et commandes restent inchangées. Prochaine étape : essai depuis un lien produit réel et avec photo de référence, puis captures des autres onglets. Voir le [bilan des essais](docs/SESSION_2026-11-02_ESSAI_OPENROUTER.md).

**Fiche produit du 26 octobre 2026 — version 0.3 :** l’onglet Infos reprend les cinq captures fournies : recherche produit, identifiants, titre et descriptions, galerie, génération d’image, prix HT/TTC et TVA, stock calculé, conditionnement, dimensions et attributs. Les brouillons incomplets sont conservés ; l’activation locale contrôle les champs métier. Le formulaire ne publie rien sur les canaux. OpenRouter est raccordé côté serveur avec un réglage de clé dans Paramètres, des propositions sélectionnables et des sources ; les connecteurs ont été vérifiés sur réponses simulées, sans clé réelle ni appel facturé. Les onglets Diffusion, Cibles marketplaces et Notes restent à spécifier avec Jasmin. Voir le [bilan de cette extension](docs/SESSION_2026-10-26_FICHE_INFOS_IA.md) et le [guide IA](docs/IA_ET_FICHE_PRODUIT.md). Les essais existants sont préservés.

**Reprise du 26 octobre 2026 — version 0.2 :** les imports de catalogue et d’inventaire sont développés pour le socle local, avec fichiers CSV/TSV ou collage depuis Excel, rapprochement par SKU, aperçu, contrôle des doublons, validation de lot et journalisation. Un inventaire remplace le physique ; les réservations sont protégées. Les lignes inchangées n’ajoutent aucun mouvement et les références absentes restent inchangées. Les 300 références ont été testées sur des données fictives dans un environnement de test isolé ; les produits réels n’ont pas été importés. Les essais existants de Jasmin sont conservés. Voir le [point de reprise actuel](REPRISE_PROJET.md) et le [guide d’essai](docs/ESSAI_GUIDE.md). PostgreSQL, les comptes sécurisés, la publication et les connexions réelles restent à construire. Les lots 1 et 2 sont donc partiellement réalisés ; ils ne sont pas terminés.

Mise à jour du 19 octobre 2026 : les lots 0 et 1 sont en cours. Un premier socle Next.js fonctionne localement avec 12 produits et 8 commandes fictifs : catalogue, mouvements en paquets/cartons, réservations, annulations, préparation partielle, remise simulée, fiche A4 interne et exports. Voir le [guide de démarrage](README.md). L’authentification, la double authentification, PostgreSQL, les imports réels, la publication et les connecteurs restent à implémenter. Le modèle PostgreSQL est préparé et validé syntaxiquement, sans connexion à une base.

Le compte Amazon SPP affiche « Jasminemballage » en Sandbox et « BAZ Production » en brouillon. Une demande antérieure d’accès SP-API est approuvée ; le profil est privé et le rôle restreint d’expédition est proposé. Les deux parties du questionnaire de sécurité sont reçues. Jasmin confirme que le VPS n’est pas commandé et qu’aucune procédure écrite n’est connue. Il faut mettre en place et prouver les protections, puis finaliser la demande restreinte sur cette base. L’audit des autres connexions reste à poursuivre. Consulter [l’audit](AUDIT_CONNEXIONS_CRM_JASMIN.md) et la [fiche du questionnaire](docs/AMAZON_QUESTIONNAIRE_SECURITE.md). La [note pour le développeur du site](docs/NOTE_DEVELOPPEUR_SITE.md) est préparée et non envoyée.

Lire ce document avant de commencer. Reprendre par la validation des écrans et des conditionnements avec Jasmin, puis PostgreSQL et les comptes sécurisés. Poursuivre en parallèle le **lot 0 — Audit des connexions**, avec Amazon, Chronopost et les échanges à prévoir avec le développeur du site.

Le dossier du projet ne contenait aucun code applicatif lors du cadrage. Aucun accès vendeur, secret technique, VPS ou service de transport n’a été configuré ou testé pendant cette phase. Les captures d’interface mentionnées dans le cahier des charges ne sont pas incluses dans le PDF fourni.
