# Correctif de l’enrichissement web — version 0.3.2

## Signalement et reproduction

Jasmin a obtenu « La proposition IA n’est pas un objet JSON valide » en essayant le lien [Sac Poulet XL 20+8x35 cm](https://jasminemballage.fr/product/Sac-Poulet-XL-20-8x35-cm).

L’erreur a été reproduite avec le compte OpenRouter configuré. La consultation retrouvait le produit, mais renvoyait un bloc Markdown et une structure différente du schéma de fiche : attributs sous forme de textes, rubriques d’entrée recopiées et renseignements requis manquants. Accepter uniquement le bloc Markdown ne suffisait donc pas.

## Correction

- Séparation du mode web en deux appels prévus : consultation du lien ou recherche de référence, puis construction de la proposition sans outil web actif, avec schéma strict et contrat explicite.
- Budget de temps commun aux deux appels ; refus d’une extraction vide, interrompue ou trop grande avant la seconde étape. Une annulation empêche le formatage. Aucune relance automatique en cas d’échec.
- Coût affiché : somme des deux coûts lorsqu’ils sont tous deux retournés ; montant inconnu signalé autrement.
- Lecteur JSON borné au format brut ou à un unique bloc Markdown. Aucun JavaScript, JSON incomplet, ajout de champs manquants, texte environnant ou structure incorrecte n’est accepté. Validation complète du schéma après lecture.
- Messages spécifiques pour les réponses interrompues ou refusées, sans afficher la réponse brute ou un secret.
- Zéros de caractéristiques initialement inconnues retirés des propositions factuelles. Une nouvelle proposition de paquets par carton doit explicitement justifier cette unité ; « carton de 500 sacs » ne peut pas suffire à proposer 500 paquets.

Le comportement des sorties structurées varie selon les points d’accès ; voir la [documentation OpenRouter](https://openrouter.ai/docs/guides/features/structured-outputs). La seconde étape évite de dépendre du format final du [traitement des outils web](https://openrouter.ai/docs/guides/features/server-tools/web-fetch).

## Vérification

- **64 tests réussis**, dont huit cas de régression pour le lecteur JSON, les réponses tronquées, les rubriques incorrectes, l’absence de relance, l’annulation entre étapes et la confusion entre pièces et paquets.
- Compilation et vérification TypeScript de la version finale.
- Deux essais réels réussis dans le navigateur depuis le lien de Jasmin après séparation des étapes ; le dernier inclut le contrôle de conditionnement. Propositions affichées, titre et descriptions retrouvés, sources consultables, aucun message JSON invalide.
- [Capture de la proposition](apercus/sac-poulet-proposition-web-2026-11-02.png). Le dernier coût affiché est de 0,0021 USD, arrondi par l’interface ; ce n’est pas un relevé de facturation complet.
- Saisie utilisateur conservée et fiche laissée ouverte pour la vérification. Aucun champ appliqué ni produit enregistré par l’agent. Données toujours identiques à la copie du 26 octobre : 13 produits, 8 commandes, aucun colis, révision 1.

## Points à vérifier avant enregistrement

Le succès du format ne garantit pas l’exactitude de chaque proposition. Vérifier la catégorie, la marque réellement portée par le produit, le prix et son unité de vente, le conditionnement et la distinction entre dimensions d’un sac et dimensions du paquet. Les champs non cochés ne sont pas appliqués. Le poids et l’EAN ne doivent pas être inventés.

La recherche sans lien exact et la génération d’image avec photo de référence restent à essayer. Aucun nouvel essai image n’a été effectué pour ce correctif. La clé reste dans le fichier serveur local, exclue des sauvegardes ; ne jamais l’afficher ni la demander dans la conversation.
