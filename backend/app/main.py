from fastapi import FastAPI
from app.core.database import test_db_connection
from app.modules.utilisateur.router import router as utilisateur_router
from app.modules.auth.router import router as auth_router

app = FastAPI(title="Gestion des Stagiaires - CNI")

# @app.on_event("startup")
# def startup():
#     test_db_connection()

# hedha prefix te3na koll modulle naamloul perfix wa7dou ...
# 👇 include router utilisateur
app.include_router(utilisateur_router,tags=["utilisateur"],prefix="/utilisateur")
app.include_router(auth_router, tags=["auth"], prefix="/auth" )
    


# @app.get("/")
# def root():
#     return {"message": "API is running 🚀"}
