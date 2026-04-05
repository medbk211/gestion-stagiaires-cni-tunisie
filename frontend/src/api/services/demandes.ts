import { apiClient } from "../core/client"
import { apiRoutes } from "../endpoints"

export interface DemandesListParams {
  skip?: number
  limit?: number
  search?: string
  statut?: string
  departement?: string
  encadreurId?: number
}

export interface DemandeStatusPayload {
  reason?: string | null
}

export const demandesApi = {
  options<T>(init?: RequestInit) {
    return apiClient.get<T>(apiRoutes.demandes.options, init)
  },
  create<T>(formData: FormData) {
    return apiClient.postForm<T>(apiRoutes.demandes.root, formData)
  },
  list<T>(params?: DemandesListParams) {
    return apiClient.authGet<T>(apiRoutes.demandes.list(params))
  },
  accept<T>(demandeId: number, encadreurId: number) {
    return apiClient.authPost<T>(apiRoutes.demandes.accept(demandeId, encadreurId))
  },
  refuse<T>(demandeId: number, payload: DemandeStatusPayload) {
    return apiClient.authPostJson<T>(apiRoutes.demandes.refuse(demandeId), payload)
  },
  putOnHold<T>(demandeId: number, payload: DemandeStatusPayload) {
    return apiClient.authPostJson<T>(apiRoutes.demandes.putOnHold(demandeId), payload)
  },
  reopen<T>(demandeId: number, payload: DemandeStatusPayload) {
    return apiClient.authPostJson<T>(apiRoutes.demandes.reopen(demandeId), payload)
  },
  history<T>(demandeId: number) {
    return apiClient.authGet<T>(apiRoutes.demandes.history(demandeId))
  },
}
