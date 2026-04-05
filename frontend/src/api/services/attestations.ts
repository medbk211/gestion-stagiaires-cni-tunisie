import { apiClient } from "../core/client"
import { apiRoutes } from "../endpoints"

export const attestationsApi = {
  list<T>(params?: { skip?: number; limit?: number; stagiaireId?: number; stageId?: number }) {
    return apiClient.authGet<T>(apiRoutes.attestations.list(params))
  },
  create<T>(payload: unknown) {
    return apiClient.authPostJson<T>(apiRoutes.attestations.create, payload)
  },
  mine<T>(params?: { skip?: number; limit?: number }) {
    return apiClient.authGet<T>(apiRoutes.attestations.mine(params))
  },
  byId<T>(attestationId: number) {
    return apiClient.authGet<T>(apiRoutes.attestations.byId(attestationId))
  },
  download(attestationId: number) {
    return apiClient.authBlob(apiRoutes.attestations.download(attestationId))
  },
  remove<T>(attestationId: number) {
    return apiClient.authRemove<T>(apiRoutes.attestations.byId(attestationId))
  },
}
