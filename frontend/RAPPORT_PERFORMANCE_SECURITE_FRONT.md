# Rapport Frontend - Performance et Security

Date: 2026-02-25
Scope: frontend React + Vite

## Mise a jour execution
- Sprint 1 est implemente (lazy routes, split chunks, fonts, metas security de base, nettoyage token URL).
- Voir le plan d execution detaille: `frontend/PLAN_SPRINTS_FRONT_PERF_SEC.md`.

## 1) Etat actuel (constats)

### Build and bundle
- Build production ok, mais bundle principal lourd:
  - JS: `dist/assets/index-*.js` ~ 677 KB (gzip ~ 184 KB)
  - CSS: `dist/assets/index-*.css` ~ 151 KB
- App charge toutes les pages au demarrage (pas de lazy loading par route).
  - Ref: `frontend/src/App.tsx:1-27`

### Data loading
- Plusieurs ecrans chargent beaucoup de data d un coup (`limit=300/400/500`) puis filtrent cote client.
  - Ref: `frontend/src/pages/dashboard/admin/AdminCandidaturesPage.tsx:381,385`
  - Ref: `frontend/src/pages/dashboard/admin/AdminStatsPage.tsx:160`
  - Ref: `frontend/src/pages/dashboard/admin/AdminStagiairesPage.tsx:172`
  - Ref: `frontend/src/pages/dashboard/stagiaire/StagiaireDocumentsPage.tsx:185`

### Auth and token handling
- Access token et refresh token stockes dans `localStorage`.
  - Ref: `frontend/src/lib/api.ts:133-135,139-140,157`
- Base API par defaut en HTTP:
  - Ref: `frontend/src/lib/api.ts:1`

### Browser security hardening
- Pas de CSP / Referrer-Policy / X-Frame-Options visibles dans la page HTML.
  - Ref: `frontend/index.html`
- Usage de `dangerouslySetInnerHTML` dans le composant chart (cas controle, mais a monitorer).
  - Ref: `frontend/src/components/ui/chart.tsx:82`

### Font loading
- Fonts Google chargees via `@import` CSS (peut retarder le rendu initial).
  - Ref: `frontend/src/styles/globals.css:1`

### Audit deps
- `npm audit --omit=dev` non executable car lockfile npm absent (projet en pnpm).
  - Action recommandee: audit via `pnpm audit` en CI.

---

## 2) Priorites de correction

## P0 - Security (immediat)

1. Migrer les tokens hors `localStorage` vers cookies `HttpOnly + Secure + SameSite`.
- Impact: reduit fortement le risque de vol de token via XSS.
- Effort: moyen (front + back).

2. Activer headers de securite au niveau serveur/reverse proxy:
- `Content-Security-Policy`
- `Referrer-Policy: strict-origin-when-cross-origin` (ou plus strict)
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Permissions-Policy`
- Impact: protection browser robuste.
- Effort: faible a moyen.

3. Forcer HTTPS en production pour le frontend + API.
- `VITE_API_BASE_URL` doit pointer en `https://...`
- Impact: evite MITM et fuite de session.
- Effort: faible.

4. Route tokenisee `/selection-projet?token=...`:
- Garder token TTL court (deja present cote back), usage unique.
- Cote front: supprimer le token de la barre URL apres chargement (`history.replaceState`) pour limiter leakage via partage/screenshot.
- Impact: reduction fuite token.
- Effort: faible.

## P1 - Performance (court terme)

1. Route-level code splitting (`React.lazy` + `Suspense`).
- Cible: toutes les pages dashboard + pages secondaires.
- Ref a corriger: `frontend/src/App.tsx:1-27`.
- Impact: gros gain TTI/FCP sur landing/login.
- Effort: moyen.

2. Config Vite de split vendor via `manualChunks`.
- Ref: `frontend/vite.config.ts`.
- Impact: cache navigateur plus efficace, bundle initial plus petit.
- Effort: faible.

3. Passer les ecrans lourds en pagination/filtrage serveur.
- Eviter les appels `limit=500` puis tri local.
- Impact: baisse payload reseau + CPU client.
- Effort: moyen.

4. Introduire cache de requetes (TanStack Query par exemple).
- Eviter refetch en boucle entre pages.
- Impact: UX plus rapide et moins de charge API.
- Effort: moyen.

5. Optimiser chargement fonts.
- Remplacer `@import` par `<link rel="preconnect">` + `<link rel="stylesheet">` dans `index.html`, ou self-host fonts.
- Impact: rendu initial plus rapide.
- Effort: faible.

## P2 - Hygiene continue (moyen terme)

1. Ajouter budgets perf en CI:
- limite gzip JS initial (ex: < 140 KB), CSS initial (ex: < 30 KB).
- fail pipeline si depassement.

2. Audit security automatises:
- `pnpm audit --prod` en CI
- dependabot/renovate

3. Observabilite frontend:
- Web Vitals (LCP/INP/CLS)
- tracking erreurs runtime (Sentry ou equivalent)

4. Revue des libs UI importees:
- garder seulement les composants Radix effectivement utilises.

---

## 3) Plan d execution recommande

### Sprint 1 (quick wins - 2 a 4 jours)
- Headers de securite + HTTPS strict.
- `manualChunks` Vite.
- Lazy loading des routes principales.
- Nettoyage URL token `selection-projet`.

### Sprint 2 (1 semaine)
- Migration tokens vers cookies HttpOnly.
- Pagination serveur pour ecrans admin lourds.
- Debut cache data centralise (Query Client).

### Sprint 3 (1 semaine)
- Budgets CI perf + audit security CI.
- Web Vitals + monitoring erreurs.
- Optimisation fonts/images.

---

## 4) Resultat attendu apres implementation

- Chargement initial sensiblement plus rapide (bundle initial reduit).
- UX plus fluide sur dashboards volumineux.
- Surface d attaque frontend reduite (session handling + headers).
- Meilleure stabilite operationnelle (mesure continue + alerting).
