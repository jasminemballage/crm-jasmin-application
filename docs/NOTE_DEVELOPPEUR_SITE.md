# CRM Jasmin — note pour le développeur de jasminemballage.fr

Préparée le 19 octobre 2026. Brouillon technique à examiner avec Jasmin ; non envoyé.

## Objectif

Connecter le site existant au futur CRM Jasmin sans refonte du site. Le CRM centralisera le catalogue validé, les disponibilités, les commandes et les expéditions Chronopost pour le site et quatre marketplaces.

Le projet prévoit environ 300 produits, un entrepôt et un stock géré au paquet indivisible. Les cartons et offres multiples auront des coefficients de consommation en paquets.

## Informations à vérifier côté site

- Technologies et versions employées, mode d’hébergement et possibilité d’utiliser un environnement de test.
- Interfaces déjà disponibles pour lire les commandes et modifier les produits, prix, stocks et suivis.
- Identifiants stables des produits, variantes, offres, commandes et lignes de commande ; présence des SKU et EAN.
- Manière dont le site distingue le produit physique, son conditionnement et la quantité vendue.
- Statuts de paiement, d’annulation et d’expédition réellement disponibles.
- Possibilité d’exporter l’historique des commandes et de récupérer seulement les changements depuis une date ou un curseur.
- Possibilité d’ajouter des points d’API ou des notifications, avec estimation des adaptations et du délai.

## Échanges attendus

| Flux | Direction métier | Résultat attendu |
|---|---|---|
| Catalogue et offres | CRM vers site | Création ou mise à jour des produits, attributs, images et conditions commerciales validées pour le site. |
| Disponibilités | CRM vers site | Mise à jour du vendable calculé par le CRM dans l’unité de vente du site. |
| Commandes et modifications | Site vers CRM | Transmission des commandes, lignes, quantités, montants, coordonnées autorisées et changements de statut. |
| Expéditions et suivis | CRM vers site | Association des colis, lignes et numéros de suivi à la bonne commande. |

## Principes d’intégration

- Le CRM devient maître du stock après une bascule concertée ; les mises à jour ne doivent pas former une boucle entre les systèmes.
- Prévoir un contrat REST versionné, des accès machine limités aux flux nécessaires et HTTPS.
- Utiliser les identifiants externes stables pour rendre les réimports et nouvelles tentatives sans doublon.
- Séparer l’accusé de réception technique de l’application effective d’une modification.
- Fournir un suivi des erreurs et un mécanisme de reprise.
- Valider ensemble le traitement des commandes en cours au moment de la bascule.

Les URL, schémas de messages et modalités de notification ou de relève seront figés après examen des interfaces existantes. Cette note expose les besoins ; elle ne prétend pas que le site dispose déjà de ces capacités.

## Résultat demandé pour terminer l’audit du site

Une description des interfaces existantes, un exemple anonymisé de produit et de commande, les adaptations nécessaires, la disponibilité d’un environnement de test et la personne chargée des modifications côté site.
