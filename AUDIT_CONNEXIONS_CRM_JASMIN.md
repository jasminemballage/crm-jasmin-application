# CRM Jasmin — audit des connexions

Mis à jour le 19 octobre 2026. Lot 0 du [plan de développement](PLAN_CRM_JASMIN.md).

## Ajout du 4 novembre 2026

Le CRM possède maintenant le connecteur SOAP Chronopost `shippingV7`, une configuration par canal et le téléchargement des étiquettes PDF. Les tests automatisés utilisent un transporteur simulé. L’authentification du contrat a été vérifiée par une consultation de tarif ; un PDF a été généré sur le contrat officiel de test. Le nouvel essai utilisateur après correction a retourné un numéro de suivi et un PDF local valide. La remise physique et le suivi transporteur ne sont pas vérifiés. La première version couvre les colis domicile en France métropolitaine. Les connexions marketplaces et les validations de sécurité/hébergement ci-dessous restent à réaliser. Voir [le bilan](docs/COMMANDES_CHRONOPOST_2026-11-04.md).

## État de l’audit

L’audit documentaire a commencé. Aucun appel authentifié aux comptes de Jasmin n’a été réalisé et aucun connecteur n’est validé en production.

Les mentions « documenté » ci-dessous concernent les interfaces publiques des fournisseurs. Elles ne prouvent pas que le compte de Jasmin dispose des accès correspondants.

## Informations confirmées avec Jasmin

| Sujet | Situation confirmée |
|---|---|
| Amazon | Compte SPP reconnu ; deux applications identifiées. La demande antérieure de rôles supplémentaires est approuvée selon la réponse Amazon. « BAZ Production » utilise la SP-API vendeurs avec sept rôles cochés. La capture du profil confirme un fournisseur de solutions privé et le rôle « Expédition directe aux clients (Restreint) » proposé mais décoché. Aucune demande active ni approbation spécifique de ce rôle n’est démontrée. |
| Expédition Amazon | Les commandes sont préparées et expédiées par Jasmin depuis son entrepôt. |
| Chronopost | Les étiquettes sont actuellement créées dans l’espace client Chronopost. |
| Catalogue | Environ 300 produits, principalement référencés sur Amazon. |
| Stock | Un entrepôt ; suivi Excel ou papier ; paquet indivisible ; conversion des cartons en paquets à définir par référence. |
| Site | Un développeur est joignable ; Jasmin ne possède pas le code source du site. |
| Autres canaux | Cdiscount, RETIF, METRO et le site sont déjà actifs. |
| Déploiement | Application web partagée ; Jasmin confirme le 19 octobre que le VPS n’est pas encore commandé. |
| Procédures de sécurité | Jasmin indique le 19 octobre n’avoir connaissance d’aucune procédure écrite existante. Les protections de l’ensemble des systèmes de l’entreprise ne sont pas auditées. |

## Matrice de faisabilité à compléter

| Connexion | Base documentaire | Accès Jasmin | Prochaine preuve attendue |
|---|---|---|---|
| Amazon | SP-API documentée : catalogue, offres et commandes. | Profil privé confirmé ; rôle d’expédition directe proposé mais décoché dans le profil et absent du formulaire de l’application observé. | Préparer la demande du rôle restreint avec les réponses réelles sur l’usage et la sécurité, puis vérifier l’approbation, la configuration de l’application et l’autorisation vendeur. |
| Chronopost | Les guides officiels décrivent des intégrations utilisant le contrat et les webservices. | Espace client utilisé ; accès webservices non vérifié. | Confirmer les services du contrat, les accès techniques et les possibilités d’essai ; vérifier ensuite le format A4 et le multicolis. |
| Cdiscount | API Octopia officielle documentée. | Compte actif ; accès technique non vérifié. | Identifier le compte, les autorisations et la lecture d’une commande ; relever le fonctionnement de l’acceptation des commandes. |
| RETIF | Les conditions de RETIF identifient Mirakl comme éditeur de la plateforme. | Compte actif ; URL vendeur, version et permissions non vérifiées. | Relever l’instance du compte et consulter sa documentation avant de choisir l’adaptateur. |
| METRO | Un portail développeur officiel décrit des services produits, offres et commandes. | Compte actif ; portail et interface applicables au compte non identifiés. | Identifier l’espace vendeur exact, sa documentation, ses clés et ses exigences de validation. |
| jasminemballage.fr | Site existant sur mesure ; échanges techniques à définir avec le développeur. | Pas de code source disponible dans le projet. | Obtenir le retour du développeur sur les interfaces existantes et les adaptations possibles. |
| Service email | Prospection prévue après les flux de vente. | Fournisseur non choisi. | À traiter lors du cadrage du lot prospection. |

