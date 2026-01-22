from pydantic import BaseModel
from typing import List


class ProjetProposeResponse(BaseModel):
    projet_id: int
    intitule: str
    score: int


class ChoixProjetRequest(BaseModel):
    demande_id: int
    projet_id: int
    token: str


class AssignEncadreurRequest(BaseModel):
    demande_id: int
    encadreur_id: int
