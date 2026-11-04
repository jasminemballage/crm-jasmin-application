# Commandes multicanales et Chronopost — 4 novembre 2026

## Résultat

La liste des commandes reprend la structure des captures fournies : indicateurs, sources, statuts, recherche, dates, montants, tri et pagination. Le clic ouvre une fenêtre avec client, destinataire, coordonnées, adresse, fenêtres d’expédition/livraison, flags, informations marketplace, lignes et montants. Les données facultatives préservent la lecture des fichiers locaux existants. Aucun client réel des captures n’est incorporé au jeu de démonstration ou au dépôt.

Les montants TTC ne sont affichés que lorsqu’ils sont fournis ; les anciens montants HT restent HT. Articles commandés et paquets physiques sont distingués. Les données de livraison finale, remboursement et incident ne sont pas encore alimentées : les onglets concernés sont indisponibles, sans faux compteurs.

## Chronopost

Le choix confirmé est la génération directe dans le CRM par l’API, avec `shippingV7`, SOAP 1.1 et PDF. Le formulaire utilise le colis préparé (allocations, poids et dimensions) et préremplit le destinataire lorsqu’il existe. Une adresse complète et une confirmation explicite sont requises. Le contrat est relu au retour dans l’onglet et toutes les dix secondes visibles, sans effacer les coordonnées saisies ni lancer de création ; une modification du contrat invalide la confirmation précédente. Générer l’étiquette ne modifie ni le stock ni le statut marketplace ; la remise reste une opération distincte.

Dans Paramètres, la configuration contient l’expéditeur, le mot de passe Web Services et les comptes/sous-comptes/produits/services par canal. Un seul canal complet suffit pour commencer ; le canal concerné est contrôlé avant chaque création. Le mot de passe est commun aux canaux. Des contrats avec des mots de passe différents demandent une extension.

Les secrets restent côté serveur dans `.env.local`, hors Git. L’API ne renvoie que leur présence. Les sauvegardes IA et Chronopost partagent un verrou par chemin dans le processus, conservé entre instances de modules Next, pour empêcher l’écrasement des paramètres voisins. Les fichiers et les PDF ne sont pas chiffrés ; le socle reste une application locale, sans authentification de production.

Avant l’appel au transporteur, une tentative est enregistrée sur disque sous verrou exclusif. Une réussite est réutilisée, y compris après réouverture ou remise du colis. Une coupure, une réponse invalide ou un résultat incertain bloque la régénération. Le bouton de vérification relit l’état local ; il ne rapproche pas encore l’envoi avec Chronopost. En cas d’incertitude persistante, consulter l’historique Chronopost et récupérer l’étiquette existante avec le support ; ne pas supprimer les marqueurs pour forcer un nouvel envoi.

Le périmètre initial couvre un PDF par colis, livraison à domicile en France métropolitaine. Relais, DOM, international/douane, enlèvement, annulation transporteur et suivi synchronisé ne sont pas implémentés. Les étiquettes et marqueurs sont conservés dans `.local/chronopost/`, hors export JSON des commandes ; sauvegarder aussi ce dossier.

## Sources primaires

- Contrat SOAP et types vérifiés dans le [WSDL ShippingServiceWS](https://ws.chronopost.fr/shipping-cxf/ShippingServiceWS?wsdl).
- Le [guide officiel 7.6.5](https://static.chronopost.fr/modulesecommerce/Prestashop/Guide_module_Chronopost_pour_Prestashop_1.7.8%2B_-_Version_7.6.5_FR.pdf), pages 22–23, indique que le mot de passe Web Services est le code Chronotrace à six chiffres lié au contrat.
- Le [module officiel 7.6.7](https://static.chronopost.fr/modulesecommerce/Prestashop/chronopost_7.6.7_for_prestashop_v1.7.8_8.x_9.x.zip), distribué depuis la [page Chronopost e-commerce](https://www.chronopost.fr/fr/plateformes-e-commerce), confirme pour les clients sous contrat : Chrono 13 produit `01`, service normal `0`, option samedi `6`. Ces codes ne prouvent pas l’activation d’une option sur un contrat donné.

## Vérification

- 104 tests automatisés passent : règles métier existantes, métadonnées, montants, configuration, concurrence, XML/PDF, erreurs transporteur, tentatives interrompues et absence de doubles créations.
- 10 scénarios Playwright passent dans un Chrome isolé : filtres, détail, coordonnées absentes, création confirmée, réutilisation PDF, résultat incertain, canal incomplet, chargement récupérable, paramètres, mobile et mise à jour du contrat depuis un autre onglet sans perte du destinataire. Toutes les routes API sont interceptées avec des données fictives ; aucune création réelle.
- Captures inspectées sur ordinateur et mobile. Le navigateur intégré ne pouvait pas initialiser son module de service ; les essais utilisent une nouvelle session Chrome sans profil utilisateur.
- TypeScript et compilation de production passent.
- 47 contrôles HTTP passent sur le serveur séparé `127.0.0.1:3101`, avec données de test restaurées. Les données utilisateur du port 3000 ne sont pas utilisées.

Aucun appel authentifié Chronopost ni PDF réel n’a été émis pendant ces contrôles. Les informations fournies par Tim sont enregistrées uniquement dans sa configuration locale. L’authentification du contrat et le premier envoi restent à vérifier ; les marketplaces ne fournissent toujours pas de commandes réelles à cette version.
