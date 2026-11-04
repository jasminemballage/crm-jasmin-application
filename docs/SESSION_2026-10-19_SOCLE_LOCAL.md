# Point de reprise — 19 octobre 2026

Point d’entrée pour la prochaine séance : [REPRISE_PROJET.md](../REPRISE_PROJET.md). À la demande de Jasmin, le projet et ses essais sont conservés avec une archive datée dans `sauvegardes/`.

## État livré

Première version locale sur données fictives, développée dans ce dossier avec Next.js 16 et TypeScript. Le lancement s’effectue avec `DEMARRER_CRM.cmd`, puis `http://127.0.0.1:3000`. Le serveur reste limité à cet ordinateur.

Fonctions disponibles : tableau de bord calculé depuis les données, catalogue modifiable, création de fiches, recherche et filtres, entrées/sorties en paquets ou cartons, stock physique/réservé/sécurité/disponible, création de commandes test, validation des commandes à vérifier, annulation du solde, préparation de plusieurs colis partiels, remise simulée, fiche A4 interne, journal et exports CSV/JSON.

Jeu initial : 12 produits et 8 commandes entièrement fictifs, sur les cinq canaux prévus. Les essais sont conservés dans `.local/demo-state.json`. Le contrôle automatique HTTP a restauré l’état présent avant ses essais, en conservant les ajouts manuels déjà saisis. La réinitialisation volontaire est disponible dans Paramètres.

## Vérifications effectuées

- 19 tests métier et de stockage réussis, dont la concurrence sur le dernier paquet, les répétitions, les colis partiels, l’historique, la conservation d’un fichier corrompu et le blocage du mode production par défaut.
- Contrôle TypeScript réussi.
- Compilation de l’application réussie.
- Modèle Prisma PostgreSQL valide syntaxiquement.
- 21 contrôles HTTP réussis : pages, création produit, conversion de cartons, commande répétée, colis partiel, remise répétée, annulation du solde, lecture après écriture, route A4, export protégé contre les formules, refus d’origine et révision périmée.
- Lanceur Windows exécuté : serveur prêt, puis accueil répondant HTTP 200 avec le titre attendu. Premier démarrage observé : environ 40 secondes ; la première page peut ensuite nécessiter sa compilation.

**Limite de validation :** le navigateur intégré n’a pas pu ouvrir l’aperçu et son outil a expiré. La présentation visuelle, les formulaires dans un vrai navigateur et l’impression A4 restent à vérifier avec Jasmin. Le contrôle HTTP de la route A4 ne prouve pas la mise en page imprimée.

## Ce qui reste à construire

- PostgreSQL réellement relié aux opérations, migrations, contraintes SQL, transactions et concurrence entre plusieurs processus. Le schéma préparé n’est pas utilisé par la démonstration.
- Deux comptes nominatifs, droits et double authentification.
- Import des quelque 300 produits, correspondances d’offres et reprise des commandes.
- Publication et synchronisation des cinq canaux.
- Connexion Chronopost, vraies étiquettes et retours de suivi.
- VPS, HTTPS, chiffrement, sauvegardes/restaurations et procédures de sécurité prouvées.

Aucun secret, appel de marketplace, étiquette payante ou envoi au développeur du site n’a été effectué. La démonstration n’est pas une preuve de sécurité permettant de répondre « Oui » au questionnaire Amazon. Le fichier local n’est pas chiffré : ne saisir que des données fictives.

## Prochaine séance

1. Faire ouvrir le lanceur et valider la lisibilité des écrans avec Jasmin.
2. Essayer une entrée de cartons et confirmer les coefficients de conditionnement.
3. Créer une commande test, préparer un colis partiel, simuler la remise et rapprocher le stock.
4. Contrôler la fiche A4 dans l’aperçu avant impression.
5. Intégrer ensuite PostgreSQL et les accès sécurisés ; poursuivre l’audit Amazon/Chronopost en parallèle.

Le VPS n’est toujours pas commandé et aucune procédure écrite existante n’a été confirmée. Les deux captures du questionnaire Amazon sont déjà disponibles : ne pas les redemander. Le plan et l’audit ont été mis à jour pour poursuivre depuis cet état.
