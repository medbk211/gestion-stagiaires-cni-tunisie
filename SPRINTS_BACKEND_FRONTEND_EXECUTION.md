# Execution Rapport Features (Backend + Frontend)

## Sprint 1 - Securite et socle

### Backend
- RBAC renforce sur modules sensibles (`utilisateur`, `stage`, `stagiaires`, `projet_stage`, `affectations`, `document`, `demande_stage`).
- Auth securisee:
  - secret/TTL config centralisee,
  - refresh token + revoke serveur,
  - rotation refresh token au endpoint `/auth/refresh`,
  - limite brute-force login.

### Frontend
- Gestion session centralisee:
  - token access + refresh,
  - refresh auto sur 401,
  - event global session expiree.
- Gestion erreurs reseau globale et toasts.

## Sprint 2 - Workflow metier principal

### Backend
- Workflow demandes complet:
  - `accepter`, `refuser`, `mettre-en-attente`, `reouvrir`, `historique`.
- Historique statuts demande en base.
- Email de notification sur changement statut demande.
- Workflow documents:
  - statuts `pending/approved/rejected`,
  - commentaire review,
  - `reviewed_by`, `reviewed_at`.

### Frontend
- Ecrans anciennement mock connectes API reelle:
  - dashboard admin,
  - docs/profil/settings stagiaire,
  - settings admin/encadreur,
  - gestion documents admin.

## Sprint 3 - Pilotage et optimisation API

### Backend
- Module statistiques finalise et expose:
  - `/statistiques/dashboard`,
  - `/statistiques/dashboard/filtre`,
  - `/statistiques/encadreur/overview`.
- Filtres KPI: periode, departement, encadreur.
- Endpoints cibles ajoutes:
  - `/Stages/me`,
  - `/Stages/my-interns`,
  - `/Project/projets/by-stage/{stage_id}`.
- Filtres/pagination serveur ajoutes:
  - demandes de stage,
  - documents,
  - projets.

### Frontend
- API client enrichie pour exploiter filtres/pagination.
- Mutualisation parsing erreurs API (`src/lib/apiErrors.ts`).

## Sprint 4 - Experience avancee

### Backend
- Notifications in-app (MVP):
  - table `notifications`,
  - endpoints `GET /notifications/me`, `GET /notifications/me/unread-count`,
  - `PATCH /notifications/{id}/read`, `PATCH /notifications/me/read-all`.
- Emission notifications sur:
  - changement statut demande,
  - review document.

### Frontend
- Centre notifications in-app (`NotificationBell`) dans layouts admin/encadreur/stagiaire.
- UX moderne:
  - suppression `window.confirm`,
  - export calendrier `.ics` encadreur.

## Reste a traiter (NICE TO HAVE)
- Realtime messagerie (WebSocket/SSE).
- Export metier PDF/CSV riche.
- Audit log complet admin/encadreur.
- Planning avance (recurrence + rappels + fuseaux).
