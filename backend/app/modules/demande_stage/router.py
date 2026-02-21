from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import EmailStr
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.modules.demande_stage.schemas import (
    DemandeStageCreateResponse,
    DemandeStageOptionsRead,
    DemandeStageRead,
    DemandeStatusHistoryRead,
    DemandeStatusUpdateRequest,
)
from app.modules.demande_stage.service import (
    accepter_demande,
    changer_statut_demande,
    create_demande_with_upload,
    get_all_demandes_stage,
    get_demande_form_options,
    get_demande_history,
)
from app.modules.utilisateur.models import Utilisateur
from app.shared.enums import DepartementEnum, RoleEnum, StatutDemandeEnum, TypeStageEnum

router = APIRouter()


@router.get(
    '/demandes-stage/options',
    response_model=DemandeStageOptionsRead,
    status_code=status.HTTP_200_OK,
)
def read_demande_stage_options(db: Session = Depends(get_db)):
    return get_demande_form_options(db)


@router.post('/demandes-stage', response_model=DemandeStageCreateResponse)
async def create_demande_stage(
    nom: str = Form(...),
    prenom: str = Form(...),
    email: EmailStr = Form(...),
    telephone: str = Form(...),
    etablissement: str = Form(...),
    niveau_etude: TypeStageEnum = Form(...),
    departement_souhaite: DepartementEnum = Form(...),
    date_debut_souhaitee: date = Form(...),
    date_fin_souhaitee: date = Form(...),
    competences: list[str] = Form([]),
    tags: list[str] = Form([]),
    cv: UploadFile | None = File(None),
    convention: UploadFile | None = File(None),
    lettre: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    demande = await create_demande_with_upload(
        db=db,
        nom=nom,
        prenom=prenom,
        email=email,
        telephone=telephone,
        etablissement=etablissement,
        niveau_etude=niveau_etude,
        departement_souhaite=departement_souhaite,
        date_debut_souhaitee=date_debut_souhaitee,
        date_fin_souhaitee=date_fin_souhaitee,
        competences=competences,
        tags=tags,
        cv=cv,
        convention=convention,
        lettre=lettre,
    )

    return {
        'id': demande.id,
        'message': 'Demande creee avec succes',
    }


@router.get(
    '/demandes-stage',
    response_model=list[DemandeStageRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR))],
)
def read_demandes_stage(
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    statut: StatutDemandeEnum | None = None,
    departement: DepartementEnum | None = None,
    encadreur_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    if current_user.role == RoleEnum.ENCADREUR:
        return get_all_demandes_stage(
            db,
            encadreur_id=current_user.id,
            skip=skip,
            limit=limit,
            search=search,
            statut=statut,
            departement=departement,
        )

    selected_encadreur_id = encadreur_id if current_user.role == RoleEnum.ADMIN else None
    return get_all_demandes_stage(
        db,
        encadreur_id=selected_encadreur_id,
        skip=skip,
        limit=limit,
        search=search,
        statut=statut,
        departement=departement,
    )


@router.post(
    '/{demande_id}/accepter_demande_stage',
    dependencies=[Depends(require_role(RoleEnum.ADMIN))],
)
async def accepter_demande_route(
    demande_id: int,
    encadreur_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    try:
        return await accepter_demande(demande_id, encadreur_id, db, changed_by=current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post(
    '/{demande_id}/refuser',
    response_model=DemandeStageRead,
    dependencies=[Depends(require_role(RoleEnum.ADMIN))],
)
async def refuser_demande(
    demande_id: int,
    payload: DemandeStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    return await changer_statut_demande(
        db,
        demande_id,
        StatutDemandeEnum.REFUSEE,
        changed_by=current_user.id,
        reason=payload.reason,
    )


@router.post(
    '/{demande_id}/mettre-en-attente',
    response_model=DemandeStageRead,
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR))],
)
async def mettre_en_attente_demande(
    demande_id: int,
    payload: DemandeStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    return await changer_statut_demande(
        db,
        demande_id,
        StatutDemandeEnum.EN_ATTENTE,
        changed_by=current_user.id,
        reason=payload.reason,
    )


@router.post(
    '/{demande_id}/reouvrir',
    response_model=DemandeStageRead,
    dependencies=[Depends(require_role(RoleEnum.ADMIN))],
)
async def reouvrir_demande(
    demande_id: int,
    payload: DemandeStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    return await changer_statut_demande(
        db,
        demande_id,
        StatutDemandeEnum.EN_COURS,
        changed_by=current_user.id,
        reason=payload.reason,
    )


@router.get(
    '/{demande_id}/historique',
    response_model=list[DemandeStatusHistoryRead],
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR))],
)
def historique_demande(demande_id: int, db: Session = Depends(get_db)):
    return get_demande_history(db, demande_id)
