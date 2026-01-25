from fastapi import APIRouter, Depends
from app.modules.encadreurs.service import (
    create_encadreur_by_admin,
    get_all_encadreurs,
    get_encadreur_by_id,
    delete_encadreur as delete_encadreur_service,
    update_encadreur as update_encadreur_service,
    get_available_encadreurs as get_available_encadreurs_service,
)
from app.modules.encadreurs.schemas import EncadreurCreateSchema, EncadreurResponseSchema, EncadreurUpdateSchema
from app.core.database import get_db
from fastapi import HTTPException, status
from sqlalchemy.orm import Session



router = APIRouter()


# Define your encadreur-related routes here
@router.post("/encadreurs/",)
async def create_encadreur(data :EncadreurCreateSchema,db: Session = Depends(get_db) ):
    return await  create_encadreur_by_admin(db,data)


# Additional routes (e.g., get, update, delete encadreurs) can be added here
@router.get("/",response_model=list[EncadreurResponseSchema])
def list_encadreurs(
    db: Session = Depends(get_db)
):
    return get_all_encadreurs(db)


@router.get("/{encadreur_id}",response_model=EncadreurResponseSchema)
def get_encadreur(encadreur_id: int,db: Session = Depends(get_db)):
    encadreur = get_encadreur_by_id(db, encadreur_id)
    if not encadreur:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Encadreur not found"
        )
    return encadreur


@router.put( "/{encadreur_id}", response_model=EncadreurResponseSchema)
def update_encadreur(encadreur_id: int,data: EncadreurUpdateSchema,db: Session = Depends(get_db)
):
    encadreur = update_encadreur_service(db, encadreur_id, data)
    if not encadreur:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Encadreur not found"
        )
    return encadreur


@router.delete("/{encadreur_id}",status_code=status.HTTP_204_NO_CONTENT)
def delete_encadreur( encadreur_id: int, db: Session = Depends(get_db)):
    success = delete_encadreur_service(db, encadreur_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Encadreur not found"
        )
    return None


@router.get("/available/",response_model=list[EncadreurResponseSchema])
def get_available_encadreurs( db: Session = Depends(get_db)):
    return get_available_encadreurs_service(db)