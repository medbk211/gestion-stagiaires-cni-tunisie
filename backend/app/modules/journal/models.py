
from sqlalchemy import Column, Integer, Date, Text, Enum, ForeignKey
from app.core.database import Base
from app.shared.enums import TypeJournalEnum
              
class JournalStage(Base):
    __tablename__ = "journal_stages"

    id = Column(Integer, primary_key=True, index=True)

    idStage = Column(Integer, ForeignKey("stage.id"), nullable=False)
    dateEntree = Column(Date, nullable=False)
    contenu = Column(Text, nullable=False)
    type = Column(Enum(TypeJournalEnum), nullable=False)


   
