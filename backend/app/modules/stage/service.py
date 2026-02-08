from sqlalchemy.orm import Session
from app.modules.stage.models import Stage
from app.modules.stage.schemas import StageCreate, StageUpdate

def get_stage(db: Session, stage_id: int):
    return db.query(Stage).filter(Stage.id == stage_id).first()

def get_all_stages(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Stage).offset(skip).limit(limit).all()

def create_stage(db: Session, stage_in: StageCreate):
    db_stage = Stage(
        demandestage_id=stage_in.demandestage_id,
        stagiaire_id=stage_in.stagiaire_id,
        encadreur_id=stage_in.encadreur_id,
        projet_id=stage_in.projet_id,
        date_debut=stage_in.date_debut,
        date_fin=stage_in.date_fin,
        texte_objectif=stage_in.texte_objectif
        # statut_stage has a default value (EN_COURS)
    )
    db.add(db_stage)
    db.commit()
    db.refresh(db_stage)
    return db_stage

def update_stage(db: Session, stage_id: int, stage_in: StageUpdate):
    db_stage = get_stage(db, stage_id)
    if not db_stage:
        return None
    
    update_data = stage_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_stage, field, value)

    db.add(db_stage)
    db.commit()
    db.refresh(db_stage)
    return db_stage

def delete_stage(db: Session, stage_id: int):
    db_stage = get_stage(db, stage_id)
    if not db_stage:
        return False
    
    db.delete(db_stage)
    db.commit()
    return True
