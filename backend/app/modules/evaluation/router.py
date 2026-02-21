from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.modules.evaluation.schemas import EvaluationCreate, EvaluationRead, EvaluationUpdate
from app.modules.evaluation.service import EvaluationService
from app.shared.enums import RoleEnum

router = APIRouter()


@router.post(
    "/",
    response_model=EvaluationRead,
    dependencies=[Depends(require_role(RoleEnum.ENCADREUR))],
)
def create_evaluation(
    payload: EvaluationCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return EvaluationService.create_evaluation(db, payload, current_user.id)


@router.get(
    "/my",
    response_model=list[EvaluationRead],
    dependencies=[Depends(require_role(RoleEnum.ENCADREUR, RoleEnum.STAGIAIRE))],
)
def list_my_evaluations(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    limit = max(1, min(limit, 200))

    if current_user.role == RoleEnum.STAGIAIRE:
        return EvaluationService.get_evaluations_for_stagiaire(
            db,
            current_user.id,
            skip=skip,
            limit=limit,
        )

    return EvaluationService.get_evaluations_for_encadreur(
        db,
        current_user.id,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/",
    response_model=list[EvaluationRead],
    dependencies=[Depends(require_role(RoleEnum.ADMIN))],
)
def list_all_evaluations(
    skip: int = 0,
    limit: int = 100,
    stagiaire_id: int | None = None,
    projet_id: int | None = None,
    encadreur_id: int | None = None,
    db: Session = Depends(get_db),
):
    limit = max(1, min(limit, 500))
    return EvaluationService.get_all_evaluations(
        db,
        skip=skip,
        limit=limit,
        stagiaire_id=stagiaire_id,
        projet_id=projet_id,
        encadreur_id=encadreur_id,
    )


@router.get(
    "/{evaluation_id}",
    response_model=EvaluationRead,
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR, RoleEnum.STAGIAIRE))],
)
def get_evaluation_by_id(
    evaluation_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role == RoleEnum.ADMIN:
        return EvaluationService.get_evaluation_by_admin(db, evaluation_id)
    if current_user.role == RoleEnum.STAGIAIRE:
        return EvaluationService.get_evaluation_by_stagiaire(db, evaluation_id, current_user.id)
    return EvaluationService.get_evaluation_by_encadreur(db, evaluation_id, current_user.id)


@router.put(
    "/{evaluation_id}",
    response_model=EvaluationRead,
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR))],
)
def update_evaluation(
    evaluation_id: int,
    payload: EvaluationUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role == RoleEnum.ADMIN:
        return EvaluationService.update_evaluation_by_admin(db, evaluation_id, payload)
    return EvaluationService.update_evaluation_by_encadreur(
        db,
        evaluation_id,
        payload,
        current_user.id,
    )


@router.delete(
    "/{evaluation_id}",
    status_code=200,
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR))],
)
def delete_evaluation(
    evaluation_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role == RoleEnum.ADMIN:
        EvaluationService.delete_evaluation_by_admin(db, evaluation_id)
    else:
        EvaluationService.delete_evaluation_by_encadreur(db, evaluation_id, current_user.id)
    return {"message": "Evaluation supprimee avec succes"}
