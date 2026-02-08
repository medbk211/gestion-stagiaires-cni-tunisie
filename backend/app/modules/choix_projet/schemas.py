from pydantic import BaseModel
from typing import Optional


class ChoixProjetRequest(BaseModel):
    token: str
    projet_id: int


