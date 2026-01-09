from fastapi import FastAPI
from app.core.init_db import init_db

app = FastAPI(title="Gestion des Stagiaires - CNI")

# @app.on_event("startup")
# def startup():
#     init_db()

@app.get("/")
def root():
    return {"message": "API is running 🚀"}
