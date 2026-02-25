# Gestion Stagiaires CNI Tunisie

Plateforme complete de gestion des candidatures de stage, affectations, suivi stagiaires et communication interne.

Le projet est organise en 2 parties:
- `backend/`: API FastAPI + SQLAlchemy + Alembic.
- `frontend/`: application React + Vite (dashboards Admin, Encadrant, Stagiaire).

## 1) Fonctionnalites principales

- Gestion des candidatures et des demandes de stage.
- Catalogue de projets de stage et selection de projet via lien tokenise.
- Affectation encadreur <-> demande/projet.
- Gestion des stagiaires (liste, details, progression, edition profil).
- Gestion des encadreurs.
- Suivi taches (kanban), planning, messages internes.
- Gestion documents et validations.
- Evaluation et statistiques dashboard.
- Notifications internes par role.

## 2) Stack technique

- Backend: `FastAPI`, `SQLAlchemy`, `Alembic`, `Pydantic`, `JWT auth`.
- Base de donnees: `MySQL` (fallback SQLite possible pour tests).
- Frontend: `React 19`, `TypeScript`, `Vite`, `Tailwind`, `Radix UI`.

## 3) Roles metier

- `ADMIN`: pilotage global, candidatures, stagiaires, encadreurs, projets, stats.
- `ENCADREUR`: suivi des stagiaires encadres, planning, messages, evaluations.
- `STAGIAIRE`: suivi stage/projet, taches, journal, documents, messages.

## 4) Structure du repository

```text
gestion-stagiaires-cni-tunisie/
|-- backend/
|   |-- app/
|   |-- migrations/
|   |-- requirements.txt
|   `-- .env
|-- frontend/
|   |-- src/
|   |-- public/
|   `-- package.json
`-- README.md
```

## 5) Prerequis

- Python `3.11+` (recommande `3.12`)
- Node.js `18+` (recommande `20+`)
- npm ou pnpm
- MySQL (si execution en mode MySQL)

## 6) Installation et lancement local

### 6.1 Backend

Depuis la racine du projet:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

Configurer `backend/.env` (exemple minimal):

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=gestion_stagiaires

SECRET_KEY=change_this_secret
FRONTEND_URL=http://localhost:5173

MAIL_USERNAME=you@example.com
MAIL_PASSWORD=mail_app_password
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_FROM=you@example.com
```

Executer les migrations:

```powershell
alembic upgrade head
```

Lancer l API:

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Optionnel (jeu initial encadreurs):

```powershell
python -m app.shared.seed_projets
```

### 6.2 Frontend

Dans un nouveau terminal:

```powershell
cd frontend
npm install
npm run dev
```

Optionnel: definir URL API custom dans `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

Par defaut, le frontend pointe deja sur `http://localhost:8000`.

## 7) URLs utiles en local

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

Exemple route publique de choix projet:
- `http://localhost:5173/selection-projet?token=...`

## 8) Endpoints backend (prefixes)

- `/auth`
- `/utilisateur`
- `/projets-stage`
- `/Project`
- `/affectation`
- `/encadreur`
- `/Stages`
- `/stagiaires`
- `/choix-projet`
- `/propositions_projets_router`
- `/documents`
- `/tasks`
- `/communication`
- `/evaluations`
- `/planning`
- `/statistiques`
- `/notifications`

## 9) Tests

Backend:

```powershell
cd backend
pytest
```

Le projet contient des tests API pour auth, demandes, affectations, messages, notifications.

## 10) Build production

Frontend:

```powershell
cd frontend
npm run build
npm run preview
```

Backend (serveur prod exemple):

```powershell
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## 11) Recommandations securite

- Ne jamais commiter de vrais mots de passe/cles dans `.env`.
- Changer `SECRET_KEY` avant toute mise en production.
- Utiliser des credentials DB et SMTP dedies par environnement.
- Limiter les origines CORS aux domaines de production.

## 12) Workflow developpement

- Une branche par feature.
- Commit message clair par bloc fonctionnel.
- Ouvrir une Pull Request vers `main`.
- Verifier tests backend + build frontend avant merge.

