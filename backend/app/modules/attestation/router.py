from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.modules.attestation.schemas import AttestationCreate, AttestationRead
from app.modules.attestation.service import AttestationService
from app.shared.enums import RoleEnum

router = APIRouter()


@router.post(
    "/",
    response_model=AttestationRead,
    dependencies=[Depends(require_role(RoleEnum.ADMIN))],
)
def create_attestation(
    payload: AttestationCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Create attestation for completed stage (admin only)"""
    return AttestationService.create_attestation(db, payload, current_user.id)


@router.get(
    "/my",
    response_model=list[AttestationRead],
    dependencies=[Depends(require_role(RoleEnum.STAGIAIRE))],
)
def list_my_attestations(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get all attestations for current stagiaire"""
    limit = max(1, min(limit, 200))
    return AttestationService.get_attestations_for_stagiaire(
        db,
        current_user.id,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/",
    response_model=list[AttestationRead],
    dependencies=[Depends(require_role(RoleEnum.ADMIN))],
)
def list_all_attestations(
    skip: int = 0,
    limit: int = 500,
    stagiaire_id: int | None = None,
    stage_id: int | None = None,
    db: Session = Depends(get_db),
):
    """Get all attestations (admin only)"""
    limit = max(1, min(limit, 500))
    return AttestationService.get_all_attestations(
        db,
        skip=skip,
        limit=limit,
        stagiaire_id=stagiaire_id,
        stage_id=stage_id,
    )


@router.get(
    "/{attestation_id}",
    response_model=AttestationRead,
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.STAGIAIRE))],
)
def get_attestation_by_id(
    attestation_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get attestation by ID"""
    if current_user.role == RoleEnum.STAGIAIRE:
        return AttestationService.get_attestation_by_id(db, attestation_id, current_user.id)
    return AttestationService.get_attestation_by_id(db, attestation_id)


@router.get(
    "/{attestation_id}/download",
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.STAGIAIRE))],
)
def download_attestation(
    attestation_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Download attestation PDF (admin or owner stagiaire)"""
    attestation = AttestationService.get_attestation_by_id(db, attestation_id)
    
    if current_user.role == RoleEnum.STAGIAIRE and attestation.stagiaire_id != current_user.id:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé",
        )
    
    file_path = attestation.file_path
    if not file_path:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fichier d'attestation non disponible",
        )
    
    return FileResponse(
        path=file_path,
        filename=f"{attestation.numero_attestation}.pdf",
        media_type="application/pdf",
    )


@router.delete(
    "/{attestation_id}",
    dependencies=[Depends(require_role(RoleEnum.ADMIN))],
)
def delete_attestation(
    attestation_id: int,
    db: Session = Depends(get_db),
):
    """Delete attestation (admin only)"""
    AttestationService.delete_attestation(db, attestation_id)
    return {"message": "Attestation supprimée avec succès"}
