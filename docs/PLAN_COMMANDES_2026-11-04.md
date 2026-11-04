# Commandes multicanales et Chronopost

Objectif : reprendre les écrans de référence fournis par Tim dans le CRM existant, avec génération d’étiquettes via l’API Chronopost, choix confirmé dans la conversation.

## Répartition

- [x] Étendre les métadonnées de commande sans casser les fichiers existants ; tester les montants absents et la distinction articles/paquets.
- [x] Construire tableau filtrable, indicateurs et détail complet à partir de ces métadonnées ; conserver les données utilisateur.
- [x] Ajouter configuration webservices Chronopost et expéditeur, avec réglages par canal et secrets conservés côté serveur.
- [x] Construire préparation d’étiquette à partir d’un colis existant et d’un destinataire vérifié.
- [x] Vérifier le contrat SOAP officiel, les erreurs et les créations répétées avec un fournisseur simulé ; ne pas émettre d’envoi réel pendant le développement.
- [x] Vérifier intégration, navigateur desktop/mobile, tests, TypeScript et compilation ; préparer la publication sur le dépôt du projet.

## Contraintes et vérification

Le connecteur doit utiliser les webservices du contrat, pas les identifiants du portail web. Le premier parcours couvre la livraison à domicile en France métropolitaine, selon les services réellement autorisés sur le contrat. Les connexions Amazon, Cdiscount, RETIF, METRO et site restent nécessaires pour alimenter les commandes réelles ; les captures ne fournissent aucun accès API.

Vérifier en priorité : conservation des anciennes données, adresses absentes, montants HT/TTC non mélangés, double clic ou reprise après coupure sans deuxième étiquette, et impossibilité de déduire le stock lors de la seule génération d’un PDF.

Bilan détaillé : [contrôles et limites](COMMANDES_CHRONOPOST_2026-11-04.md). La configuration utilisateur reste locale ; aucun envoi réel n’a été émis.
