# Enrichissement produit et état de préparation — 4 novembre 2026

## Erreur reproduite

Depuis une nouvelle fiche du catalogue, le lien `https://jasminemballage.fr/product/Sac-Poulet-XL-20-8x35-cm` échouait avec « La réponse IA a été interrompue avant sa fin ».

La clé fonctionne. Avec le modèle configuré `anthropic/claude-haiku-5.5`, la consultation web aboutissait, puis la construction du JSON atteignait le plafond : 3 500 tokens de sortie, dont 2 143 tokens de raisonnement, et `finish_reason: length`. Le JSON restant était incomplet et correctement rejeté.

Les plafonds de 2 000 tokens pour la consultation et 3 500 pour le JSON figuraient dans le premier commit du dépôt (`e1e1aa4`). Leur justification n’était pas documentée. OpenRouter compte aussi le raisonnement dans la sortie ; ce plafond n’est pas une limite de taille du formulaire. Voir la [documentation du fournisseur](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens).

## Corrections

- Marges de génération portées à 6 000 tokens pour la consultation et 10 000 pour le JSON. Ce sont des plafonds techniques choisis pour ce correctif, pas des consommations fixes. Le coût maximal possible augmente ; le coût réel dépend de la sortie et du modèle.
- Aucun paramètre de raisonnement imposé aux modèles qui ne le supportent pas ; aucun changement du modèle configuré.
- Délai commun de 90 secondes, contrôles JSON et vérifications factuelles conservés. Aucune relance payante automatique.
- En cas de troncature, l’erreur indique la limite de génération au lieu de demander systématiquement de réduire le contexte.
- Pendant l’enrichissement : pulsation discrète du fond, aperçu skeleton, bouton avec indicateur et libellé actif. Les textes restent lisibles. Les trois entrées de recherche passent en lecture seule jusqu’à la fin ; les autres champs conservent la protection contre une proposition périmée.
- États de succès, erreur et annulation annoncés ; réponse annulée ignorée. La préférence de réduction des mouvements désactive les animations. L’import et la génération d’image ne déclenchent pas l’animation du bloc d’enrichissement.

## Vérifications

- 77 tests automatisés réussis, dont trois régressions ajoutées après constat de leur échec avant correction.
- TypeScript et compilation Next.js réussis.
- 47 contrôles HTTP réussis sur un serveur et des données de test isolés : création de brouillon, activation, médias, stocks et refus sans modification notamment.
- Nouvel essai réel de la route du CRM : HTTP 200 en 28,5 secondes avec Haiku 5.5. Titre « Sac Poulet XL 20+8x35 cm », catégorie « Sacs », marque vide, photo originale et lien source retrouvés. Coût retourné par OpenRouter : 0,00413937 USD pour les deux étapes.
- Le fichier des données utilisateur est resté identique avant et après l’essai réel. Aucun produit enregistré ni aucune proposition appliquée par l’agent.

La validation visuelle et interactive de l’animation reste à effectuer dans le navigateur : l’outil de contrôle a échoué sur un module `browser-service.mjs` manquant. Le succès HTTP et la compilation ne prouvent pas le rendu de l’animation. Un autre modèle ou une autre page peuvent encore atteindre un plafond ou le délai de 90 secondes ; ces échecs restent explicites.
