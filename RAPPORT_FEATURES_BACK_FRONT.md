# Rapport Features a Ajouter (Backend + Frontend)

## 1) Etat actuel (resume rapide)
- Une partie importante du coeur metier est deja presente (candidature, affectation, taches, planning, evaluations, messagerie).
- Plusieurs ecrans restent statiques/mock (profil stagiaire, documents stagiaire, settings admin/encadreur/stagiaire, dashboard admin).
- Plusieurs routes backend critiques ne sont pas encore verrouillees par role.
- Le module `statistiques` est incomplet (fichiers vides).

## 2) Priorites Backend

### MUST (priorite haute)
1. RBAC complet sur toutes les routes sensibles.
   - Verrouiller routes CRUD user/stage/stagiaire/projet/affectation/documents.
   - Exemples actuels a corriger: `backend/app/modules/utilisateur/router.py`, `backend/app/modules/stage/router.py`, `backend/app/modules/stagiaires/router.py`, `backend/app/modules/projet_stage/router.py`, `backend/app/modules/document/router.py`, `backend/app/modules/demande_stage/router.py`.
2. Workflow complet des demandes de stage.
   - Ajouter endpoints: `refuser`, `mettre en attente`, `reouvrir`, `historique statut`.
   - Ajouter motif de refus + notifications email.
3. Statistiques API (admin + encadreur).
   - Finaliser module `backend/app/modules/statistiques/` (router/schemas/repository).
   - Exposer KPI filtrables (periode, departement, encadreur, statut).
4. Auth securisee production.
   - Secret/TTL centralises depuis config (pas hardcode).
   - Refresh token + rotation + revoke/logout serveur.
   - Limitation brute-force login (rate limit).
5. Documents workflow.
   - Ajouter statut document (`pending/approved/rejected`) + commentaire de validation.
   - Journaliser qui a valide/rejete et quand.

### SHOULD (priorite moyenne)
1. Endpoints cibles "me" pour eviter les surcharges front.
   - `/stages/me`, `/stages/my-interns`, `/projects/by-stage/:id`, etc.
2. Pagination + tri + recherche cote serveur partout.
   - demandes, users, projets, evaluations, affectations, messages.
3. Notifications backend.
   - Creation module notifications + compteur non lu + marquer comme lu.
   - Evenements: nouvelle tache, review demandee, doc valide/rejete, changement statut demande.
4. Planning avance.
   - Detection de conflits horaire, recurrence, rappel, fuseau horaire.
5. Audit log.
   - Tracer actions admin/encadreur (create/update/delete/approve/reject).

### NICE TO HAVE
1. Export metier (CSV/PDF) pour dashboards, evaluations, documents.
2. Webhooks / integration calendrier (Google/Outlook).
3. Sentry/monitoring backend (deja en dependances, pas branche).

## 3) Priorites Frontend

### MUST (priorite haute)
1. Brancher les pages encore mock sur API reelle.
   - `frontend/src/pages/intern/InternDocuments.tsx`
   - `frontend/src/pages/intern/InternProfile.tsx`
   - `frontend/src/pages/intern/InternSettings.tsx`
   - `frontend/src/pages/admin/DocumentsManagement.tsx`
   - `frontend/src/pages/admin/Settings.tsx`
   - `frontend/src/pages/encadreur/Settings.tsx`
   - `frontend/src/pages/admin/Dashboard.tsx` (KPI actuellement statiques).
2. Uniformiser langue et encodage UI.
   - Corriger les caracteres corrompus (accents affiches en erreur).
   - Uniformiser FR (eviter melange FR/EN).
3. UX de confirmation moderne.
   - Remplacer `window.confirm` par modal standard app (taches, planning, evaluations).
4. Gestion erreurs reseau centralisee.
   - Affichage user-friendly + retry action + etats offline.
5. Security UX.
   - Ecran/session expiree clair + redirection propre + event "token expire" global.

### SHOULD (priorite moyenne)
1. Tableaux data-rich.
   - Recherche debounced, filtres persists (URL), tri multi-colonnes, pagination server-side.
2. Notifications in-app.
   - Centre de notifications + badge global + navigation contextuelle.
3. Upload docs avance.
   - Drag-and-drop, progression, preview, validation type/poids cote front, reprise echec.
4. Dashboards dynamiques.
   - Brancher charts sur API statistiques + filtres periode.
5. Accessibilite.
   - Focus visible, labels ARIA complets, shortcuts clavier, contraste.

### NICE TO HAVE
1. Realtime messaging (WebSocket/SSE) au lieu de refresh manuel.
2. Export front + impression PDF de vues.
3. Tutoriel onboarding role-based (admin/encadreur/stagiaire).

## 4) Performance (impact direct)

### Backend
1. Index SQL sur colonnes les plus filtrees (status, dates, FK, role).
2. Eviter N+1 queries (joinedload/selectinload selon usage).
3. Caching court TTL pour endpoints stats/listes lourdes.
4. Desactiver `echo=True` en production.

### Frontend
1. Reduire les appels "list all" puis filtre local.
2. Virtualiser les grandes listes (table virtual).
3. Garder code splitting agressif sur pages lourdes dashboard.
4. Memoisation selective des calculs/callbacks (deja partiel).
5. Optimiser bundles charts si possible (chargement lazy des libs chart).

## 5) Roadmap proposee (4 sprints)

### Sprint 1 (securite + fondation)
- RBAC complet backend.
- Secrets/auth production (refresh token, rotation).
- Gestion unifiee des erreurs front.

### Sprint 2 (metier principal)
- Workflow complet demandes (accept/refuse/historique + emails).
- Documents avec statuts validation.
- Pages intern docs/profil/settings branchees API.

### Sprint 3 (pilotage)
- Finalisation module statistiques backend.
- Dashboard admin dynamique + filtres.
- Pagination/recherche serveur sur pages admin principales.

### Sprint 4 (experience avancee)
- Notifications in-app + backend.
- Realtime messagerie.
- Export CSV/PDF + audit log.

## 6) Gaps techniques constates (preuves code)
- Secret JWT hardcode: `backend/app/core/security.py`.
- RBAC non applique partout: `backend/app/modules/utilisateur/router.py`, `backend/app/modules/stage/router.py`, `backend/app/modules/stagiaires/router.py`, `backend/app/modules/projet_stage/router.py`, `backend/app/modules/document/router.py`.
- Dashboard admin statique: `frontend/src/pages/admin/Dashboard.tsx`.
- Documents stagiaire statiques: `frontend/src/pages/intern/InternDocuments.tsx`.
- Profil stagiaire statique: `frontend/src/pages/intern/InternProfile.tsx`.
- Settings principalement statiques: `frontend/src/pages/intern/InternSettings.tsx`, `frontend/src/pages/admin/Settings.tsx`, `frontend/src/pages/encadreur/Settings.tsx`.
- Placeholder sync calendrier: `frontend/src/pages/encadreur/Schedule.tsx`.
- Module statistiques incomplet: `backend/app/modules/statistiques/router.py`, `backend/app/modules/statistiques/schemas.py`, `backend/app/modules/statistiques/repository.py`.

