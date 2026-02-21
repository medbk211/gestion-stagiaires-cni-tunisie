"""add competences and tags to demandes_stage

Revision ID: 7c6d2d4a1f32
Revises: fe989894752d
Create Date: 2026-02-21 16:10:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7c6d2d4a1f32'
down_revision: Union[str, Sequence[str], None] = 'fe989894752d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = {column['name'] for column in inspector.get_columns('demandes_stage')}

    if 'competences' not in existing_columns:
        op.add_column('demandes_stage', sa.Column('competences', sa.JSON(), nullable=True))
    if 'tags' not in existing_columns:
        op.add_column('demandes_stage', sa.Column('tags', sa.JSON(), nullable=True))

    inspector = sa.inspect(bind)
    existing_columns = {column['name'] for column in inspector.get_columns('demandes_stage')}

    if 'competences' in existing_columns:
        op.execute("UPDATE demandes_stage SET competences = '[]' WHERE competences IS NULL")
        op.alter_column(
            'demandes_stage',
            'competences',
            existing_type=sa.JSON(),
            existing_nullable=True,
            nullable=False,
        )

    if 'tags' in existing_columns:
        op.execute("UPDATE demandes_stage SET tags = '[]' WHERE tags IS NULL")
        op.alter_column(
            'demandes_stage',
            'tags',
            existing_type=sa.JSON(),
            existing_nullable=True,
            nullable=False,
        )


def downgrade() -> None:
    op.drop_column('demandes_stage', 'tags')
    op.drop_column('demandes_stage', 'competences')
