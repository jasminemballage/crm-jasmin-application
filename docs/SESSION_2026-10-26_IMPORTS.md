# Reprise du 26 octobre 2026 — CRM local 0.2

## Réalisation

Jasmin a demandé de reprendre le développement et a indiqué ne pas avoir encore essayé les mouvements de stock et la préparation de colis. La reprise conserve ses essais et ajoute les outils de préparation du catalogue et de l’inventaire, sans connexion externe.

- Import catalogue CSV/TSV ou tableau collé depuis Excel ; modèle téléchargeable.
- Rapprochement des SKU sans tenir compte de la casse ; création, mise à jour partielle ou ligne inchangée visibles avant validation.
- Champs non renseignés conservés sur une fiche existante ; tous les champs du modèle exigés pour une nouvelle fiche. Toute nouvelle fiche commence à zéro stock physique.
- Import d’inventaire absolu en paquets ou cartons ; conversion avec le coefficient actuel du produit, comparaison avant/après et disponibilité future affichées.
- Motif obligatoire pour l’inventaire, confirmation explicite et journal des écarts.
- Refus de tout le lot pour les références répétées, valeurs invalides, SKU inconnus ou quantités inférieures au stock réservé.
- Revalidation côté serveur et contrôle de la révision : un aperçu périmé nécessite une actualisation et une nouvelle confirmation.
- Réimport identique sans doublon produit ni ajout de stock ou de mouvements.
- Export d’inventaire simple, modèle catalogue, modèle stock et poids du paquet ajouté à l’export du catalogue.
- Séparation des données pour les contrôles HTTP : serveur sur un autre port et fichier sous `.local/test-runs/`, sans utilisation du fichier des essais de Jasmin.

Formats : point-virgule, virgule, tabulation, cellules citées avec guillemets ou retours à la ligne, encodages UTF-8, UTF-16 avec marque et Windows-1252. Prix acceptés avec virgule ou point et deux décimales au maximum. Limites : 1 Mo et 1 000 lignes ; aperçu des 100 premières lignes, contrôle de toutes les lignes.

## Vérification

- **37 tests réussis**, dont import/réimport de 300 produits, inventaire absolu et répété, protection des réservations, rejet sans écriture d’un lot invalide, cellules CSV complexes, décodage et aperçu périmé.
- **35 contrôles HTTP réussis** sur le serveur isolé, incluant le parcours commande/colis, l’import de 300 produits, les modèles, les répétitions, le rejet d’un lot sans modification et les protections d’origine/révision.
- Contrôle TypeScript et compilation de la version 0.2 réussis.
- Page Catalogue HTTP 200 avec le bouton d’import présent.
- Un premier passage des tests avait échoué sur le test concurrent du dernier paquet ; le test isolé, puis la suite complète, ont réussi. La cause initiale n’a pas été reproduite. Le diagnostic du test affiche désormais les motifs de rejet en cas de nouvelle occurrence.

**Vérification visuelle incomplète :** l’outil de navigateur intégré a expiré. L’inventaire des applications Windows a pu être lu, mais la demande d’accès à Chrome a expiré avant autorisation. Aucun écran de formulaire ni aperçu imprimé n’a donc été validé par l’agent. Ne pas présenter ces contrôles comme une recette visuelle ou une impression A4 vérifiée.

## Données conservées

Au début de la reprise : 13 produits, 8 commandes, aucun colis, révision 1. Une copie de précaution est enregistrée dans `.local/sauvegardes/avant-session-2026-10-26.json`. Les contrôles HTTP ont utilisé un autre fichier ; les essais de Jasmin sont conservés. Une archive de la version 0.2 est enregistrée dans `sauvegardes/` en fin de séance.

## Suite

Suivre [ESSAI_GUIDE.md](ESSAI_GUIDE.md) avec Jasmin avant d’intégrer des données réelles. Poursuivre ensuite PostgreSQL, les deux comptes sécurisés et la double authentification. Le VPS et les connexions Amazon/Chronopost restent à préparer ; aucune nouvelle information sur les accès n’a été fournie durant cette reprise. Le questionnaire Amazon et la note du développeur du site restent des documents préparatoires, sans envoi ni attestation de mesures non mises en place.
