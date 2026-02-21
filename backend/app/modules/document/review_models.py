from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class DocumentReview(Base):
    __tablename__ = "document_reviews"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="pending")
    comment = Column(Text, nullable=True)
    reviewed_by = Column(Integer, ForeignKey("utilisateurs.id"), nullable=True)
    reviewed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    document = relationship("Document", backref="reviews")
