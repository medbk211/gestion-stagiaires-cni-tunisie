import { apiClient } from "../core/client"
import { apiRoutes } from "../endpoints"

export const affectationsApi = {
  list<T>(params?: { skip?: number; limit?: number }) {
    return apiClient.authGet<T>(apiRoutes.affectations.list(params))
  },
  create<T>(payload: unknown) {
    return apiClient.authPostJson<T>(apiRoutes.affectations.create, payload)
  },
  assignEncadreur<T>(payload: { demande_id: number; encadreur_id: number }) {
    return apiClient.authPostJson<T>(apiRoutes.affectations.assignEncadreur, payload)
  },
  byId<T>(affectationId: number) {
    return apiClient.authGet<T>(apiRoutes.affectations.byId(affectationId))
  },
  byStagiaire<T>(stagiaireId: number) {
    return apiClient.authGet<T>(apiRoutes.affectations.byStagiaire(stagiaireId))
  },
  byEncadreur<T>(encadreurId: number) {
    return apiClient.authGet<T>(apiRoutes.affectations.byEncadreur(encadreurId))
  },
  byProject<T>(projectId: number) {
    return apiClient.authGet<T>(apiRoutes.affectations.byProject(projectId))
  },
  update<T>(affectationId: number, payload: unknown) {
    return apiClient.authPutJson<T>(apiRoutes.affectations.byId(affectationId), payload)
  },
  remove<T>(affectationId: number) {
    return apiClient.authRemove<T>(apiRoutes.affectations.byId(affectationId))
  },
}