## Priorité 1 — Amazon

### Chemin d’intégration retenu

Le besoin correspond à une application privée réservée à Jasmin. Amazon documente un profil développeur et un mécanisme d’autorisation pour ce type d’application. L’accès au compte vendeur seul ne suffit pas à démontrer que ces étapes sont réalisées. [Inscription développeur privé](https://developer-docs.amazon.com/sp-api/docs/register-as-a-private-developer), [vue d’ensemble SP-API](https://developer-docs.amazon.com/sp-api/docs/onboarding-overview)

La documentation distingue le catalogue Amazon, les offres du vendeur et les exigences des types de produits. Le connecteur devra rapprocher les SKU du vendeur, les ASIN et les références physiques du CRM. [Gestion des fiches et offres](https://developer-docs.amazon.com/sp-api/lang-en_EN/docs/manage-product-listings-guide)

### Vérifications à réaliser

- [x] Ouvrir « Applications et services » puis « Développer des applications » : Jasmin confirme une redirection vers Solution Provider Portal, chemin `/account/program`, le 19 octobre 2026.
- [x] Examiner la capture du portail : compte SPP « Jasminemballage » reconnu, adresse connectée et plusieurs rôles affichés ; un lien « Page d’accueil » est proposé pour continuer.
- [x] Examiner la page d’accueil du compte existant : deux applications identifiées dans le texte transmis par Jasmin, « Jasminemballage » en Sandbox et « BAZ Production » en brouillon.
- [x] Lire la décision transmise par Jasmin : la demande d’accès à des SP-API supplémentaires est approuvée en fonction des rôles demandés.
- [x] Confirmer la sélection « Fournisseur de solutions privé » dans le profil développeur fourni par Jasmin.
- [ ] Vérifier l’accès de l’utilisateur principal pour l’autorisation effective du compte vendeur.
- [ ] Documenter les rôles nécessaires au catalogue, aux offres, aux commandes et aux données de livraison.
- [x] Examiner le formulaire de « BAZ Production » : type d’API SP, vendeurs cochés, fournisseurs décochés et rôles sélectionnés relevés sur la capture.
- [ ] Vérifier l’usage actuel de « BAZ Production » avant de décider de sa réutilisation pour le CRM ; le profil développeur présenté est privé.
- [x] Localiser le rôle « Expédition directe aux clients (Restreint) » dans le profil développeur : proposé et décoché sur la capture du 19 octobre.
- [ ] Préparer les réponses relatives à l’usage des données et aux contrôles réellement opérationnels pour une demande de ce rôle ; sa soumission et son approbation restent à constater.
- [ ] Configurer l’application et son autorisation lorsque le profil et les contrôles techniques requis sont prêts.
- [ ] Lire une offre existante et rapprocher son SKU et son ASIN avec un produit physique.
- [ ] Lire une commande à expédier par Jasmin, avec ses lignes et les coordonnées effectivement accessibles.
- [ ] Vérifier les dates d’historique accessibles et les exports complémentaires disponibles.

Pour les commandes, la version 2026-01-01 est la cible documentaire initiale. Elle utilise notamment `searchOrders`, `getOrder` et le paramètre `includedData`. L’accès aux coordonnées personnelles repose sur les rôles appropriés ; cette version ne demande pas de RDT pour cet accès. Ces autorisations restent à contrôler sur le compte réel. [Guide officiel de migration Orders](https://developer-docs.amazon/sp-api/docs/orders-api-migration-guide)

Lors d’une éventuelle mise à jour du profil développeur, décrire les contrôles de sécurité réellement mis en place. L’approbation d’accès reçue ne constitue pas une validation technique du futur CRM : son code et son VPS ne sont pas encore configurés.

### Redirection observée le 19 octobre 2026

Le lien communiqué par Jasmin pointe vers le domaine officiel `solutionproviderportal.amazon.com`, chemin `/account/program`. Les paramètres d’inscription propres au compte ne sont pas recopiés dans ce document. Cette redirection est compatible avec le parcours documenté par Amazon, mais elle ne prouve pas la création d’un profil développeur, d’une application ou d’une autorisation API.

La [capture fournie par Jasmin](<C:/Users/jasmi/OneDrive/Bureau/captures ecran/ssp.png>) montre une page d’intégration des profils développeurs avec un compte SPP « Jasminemballage » déjà reconnu et une adresse connectée. Des rôles sont affichés, notamment « Offre de produits » et « Tarification ». La mention « BAZ Production » est également visible ; sa nature reste à vérifier dans les détails du compte. Le bandeau inférieur indique de continuer par le lien « Page d’accueil » pour les comptes SPP existants.

Cette capture confirme qu’il faut examiner le compte reconnu avant d’en créer un autre. Elle ne prouve pas encore qu’une application exploitable pour le CRM existe, ni que l’accès aux coordonnées de livraison est autorisé.

### Applications identifiées depuis la page d’accueil

Source : texte de la page transmis par Jasmin le 19 octobre 2026. Aucun identifiant secret LWA ou jeton d’autorisation n’a été communiqué.

| Application | ID de l’application | Statut affiché | Vérification restante |
|---|---|---|---|
| Jasminemballage | `amzn1.sp.solution.e2c16df7-9b0d-4296-bf33-8b7f51c86ad5` | Sandbox | Application d’essai ; ne pas la considérer comme une preuve d’accès aux commandes réelles. |
| BAZ Production | `amzn1.sp.solution.b3763550-ab6c-47f9-862f-f29f3f8b12cc` | Brouillon | Vérifier l’usage actuel, le type privé/public, les rôles demandés et les autorisations du compte vendeur avant de retenir cette application pour le CRM. |

Le bandeau annonce « Votre profil de développeur a été examiné » et propose « Afficher la décision ». Jasmin a ensuite transmis la réponse d’Amazon : la demande d’accès à des SP-API supplémentaires a été approuvée, selon les rôles demandés. Le message ne fournit pas la liste détaillée de ces rôles. [Suivi officiel de la demande développeur](https://developer-docs.amazon/sp-api/docs/check-the-status-of-your-request-to-register-as-a-developer)

Le nom « BAZ Production » est un nom d’application et ne démontre pas son état opérationnel. À l’inverse, le statut « Brouillon » n’interdit pas à lui seul une utilisation réelle : Amazon documente l’auto-autorisation des applications privées en brouillon. Le type d’application et les autorisations doivent donc être contrôlés avant de conclure. [Autorisation des applications privées](https://developer-docs.amazon/sp-api/docs/self-authorization)

Les ID d’application ci-dessus ne sont pas les identifiants LWA à employer pour obtenir un jeton d’accès. Les secrets et les jetons ne seront pas inscrits dans les documents d’audit.

### Décision d’accès communiquée le 19 octobre 2026

L’approbation est confirmée par le texte de la réponse d’Amazon fourni par Jasmin. La date de la décision elle-même n’est pas précisée dans le texte reçu. Les instructions et liens du message constituent des références documentaires, pas la preuve qu’une application est déjà autorisée sur le compte vendeur.

Étape suivante : ouvrir « Modifier l’application » pour « BAZ Production » et relever uniquement ses paramètres non secrets, notamment son type et les rôles sélectionnés. Vérifier également son usage actuel avant toute modification. [Accès aux informations de l’application](https://developer-docs.amazon/sp-api/docs/updating-your-application-information)

Si cette application est privée et convient à Jasmin, vérifier ensuite son autorisation pour le compte vendeur concerné. L’approbation de rôles sur le profil et l’autorisation effective de l’application sont deux vérifications distinctes. Aucun jeton n’a encore été généré pour ce projet et aucun appel authentifié n’a été effectué.

### Configuration de « BAZ Production » observée le 19 octobre 2026

Source : [capture du formulaire d’enregistrement](<C:/Users/jasmi/OneDrive/Bureau/captures ecran/enr.png>) fournie par Jasmin.

- Type d’API affiché : « API SP ».
- Entités prises en charge : « Vendeurs » coché ; « Fournisseurs » décoché.
- Rôles cochés : Finances et comptabilité ; Communication de l’acheteur ; Tarification ; Suivi des stocks et des commandes ; Expédié par Amazon ; Sollicitation de l’acheteur ; Offre de produits.
- Rôle « Informations sur les partenaires de vente » décoché.
- Délégation des PII à l’application d’un autre développeur : « Non » sélectionné.
- Aucun rôle d’expédition directe ni autre rôle restreint donnant accès aux coordonnées n’est visible sur cette capture.

Le formulaire précise lui-même que le suivi des stocks et commandes ne comprend pas les informations requises pour les étiquettes d’expédition. Pour l’usage prévu, le rôle à vérifier est « Direct-to-Consumer Shipping (Restricted) ». La documentation Orders 2026 le prévoit notamment pour les coordonnées de contact et l’expédition des commandes traitées par le marchand ; un RDT n’est pas exigé par cette version, mais les rôles et conditions d’accès restent requis. [Accès aux données personnelles des commandes](https://developer-docs.amazon/sp-api/docs/access-orders-pii)

Si le rôle nécessaire n’est pas disponible dans la configuration d’application, Amazon indique de le demander dans le profil développeur avant de l’ajouter à l’application et de renouveler son autorisation. Son absence visuelle ne permet pas encore de conclure à un refus. [Rôles SP-API](https://developer-docs.amazon/sp-api/docs/roles-in-the-selling-partner-api)

La question de délégation en bas du formulaire concerne une application d’un autre développeur : le choix « Non » ne constitue pas une autorisation d’accès direct aux adresses. Aucun paramètre n’a été modifié et aucun enregistrement n’a été effectué pendant cet audit.

### Profil privé et rôle d’expédition observés le 19 octobre 2026

Source : [capture du profil développeur](<C:/Users/jasmi/OneDrive/Bureau/captures ecran/role.png>) fournie par Jasmin.

Le type sélectionné est « Fournisseur de solutions privé ». Le rôle « Expédition directe aux clients (Restreint) » est proposé, avec la case décochée. Il est situé avant les rôles restreints de facturation et de versement des taxes. La capture établit sa disponibilité dans le formulaire, pas l’existence d’une demande en cours ni son approbation.

Le texte du formulaire annonce des informations supplémentaires sur l’usage des données et les contrôles de sécurité pour les rôles restreints. La prochaine étape consiste à sélectionner le rôle correspondant au besoin d’expédition, puis à examiner ces questions avec Jasmin avant de préparer la soumission. Aucune sélection ni soumission n’a été effectuée par l’agent.

Les réponses devront décrire la situation réelle. Le déploiement du nouveau CRM et de son VPS reste à réaliser ; les protections projetées ne doivent pas être déclarées comme déjà opérationnelles. L’usage prévu des coordonnées est la préparation et le suivi des expéditions, sans réutilisation automatique en prospection. [Demande et ajout de rôles SP-API](https://developer-docs.amazon/sp-api/docs/roles-in-the-selling-partner-api)

### Questionnaire de sécurité reçu le 19 octobre 2026

Jasmin a fourni les deux parties du questionnaire pour les rôles restreints. Elles demandent des mesures et processus effectifs, notamment politiques écrites, chiffrement et gestion des clés, accès, journaux, tests, vulnérabilités, sauvegardes et gestion des incidents. Les descriptions détaillées sont limitées à 500 caractères par champ.

Jasmin confirme que le VPS n’est pas encore commandé et qu’aucune procédure de sécurité écrite n’est connue. Les réponses positives sur le futur CRM ne peuvent donc pas être préparées comme si les protections prévues étaient déjà installées. Une [fiche de préparation question par question](docs/AMAZON_QUESTIONNAIRE_SECURITE.md) recense les éléments à réunir et les impacts sur le développement. Aucun « Oui », texte de réponse ou accord n’a été saisi ou soumis par l’agent.

La préparation du rôle restreint nécessite désormais la mise en place et la vérification du socle concerné. Le développement local peut progresser sur des données fictives pendant ce travail ; l’intégration réelle des coordonnées Amazon reste à valider ultérieurement.

## Priorité 2 — Chronopost

Le fonctionnement actuel dans l’espace client est confirmé, mais il ne valide pas l’accès du futur CRM aux webservices. Un guide de module officiel illustre la configuration du contrat et des accès associés ; il ne constitue pas un connecteur prêt pour le projet sur mesure. [Guide officiel Chronopost](https://static.chronopost.fr/pdf/chronopost/Guide_Shopify_-_Version_1.2.2.pdf)

- [ ] Confirmer les services utilisés pour la France et l’Union européenne, ainsi que les éventuels sous-comptes.
- [ ] Vérifier avec Chronopost les accès webservices rattachés au contrat et la documentation applicable.
- [ ] Identifier une méthode de vérification des accès sans création d’envoi payant.
- [ ] Vérifier le format A4, le multicolis, la réimpression et les capacités de rapprochement d’une réponse incertaine.
- [ ] Identifier les informations disponibles pour le suivi et les conditions d’annulation des étiquettes.
- [ ] Réaliser ultérieurement un essai d’étiquette expressément validé, en conservant la preuve du résultat.

Les tentatives de consultation des descriptions WSDL par l’outil web n’ont pas abouti. Elles ne démontrent ni l’indisponibilité du service ni l’absence d’accès du contrat. Aucun appel de création d’expédition n’a été effectué.

## Autres canaux et site

**Cdiscount.** La documentation officielle renvoie vers Octopia. Le cycle peut comporter une acceptation vendeur avant préparation ; ce réglage devra être relevé sur le compte pour définir correctement l’éligibilité à l’expédition. [API Cdiscount](https://marketplace.cdiscount.com/en/api/), [commandes Octopia](https://developer.octopia-io.net/api-reference/orders-management/)

**RETIF.** La référence à Mirakl dans les conditions publiques est un indice technique. L’URL, les droits, les catégories et les capacités du compte doivent être vérifiés séparément. [Conditions de la marketplace RETIF](https://www.retif.eu/cgv-cgu-marketplace/)

**METRO.** Le portail développeur présente plusieurs services distincts. Le connecteur sera déterminé à partir du compte réel ; l’interface de RETIF ne sera pas supposée identique. [Portail développeur METRO](https://developer.metro-selleroffice.com/docs/certification-process/production/)

**Site.** Une [note pour le développeur](docs/NOTE_DEVELOPPEUR_SITE.md) prépare les points à vérifier et les échanges attendus. Elle n’a pas été envoyée.

## Données d’essai à rapprocher

Préparer un petit échantillon comprenant un produit vendu au paquet, une offre portant sur plusieurs paquets ou un carton si elle existe, une commande à expédier et une commande close. Pour chaque référence, relever les identifiants par canal et le nombre de paquets réellement consommés par une vente.

Les coordonnées personnelles nécessaires à la livraison resteront dans l’environnement de travail protégé lors des essais ; les rapports d’audit et exemples partagés seront anonymisés.

## Environnement local observé

Au 19 octobre 2026, le dossier contient un premier socle Next.js sur données fictives, en plus des documents de cadrage. Node.js et pnpm sont disponibles ; Docker et `psql` ne sont pas repérés dans le PATH. Cela ne prouve pas leur absence complète du poste. Voir le [guide de démarrage](README.md).

La démonstration conserve ses essais dans un fichier local, avec un verrou pour un seul processus. Avant les données réelles et les accès multiutilisateurs, il faudra intégrer PostgreSQL, les comptes nominatifs, la double authentification et les protections prévues, puis préparer l’environnement Docker Compose du VPS. Le schéma Prisma est une préparation, sans base ni migration exécutée.

## Prochaine action de session

Faire essayer le parcours catalogue → stock → commande → colis sur données fictives, puis intégrer la base partagée et les accès sécurisés. Préparer les besoins du VPS, installer et vérifier les protections répertoriées dans la fiche du questionnaire. Les deux parties du formulaire sont déjà reçues : ne pas les redemander. Finaliser les réponses à partir des éléments réellement opérationnels avant la demande restreinte ; après approbation, vérifier l’ajout du rôle et l’autorisation vendeur. L’accès réel aux coordonnées et les essais API restent à démontrer. Aucun appel de marketplace ou de transporteur n’a été effectué par la démonstration.
