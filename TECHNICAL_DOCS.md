# Documentation Technique - Gestion des Stagiaires CNI

## 1. Vue d'ensemble
Cette application est une plateforme de gestion des stagiaires pour le CNI (Centre National de l'Informatique). Elle permet aux candidats de postuler en ligne, aux administrateurs de gérer les demandes et les affectations, et aux encadreurs de suivre leurs stagiaires.

## 2. Architecture Technique

### Frontend (React + Vite)
- **Framework**: React 18 avec TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS pour le design utilitaire
- **Composants UI**: Radix UI (primitives) + Shadcn/UI (composants stylisés)
- **Animations**: Framer Motion
- **Gestion d'état**: React Hooks (useState, useEffect)
- **Routing**: React Router (implémentation personnalisée dans App.tsx)
- **Notifications**: Sonner (Toast notifications)

### Backend (FastAPI)
- **Framework**: FastAPI (Python)
- **Base de données**: MySQL avec SQLAlchemy ORM
- **Authentification**: JWT (JSON Web Tokens)
- **Validation**: Pydantic models

## 3. Structure du Projet (Frontend)

```
src/
├── app/
│   ├── components/
│   │   ├── admin/       # Composants de l'administration (Sidebar, Dashboard...)
│   │   ├── layout/      # Layouts globaux (AdminLayout...)
│   │   ├── ui/          # Composants réutilisables (Button, Input, Card...)
│   │   └── ...
│   ├── landing/         # Nouvelle Landing Page publique
│   │   ├── components/  # Navbar, Hero, Features, ApplicationForm...
│   │   └── LandingPage.tsx
│   ├── pages/           # Pages autonomes (SelectionProjet...)
│   └── App.tsx          # Point d'entrée et routing
├── api.ts               # Configuration Axios et endpoints API
└── main.tsx             # Montage de l'application React
```

## 4. Fonctionnalités Clés

### Landing Page & Candidature
- **Page d'accueil** : Présentation moderne avec sections Hero et Features.
- **Formulaire** : Candidature spontanée avec upload de fichiers (CV, Convention).
- **Champs** : Sélection dynamique du poste/département, validation des données.

### Administration
- **Dashboard** : Vue d'ensemble des statistiques.
- **Gestion des demandes** : Traitement des candidatures reçues.
- **Affectations** : Attribution des encadreurs et projets.

## 5. Instructions d'Installation et de Démarrage

### Prérequis
- Node.js (v16+)
- Python (v3.8+)
- MySQL Server

### Backend
```bash
cd backend
pip install -r requirements.txt
pip install python-dotenv pymysql
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 6. Maintenance
- **Ajout de postes** : Modifier la constante `POSTES` dans `src/app/landing/components/ApplicationForm.tsx`.
- **Menu Admin** : Modifier `menuItems` dans `src/app/components/admin/Sidebar.tsx`.
