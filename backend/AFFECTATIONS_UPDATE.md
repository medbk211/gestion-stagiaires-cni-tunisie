# Affectations Model - Complete Implementation

## What Was Added

### 1. **New `Affectation` Model** ✅
Complete model that links together all the internship components:

```python
class Affectation:
    - id (PK)
    - demande_id (FK → DemandeStage)
    - projet_id (FK → Projet)
    - encadreur_id (FK → Encadreur)
    - stagiaire_id (FK → Stagiaire) [Optional initially]
    - statut (AFFECTEE, EN_COURS, COMPLETEE, ANNULEE)
    - date_affectation
    - date_debut_prevue
    - date_fin_prevue
    - created_at
    - updated_at
```

### 2. **New Enum: `StatutAffectationEnum`** ✅
```python
- AFFECTEE: Initial assignment
- EN_COURS: Internship in progress
- COMPLETEE: Successfully completed
- ANNULEE: Cancelled
```

### 3. **New Schemas** ✅
- `AffectationCreate` - For creating affectations
- `AffectationUpdate` - For updating status/dates
- `AffectationRead` - Basic read (IDs)
- `AffectationReadDetailed` - With full related objects

### 4. **Relationships** ✅
```
Affectation → DemandeStage (Many-to-One)
Affectation → Projet (Many-to-One)
Affectation → Encadreur (Many-to-One)
Affectation → Stagiaire (Many-to-One, optional)
```

### 5. **Data Constraints** ✅
- `date_fin_prevue >= date_debut_prevue` (Database level check)

### 6. **Fixed Issues** ✅
- Added missing model imports to `database.py`
- Added `evaluations` relationship to Stage model

---

## Database Schema

```
AFFECTATIONS Table:
┌─────────────────────────────────┐
│ id (PK)                         │
│ demande_id (FK)          ──────→ DEMANDES_STAGE
│ projet_id (FK)           ──────→ PROJETS
│ encadreur_id (FK)        ──────→ ENCADREURS
│ stagiaire_id (FK) [NULL] ──────→ STAGIAIRES
│ statut (ENUM)                   │
│ date_affectation                │
│ date_debut_prevue               │
│ date_fin_prevue                 │
│ created_at                      │
│ updated_at                      │
└─────────────────────────────────┘
```

---

## Workflow

### Step 1: Demand Created
```
DemandeStage created → awaiting project proposal
```

### Step 2: Project Proposed
```
PropositionProjet created → intern receives proposal
```

### Step 3: Project Selected
```
PropositionProjet.statut = CHOISI → ready for affectation
```

### Step 4: Affectation Created
```
Affectation created with:
- demande_id (from DemandeStage)
- projet_id (chosen project)
- encadreur_id (assigned supervisor)
- stagiaire_id (NULL - assigned later when user account created)
```

### Step 5: Intern Account Created
```
Stagiaire created → affectation.stagiaire_id updated
```

### Step 6: Internship Starts
```
Affectation.statut = EN_COURS
```

### Step 7: Internship Completes
```
Affectation.statut = COMPLETEE
Evaluation created
```

---

## Next Steps for Implementation

You still need to:

1. **Create router endpoints** for affectations:
   ```python
   POST /affectations - Create affectation
   GET /affectations - List all
   GET /affectations/{id} - Get details
   PUT /affectations/{id} - Update status/dates
   ```

2. **Create service functions**:
   - `create_affectation()` - with validation
   - `get_affectation()` 
   - `update_affectation_status()`
   - `assign_stagiaire_to_affectation()`

3. **Add validations**:
   - Encadreur can accept max_stagiaires
   - Demand must have selected project
   - Projet must be DISPONIBLE

4. **Add to main.py**:
   ```python
   from app.modules.affectations.router import router as affectation_router
   app.include_router(affectation_router, prefix="/affectations", tags=["Affectations"])
   ```

---

## Files Modified

✅ `app/modules/affectations/models.py` - Added Affectation model
✅ `app/modules/affectations/schemas.py` - Added Affectation schemas
✅ `app/core/database.py` - Added all missing model imports
✅ `app/modules/stage/models.py` - Added evaluations relationship

---

## Key Features

✨ **Complete traceability**: All data linked together
✨ **Status tracking**: Monitor affectation progress
✨ **Date management**: Track planned vs actual dates
✨ **Flexible**: Stagiaire assigned later
✨ **Cascading**: Auto-cleanup on deletions
✨ **Audit trail**: created_at, updated_at timestamps
