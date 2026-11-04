# Préparation du questionnaire de sécurité Amazon SP-API

État au 19 octobre 2026. Document de travail pour le futur CRM Jasmin ; aucune conformité opérationnelle n’est attestée par cette fiche.

## Situation confirmée

- Le VPS du CRM n’est pas encore commandé.
- Jasmin n’a connaissance d’aucune procédure de sécurité écrite dans l’entreprise.
- Le nouveau CRM n’est pas développé et ses protections ne sont pas installées ou testées.
- Une demande antérieure de rôles SP-API a été approuvée ; cela ne démontre pas l’approbation du rôle restreint d’expédition ni la sécurité du futur CRM.
- Les deux captures montrent des questions encore sans réponses sélectionnées ou rédigées. Aucune soumission de cette demande restreinte n’est confirmée.

Sources du questionnaire : [première partie](<C:/Users/jasmi/OneDrive/Bureau/captures ecran/quest1.png>) et [seconde partie](<C:/Users/jasmi/OneDrive/Bureau/captures ecran/quest 2.png>).

## Comment répondre

Répondre à partir des mesures effectivement appliquées et de leurs preuves. Une fonction prévue au plan ne permet pas de répondre « Oui » à une question sur un contrôle déjà en place. Un élément inconnu doit être vérifié ; il ne doit pas être déclaré présent ou absent par supposition. La création de ce document ne suffit pas à rendre une procédure opérationnelle.

Dans la situation connue, l’existence de politiques écrites ne peut pas être déclarée : Jasmin indique ne pas en connaître. Pour les autres systèmes déjà utilisés dans l’entreprise, demander les informations au responsable concerné avant toute déclaration globale. Les constats sur le nouveau CRM ne valent pas audit du site existant ou de l’ensemble de l’entreprise.

