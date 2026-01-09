Voici la liste complète, exacte et finale de toutes les tables nécessaires,
avec un raisonnement clair et structuré basé sur :

✔ ton cahier des charges
✔ le PDF du modèle de base de données
✔ ta structure modulaire actuelle
✔ les relations logiques du système

Je vais te donner :
1️⃣ Les tables obligatoires
2️⃣ Pourquoi elles existent (raisonnement)
3️⃣ Quel module elles appartiennent

Ceci est la version PRO de ton schéma final.

🟦 1. MODULE UTILISATEUR (base du système)
✔ Tables
1️⃣ utilisateur
✔ Raison :

Base pour tous les comptes (Admin, Encadreur, Stagiaire)

Contient données essentielles + rôle

✔ Colonnes :

id, nom, prenom, email, mot_de_passe, role, actif, date_creation

🔐 2. MODULE AUTH
✔ Tables
2️⃣ reset_mot_de_passe
✔ Raison :

Gestion de la sécurité

Token temporaire reset password

👨‍🎓 3. MODULE STAGIAIRE
✔ Tables
3️⃣ stagiaire

→ Hérite de utilisateur

4️⃣ competence

→ Une liste de compétences par stagiaire

✔ Raisonnement :

Profil spécifique stagiaire

Compétences utilisées dans matching IA et sélection du projet

👨‍🏫 4. MODULE ENCADREUR
✔ Tables
5️⃣ encadreur

→ Hérite de utilisateur

6️⃣ departement
✔ Raisonnement :

L’encadreur a une spécialité

travaillé dans département spécifique

utile dans affectation + statistiques

📄 5. MODULE DEMANDE DE STAGE
✔ Tables
7️⃣ demande_stage
✔ Raisonnement :

Point d’entrée du workflow

Stagiaire fait la demande avant d’être affecté

Étape obligatoire

🔄 6. MODULE AFFECTATION
✔ Tables
8️⃣ affectation
✔ Raisonnement :

Lien entre une demande & un encadreur

Score IA

Choix final

Gestion multi propositions

🧩 7. MODULE PROJET DE STAGE
✔ Tables
9️⃣ projet_stage
✔ Raisonnement :

Liste des projets disponibles

Chaque projet a un domaine, niveau requis

Sert pour matching IA + encadreur

🧑‍💻 8. MODULE STAGE
✔ Tables
🔟 stage
✔ Raisonnement :

Le stage final après affectation

Contient (stagiaire + encadreur + projet + dates)

C’est l’objet principal du suivi

📓 9. MODULE JOURNAL DE STAGE
✔ Tables
1️⃣1️⃣ journal_stage
✔ Raisonnement :

Entrées quotidiennes ou hebdomadaires

Suivi obligatoire par encadreur

👁 10. MODULE OBSERVATION
✔ Tables
1️⃣2️⃣ observation
✔ Raisonnement :

Encadreur donne feedback

Preuve de suivi

⭐ 11. MODULE EVALUATION
✔ Tables
1️⃣3️⃣ evaluation
✔ Raisonnement :

Note finale du stage

Critique qualitative encadreur

📁 12. MODULE DOCUMENT
✔ Tables
1️⃣4️⃣ document
1️⃣5️⃣ rapport_final
1️⃣6️⃣ attestation
✔ Raisonnement :

Upload fichiers stagiaire

Rapport final obligatoire

Attestation générée automatiquement

🔔 13. MODULE NOTIFICATION
✔ Tables
1️⃣7️⃣ notification
✔ Raisonnement :

Alertes système : demande acceptée, journal validé, etc.

💬 14. MODULE MESSAGE INTERNE
✔ Tables
1️⃣8️⃣ message_interne
✔ Raisonnement :

Communication interne stagiaire ↔ encadreur ↔ admin

📊 15. MODULE STATISTIQUES
✔ Tables
1️⃣9️⃣ statistiques (optionnelle : peut être calculée)
✔ Raisonnement :

Tableau de bord administratif

Rapports mensuels / annuels

🧾 16. MODULE HISTORIQUE
✔ Tables
2️⃣0️⃣ historique_action
✔ Raisonnement :

Log audit obligatoire

Suivi sécurité + conformité

🎯 RÉCAPITULATIF FINAL : 20 TABLES VALIDÉES
#	Table	Module
1	utilisateur	utilisateur
2	reset_mot_de_passe	auth
3	stagiaire	stagiaires
4	competence	stagiaires
5	encadreur	encadreurs
6	departement	encadreurs
7	demande_stage	demande_stage
8	affectation	affectation
9	projet_stage	projet_stage
10	stage	stage
11	journal_stage	journal
12	observation	observation
13	evaluation	evaluation
14	document	document
15	rapport_final	document
16	attestation	document
17	notification	notification
18	message_interne	message_interne
19	statistiques	statistiques
20	historique_action	historique