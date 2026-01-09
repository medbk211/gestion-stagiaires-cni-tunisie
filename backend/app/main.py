from fastapi import FastAPI
# from app.core.init_db import init_db
from app.core.database import test_db_connection




app = FastAPI(title="Gestion des Stagiaires - CNI")

@app.on_event("startup")
def startup():
    test_db_connection()

@app.get("/")
def root():
    return {"message": "API is running 🚀"}
