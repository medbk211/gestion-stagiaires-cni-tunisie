# Entity Relationship Diagram (ERD) - Gestion Stagiaires CNI

## Database Schema Overview

```
┌─────────────────────┐
│   UTILISATEURS      │
├─────────────────────┤
│ id (PK)             │
│ nom                 │
│ prenom              │
│ email (UNIQUE)      │
│ motDePasse          │
│ role (ENUM)         │
│ actif               │
│ emailVerifie        │
│ dateCreation        │
│ dateModification    │
│ dernierLogin        │
└──────┬──────────────┘
       │
       ├─────────────────────┬──────────────────────┐a
       │                     │                      │
       ▼                     ▼                      ▼
┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  STAGIAIRES     │  │  ENCADREURS      │  │ RESET_MOT_DE_    │
│  (FK to users)  │  │  (FK to users)   │  │ PASSE            │
├─────────────────┤  ├──────────────────┤  ├──────────────────┤
│ id (FK, PK)     │  │ id (FK, PK)      │  │ id (PK)          │
│ matricule       │  │ matricule        │  │ utilisateur_id   │
│ type_stage      │  │ grade            │  │ (FK)             │
│ statut_stage    │  │ departement      │  │ token            │
│ date_debut_     │  │ actif_encadrement│  │ date_creation    │
│   stage         │  │ is_active        │  │ date_expiration  │
│ date_fin_stage  │  │ max_stagiaires   │  │ utilisee         │
│ etablissement   │  └──────┬───────────┘  └──────────────────┘
│ niveau_etude    │         │
│ encadreur_id    │◄────────┘
│ (FK)            │
│ date_validation │
│ note_finale     │
└────────┬────────┘
         │
         │ (1:N)
         ▼
┌──────────────────────────┐
│      STAGES              │
├──────────────────────────┤
│ id (PK)                  │
│ demandestage_id (FK)  ◄──┼──────────┐
│ stagiaire_id (FK)     ◄──┘          │
│ encadreur_id (FK)     ◄──┐          │
│ date_debut               │          │
│ date_fin                 │          │
│ statut_stage             │          │
│ texte_objectif           │          │
└──────────┬───────────────┘          │
           │                          │
           │ (1:N)                    │
           ▼                          │
┌──────────────────────────┐          │
│   EVALUATIONS            │          │
├──────────────────────────┤          │
│ id (PK)                  │          │
│ idStage (FK)             │          │
│ note                     │          │
│ continu                  │          │
│ dateEvaluation           │          │
└──────────────────────────┘          │
                                      │
                                      │
                    ┌─────────────────┘
                    │
                    ▼
      ┌──────────────────────────┐
      │  DEMANDES_STAGE          │
      ├──────────────────────────┤
      │ id (PK)                  │
      │ nom                      │
      │ prenom                   │
      │ email (UNIQUE)           │
      │ telephone                │
      │ etablissement            │
      │ niveau_etude             │
      │ departement_souhaite     │
      │ date_debut_souhaitee     │
      │ date_fin_souhaitee       │
      │ statut                   │
      │ encadreur_id (FK)    ────┼──────────────┐
      │ created_at               │              │
      └──────────┬───────────────┘              │
                 │                              │
                 │ (1:N)                        │
                 │                              │
                 ▼                              │
      ┌──────────────────────┐                 │
      │   DOCUMENTS          │                 │
      ├──────────────────────┤                 │
      │ id (PK)              │                 │
      │ demande_id (FK)      │                 │
      │ type                 │                 │
      │ file_path            │                 │
      │ created_at           │                 │
      └──────────────────────┘                 │
                                               │
       ┌───────────────────────────────────────┘
       │
       ▼
   ┌──────────────────────┐
   │   PROJETS            │
   ├──────────────────────┤
   │ id (PK)              │
   │ code_projet (UNIQUE) │
   │ intitule             │
   │ departement          │
   │ type_stage           │
   │ description          │
   │ objectifs            │
   │ livrables            │
   │ duree_semaines       │
   │ charge_hebdo         │
   │ niveau_requis        │
   │ competences (JSON)   │
   │ tags (JSON)          │
   │ complexite           │
   │ priorite             │
   │ status               │
   │ nombre_max_stagiaires│
   │ created_at           │
   │ updated_at           │
   └──────────────────────┘
```

## Relationship Summary

| From Table | To Table | Type | Foreign Key | Notes |
|-----------|----------|------|-------------|-------|
| STAGIAIRES | UTILISATEURS | Many-to-One | id (FK) | Inheritance via Single Table Polymorphism |
| ENCADREURS | UTILISATEURS | Many-to-One | id (FK) | Inheritance via Single Table Polymorphism |
| RESET_MOT_DE_PASSE | UTILISATEURS | Many-to-One | utilisateur_id | Password reset tokens |
| STAGES | DEMANDES_STAGE | Many-to-One | demandestage_id | Actual internship |
| STAGES | STAGIAIRES | Many-to-One | stagiaire_id | Links to intern |
| STAGES | ENCADREURS | Many-to-One | encadreur_id | Links to supervisor |
| EVALUATIONS | STAGES | Many-to-One | idStage | Internship evaluation |
| DOCUMENTS | DEMANDES_STAGE | Many-to-One | demande_id | Supporting documents |
| DEMANDES_STAGE | ENCADREURS | Many-to-One | encadreur_id | Optional supervisor assignment |
| STAGIAIRES | ENCADREURS | Many-to-One | encadreur_id | Optional supervisor |

## Key Features

### User Hierarchy (Polymorphism)
- **UTILISATEURS** (Base class)
  - **STAGIAIRES** (Interns) - Extends with specific internship info
  - **ENCADREURS** (Supervisors) - Extends with grade and department

### Workflow
1. **DEMANDE_STAGE** → Initial application submission
2. **DOCUMENTS** → Support files for application
3. **STAGES** → Once approved, creates actual internship
4. **EVALUATIONS** → Performance evaluation during/after internship

### Reference Data
- **PROJETS** → Available internship projects

## Enums Used
- **RoleEnum** - User roles
- **TypeStageEnum** - Type of internship
- **StatutStageEnum** - Stage status
- **StatutDemandeEnum** - Demand status
- **DepartementEnum** - Departments
- **NiveauEnum** - Education level
- **GradeEnum** - Supervisor grade
- **DocumentTypeEnum** - Document type
- **ProjetStatusEnum** - Project status
e