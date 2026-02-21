"""add fiche_pdf_path to projets

Revision ID: 4a6f2c1b9d10
Revises: 7c6d2d4a1f32
Create Date: 2026-02-21 19:05:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4a6f2c1b9d10'
down_revision: Union[str, Sequence[str], None] = '7c6d2d4a1f32'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = {column['name'] for column in inspector.get_columns('projets')}

    if 'fiche_pdf_path' not in existing_columns:
        op.add_column('projets', sa.Column('fiche_pdf_path', sa.String(length=500), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = {column['name'] for column in inspector.get_columns('projets')}

    if 'fiche_pdf_path' in existing_columns:
        op.drop_column('projets', 'fiche_pdf_path')
