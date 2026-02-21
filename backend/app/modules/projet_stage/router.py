import os
from typing import List

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_role
from app.modules.projet_stage.schemas import (
    ProjetStageCreate,
    ProjetStageOptionsRead,
    ProjetStageRead,
    ProjetStageUpdate,
)
from app.modules.projet_stage.service import (
    create_projet_stage,
    delete_project,
    get_all_projects,
    get_project_creation_options,
    get_project,
    get_project_pdf_file_path,
    get_project_by_stage_id,
    update_project,
)
from app.shared.enums import DepartementEnum, NiveauEnum, RoleEnum, TypeStageEnum

router = APIRouter()


@router.post(
    '/projets',
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(RoleEnum.ADMIN))],
)
def create_projet(
    intitule: str = Form(...),
    departement: DepartementEnum = Form(...),
    type_stage: TypeStageEnum = Form(...),
    description: str = Form(...),
    objectifs: str = Form(...),
    livrables: str = Form(...),
    duree_semaines: int = Form(...),
    charge_hebdo: int = Form(...),
    niveau_requis: NiveauEnum = Form(...),
    competences: list[str] = Form([]),
    tags: list[str] = Form([]),
    complexite: int = Form(...),
    priorite: int = Form(...),
    nombre_max_stagiaires: int = Form(...),
    fiche_pdf: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    projet_data = ProjetStageCreate(
        intitule=intitule,
        departement=departement,
        type_stage=type_stage,
        description=description,
        objectifs=objectifs,
        livrables=livrables,
        duree_semaines=duree_semaines,
        charge_hebdo=charge_hebdo,
        niveau_requis=niveau_requis,
        competences=competences,
        tags=tags,
        complexite=complexite,
        priorite=priorite,
        nombre_max_stagiaires=nombre_max_stagiaires,
    )
    projet_stage = create_projet_stage(db, projet_data, fiche_pdf=fiche_pdf)
    return {
        'success': True,
        'message': 'Projet cree avec succes',
        'code_projet': projet_stage.code_projet,
        'intitule': projet_stage.intitule,
        'fiche_pdf_uploaded': bool(projet_stage.fiche_pdf_path),
    }


@router.get(
    '/projets',
    response_model=List[ProjetStageRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR, RoleEnum.STAGIAIRE))],
)
def read_projets(
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    departement: str | None = None,
    status_filter: str | None = None,
    db: Session = Depends(get_db),
):
    return get_all_projects(
        db,
        skip=skip,
        limit=limit,
        search=search,
        departement=departement,
        status_filter=status_filter,
    )


@router.get(
    '/projets/recherche',
    response_model=List[ProjetStageRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR, RoleEnum.STAGIAIRE))],
)
def search_projets(
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    departement: str | None = None,
    status_filter: str | None = None,
    db: Session = Depends(get_db),
):
    return get_all_projects(
        db,
        skip=skip,
        limit=limit,
        search=search,
        departement=departement,
        status_filter=status_filter,
    )


@router.get(
    '/projets/options',
    response_model=ProjetStageOptionsRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR, RoleEnum.STAGIAIRE))],
)
def read_projet_options(db: Session = Depends(get_db)):
    return get_project_creation_options(db)


@router.get(
    '/projets/{projet_id}',
    response_model=ProjetStageRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR, RoleEnum.STAGIAIRE))],
)
def read_projet(projet_id: int, db: Session = Depends(get_db)):
    return get_project(db, projet_id)


@router.get(
    '/projets/by-stage/{stage_id}',
    response_model=ProjetStageRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR, RoleEnum.STAGIAIRE))],
)
def read_projet_by_stage(stage_id: int, db: Session = Depends(get_db)):
    return get_project_by_stage_id(db, stage_id)


@router.get(
    '/projets/{projet_id}/fiche-pdf',
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR, RoleEnum.STAGIAIRE))],
)
def download_projet_pdf(projet_id: int, db: Session = Depends(get_db)):
    file_path = get_project_pdf_file_path(db, projet_id)
    return FileResponse(
        file_path,
        media_type='application/pdf',
        filename=os.path.basename(file_path),
    )


@router.put(
    '/projets/{projet_id}',
    response_model=ProjetStageRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_role(RoleEnum.ADMIN))],
)
def update_projet(projet_id: int, projet_data: ProjetStageUpdate, db: Session = Depends(get_db)):
    return update_project(db, projet_id, projet_data)


@router.delete(
    '/projets/{projet_id}',
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_role(RoleEnum.ADMIN))],
)
def remove_projet(projet_id: int, db: Session = Depends(get_db)):
    return delete_project(db, projet_id)
