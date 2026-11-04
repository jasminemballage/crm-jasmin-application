# Catégorie, marque et photos — version 0.3.3

Jasmin a demandé de poursuivre ces trois champs sur la fiche [Sac Poulet XL 20+8x35 cm](https://jasminemballage.fr/product/Sac-Poulet-XL-20-8x35-cm). Il a explicitement demandé de laisser la marque à confirmer.

## Résultat vérifié

Un essai réel depuis la route d’enrichissement du CRM, avec OpenRouter déjà configuré, a répondu HTTP 200 en 45,2 secondes :

| Champ | Résultat |
|---|---|
| Catégorie | Sacs |
| Marque | Vide, à confirmer ; Jasmin Emballage n’est pas déduit du nom du vendeur |
| Images | Une photo originale du produit, déclarée comme image principale de sa fiche |

Le coût retourné pour cet essai est de **0,0021871 USD**. Aucun nouveau visuel IA n’a été généré. La [preuve résumée du test](validation-enrichissement-sac-2026-11-02.json) conserve uniquement les champs vérifiés, le modèle, le coût et l’absence de changement des données.

![Photo originale identifiée sur la fiche](apercus/sac-poulet-photo-source-2026-11-02.jpg)

## Changements

- Lecture directe et bornée des métadonnées des fiches HTTPS du site Jasmin, en complément des deux étapes web existantes. Destinations publiques validées, redirections limitées, aucun script exécuté.
- Catégorie déduite du titre produit ; une valeur initiale Accessoires n’empêche plus la proposition Sacs.
- Distinction entre marque déclarée pour le produit et vendeur. Les métadonnées LocalBusiness et les produits recommandés ne renseignent pas la marque. Une marque déjà saisie par l’utilisateur est conservée.
- Photos originales proposées à partir des métadonnées du produit, avec aperçu. Les logos génériques, images externes et SVG sont écartés de cet adaptateur.
- Catégorie, marque disponible et images peuvent être présélectionnées si les champs correspondants sont encore initiaux ou vides. L’application des champs reste une action distincte de l’enregistrement.

La copie JPEG ci-dessus est documentaire. Les photos web ajoutées à la galerie restent des liens externes ; elles ne sont pas automatiquement copiées dans le stockage local des médias.

## Validation et reprise

**74 tests réussis**, dont dix nouveaux cas pour la lecture des métadonnées, les produits correspondants, la marque, les images, la catégorie, les limites de consultation et les adresses réseau. TypeScript et compilation de production réussis. Les 47 contrôles HTTP généraux du 26 octobre n’ont pas été relancés ; le test ciblé réel de la route IA est passé le 2 novembre.

Le contrôle du navigateur intégré a expiré à deux reprises pendant cette extension. L’essai a donc été effectué directement sur la route du CRM ; l’affichage de la nouvelle proposition et son application restent à vérifier à l’écran. Aucune action réussie sur le formulaire, aucun produit enregistré. Pour reprendre : conserver la saisie en cours, utiliser **Enrichir depuis le web**, examiner catégorie et aperçu photo, puis **Appliquer les champs cochés**. La marque doit rester vide et à confirmer.

Les données persistantes restent identiques à la copie initiale : **13 produits, 8 commandes, aucun colis, révision 1**. Le serveur local est laissé en marche. Les clés et les fichiers temporaires ne sont pas inclus dans la sauvegarde du projet.
