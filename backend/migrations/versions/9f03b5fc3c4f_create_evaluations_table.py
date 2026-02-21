"""create evaluations table

Revision ID: 9f03b5fc3c4f
Revises: c11e434a09cb
Create Date: 2026-02-20 22:15:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9f03b5fc3c4f"
down_revision: Union[str, Sequence[str], None] = "c11e434a09cb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "evaluations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("stagiaire_id", sa.Integer(), nullable=False),
        sa.Column("projet_id", sa.Integer(), nullable=False),
        sa.Column("encadreur_id", sa.Integer(), nullable=False),
        sa.Column("note", sa.Integer(), nullable=False),
        sa.Column("commentaire", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("note >= 0 AND note <= 20", name="ck_evaluations_note_range"),
        sa.ForeignKeyConstraint(["stagiaire_id"], ["stagiaires.id"]),
        sa.ForeignKeyConstraint(["projet_id"], ["projets.id"]),
        sa.ForeignKeyConstraint(["encadreur_id"], ["encadreurs.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "stagiaire_id",
            "projet_id",
            "encadreur_id",
            name="uq_evaluations_stagiaire_projet_encadreur",
        ),
    )
    op.create_index(op.f("ix_evaluations_id"), "evaluations", ["id"], unique=False)
    op.create_index(
        op.f("ix_evaluations_stagiaire_id"),
        "evaluations",
        ["stagiaire_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_evaluations_projet_id"),
        "evaluations",
        ["projet_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_evaluations_encadreur_id"),
        "evaluations",
        ["encadreur_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_evaluations_encadreur_id"), table_name="evaluations")
    op.drop_index(op.f("ix_evaluations_projet_id"), table_name="evaluations")
    op.drop_index(op.f("ix_evaluations_stagiaire_id"), table_name="evaluations")
    op.drop_index(op.f("ix_evaluations_id"), table_name="evaluations")
    op.drop_table("evaluations")
