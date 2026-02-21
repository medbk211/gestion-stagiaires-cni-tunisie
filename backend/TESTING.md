# Tests Backend + CI

## Prerequis
- Python 3.12
- Environnement virtuel backend (`backend/venv`)

## Installation
```bash
cd backend
pip install -r requirements.txt
```

## Lancer les tests en local
```bash
cd backend
pytest
```

## Variables utilisees en test
Les tests utilisent SQLite automatiquement:
- `DATABASE_URL=sqlite:///./test_api.db`
- variables mail factices pour eviter un blocage d import

## Couverture actuelle (API critiques)
- `auth`: login, refresh, forgot-password
- `demandes`: options, creation, protection d acces, listing admin
- `affectations`: protection admin, assignation, creation
- `messages`: envoi, conversations, thread
- `notifications`: unread count, list, mark read, mark all read

## CI GitHub Actions
Workflow:
- `.github/workflows/backend-tests.yml`

Declenchement:
- `push` et `pull_request` sur fichiers backend

Execution:
- install deps
- `pytest` sur le backend
