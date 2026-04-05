"""create attestations table

Revision ID: create_attestations
Revises: 9f03b5fc3c4f
Create Date: 2026-04-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "create_attestations"
down_revision: Union[str, Sequence[str], None] = "9f03b5fc3c4f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "attestations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("stagiaire_id", sa.Integer(), nullable=False),
        sa.Column("stage_id", sa.Integer(), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("numero_attestation", sa.String(length=50), nullable=False),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("date_debut_stage", sa.DateTime(), nullable=False),
        sa.Column("date_fin_stage", sa.DateTime(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["stagiaire_id"], ["stagiaires.id"]),
        sa.ForeignKeyConstraint(["stage_id"], ["stages.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["utilisateurs.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("numero_attestation", name="uq_attestations_numero"),
    )
    op.create_index(op.f("ix_attestations_id"), "attestations", ["id"], unique=False)
    op.create_index(op.f("ix_attestations_stagiaire_id"), "attestations", ["stagiaire_id"], unique=False)
    op.create_index(op.f("ix_attestations_stage_id"), "attestations", ["stage_id"], unique=False)
    op.create_index(op.f("ix_attestations_created_by"), "attestations", ["created_by"], unique=False)
    op.create_index(op.f("ix_attestations_numero_attestation"), "attestations", ["numero_attestation"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_attestations_numero_attestation"), table_name="attestations")
    op.drop_index(op.f("ix_attestations_created_by"), table_name="attestations")
    op.drop_index(op.f("ix_attestations_stage_id"), table_name="attestations")
    op.drop_index(op.f("ix_attestations_stagiaire_id"), table_name="attestations")
    op.drop_index(op.f("ix_attestations_id"), table_name="attestations")
    op.drop_table("attestations")
