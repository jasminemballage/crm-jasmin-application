# Fiche produit Infos et OpenRouter

## Utilisation

1. Dans Catalogue, ouvrir **Nouveau produit** ou **Modifier**. Renseigner le lien produit, ou une référence de recherche avec un contexte suffisant.
2. **Enrichir depuis le web** consulte le lien en priorité, sinon recherche la référence, puis construit la fiche dans une seconde étape contrôlée. Ce mode utilise deux appels IA successifs avec un seul budget de temps total ; aucune relance automatique n’est lancée en cas d’échec. **Proposer les textes** utilise les données déjà fournies, en un appel.
3. Consulter les propositions, les aperçus photo et leurs sources. Cocher les champs souhaités, puis **Appliquer les champs cochés**. Les textes vides, la catégorie initiale Accessoires et une galerie vide sont présélectionnés lorsqu’une proposition est disponible ; les valeurs déjà renseignées ne sont pas automatiquement remplacées. Une marque absente reste vide, avec l’indication « À confirmer » dans le champ.
4. Importer les photos produit ou préparer une image IA. Le résultat généré s’affiche séparément avant ajout à la galerie. Vérifier sa fidélité et cocher sa validation avant d’activer la fiche.
5. **Enregistrer brouillon** conserve la fiche incomplète. **Enregistrer et activer** la rend utilisable dans le CRM, sans publication externe. Un produit sans SKU interne reçoit une référence Jasmin.

Le stock disponible est calculé. Le physique existant se modifie uniquement par les mouvements/inventaires de Stocks. Une nouvelle fiche peut recevoir un inventaire initial explicite, journalisé à sa création.

## Configurer la clé

Dans **Paramètres → Enrichissement IA · OpenRouter**, saisir la clé API dans le champ masqué, choisir les identifiants des modèles, puis enregistrer. Ne jamais transmettre la clé dans la conversation ou dans un fichier d’import produit.

La clé est conservée dans `.env.local`, côté serveur. L’API ne renvoie qu’un indicateur de présence, les modèles et les règles d’image. Laisser le champ vide conserve la clé ; la case d’effacement la retire de la configuration active. Les autres variables du fichier sont préservées. La désactivation bloque les appels IA.

Le prototype local ne chiffre pas ce fichier ; il reste soumis aux accès du poste. Les sauvegardes de projet excluent les fichiers `.env`. La clé ne fait partie ni des fiches, ni des exports JSON de données, ni des journaux métier. Sur le futur VPS, la gestion des secrets et les droits d’accès devront être intégrés aux mesures de sécurité prévues.

Enregistrer la configuration ne vérifie pas le compte et ne consomme pas d’inférence. Les appels sont facturés par OpenRouter selon les modèles et les outils utilisés. Aucun abonnement ni crédit n’est acheté par le CRM.

## Connecteurs préparés

