# Plan Sprints - Frontend Performance and Security

Date: 2026-02-25

## Sprint 1 (Realise)
Objectif: reduire le temps de chargement initial et appliquer les hardenings frontend immediats.

- [x] Lazy loading des routes React (code splitting par page)
  - Fichier: `src/App.tsx`
- [x] Fallback global de chargement pour routes lazy
  - Fichier: `src/App.tsx`
- [x] Split vendor via Vite `manualChunks`
  - Fichier: `vite.config.ts`
- [x] Optimisation fonts (preconnect + stylesheet dans `index.html`)
  - Fichiers: `index.html`, `src/styles/globals.css`
- [x] Hardening meta policy cote frontend (referrer/content-type/permissions)
  - Fichier: `index.html`
- [x] Nettoyage du token dans l URL de `selection-projet` apres lecture
  - Fichier: `src/pages/SelectionProjetPage.tsx`
- [x] Verification build production
  - Commande: `npm run build` (OK)

Resultat attendu Sprint 1:
- Chunks frontend plus petits et charges a la demande.
- Meilleure securite pratique pour les URL tokenisees.
- Meilleur comportement de chargement des fonts.

## Sprint 2 (A faire - priorite haute)
Objectif: renforcer la securite session + limiter la charge data inutile.

- [ ] Migration auth tokens de `localStorage` vers cookies `HttpOnly` (front + backend)
- [ ] Pagination serveur sur ecrans volumineux admin/stagiaire
  - Cibles initiales:
    - `AdminCandidaturesPage`
    - `AdminStatsPage`
    - `AdminStagiairesPage`
    - `StagiaireDocumentsPage`
- [ ] Standardiser cache/retry avec un client de data (ex: TanStack Query)
- [ ] Ajouter strategy de refresh de token basee cookie (sans exposer token JS)

Definition of Done Sprint 2:
- Plus aucun token sensible dans `localStorage`.
- Les pages lourdes ne chargent plus 300-500 items au premier rendu.

## Sprint 3 (A faire - industrialisation)
Objectif: automatiser le controle qualite performance/security.

- [ ] CI security audit (dependances prod)
- [ ] CI budget performance (taille chunks/asset max)
- [ ] Monitoring frontend:
  - erreurs runtime
  - web vitals (LCP, INP, CLS)
- [ ] Hardening headers cote serveur/reverse proxy (CSP, frame-ancestors, etc.)

Definition of Done Sprint 3:
- Pipeline CI bloque les regressions critiques.
- Visibilite claire sur perf reel utilisateur et incidents JS.

