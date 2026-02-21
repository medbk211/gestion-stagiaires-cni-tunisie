"""create messages internes table

Revision ID: fe989894752d
Revises: d4e7b9f9a2ce
Create Date: 2026-02-21 14:28:25.986296

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fe989894752d'
down_revision: Union[str, Sequence[str], None] = 'd4e7b9f9a2ce'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'messages_internes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('id_expediteur', sa.Integer(), nullable=False),
        sa.Column('id_destinataire', sa.Integer(), nullable=False),
        sa.Column('sujet', sa.String(length=255), nullable=False),
        sa.Column('contenu', sa.String(length=1000), nullable=False),
        sa.Column('date_envoi', sa.DateTime(), nullable=True),
        sa.Column('lu', sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(['id_destinataire'], ['utilisateurs.id']),
        sa.ForeignKeyConstraint(['id_expediteur'], ['utilisateurs.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_messages_internes_id_expediteur'),
        'messages_internes',
        ['id_expediteur'],
        unique=False,
    )
    op.create_index(
        op.f('ix_messages_internes_id_destinataire'),
        'messages_internes',
        ['id_destinataire'],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_messages_internes_id_destinataire'), table_name='messages_internes')
    op.drop_index(op.f('ix_messages_internes_id_expediteur'), table_name='messages_internes')
    op.drop_table('messages_internes')