- Textes : Chat Completions, réponse structurée et validation locale du schéma. [Documentation des sorties structurées](https://openrouter.ai/docs/guides/features/structured-outputs).
- Lien fourni : outil serveur Web Fetch, limité au domaine fourni et à une consultation. [Documentation Web Fetch](https://openrouter.ai/docs/guides/features/server-tools/web-fetch).
- Référence sans lien : outil serveur Web Search, recherches et résultats bornés. [Documentation Web Search](https://openrouter.ai/docs/guides/features/server-tools/web-search).
- Images : API Images dédiée, un visuel par requête, avec photo locale de référence facultative et retour binaire conservé côté serveur. [Documentation Images](https://openrouter.ai/docs/guides/overview/multimodal/image-generation).

Les outils web d’OpenRouter sont annoncés en bêta par leur documentation. Les tests automatiques utilisent des réponses simulées et les serveurs QA emploient `CRM_AI_DISABLED=1`.

Le 2 novembre 2026, Jasmin a configuré sa clé dans l’application. Les textes avec `openai/gpt-4o-mini` et les images avec `google/gemini-2.5-flash-image` ont été testés réellement, avec consommation des crédits du compte. L’ancien modèle `openai/gpt-image-1` était affiché au catalogue du fournisseur mais sa génération a été refusée (« modèle introuvable ») ; il a été remplacé. Le format natif de l’image est désormais accepté et contrôlé, sans imposer un paramètre de sortie que certains modèles ne prennent pas en charge. Les consignes de texte interdisent également les usages et compatibilités non sourcés.

Les premiers essais texte/image ont porté sur des produits fictifs, sans photo de référence. Le lien exact du sac à poulet de Jasmin a ensuite été testé avec succès après le correctif 0.3.2. La recherche sans lien et la génération guidée par une photo restent à vérifier. Voir le [correctif web](CORRECTIF_2026-11-02_JSON_ENRICHISSEMENT_WEB.md).

## Format des réponses depuis la version 0.3.2

La proposition finale est préparée sans outil web actif, avec schéma strict et contrat explicite. Le coût affiché additionne les deux étapes lorsque les deux coûts sont retournés. Un unique bloc Markdown est accepté si son contenu est du JSON valide et conforme. Textes environnants, structures incorrectes, refus et réponses interrompues sont rejetés ; aucune valeur manquante n’est fabriquée.

Les zéros des caractéristiques initialement inconnues ne sont pas présentés comme des faits. Une nouvelle proposition de paquets par carton doit mentionner explicitement des paquets, packs ou lots dans sa justification ; un nombre de pièces ou de sacs seul est écarté. Cela ne remplace pas la vérification du conditionnement. Les dimensions trouvées peuvent concerner un produit individuel : vérifier qu’elles décrivent le paquet avant de les utiliser pour les expéditions.

## Fiabilité des informations

Depuis la version 0.3.3, une lecture directe est ajoutée pour les URL HTTPS de fiches produit de `jasminemballage.fr` et `www.jasminemballage.fr`. Elle récupère le titre, les métadonnées de partage et les données structurées **Product** correspondant à la fiche. Une catégorie interne est déduite d’une famille explicite du titre. La marque est acceptée uniquement si elle est déjà fournie par l’utilisateur ou déclarée pour le produit ; le nom du commerce dans **LocalBusiness** ne devient pas une marque. Les photos sont limitées aux images principales déclarées pour le produit, sur le même site, au format PNG/JPEG/WebP. Logos génériques, SVG, domaines externes et images de recommandations ne sont pas retenus par cet adaptateur.

Cette lecture est limitée à 12 secondes, deux redirections et 2 Mo de HTML ; les destinations réseau locales ou réservées sont refusées et l’adresse publique validée est utilisée pour la connexion. Aucun script de la page n’est exécuté. Les autres sites restent traités par les outils web existants d’OpenRouter. Si la vérification directe échoue, la proposition le signale et nécessite un contrôle manuel. Il n’y a pas d’appel IA supplémentaire pour cette lecture directe. Le test réel du sac poulet est conservé dans le [bilan catégorie, marque et images](ENRICHISSEMENT_2026-11-02_CATEGORIE_MARQUE_IMAGES.md).

Une source citée par le modèle n’est pas une preuve automatiquement vérifiée. Le CRM écarte les faits nouveaux sans référence de source et contrôle le format des données ; il faut encore consulter les liens pour confirmer la référence exacte, le conditionnement, le prix et les caractéristiques. Les EAN ne doivent jamais être inventés et un contrôle de clé ne prouve pas leur attribution au produit.

Les textes ne doivent pas introduire de certifications, compatibilités ou allégations écologiques sans faits fournis. Les visuels générés sont signalés comme IA et demandent une validation humaine. Sans photo de référence, le résultat peut être une illustration approximative ; il ne constitue pas une photographie du produit réellement vendu.

## Médias et sauvegarde

Les photos PNG/JPEG/WebP importées et générées sont dans `.local/media/`. Les fiches conservent leurs adresses internes et leurs métadonnées, pas leur contenu binaire. Une copie JSON seule ne suffit donc pas pour restaurer les photos. L’archive de fin de séance doit inclure le JSON des essais et les médias locaux. Les images web restent des liens externes et peuvent devenir indisponibles.

Les images chargées avant l’enregistrement d’une fiche, ou les propositions écartées, peuvent laisser des fichiers non rattachés. Aucun nettoyage automatique destructif n’est réalisé à cette étape.
