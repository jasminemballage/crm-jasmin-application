# Essayer le CRM ensemble — catalogue, stock et colis

Ce parcours utilise uniquement des données fictives. Il n’effectue aucun échange avec Amazon, les autres canaux ou Chronopost.

## 1. Ouvrir l’espace

Double-cliquer sur `DEMARRER_CRM.cmd`, attendre « Ready », puis ouvrir `http://127.0.0.1:3000/catalogue`. Laisser la fenêtre du lanceur ouverte. Conserver les essais existants : aucune réinitialisation n’est nécessaire.

## 2. Créer une fiche à partir du modèle

Dans **Catalogue**, cliquer sur **Importer un CSV**, puis **Modèle CSV**. Ce fichier contient la référence fictive `EXEMPLE-GOB-25`, avec 50 pièces par paquet et 10 paquets par carton.

Sélectionner le fichier téléchargé. Autre possibilité : ouvrir le fichier dans le tableur, copier les cellules avec l’en-tête et utiliser **Ou coller un tableau depuis Excel**, puis **Vérifier le tableau**.

Vérifier l’aperçu : une création doit apparaître si cette référence n’existe pas encore. Cocher la confirmation et enregistrer. Si elle existe déjà avec les mêmes valeurs, l’aperçu indiquera « Inchangé » et aucune action n’est nécessaire. Le nouveau produit est créé à **zéro stock physique**.

## 3. Importer un inventaire fictif

Dans **Stocks**, cliquer sur **Importer un CSV**, puis télécharger **Modèle CSV**. Il contient la même référence et un inventaire de deux cartons.

L’aperçu doit convertir **2 cartons × 10 paquets = 20 paquets physiques**. Cette valeur remplace le stock physique de la référence. Lire l’écart proposé, renseigner un motif tel que « Inventaire de démonstration », puis confirmer.

Ne pas confondre cet import avec une réception supplémentaire : pour ajouter deux cartons à un stock existant, utiliser **Mouvement → Entrée de stock**.

## 4. Réserver deux paquets

Dans **Commandes**, cliquer sur **Commande test**, choisir `EXEMPLE-GOB-25` et commander deux **paquets**. Le canal est simulé et le destinataire reste fictif.

Après création, le physique reste inchangé. Deux paquets sont réservés pour cette commande, et la disponibilité diminue de deux.

## 5. Préparer deux colis partiels

Ouvrir la commande, choisir **Préparer un colis** et saisir un seul paquet dans le premier colis. Le physique reste inchangé pendant la préparation.

Dans **Expéditions**, ouvrir la **Fiche A4**. Vérifier les quantités et l’aperçu avant impression. Cette fiche est un document interne, non valable pour le transport.

Choisir **Simuler la remise** du premier colis et confirmer. Un paquet sort du physique ; un paquet reste réservé pour le solde de la commande. Préparer ensuite le second paquet et simuler sa remise. La commande devient expédiée et ses réservations sont épuisées.

## 6. Vérifier le résultat

Sur cette référence, l’ensemble de la commande a retiré deux paquets physiques. Le disponible a baissé lors de la réservation ; il n’est pas débité une seconde fois lors de la remise.

Essayer aussi de sélectionner de nouveau le modèle d’inventaire : l’aperçu présentera son nouvel écart avec les 20 paquets du modèle. Fermer sans confirmer si l’on souhaite conserver le résultat du parcours.

## Signaler un point à modifier

Noter simplement l’écran, l’action effectuée et ce qui était attendu. Ne pas transmettre de mot de passe, d’identifiant technique ou de coordonnées de vrais clients dans la conversation.
