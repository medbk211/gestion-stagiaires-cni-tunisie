from fastapi import HTTPException, UploadFile
from uuid import uuid4
from datetime import date
import os

MAX_FILE_SIZE = 2 * 1024 * 1024  # 2MB
ALLOWED_TYPE = "application/pdf"


def validate_dates(date_debut: date, date_fin: date):
    if date_fin <= date_debut:
        raise HTTPException(
            status_code=400,
            detail="Date fin doit être après date début"
        )


def validate_file(file: UploadFile):
    if file.content_type != ALLOWED_TYPE:
        raise HTTPException(
            status_code=400,
            detail="Seulement les fichiers PDF sont autorisés"
        )

    file.file.seek(0, os.SEEK_END)
    size = file.file.tell()
    file.file.seek(0)

    if size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="Fichier trop volumineux (max 2MB)"
        )
