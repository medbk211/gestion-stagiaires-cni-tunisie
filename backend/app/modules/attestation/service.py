import os
from datetime import datetime, timezone
from uuid import uuid4
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch

from app.modules.attestation.models import Attestation
from app.modules.attestation.schemas import AttestationCreate, AttestationRead
from app.modules.stage.models import Stage
from app.modules.stagiaires.models import Stagiaire
from app.shared.enums import StatutStageEnum


class AttestationService:
    @staticmethod
    def _generate_numero_attestation() -> str:
        """Generate unique attestation number: ATT-YYYY-XXXXX"""
        year = datetime.now(timezone.utc).year
        unique_id = str(uuid4())[:8].upper()
        return f"ATT-{year}-{unique_id}"

    @staticmethod
    def _generate_pdf_attestation(
        numero: str,
        stagiaire_name: str,
        date_debut: datetime,
        date_fin: datetime,
        description: str | None = None,
    ) -> str:
        """Generate PDF attestation file and return file path"""
        # Ensure uploads/attestations directory exists
        uploads_dir = Path("uploads/attestations")
        uploads_dir.mkdir(parents=True, exist_ok=True)

        file_path = uploads_dir / f"{numero}.pdf"

        # Create PDF
        c = canvas.Canvas(str(file_path), pagesize=letter)
        width, height = letter

        # Add header
        c.setFont("Helvetica-Bold", 16)
        c.drawString(1 * inch, height - 1 * inch, "ATTESTATION DE STAGE")

        # Add attestation number
        c.setFont("Helvetica", 10)
        c.drawString(1 * inch, height - 1.5 * inch, f"Numéro: {numero}")
        c.drawString(1 * inch, height - 1.7 * inch, f"Date: {datetime.now().strftime('%d/%m/%Y')}")

        # Add content
        c.setFont("Helvetica", 11)
        y_position = height - 2.5 * inch

        c.drawString(1 * inch, y_position, "Attestation de stage")
        y_position -= 0.3 * inch

        c.setFont("Helvetica", 10)
        c.drawString(1 * inch, y_position, f"Stagiaire: {stagiaire_name}")
        y_position -= 0.2 * inch

        c.drawString(1 * inch, y_position, f"Période: {date_debut.strftime('%d/%m/%Y')} au {date_fin.strftime('%d/%m/%Y')}")
        y_position -= 0.2 * inch

        if description:
            c.drawString(1 * inch, y_position, "Description:")
            y_position -= 0.15 * inch
            # Word wrap description
            from textwrap import wrap
            for line in wrap(description, width=80):
                c.drawString(1.2 * inch, y_position, line)
                y_position -= 0.15 * inch

        y_position -= 0.5 * inch

        # Add footer
        c.setFont("Helvetica", 9)
        c.drawString(1 * inch, 0.75 * inch, "Certification de stage - Plateforme de Gestion des Stages")
        c.drawString(width - 2 * inch, 0.75 * inch, f"Généré le: {datetime.now().strftime('%d/%m/%Y %H:%M')}")

        c.save()
        return str(file_path)

    @staticmethod
    def create_attestation(
        db: Session,
        payload: AttestationCreate,
        admin_id: int,
    ) -> AttestationRead:
        """Create attestation for completed stage"""
        # Verify stage exists and is completed
        stage = db.query(Stage).filter(Stage.id == payload.stage_id).first()
        if not stage:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stage non trouvé",
            )

        if stage.statut_stage not in [StatutStageEnum.TERMINE, StatutStageEnum.EN_COURS]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La stage doit être terminée pour générer une attestation",
            )

        # Verify stagiaire
        stagiaire = db.query(Stagiaire).filter(Stagiaire.id == payload.stagiaire_id).first()
        if not stagiaire:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stagiaire non trouvé",
            )

        # Check if attestation already exists
        existing = db.query(Attestation).filter(
            Attestation.stage_id == payload.stage_id,
            Attestation.stagiaire_id == payload.stagiaire_id,
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Une attestation existe déjà pour ce stage",
            )

        numero = AttestationService._generate_numero_attestation()
        
        # Generate PDF
        stagiaire_full_name = f"{stagiaire.prenom} {stagiaire.nom}"
        file_path = AttestationService._generate_pdf_attestation(
            numero=numero,
            stagiaire_name=stagiaire_full_name,
            date_debut=payload.date_debut_stage,
            date_fin=payload.date_fin_stage,
            description=payload.description,
        )

        attestation = Attestation(
            stagiaire_id=payload.stagiaire_id,
            stage_id=payload.stage_id,
            created_by=admin_id,
            numero_attestation=numero,
            file_path=file_path,
            date_debut_stage=payload.date_debut_stage,
            date_fin_stage=payload.date_fin_stage,
            description=payload.description,
        )

        db.add(attestation)
        db.commit()
        db.refresh(attestation)
        return AttestationRead.from_orm(attestation)

    @staticmethod
    def get_attestations_for_stagiaire(
        db: Session,
        stagiaire_id: int,
        skip: int = 0,
        limit: int = 100,
    ) -> list[AttestationRead]:
        """Get all attestations for stagiaire"""
        attestations = (
            db.query(Attestation)
            .filter(Attestation.stagiaire_id == stagiaire_id)
            .offset(skip)
            .limit(limit)
            .all()
        )
        return [AttestationRead.from_orm(att) for att in attestations]

    @staticmethod
    def get_attestation_by_id(
        db: Session,
        attestation_id: int,
        stagiaire_id: int | None = None,
    ) -> AttestationRead:
        """Get attestation by ID"""
        attestation = db.query(Attestation).filter(Attestation.id == attestation_id).first()
        if not attestation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attestation non trouvée",
            )

        if stagiaire_id and attestation.stagiaire_id != stagiaire_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Accès refusé",
            )

        return AttestationRead.from_orm(attestation)

    @staticmethod
    def get_all_attestations(
        db: Session,
        skip: int = 0,
        limit: int = 500,
        stagiaire_id: int | None = None,
        stage_id: int | None = None,
    ) -> list[AttestationRead]:
        """Get all attestations (admin only)"""
        query = db.query(Attestation)

        if stagiaire_id:
            query = query.filter(Attestation.stagiaire_id == stagiaire_id)
        if stage_id:
            query = query.filter(Attestation.stage_id == stage_id)

        attestations = query.offset(skip).limit(limit).all()
        return [AttestationRead.from_orm(att) for att in attestations]

    @staticmethod
    def delete_attestation(db: Session, attestation_id: int) -> None:
        """Delete attestation (admin only)"""
        attestation = db.query(Attestation).filter(Attestation.id == attestation_id).first()
        if not attestation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attestation non trouvée",
            )

        # Delete file if exists
        if attestation.file_path and os.path.exists(attestation.file_path):
            try:
                os.remove(attestation.file_path)
            except OSError:
                pass

        db.delete(attestation)
        db.commit()
