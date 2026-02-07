from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.modules.affectations.schemas import (
    AssignEncadreurRequest,
    ChoixProjetRequest,
    AffectationCreate,
    AffectationUpdate,
    AffectationRead,
    AffectationReadDetailed
)
from app.modules.affectations.service import (
    assigner_encadreur,
    # New affectation services
    create_affectation,
    get_affectation_by_id,
    get_all_affectations,
    update_affectation_status,
    delete_affectation,
    get_affectations_by_stagiaire,
    get_affectations_by_encadreur,
    get_affectations_by_projet,
)
from app.modules.demande_stage.models import DemandeStage
from app.modules.projet_stage.models import Projet

router = APIRouter()

# Proposition-related endpoints moved to `app.modules.propositions_projets.router`

@router.post("/assign-encadreur")
def router_assigner_encadreur(payload: AssignEncadreurRequest, db: Session = Depends(get_db)):
    return assigner_encadreur(payload.demande_id, payload.encadreur_id, db)


# ============ NEW AFFECTATION ENDPOINTS ============

@router.post(
    "/",
    response_model=AffectationRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create affectation",
    description="Create a new affectation linking demand, project, and supervisor"
)
async def create_affectation_endpoint(
    affectation_data: AffectationCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new internship affectation.
    
    Links together:
    - DemandeStage (application)
    - Projet (chosen project)
    - Encadreur (assigned supervisor)
    - Stagiaire (optional, assigned later)
    """
    try:
        return await create_affectation(affectation_data, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating affectation: {str(e)}")


@router.get(
    "/",
    response_model=List[AffectationRead],
    summary="List all affectations",
    description="Get all internship affectations with pagination"
)
def list_affectations(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Get all affectations with optional pagination.
    
    Query Parameters:
    - skip: Number of records to skip (default: 0)
    - limit: Maximum number of records (default: 100, max: 500)
    """
    if limit > 500:
        limit = 500
    return get_all_affectations(db, skip, limit)


@router.get(
    "/{affectation_id}",
    response_model=AffectationReadDetailed,
    summary="Get affectation details",
    description="Get detailed information about a specific affectation"
)
def get_affectation_details(
    affectation_id: int,
    db: Session = Depends(get_db)
):
    """
    Get detailed affectation with all related objects.
    """
    affectation = get_affectation_by_id(affectation_id, db)
    if not affectation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Affectation {affectation_id} not found"
        )
    return affectation


@router.put(
    "/{affectation_id}",
    response_model=AffectationRead,
    summary="Update affectation",
    description="Update affectation status or dates"
)
async def update_affectation_endpoint(
    affectation_id: int,
    affectation_data: AffectationUpdate,
    db: Session = Depends(get_db)
):
    """
    Update an affectation.
    
    Can update:
    - statut (AFFECTEE, EN_COURS, COMPLETEE, ANNULEE)
    - stagiaire_id (assign intern)
    - date_debut_prevue
    - date_fin_prevue
    """
    try:
        updated = await update_affectation_status(affectation_id, affectation_data, db)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Affectation {affectation_id} not found"
            )
        return updated
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete(
    "/{affectation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete affectation",
    description="Delete/cancel an affectation"
)
async def delete_affectation_endpoint(
    affectation_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete an affectation.
    """
    success = delete_affectation(affectation_id, db)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Affectation {affectation_id} not found"
        )

@router.get(
    "/stagiaire/{stagiaire_id}",
    response_model=List[AffectationRead],
    summary="Get stagiaire affectations",
    description="Get all affectations for a specific intern"
)
def list_stagiaire_affectations(
    stagiaire_id: int,
    db: Session = Depends(get_db)
):
    """
    Get all affectations for a specific intern (Stagiaire).
    """
    return get_affectations_by_stagiaire(stagiaire_id, db)


@router.get(
    "/encadreur/{encadreur_id}/affectations",
    response_model=List[AffectationRead],
    summary="Get encadreur affectations",
    description="Get all affectations for a specific supervisor"
)
def list_encadreur_affectations(
    encadreur_id: int,
    db: Session = Depends(get_db)
):
    """
    Get all affectations for a specific supervisor (Encadreur).
    """
    return get_affectations_by_encadreur(encadreur_id, db)


@router.get(
    "/projet/{projet_id}",
    response_model=List[AffectationRead],
    summary="Get projet affectations",
    description="Get all affectations for a specific project"
)
def list_projet_affectations(
    projet_id: int,
    db: Session = Depends(get_db)
):
    """
    Get all affectations for a specific project.
    """
    return get_affectations_by_projet(projet_id, db)


