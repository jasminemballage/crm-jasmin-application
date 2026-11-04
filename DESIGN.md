# Interface Jasmin CRM

## Commandes et expédition

Référence choisie par Tim le 4 novembre 2026 : captures de sa liste multicanal, détail de commande et préparation Chronopost. Reprendre leur hiérarchie : indicateurs, canaux, statuts, filtres, tableau dense, puis fenêtre de détail regroupant identité, paiement, livraison et articles. La génération via API Chronopost a été choisie explicitement dans la conversation.

Conserver la navigation, la palette verte et blanche, les typographies, boutons et champs existants. `src/app/globals.css` reste la source des styles communs ; `orders.css`, `chronopost.css` et `chronopost-settings.css` portent les variantes de ces parcours. Utiliser les icônes Lucide déjà installées. Les coordonnées et chiffres visibles dans les références ne deviennent pas des données de démonstration du dépôt public.

## Comportements

- Fenêtres : conteneur `Dialog` existant dans `crm.tsx`, fermeture clavier, focus contenu et restitution du focus ; variantes larges pour commande et Chronopost.
- Filtres, dates et choix de service : contrôles natifs explicitement retenus, libellés français ; dates des commandes affichées en Europe/Paris.
- Les recherches et filtres locaux ne modifient pas les données. Les actions métier restent vérifiées côté serveur.
- Valeur absente : « Non transmis » ou tiret, jamais un fait inventé. Ne pas présenter un total HT existant comme un TTC.
- Aucun statut connecté sur la seule présence d’un formulaire enregistré. Les coordonnées manquantes empêchent la création d’une étiquette.
- Une étiquette est un envoi contractuel réel : résumé du destinataire et colis, confirmation explicite, action unique, puis suivi et PDF. Une réponse incertaine ne déclenche pas une nouvelle émission.
- Responsive : tableaux défilants et sections empilées ; focus visible et réduction des mouvements.