Amazon demande des informations exactes sur les usages et contrôles, puis évalue le profil. [Procédure officielle](https://developer-docs.amazon/sp-api/docs/register-as-a-private-developer)

## Première partie : choix et réponses Oui/Non

Les éléments de cette matrice proviennent des questions affichées dans la capture. Ils décrivent le travail restant, pas des réponses déjà validées.

| Question | Situation du nouveau CRM | Éléments nécessaires pour répondre |
|---|---|---|
| Durée de conservation des données personnelles | Non définie et non appliquée. | Inventaire des données, point de départ du délai, durée réelle, purge et vérification des fichiers, exports et sauvegardes. |
| Politiques documentées de traitement, classification et confidentialité, avec registre | Aucune procédure écrite connue selon Jasmin. | Documents adoptés, données et flux recensés, responsables et règles appliquées. |
| Chiffrement au repos et gestion des clés | Non mis en place pour le futur CRM. | Configuration vérifiable du chiffrement des données et sauvegardes, gestion et protection du cycle de vie des clés. |
| Contrôles d’accès précis | Prévus au plan ; pas implémentés. | Comptes individuels, droits minimaux, essais d’accès autorisé et refusé, révocation et revue des comptes. |
| Journaux d’audit, examens et conservation minimale de 12 mois | Non mis en place. | Collecte, intégrité, contrôle d’accès, rétention et preuves de revues à la fréquence requise. |
| Évaluation des changements dans un environnement de test dédié | Aucun environnement applicatif encore créé. | Développement, test et production séparés, règles de validation et preuves d’essais. |
| Analyses de vulnérabilités tous les 30 jours, tests d’intrusion annuels et corrections critiques sous 7 jours / élevées sous 30 jours | Aucun programme établi pour le futur CRM. | Outils, périmètre, responsables, rapports, calendrier et suivi des corrections ; intervention adaptée pour le test d’intrusion. |
| Analyse du code avant chaque version | Aucun code applicatif ou processus de version encore en place. | Analyses de code et dépendances, résultats conservés et traitement des défauts avant livraison. |
| Processus officiel de gestion des changements | Non formalisé pour le projet. | Responsabilités de test, vérification et approbation, accès limités et historique des changements. |

## Seconde partie : textes limités à 500 caractères

Les futures réponses devront décrire précisément le système installé. Ne pas copier les éléments ci-dessous comme s’ils étaient déjà déployés.

| Champ à renseigner | Informations et preuves à réunir |
|---|---|
| Protection réseau des bases, fichiers et postes | Fournisseur et réseau du VPS, ports ouverts, isolation de la base, accès administratifs, pare-feu et protections des postes. |
| Identification individuelle des employés et limitation des accès | Identité des deux utilisateurs, comptes nominatifs, responsabilités, droits et procédure de retrait d’accès. |
| Stockage chiffré au repos et gestion des clés | Méthode réellement utilisée, composants couverts, emplacement protégé des clés, responsables et procédures de rotation/révocation. |
| Sauvegardes chiffrées et restauration | Destination géographique distincte, chiffrement, fréquence, durée, objectifs RPO/RTO et résultat d’un essai de restauration. |
| Journalisation et surveillance | Événements collectés, stockage, rétention, protection, revue, alertes et suivi des investigations. |
| Plan de réponse aux incidents | Détection, qualification, confinement, protection des preuves, remédiation, restauration et circuit de notification. |
| Gestion des mots de passe | Règles réellement imposées et testées pour longueur, complexité, historique, expiration et mécanismes d’authentification. |
| Protection des données personnelles pendant les tests | Données fictives ou anonymisées, séparation des environnements et restrictions empêchant les usages accidentels de données réelles. |
| Prévention de l’exposition des identifiants | Stockage des secrets, droits d’accès, exclusion du code et des journaux, contrôle des dépôts et procédure de rotation. |
| Suivi des corrections issues des scans et tests d’intrusion | Registre des défauts avec gravité, responsable, échéance, preuve de correction et vérification de clôture. |
| Traitement des vulnérabilités pendant le développement et l’exploitation | Détection, tri, correction, contrôle de livraison et mise à jour des composants déployés. |
| Contact incidents IMPOC | Nom et adresse professionnelle du responsable désigné, rôle accepté et disponibilité. Ne pas désigner une personne par simple déduction de son adresse de connexion. |

L’acceptation des conditions en bas du formulaire sera examinée par Jasmin au moment de la soumission. Aucun formulaire externe ni accord n’a été accepté par l’agent.

## Conservation : préciser le délai avant de choisir une case

Le formulaire affiché classe les durées après **expédition**. La politique Amazon consultée fixe normalement une limite de 30 jours après **livraison** pour les données personnelles, avec exceptions limitées aux obligations légales applicables. Il faut définir et appliquer la durée réelle, puis répondre au formulaire selon son libellé ; les deux dates ne doivent pas être confondues. [DPP, section 2.1](https://sellercentral.amazon.com/solution-provider/policy?policyType=DPP&locale=en_GB)

La reprise de tout l’historique accessible n’autorise pas la conservation illimitée des coordonnées. Séparer les données conservées pour un besoin autorisé des coordonnées à supprimer ; inclure étiquettes, pièces jointes, exports et sauvegardes dans la stratégie de suppression.

## Ajustements du socle à intégrer avant les données réelles

- Étendre la double authentification aux deux comptes : la DPP consultée demande la MFA pour tous les comptes utilisateurs. [DPP, section 1.4](https://sellercentral.amazon.com/solution-provider/policy?policyType=DPP&locale=en_GB)
- Préparer le chiffrement au repos et la gestion des clés, ainsi que les sauvegardes séparées.
- Mettre en place les contrôles d’accès, la journalisation, les tests et la purge ; documenter les résultats vérifiables.
- Rédiger les procédures correspondant à la réalité et attribuer les responsabilités de fonctionnement.
- Prévoir le coût et l’organisation des analyses récurrentes et du test d’intrusion ; aucun de ces examens n’a été réalisé pour le nouveau CRM.
- Vérifier les exigences générales avant l’utilisation réelle de SP-API, même lorsque les données personnelles ne sont pas demandées. [Périmètre de la politique](https://sellercentral.amazon.com/solution-provider/policy?policyType=DPP&locale=en_GB)

## Suite de travail

1. Avancer sur le développement local avec des données fictives et préparer les besoins du VPS.
2. Mettre à disposition l’hébergement, installer les protections et exécuter les contrôles nécessaires.
3. Formaliser et appliquer les procédures, puis réunir les preuves.
4. Rédiger les champs de 500 caractères à partir des éléments vérifiés et préparer la soumission du rôle restreint.

L’automatisation des étiquettes Chronopost à partir des coordonnées Amazon reste un objectif de la première version. Sa validation dépend de ces travaux et de l’autorisation spécifique d’Amazon ; elle n’est pas remplacée par un processus manuel présenté comme une intégration automatique.
