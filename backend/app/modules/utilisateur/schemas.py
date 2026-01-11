from pydantic import BaseModel, EmailStr
from datetime import datetime
from app.shared.enums import RoleEnum

class UtilisateurBase(BaseModel):
    nom: str
    prenom: str
    email: EmailStr
    role: RoleEnum

class UtilisateurCreate(UtilisateurBase):
    motDePasse: str
    

class UtilisateurUpdate(BaseModel):
    nom: str | None = None
    prenom: str | None = None
    email: EmailStr | None = None
    role: RoleEnum | None = None
    actif: bool | None = None


class UtilisateurRead(UtilisateurBase):
    id: int
    actif: bool
    dateCreation: datetime

    class Config:
        from_attributes = True
