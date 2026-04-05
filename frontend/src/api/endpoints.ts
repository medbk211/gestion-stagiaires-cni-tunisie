type QueryValue = string | number | boolean | null | undefined

export function withQuery(
  path: string,
  params?: Record<string, QueryValue>,
): string {
  if (!params) {
    return path
  }

  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return
    }

    searchParams.set(key, String(value))
  })

  const query = searchParams.toString()
  return query ? `${path}?${query}` : path
}

export const apiRoutes = {
  users: {
    list: (params?: { skip?: number; limit?: number }) =>
      withQuery("/utilisateur/", params),
    create: "/utilisateur/create",
    byId: (userId: number) => `/utilisateur/${userId}`,
    activate: (userId: number) => `/utilisateur/${userId}/activer`,
    deactivate: (userId: number) => `/utilisateur/${userId}/desactiver`,
  },
  auth: {
    me: "/auth/me",
    login: "/auth/login",
    refresh: "/auth/refresh",
    logout: "/auth/logout",
    forgotPassword: "/auth/forgot-password",
    resetPassword: "/auth/reset-password",
    changePassword: "/auth/change-password",
  },
  demandes: {
    root: "/projets-stage/demandes-stage",
    options: "/projets-stage/demandes-stage/options",
    list: (params?: {
      skip?: number
      limit?: number
      search?: string
      statut?: string
      departement?: string
      encadreurId?: number
    }) =>
      withQuery("/projets-stage/demandes-stage", {
        skip: params?.skip,
        limit: params?.limit,
        search: params?.search,
        statut: params?.statut,
        departement: params?.departement,
        encadreur_id: params?.encadreurId,
      }),
    accept: (demandeId: number, encadreurId: number) =>
      withQuery(`/projets-stage/${demandeId}/accepter_demande_stage`, {
        encadreur_id: encadreurId,
      }),
    refuse: (demandeId: number) => `/projets-stage/${demandeId}/refuser`,
    putOnHold: (demandeId: number) => `/projets-stage/${demandeId}/mettre-en-attente`,
    reopen: (demandeId: number) => `/projets-stage/${demandeId}/reouvrir`,
    history: (demandeId: number) => `/projets-stage/${demandeId}/historique`,
  },
  projects: {
    root: "/Project/projets",
    list: (params?: {
      skip?: number
      limit?: number
      search?: string
      departement?: string
      statusFilter?: string
    }) =>
      withQuery("/Project/projets", {
        skip: params?.skip,
        limit: params?.limit,
        search: params?.search,
        departement: params?.departement,
        status_filter: params?.statusFilter,
      }),
    search: (params?: {
      skip?: number
      limit?: number
      search?: string
      departement?: string
      statusFilter?: string
    }) =>
      withQuery("/Project/projets/recherche", {
        skip: params?.skip,
        limit: params?.limit,
        search: params?.search,
        departement: params?.departement,
        status_filter: params?.statusFilter,
      }),
    options: "/Project/projets/options",
    byId: (projectId: number) => `/Project/projets/${projectId}`,
    byStage: (stageId: number) => `/Project/projets/by-stage/${stageId}`,
    sheet: (projectId: number) => `/Project/projets/${projectId}/fiche-pdf`,
  },
  affectations: {
    list: (params?: { skip?: number; limit?: number }) =>
      withQuery("/affectation/", params),
    create: "/affectation/",
    assignEncadreur: "/affectation/assign-encadreur",
    byId: (affectationId: number) => `/affectation/${affectationId}`,
    byStagiaire: (stagiaireId: number) => `/affectation/stagiaire/${stagiaireId}`,
    byEncadreur: (encadreurId: number) => `/affectation/encadreur/${encadreurId}/affectations`,
    byProject: (projectId: number) => `/affectation/projet/${projectId}`,
  },
  encadreurs: {
    list: "/encadreur/",
    create: "/encadreur/encadreurs/",
    available: "/encadreur/available/",
    myStagiaires: "/encadreur/me/stagiaires",
    byId: (encadreurId: number) => `/encadreur/${encadreurId}`,
    stagiaires: (encadreurId: number) => `/encadreur/${encadreurId}/stagiaires`,
  },
  stages: {
    list: (params?: { skip?: number; limit?: number }) => withQuery("/Stages/", params),
    create: "/Stages/",
    mine: "/Stages/me",
    myInterns: (params?: { skip?: number; limit?: number }) =>
      withQuery("/Stages/my-interns", params),
    byId: (stageId: number) => `/Stages/${stageId}`,
  },
  stagiaires: {
    list: (params?: { skip?: number; limit?: number }) =>
      withQuery("/stagiaires/", params),
    create: "/stagiaires/",
    myProfile: "/stagiaires/me/profile",
    progress: (stagiaireId: number) => `/stagiaires/${stagiaireId}/progress`,
    byId: (stagiaireId: number) => `/stagiaires/${stagiaireId}`,
  },
  choixProjet: {
    selection: (token: string) => withQuery("/choix-projet/selection-projet", { token }),
    choose: "/choix-projet/choisir-projet",
    selectedByEncadreur: (encadreurId: number) =>
      `/choix-projet/encadreur/${encadreurId}/projets-choisis`,
  },
  propositions: {
    list: "/propositions_projets_router/list",
    proposeForDemande: (demandeId: number) =>
      `/propositions_projets_router/demande/${demandeId}/proposer-projets`,
  },
  documents: {
    list: (params?: {
      demandeId?: number
      status?: string
      typeDocument?: string
      search?: string
      skip?: number
      limit?: number
    }) =>
      withQuery("/documents/", {
        demande_id: params?.demandeId,
        status: params?.status,
        type_document: params?.typeDocument,
        search: params?.search,
        skip: params?.skip,
        limit: params?.limit,
      }),
    mine: (params?: { skip?: number; limit?: number }) =>
      withQuery("/documents/me", params),
    uploadForDemande: (demandeId: number) => `/documents/upload/${demandeId}`,
    uploadMyReport: "/documents/me/upload-rapport",
    byDemande: (demandeId: number) => `/documents/demande/${demandeId}`,
    download: (documentId: number) => `/documents/download/${documentId}`,
    updateStatus: (documentId: number) => `/documents/${documentId}/status`,
    remove: (documentId: number) => `/documents/${documentId}`,
  },
  tasks: {
    root: "/tasks/",
    mine: "/tasks/my-tasks",
    byId: (taskId: number) => `/tasks/${taskId}`,
    create: "/tasks/",
    updateStatus: (taskId: number) => `/tasks/${taskId}/status`,
    updateMyStatus: (taskId: number) => `/tasks/${taskId}/my-status`,
    submit: (taskId: number) => `/tasks/${taskId}/submit`,
    latestSubmission: (taskId: number) => `/tasks/${taskId}/latest-submission`,
    review: (taskId: number) => `/tasks/${taskId}/review`,
    validate: (taskId: number) => `/tasks/${taskId}/validate`,
  },
  communication: {
    conversations: "/communication/conversations",
    thread: (contactId: number) => `/communication/with/${contactId}`,
    send: "/communication/send",
  },
  evaluations: {
    list: (params?: {
      skip?: number
      limit?: number
      stagiaireId?: number
      projetId?: number
      encadreurId?: number
    }) =>
      withQuery("/evaluations/", {
        skip: params?.skip,
        limit: params?.limit,
        stagiaire_id: params?.stagiaireId,
        projet_id: params?.projetId,
        encadreur_id: params?.encadreurId,
      }),
    mine: (params?: { skip?: number; limit?: number }) =>
      withQuery("/evaluations/my", params),
    create: "/evaluations/",
    byId: (evaluationId: number) => `/evaluations/${evaluationId}`,
  },
  planning: {
    overview: (params?: { weekStart?: string }) =>
      withQuery("/planning/overview", { week_start: params?.weekStart }),
    createEvent: "/planning/events",
    eventById: (eventId: number) => `/planning/events/${eventId}`,
  },
  statistics: {
    dashboard: "/statistiques/dashboard",
    dashboardFiltered: (params?: {
      startDate?: string
      endDate?: string
      departement?: string
      encadreurId?: number
    }) =>
      withQuery("/statistiques/dashboard/filtre", {
        start_date: params?.startDate,
        end_date: params?.endDate,
        departement: params?.departement,
        encadreur_id: params?.encadreurId,
      }),
    encadreurOverview: (params?: { encadreurId?: number }) =>
      withQuery("/statistiques/encadreur/overview", {
        encadreur_id: params?.encadreurId,
      }),
  },
  notifications: {
    mine: (params?: {
      skip?: number
      limit?: number
      unreadOnly?: boolean
      category?: string
    }) =>
      withQuery("/notifications/me", {
        skip: params?.skip,
        limit: params?.limit,
        unread_only: params?.unreadOnly,
        category: params?.category,
      }),
    unreadCount: (params?: { category?: string }) =>
      withQuery("/notifications/me/unread-count", {
        category: params?.category,
      }),
    markRead: (notificationId: number) => `/notifications/${notificationId}/read`,
    markAllRead: (params?: { category?: string }) =>
      withQuery("/notifications/me/read-all", {
        category: params?.category,
      }),
  },
  attestations: {
    list: (params?: { skip?: number; limit?: number; stagiaireId?: number; stageId?: number }) =>
      withQuery("/attestations", {
        skip: params?.skip,
        limit: params?.limit,
        stagiaire_id: params?.stagiaireId,
        stage_id: params?.stageId,
      }),
    create: "/attestations",
    mine: (params?: { skip?: number; limit?: number }) =>
      withQuery("/attestations/my", params),
    byId: (attestationId: number) => `/attestations/${attestationId}`,
    download: (attestationId: number) => `/attestations/${attestationId}/download`,
  },
} as const
