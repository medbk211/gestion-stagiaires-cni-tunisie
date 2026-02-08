from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import test_db_connection
from app.modules.utilisateur.router import router as utilisateur_router
from app.modules.auth.router import router as auth_router
from app.modules.demande_stage.router import router as demande_stage
from app.modules.projet_stage.router import router as Projets_stage
from app.modules.affectations.router import router as affectation_router
from app.modules.choix_projet.router import router as choix_projet_router
from app.modules.propositions_projets.router import router as propositions_projets_router
from app.modules.encadreurs.router import router as encadreur_router
from app.modules.stage.router import router as Stages
from app.modules.document.router import router as document_router
from app.modules.stagiaires.router import router as stagiaire_router
from app.modules.tasks.router import router as tasks_router


app = FastAPI(title="Gestion des Stagiaires - CNI")

# Prefix par module
app.include_router(utilisateur_router, tags=["utilisateur"], prefix="/utilisateur")
app.include_router(auth_router, tags=["auth"], prefix="/auth")
app.include_router(demande_stage, tags=["Demandes de stage"], prefix="/projets-stage")
app.include_router(Projets_stage, tags=["Projets de stage"], prefix="/Project")
app.include_router(affectation_router, tags=["Affectation de stage"], prefix="/affectation")
app.include_router(encadreur_router, tags=["Encadreurs"], prefix="/encadreur")
app.include_router(Stages, tags=["Stages"], prefix="/Stages")
app.include_router(stagiaire_router, tags=["Stagiaires"], prefix="/stagiaires")
app.include_router(choix_projet_router, tags=["Choix Projet"], prefix="/choix-projet")
app.include_router(propositions_projets_router, tags=["propositions_projets_router"], prefix="/propositions_projets_router")
app.include_router(document_router)
app.include_router(tasks_router, tags=["Tasks"], prefix="/tasks")




# CORS pour autoriser le front React (Vite)
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/hello")
def hello():
    return {"message": "Hello from FastAPI"}