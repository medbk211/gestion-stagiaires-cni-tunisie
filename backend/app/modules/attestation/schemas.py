from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AttestationCreate(BaseModel):
    stagiaire_id: int
    stage_id: int
    date_debut_stage: datetime
    date_fin_stage: datetime
    description: str | None = None


class AttestationRead(BaseModel):
    id: int
    stagiaire_id: int
    stage_id: int
    numero_attestation: str
    date_debut_stage: datetime
    date_fin_stage: datetime
    description: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AttestationDownload(BaseModel):
    file_path: str
    numero_attestation: str
