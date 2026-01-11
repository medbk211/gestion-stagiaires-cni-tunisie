[Module Utilisateur]
 └─ utilisateur
     • Créer / modifier / supprimer compte
     • Gestion rôles
     • Activer / désactiver compte
     • Mot de passe crypté
     • Héritage pour Stagiaire / Encadreur

[Module Auth]
 └─ reset_mot_de_passe
     • Token temporaire
     • Réinitialisation mot de passe
     • Expiration token
     • Notification email

[Module Stagiaire]
 ├─ stagiaire
 │   • Profil stagiaire complet
 │   • Hérite utilisateur
 │   • Consultation demandes, stages, journaux
 │   • Interaction avec encadreur (messages)
 └─ competence
     • Ajouter/modifier/supprimer compétences
     • Lien avec stagiaire
     • Matching IA

[Module Encadreur]
 ├─ encadreur
 │   • Profil encadreur
 │   • Suivi stagiaires affectés
 │   • Validation journal et évaluation
 └─ departement
     • Définir spécialité / département
     • Lien avec encadreur
     • Affectation + statistiques

[Module Demande de stage]
 └─ demande_stage
     • Création demande par stagiaire
     • Suivi statut (pending / approved / rejected)
     • Historique demandes
     • Notification statut

[Module Affectation]
 └─ affectation
     • Lien demande ↔ projet ↔ encadreur
     • Score IA
     • Multi-propositions
     • Statut final
     • Notification

[Module Projet de stage]
 └─ projet_stage
     • Liste projets
     • Domaine, niveau requis
     • Matching IA
     • CRUD projets
     • Statistiques projets

[Module Stage]
 └─ stage
     • Stage final après affectation
     • Contient stagiaire, encadreur, projet, dates
     • Lien journaux, évaluations, documents
     • Suivi statut stage

[Module Journal de stage]
 └─ journal_stage
     • Entrées quotidiennes/hebdomadaires
     • Validation encadreur
     • Historique / reporting

[Module Observation]
 └─ observation
     • Feedback encadreur
     • Preuve de suivi
     • Lien stage/journal

[Module Evaluation]
 └─ evaluation
     • Notes finales
     • Critique qualitative
     • Lien stage/projet

[Module Document]
 ├─ document
 │   • Upload fichiers stagiaire
 │   • Gestion droits accès
 ├─ rapport_final
 │   • Upload obligatoire
 │   • Validation encadreur
 └─ attestation
     • Génération automatique après stage validé

[Module Notification]
 └─ notification
     • Alertes système
     • Statut lu/non lu
     • Historique notifications

[Module Message interne]
 └─ message_interne
     • Communication stagiaire ↔ encadreur ↔ admin
     • Historique
     • Notifications à réception

[Module Statistiques]
 └─ statistiques
     • Dashboard administratif
     • Rapports mensuels/annuels
     • KPIs, Graphiques

[Module Historique]
 └─ historique_action
     • Audit actions utilisateurs
     • Création/modification/suppression
     • Suivi sécurité / conformité

[Login Controller]
 ├─ Vérifie utilisateur (table utilisateur)
 ├─ Vérifie mot de passe
 ├─ Génère token JWT
 ├─ Renvoie info + permissions
 └─ Gestion erreurs / sécurité

[Reset Password Controller]
 ├─ Génère token temporaire (table reset_mot_de_passe)
 ├─ Envoie email
 ├─ Vérifie token
 └─ Update mot de passe



backend/app/
├── stagiaire/
│   ├── models.py      # Tables : stagiaire, competence
│   ├── schemas.py     # Pydantic models pour validation
│   ├── controllers.py # Routes API (CRUD, login spécifique si nécessaire)
│   └── services.py    # Logique métier (matching IA, calcul score)
├── encadreur/
│   ├── models.py
│   ├── schemas.py
│   ├── controllers.py
│   └── services.py
...