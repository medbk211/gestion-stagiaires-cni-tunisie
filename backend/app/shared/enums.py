import enum

class RoleEnum(str, enum.Enum):
    ADMIN = "ADMIN"
    ENCADREUR = "ENCADREUR"
    STAGIAIRE = "STAGIAIRE"

class StatutDemandeEnum(str, enum.Enum):
    EN_ATTENTE = "EN_ATTENTE"
    ACCEPTEE = "ACCEPTEE"
    REFUSEE = "REFUSEE"

class StatutProjetEnum(str, enum.Enum):
    DISPONIBLE = "DISPONIBLE"
    AFFECTE = "AFFECTE"
    TERMINE = "TERMINE"

class StatutStageEnum(str, enum.Enum):
    EN_COURS = "EN_COURS"
    TERMINE = "TERMINE"
    ANNULE = "ANNULE"

class TypeJournalEnum(str, enum.Enum):
    JOURNALIER = "JOURNALIER"
    HEBDOMADAIRE = "HEBDOMADAIRE"


class NotificationTypeEnum(str, enum.Enum):
    info = "SYSTEM"
    warning = "WARNING"
    alert = "ALERT"
    error = "ERROR"
    validation = "VALIDATION"


class TypeDocumentEnum(str, enum.Enum):
    RAPPORT_FINAL = "RAPPORT_FINAL"
    ATTESTATION = "ATTESTATION"