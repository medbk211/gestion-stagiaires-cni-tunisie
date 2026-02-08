# Affectations Router & Service - Complete Endpoints

## API Endpoints Overview

### Base URL: `/affectations`

---

## 📋 EXISTING ENDPOINTS (Project Proposals)

### 1. **Propose 3 Projects to Demand**
```
POST /affectations/demande/{demande_id}/proposer-projets
```
**Access:** Admin
**Description:** Admin proposes 3 projects → System creates tokens + sends email
**Response:** Top 3 projects with scores

---

### 2. **View Projects by Token**
```
GET /affectations/selection-projet?token={token}
```
**Access:** Public (offline stagiaire)
**Description:** Stagiaire clicks link → views 3 projects
**Response:** List of 3 projects with details

---

### 3. **Choose Project**
```
POST /affectations/choisir-projet
```
**Request Body:**
```json
{
  "token": "string",
  "projet_id": 1
}
```
**Access:** Stagiaire
**Description:** Stagiaire chooses 1 project → locks choice
**Response:** Success message with project details

---

### 4. **View Chosen Projects (Supervisor)**
```
GET /affectations/encadreur/{encadreur_id}/projets-choisis
```
**Access:** Supervisor, Admin
**Description:** Supervisor sees projects chosen in their department
**Response:** List of chosen projects with applicant details

---

### 5. **Assign Supervisor to Demand**
```
POST /affectations/assign-encadreur
```
**Request Body:**
```json
{
  "demande_id": 1,
  "encadreur_id": 5
}
```
**Access:** Admin
**Description:** Admin assigns supervisor to application
**Response:** Assignment confirmation

---

### 6. **List All Propositions**
```
GET /affectations/list
```
**Access:** Admin
**Description:** Admin sees all propositions/affectations
**Response:** List with all details (demand, project, status, etc.)

---

## 🆕 NEW AFFECTATION ENDPOINTS

### 7. **Create Affectation**
```
POST /affectations/
```
**Request Body:**
```json
{
  "demande_id": 1,
  "projet_id": 5,
  "encadreur_id": 3,
  "stagiaire_id": null,
  "date_debut_prevue": "2024-03-01T00:00:00",
  "date_fin_prevue": "2024-05-01T00:00:00"
}
```
**Status:** 201 Created
**Access:** Admin
**Description:** Create new internship affectation
**Response:**
```json
{
  "id": 1,
  "demande_id": 1,
  "projet_id": 5,
  "encadreur_id": 3,
  "stagiaire_id": null,
  "statut": "AFFECTEE",
  "date_affectation": "2024-02-02T12:00:00",
  "date_debut_prevue": "2024-03-01T00:00:00",
  "date_fin_prevue": "2024-05-01T00:00:00",
  "created_at": "2024-02-02T12:00:00",
  "updated_at": "2024-02-02T12:00:00"
}
```

---

### 8. **List All Affectations**
```
GET /affectations/?skip=0&limit=100
```
**Query Parameters:**
- `skip`: Records to skip (default: 0)
- `limit`: Max records (default: 100, max: 500)

**Access:** Admin
**Description:** Get all affectations with pagination
**Response:** Array of affectations

---

### 9. **Get Affectation Details**
```
GET /affectations/{affectation_id}
```
**Access:** Admin, Related users
**Description:** Get detailed affectation with all related objects
**Response:**
```json
{
  "id": 1,
  "demande": {
    "id": 1,
    "nom": "Dupont",
    "prenom": "Jean",
    "email": "jean@example.com",
    "etablissement": "University"
  },
  "projet": {
    "id": 5,
    "code_projet": "PRJ001",
    "intitule": "Web Development",
    "departement": "INFORMATIQUE"
  },
  "encadreur": {
    "id": 3,
    "nom": "Martin",
    "prenom": "Pierre",
    "grade": "Senior"
  },
  "stagiaire": null,
  "statut": "AFFECTEE",
  "date_affectation": "2024-02-02T12:00:00",
  "date_debut_prevue": "2024-03-01T00:00:00",
  "date_fin_prevue": "2024-05-01T00:00:00",
  "created_at": "2024-02-02T12:00:00",
  "updated_at": "2024-02-02T12:00:00"
}
```

---

### 10. **Update Affectation**
```
PUT /affectations/{affectation_id}
```
**Request Body (all optional):**
```json
{
  "statut": "EN_COURS",
  "stagiaire_id": 10,
  "date_debut_prevue": "2024-03-05T00:00:00",
  "date_fin_prevue": "2024-05-05T00:00:00"
}
```
**Access:** Admin
**Description:** Update affectation status or dates
**Response:** Updated affectation object

**Valid Statuses:**
- `AFFECTEE` - Initial assignment
- `EN_COURS` - Internship in progress
- `COMPLETEE` - Successfully completed
- `ANNULEE` - Cancelled

---

### 11. **Delete Affectation**
```
DELETE /affectations/{affectation_id}
```
**Status:** 204 No Content
**Access:** Admin
**Description:** Delete/cancel an affectation
**Response:** Empty (204 success or 404 not found)

---

### 12. **List Intern's Affectations**
```
GET /affectations/stagiaire/{stagiaire_id}
```
**Access:** Intern, Admin
**Description:** Get all affectations for a specific intern
**Response:** Array of affectations

---

### 13. **List Supervisor's Affectations**
```
GET /affectations/encadreur/{encadreur_id}/affectations
```
**Access:** Supervisor, Admin
**Description:** Get all affectations for a specific supervisor
**Response:** Array of affectations

---

### 14. **List Project's Affectations**
```
GET /affectations/projet/{projet_id}
```
**Access:** Admin
**Description:** Get all affectations for a specific project
**Response:** Array of affectations

---

## Service Functions

### Backend Functions in `service.py`

1. **create_affectation(affectation_data, db)** - async
   - Creates affectation with validations
   - Checks supervisor capacity
   - Validates all foreign keys

2. **get_affectation_by_id(affectation_id, db)**
   - Returns affectation with related objects

3. **get_all_affectations(db, skip, limit)**
   - Returns paginated list

4. **update_affectation_status(affectation_id, affectation_data, db)** - async
   - Updates status, dates, or stagiaire
   - Validates changes

5. **delete_affectation(affectation_id, db)**
   - Deletes affectation
   - Returns success boolean

6. **get_affectations_by_stagiaire(stagiaire_id, db)**
   - Filters by intern

7. **get_affectations_by_encadreur(encadreur_id, db)**
   - Filters by supervisor

8. **get_affectations_by_projet(projet_id, db)**
   - Filters by project

---

## Status Codes

- **201 Created** - Affectation successfully created
- **200 OK** - Successful read/update
- **204 No Content** - Successful deletion
- **400 Bad Request** - Validation error
- **404 Not Found** - Resource not found
- **500 Server Error** - Database or server error

---

## Workflow Example

```
1. POST /affectations/demande/1/proposer-projets
   → Creates 3 PropositionProjet entries

2. GET /affectations/selection-projet?token=xxx
   → Shows 3 projects to stagiaire

3. POST /affectations/choisir-projet
   → Sets PropositionProjet.statut = CHOISI

4. POST /affectations/
   → Creates Affectation (new model)
   → Links demande, projet, encadreur

5. PUT /affectations/1
   → Update status to EN_COURS
   → Assign stagiaire_id

6. PUT /affectations/1
   → Update status to COMPLETEE
   → Create Evaluation
```

---

## Error Handling

All endpoints handle:
- Missing resources (404)
- Validation errors (400)
- Constraint violations
- Supervisor capacity checks
- Status transition validation
