import enum

class RoleEnum(str, enum.Enum):
    ADMIN = "ADMIN"
    ENCADREUR = "ENCADREUR"
    STAGIAIRE = "STAGIAIRE"

class StatutDemandeEnum(str, enum.Enum):
    EN_ATTENTE = "EN_ATTENTE"
    EN_COURS = "EN_COURS"
    ACCEPTEE = "ACCEPTEE"
    REFUSEE = "REFUSEE"

class taskStatusEnum(str, enum.Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    VALIDATED = "validated"
class taskPriorityEnum(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class planningEventTypeEnum(str, enum.Enum):
    MEETING = "meeting"
    REVIEW = "review"
    VISIT = "visit"
    DEADLINE = "deadline"

class StatutProjetEnum(str, enum.Enum):
    DISPONIBLE = "DISPONIBLE"
    AFFECTE = "AFFECTE"
    TERMINE = "TERMINE"

class StatutStageEnum(str, enum.Enum):
    EN_COURS = "EN_COURS"
    TERMINE = "TERMINE"
    ANNULE = "ANNULE"
    EN_ATTENTE = "EN_ATTENTE"


class TypeJournalEnum(str, enum.Enum):
    JOURNALIER = "JOURNALIER"
    HEBDOMADAIRE = "HEBDOMADAIRE"

    
class GradeEnum(str, enum.Enum):
    junior = "Junior"
    senior = "Senior"
    expert = "Expert"


class NotificationTypeEnum(str, enum.Enum):
    info = "SYSTEM"
    warning = "WARNING"
    alert = "ALERT"
    error = "ERROR"
    validation = "VALIDATION"


class DocumentTypeEnum(str, enum.Enum):
    CV = "cv"
    LETTRE = "lettre"
    CONVOCATION = "convocation"
    RAPPORT_FINAL = "RAPPORT_FINAL"
    ATTESTATION = "ATTESTATION"


class TypeStageEnum(str, enum.Enum):
    PFE = "PFE"
    INITIATION = "INITIATION"
    PERFECTIONNEMENT = "PERFECTIONNEMENT"    


class DepartementEnum(str, enum.Enum):
    INFORMATIQUE = "INFORMATIQUE"
    RH = "RESSOURCES_HUMAINES"
    FINANCES = "FINANCES"
    EXPLOITATION = "EXPLOITATION"
    SUPPORT = "SUPPORT"
    ADMINISTRATION = "ADMINISTRATION"
class NiveauEnum(str, enum.Enum):
    LICENCE = "LICENCE"
    MASTER = "MASTER"
    DOCTORAT = "DOCTORAT"

class ProjetStatusEnum(str, enum.Enum):
    DISPONIBLE = "DISPONIBLE"
    AFFECTE = "AFFECTE"
    TERMINE = "TERMINE"
      











