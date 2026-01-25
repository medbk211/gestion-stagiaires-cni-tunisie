from pydantic import BaseModel
from typing import List, Optional


class ProjetProposeResponse(BaseModel):
    projet_id: int
    intitule: str
    score: int


class ChoixProjetRequest(BaseModel):
    token: str
    projet_id: int


class AssignEncadreurRequest(BaseModel):
    demande_id: int
    encadreur_id: int
