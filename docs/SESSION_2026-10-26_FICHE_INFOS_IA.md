# Fiche Infos et IA — 26 octobre 2026, version 0.3

## Demande

Jasmin a fourni cinq captures de Nouveau produit, portant uniquement sur Infos. Il demande les informations manquantes et l’enrichissement IA du titre, des descriptions et des images. Il propose OpenRouter ; aucune clé n’a été transmise. Les captures décrivent l’interface attendue, sans autoriser de publication externe.

## Réalisation

- Formulaire étendu avec en-tête et pied fixes, défilement interne et adaptation aux petits écrans. Diffusion, Cibles marketplaces et Notes sont réservés pour la suite.
- Lien produit prioritaire, référence SKU/EAN/ASIN de recherche, contexte, identifiants, titre et descriptions, prix HT/TTC calculés en centimes et TVA, poids en kg, dimensions en cm et attributs personnalisés.
- Conditionnement et stock de sécurité conservés. Disponible calculé ; inventaire initial explicite pour une nouvelle fiche, journalisé. Une modification de fiche ne change ni le physique ni les réservations.
- Galerie de huit images au maximum : import PNG/JPEG/WebP, glisser-déposer, ordre, légende et retrait. Premier visuel principal ; recherche Google Images ouverte séparément.
- Brouillons incomplets acceptés, référence interne générée si absente. Activation locale contrôlée ; aucun push externe. Les brouillons ne peuvent pas créer de nouvelles réservations.
- Images et métadonnées persistées séparément. Noms de fichiers internes aléatoires, type binaire contrôlé, limite de 8 Mo, lecture locale bornée au dossier des médias.
- Configuration OpenRouter côté serveur via Paramètres : clé masquée, conservation/effacement, activation, modèles et règles d’image. La clé n’est jamais renvoyée ni exportée avec les produits. Le fichier local n’est pas chiffré.
- Textes et recherche web : lien prioritaire ou recherche par référence, appels bornés, réponse structurée validée, propositions sélectionnables et sources conservées. Les caractéristiques nouvelles sans source sont écartées ; les liens cités restent à vérifier humainement.
- Génération d’un packshot, d’une mise en situation ou d’un détail, avec consignes et première photo locale facultative. Prévisualisation séparée avant ajout ; validation de fidélité exigée avant activation.
- Aucun appel payant automatique à la sauvegarde des réglages, aucune nouvelle tentative automatique d’inférence. Délais et tailles bornés ; erreurs fournisseur expurgées des corps et secrets.
- Remplacement atomique des fichiers locaux avec tentatives bornées sur les erreurs de verrou Windows, sans suppression préalable de la version précédente.

Utilisation, références officielles OpenRouter et limites : [IA_ET_FICHE_PRODUIT.md](IA_ET_FICHE_PRODUIT.md).

## Vérification

- **56 tests réussis** : parcours existants, brouillon/activation, persistance des champs, sauvegarde sans changement de stock, médias, GTIN, URL, HT/TTC, conservation des informations lors des imports, secrets et connecteurs IA simulés.
- **47 contrôles HTTP réussis**, sur un serveur isolé hors du port 3000, avec un fichier sous `.local/test-runs/` et `CRM_AI_DISABLED=1` : parcours et imports, sauvegarde des fiches, upload/lecture d’image, rejets et configuration publique sans clé.
- TypeScript, compilation et schéma Prisma validés. Le schéma PostgreSQL prépare le stockage des informations complémentaires ; il n’est pas relié à une base.
- Navigateur intégré : ouverture du formulaire, lecture des sections et onglets réservés, saisie temporaire d’un titre fictif, calcul de 4,25 € HT en 5,10 € TTC à 20 %, refus explicite de l’appel IA sans configuration et fermeture sans sauvegarde. Panneau de configuration IA vérifié sans clé saisie.
- [Capture](apercus/fiche-produit-infos.png) conservée. Cette vérification de base ne remplace pas la recette des formulaires, des différentes tailles et de l’impression avec Jasmin.
- Un premier contrôle HTTP avait retourné une erreur 500 non reproduite lors du passage complet suivant. La cause n’a pas été prouvée. Une erreur Windows EPERM sur un fichier de compilation a également disparu à la recompilation. Les écritures applicatives disposent désormais d’une reprise bornée des verrous temporaires, testée séparément.

**Aucun essai réel OpenRouter n’a été effectué.** `.env.local` était absent au dernier contrôle. Les contrats texte/web/images sont vérifiés par réponses simulées ; compte, crédits, compatibilité des modèles et résultats restent à tester après configuration par Jasmin.

## Conservation et suite

Données inchangées : 13 produits, 8 commandes, aucun colis, révision 1. Empreinte SHA-256 du JSON : `FDEA110BDB4355C5BEE9C9C2CE2DC0B3289B3818F3B4DAEEF537918CFA2F6727`, identique à `.local/sauvegardes/avant-fiche-infos-20261026-172807.json`. Les essais automatiques utilisent des fichiers distincts.

L’archive v0.3 conserve sources, documents, tests, données et médias éventuels dans `sauvegardes/`. Secrets et fichiers de test exclus. Le serveur utilisateur reste disponible sur `http://127.0.0.1:3000`.

Suite : essai de la fiche avec Jasmin, configuration et premier test réel OpenRouter, réception des autres onglets, puis PostgreSQL, comptes nominatifs/MFA et hébergement sécurisé. Connexions vendeurs/transport désactivées ; les exigences Amazon ne sont pas attestées par ce prototype.
