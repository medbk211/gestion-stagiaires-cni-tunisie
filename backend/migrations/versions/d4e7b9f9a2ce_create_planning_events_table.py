"""create planning events table

Revision ID: d4e7b9f9a2ce
Revises: 9f03b5fc3c4f
Create Date: 2026-02-20 23:42:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d4e7b9f9a2ce"
down_revision: Union[str, Sequence[str], None] = "9f03b5fc3c4f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    priority_enum = sa.Enum(
        "LOW",
        "MEDIUM",
        "HIGH",
        name="taskpriorityenum",
        create_type=False,
    )

    op.create_table(
        "planning_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("encadreur_id", sa.Integer(), nullable=False),
        sa.Column("stagiaire_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "event_type",
            sa.Enum("MEETING", "REVIEW", "VISIT", "DEADLINE", name="planningeventtypeenum"),
            nullable=False,
        ),
        sa.Column("priority", priority_enum, nullable=False),
        sa.Column("attendee_name", sa.String(length=255), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("start_at", sa.DateTime(), nullable=False),
        sa.Column("end_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["encadreur_id"], ["encadreurs.id"]),
        sa.ForeignKeyConstraint(["stagiaire_id"], ["stagiaires.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_planning_events_id"), "planning_events", ["id"], unique=False)
    op.create_index(
        op.f("ix_planning_events_encadreur_id"),
        "planning_events",
        ["encadreur_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_planning_events_stagiaire_id"),
        "planning_events",
        ["stagiaire_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_planning_events_start_at"),
        "planning_events",
        ["start_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_planning_events_start_at"), table_name="planning_events")
    op.drop_index(op.f("ix_planning_events_stagiaire_id"), table_name="planning_events")
    op.drop_index(op.f("ix_planning_events_encadreur_id"), table_name="planning_events")
    op.drop_index(op.f("ix_planning_events_id"), table_name="planning_events")
    op.drop_table("planning_events")
