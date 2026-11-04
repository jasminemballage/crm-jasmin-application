# Reprise du 2 novembre 2026 — essai OpenRouter

Jasmin demande de poursuivre le projet et choisit de commencer par le test réel de l’enrichissement IA.

## Préparation effectuée

- Notes de reprise, instructions du dépôt et configuration de la version 0.3 relues.
- CRM relancé sur `http://127.0.0.1:3000`, en conservant les données existantes.
- Catalogue et état public de configuration IA : réponse HTTP 200. Fiche et catalogue affichés dans le navigateur intégré ; paramètres IA ouverts pour Jasmin.
- Jasmin a ensuite enregistré sa clé directement dans le CRM et confirmé cette action dans la conversation. La configuration publique indique une clé présente et les requêtes autorisées. La clé n’a jamais été affichée par l’agent et n’est pas incluse dans les documents ni l’archive.
- Contrats officiels revérifiés : [sorties structurées](https://openrouter.ai/docs/guides/features/structured-outputs), [API Images](https://openrouter.ai/docs/guides/overview/multimodal/image-generation), [consultation web](https://openrouter.ai/docs/guides/features/server-tools/web-fetch). Modèles retenus après essai : `openai/gpt-4o-mini` pour les textes et `google/gemini-2.5-flash-image` pour les images.
- [Capture du formulaire](apercus/openrouter-configuration-2026-11-02.png) conservée.
- Données inchangées : 13 produits, 8 commandes, aucun colis, révision 1 ; empreinte identique à la copie du 26 octobre.

## Essais réels et corrections — version 0.3.1

- Premier appel texte par l’API du CRM : HTTP 200, réponse structurée valide en environ 21 secondes, coût retourné de **0,00023145 USD**. Données fictives explicites : papier kraft, 250 ml, 50 pièces par paquet, 20 paquets par carton, poids 500 g. EAN et dimensions inconnus laissés vides.
- La première description ajoutait « tous types de boissons », non établi par les faits. Consignes resserrées pour interdire usages, résistances, contact alimentaire, chaud/froid et propriétés écologiques sans preuve. Un second essai depuis le bouton **Proposer les textes** a donné une description factuelle ; titre et deux descriptions sélectionnés puis appliqués dans le formulaire. [Capture des textes](apercus/openrouter-textes-valides-2026-11-02.png).
- Le modèle initial `openai/gpt-image-1`, pourtant présent au catalogue public, a été refusé par le fournisseur avec HTTP 400, « The model 'gpt-image-1' does not exist. ». Deux tentatives ont constaté ce refus, dont une de diagnostic. Aucun visuel de ce modèle n’a été produit. Les corps d’erreur ne sont pas exposés par le CRM.
- Modèle alternatif vérifié : [Gemini 2.5 Flash Image](https://openrouter.ai/google/gemini-2.5-flash-image). Un visuel fictif PNG a été produit en environ **6,4 secondes**, coût retourné **0,0387916 USD**, taille 788 630 octets. Le CRM le sert en HTTP 200, type `image/png`. [Visuel conservé](apercus/openrouter-visuel-genere-2026-11-02.png).
- Configuration enregistrée avec ce modèle, sans effacer la clé ni les règles existantes. Modèle également choisi par défaut pour une nouvelle configuration. Le connecteur accepte le format natif PNG/JPEG/WebP contrôlé au lieu d’imposer un paramètre `output_format` non universel. Les erreurs HTTP 400/404/422 indiquent désormais de vérifier le modèle et ses paramètres, sans afficher leur corps.
- Dernier essai complet depuis le bouton **Générer une image** : réponse HTTP 200 en environ 13 secondes côté CRM, coût affiché **0,0388 USD** ; aperçu reçu, puis ajout à la galerie. Premier visuel, badge **IA · à valider**, case de fidélité décochée. [Capture de la galerie](apercus/openrouter-galerie-validee-2026-11-02.png).
- Les deux formulaires d’essai ont été fermés sans sauvegarde. Aucun produit, mouvement de stock ou commande ajouté/modifié ; JSON toujours identique à la sauvegarde du 26 octobre. Les deux images de test restent dans `.local/media/` et sont incluses dans l’archive ; elles ne sont rattachées à aucun produit enregistré.

Les coûts ci-dessus sont ceux retournés par les réponses réussies ; ils ne constituent pas un relevé de facturation complet du compte. La clé est conservée uniquement dans la configuration serveur locale et exclue des archives.

## Vérification et suite

Les **56 tests** ont été relancés avec succès après les corrections, en désactivant l’IA réelle dans le processus de test. Le contrôle de confidentialité couvre aussi le refus HTTP 400. Compilation de production et contrôle TypeScript vérifiés. Les **47 contrôles HTTP** généraux restent ceux du 26 octobre ; ils n’ont pas été répétés intégralement pour cette correction du connecteur IA.

Le premier contrôle du navigateur a nécessité une réinitialisation de son outil ; les essais des boutons et champs ont ensuite été effectués dans le navigateur intégré. Cela ne modifie pas le CRM ou ses données.

Prochaine étape : essayer l’enrichissement web depuis une référence publique exacte, puis la génération avec une vraie photo de référence, et recueillir les captures des autres onglets. Aucun essai web ni avec photo de référence n’a été effectué pendant cette séance. La validation des résultats reste nécessaire avant utilisation sur un produit réel.
