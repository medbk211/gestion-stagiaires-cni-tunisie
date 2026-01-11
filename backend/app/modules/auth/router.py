from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.modules.auth.schemas import LoginRequest, LoginResponse
from app.modules.auth.service import login_user

router = APIRouter()

@router.post("/login", response_model=LoginResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    token = login_user(db, form_data.username, form_data.password)
    return {
        "access_token": token,
        "token_type": "bearer"
    }
