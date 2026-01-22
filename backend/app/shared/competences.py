from app.shared.enums import DepartementEnum

# 🔹 Compétences générales (pour tous)
GENERAL_COMPETENCES = [
    "Organisation",
    "Communication",
    "Rédaction",
    "Gestion du temps",
    "Travail en équipe",
    "Analyse",
    "Classement",
    "Autonomie",
    "Respect des procédures",
    "Bureautique"
]

# 🔹 Compétences par département
DEPARTEMENT_COMPETENCES = {
    DepartementEnum.INFORMATIQUE: [
        "Support informatique",
        "Maintenance de base",
        "Réseaux (notions)",
        "Sécurité informatique (notions)",
        "Documentation technique"
    ],

    DepartementEnum.RH: [
        "Gestion des dossiers",
        "Classement administratif",
        "Communication interne",
        "Rédaction administrative",
        "Confidentialité"
    ],

    DepartementEnum.FINANCES: [
        "Excel",
        "Analyse financière (bases)",
        "Suivi des dépenses",
        "Classement comptable",
        "Reporting simple"
    ],

    DepartementEnum.EXPLOITATION: [
        "Suivi des opérations",
        "Organisation des interventions",
        "Analyse des incidents",
        "Rédaction de rapports"
    ],

    DepartementEnum.SUPPORT: [
        "Assistance utilisateur",
        "Gestion des demandes",
        "Résolution de problèmes simples",
        "Documentation utilisateur"
    ],

    DepartementEnum.ADMINISTRATION: [
        "Archivage",
        "Classement des documents",
        "Rédaction de procédures",
        "Gestion des courriers"
    ]
}
