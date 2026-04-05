import { apiClient } from "../core/client"
import { apiRoutes } from "../endpoints"

export const stagiairesApi = {
  list<T>(params?: { skip?: number; limit?: number }) {
    return apiClient.authGet<T>(apiRoutes.stagiaires.list(params))
  },
  create<T>(payload: unknown) {
    return apiClient.authPostJson<T>(apiRoutes.stagiaires.create, payload)
  },
  myProfile<T>() {
    return apiClient.authGet<T>(apiRoutes.stagiaires.myProfile)
  },
  updateMyProfile<T>(payload: unknown) {
    return apiClient.authPatchJson<T>(apiRoutes.stagiaires.myProfile, payload)
  },
  progress<T>(stagiaireId: number) {
    return apiClient.authGet<T>(apiRoutes.stagiaires.progress(stagiaireId))
  },
  byId<T>(stagiaireId: number) {
    return apiClient.authGet<T>(apiRoutes.stagiaires.byId(stagiaireId))
  },
  update<T>(stagiaireId: number, payload: unknown) {
    return apiClient.authPutJson<T>(apiRoutes.stagiaires.byId(stagiaireId), payload)
  },
  remove<T>(stagiaireId: number) {
    return apiClient.authRemove<T>(apiRoutes.stagiaires.byId(stagiaireId))
  },
}
