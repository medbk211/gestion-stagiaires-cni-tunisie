import { apiClient } from "../core/client"
import { apiRoutes } from "../endpoints"

export const evaluationsApi = {
  list<T>(params?: {
    skip?: number
    limit?: number
    stagiaireId?: number
    projetId?: number
    encadreurId?: number
  }) {
    return apiClient.authGet<T>(apiRoutes.evaluations.list(params))
  },
  mine<T>(params?: { skip?: number; limit?: number }) {
    return apiClient.authGet<T>(apiRoutes.evaluations.mine(params))
  },
  create<T>(payload: unknown) {
    return apiClient.authPostJson<T>(apiRoutes.evaluations.create, payload)
  },
  byId<T>(evaluationId: number) {
    return apiClient.authGet<T>(apiRoutes.evaluations.byId(evaluationId))
  },
  update<T>(evaluationId: number, payload: unknown) {
    return apiClient.authPutJson<T>(apiRoutes.evaluations.byId(evaluationId), payload)
  },
  remove<T>(evaluationId: number) {
    return apiClient.authRemove<T>(apiRoutes.evaluations.byId(evaluationId))
  },
}
