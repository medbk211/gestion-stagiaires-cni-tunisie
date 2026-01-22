from pydantic import BaseModel
from app.shared.enums import GradeEnum, DepartementEnum
from typing import Optional
from pydantic.networks import EmailStr



class EncadreurBaseSchema(BaseModel):
    nom : str
    prenom: str
    email: EmailStr
    matricule: str
    grade: GradeEnum
    departement: DepartementEnum | None = None
    actif_encadrement: bool = True

class EncadreurCreateSchema(EncadreurBaseSchema):
    pass    

class EncadreurUpdateSchema(BaseModel):
    nom: Optional[str] = None
    prenom: Optional[str] = None
    email: Optional[EmailStr] = None
    telephone: Optional[str] = None
    is_active: Optional[bool] = None    

class EncadreurResponseSchema(EncadreurBaseSchema):
    id: int
    max_stagiaires: int

    class Config:
        from_attributes = True
