import { apiClient } from "../core/client"
import { apiRoutes } from "../endpoints"

export const stagesApi = {
  list<T>(params?: { skip?: number; limit?: number }) {
    return apiClient.authGet<T>(apiRoutes.stages.list(params))
  },
  create<T>(payload: unknown) {
    return apiClient.authPostJson<T>(apiRoutes.stages.create, payload)
  },
  mine<T>() {
    return apiClient.authGet<T>(apiRoutes.stages.mine)
  },
  myInterns<T>(params?: { skip?: number; limit?: number }) {
    return apiClient.authGet<T>(apiRoutes.stages.myInterns(params))
  },
  byId<T>(stageId: number) {
    return apiClient.authGet<T>(apiRoutes.stages.byId(stageId))
  },
  update<T>(stageId: number, payload: unknown) {
    return apiClient.authPutJson<T>(apiRoutes.stages.byId(stageId), payload)
  },
  remove<T>(stageId: number) {
    return apiClient.authRemove<T>(apiRoutes.stages.byId(stageId))
  },
}
