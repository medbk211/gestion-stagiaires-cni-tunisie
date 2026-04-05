import { apiClient } from "../core/client"
import { apiRoutes } from "../endpoints"

export const tasksApi = {
  mine<T>() {
    return apiClient.authGet<T>(apiRoutes.tasks.mine)
  },
  byId<T>(taskId: number) {
    return apiClient.authGet<T>(apiRoutes.tasks.byId(taskId))
  },
  create<T>(payload: unknown) {
    return apiClient.authPostJson<T>(apiRoutes.tasks.create, payload)
  },
  update<T>(taskId: number, payload: unknown) {
    return apiClient.authPutJson<T>(apiRoutes.tasks.byId(taskId), payload)
  },
  updateStatus<T>(taskId: number, payload: unknown) {
    return apiClient.authPatchJson<T>(apiRoutes.tasks.updateStatus(taskId), payload)
  },
  updateMyStatus<T>(taskId: number, payload: unknown) {
    return apiClient.authPatchJson<T>(apiRoutes.tasks.updateMyStatus(taskId), payload)
  },
  submit<T>(taskId: number, payload: unknown) {
    return apiClient.authPostJson<T>(apiRoutes.tasks.submit(taskId), payload)
  },
  latestSubmission<T>(taskId: number) {
    return apiClient.authGet<T>(apiRoutes.tasks.latestSubmission(taskId))
  },
  review<T>(taskId: number, payload: unknown) {
    return apiClient.authPostJson<T>(apiRoutes.tasks.review(taskId), payload)
  },
  validate<T>(taskId: number) {
    return apiClient.authPatch<T>(apiRoutes.tasks.validate(taskId))
  },
  remove<T>(taskId: number) {
    return apiClient.authRemove<T>(apiRoutes.tasks.byId(taskId))
  },
}
