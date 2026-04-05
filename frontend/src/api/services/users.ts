import { apiClient } from "../core/client"
import { apiRoutes } from "../endpoints"

export const usersApi = {
  list<T>(params?: { skip?: number; limit?: number }) {
    return apiClient.authGet<T>(apiRoutes.users.list(params))
  },
  create<T>(payload: unknown) {
    return apiClient.authPostJson<T>(apiRoutes.users.create, payload)
  },
  update<T>(userId: number, payload: unknown) {
    return apiClient.authPutJson<T>(apiRoutes.users.byId(userId), payload)
  },
  remove<T>(userId: number) {
    return apiClient.authRemove<T>(apiRoutes.users.byId(userId))
  },
  activate<T>(userId: number) {
    return apiClient.authPatch<T>(apiRoutes.users.activate(userId))
  },
  deactivate<T>(userId: number) {
    return apiClient.authPatch<T>(apiRoutes.users.deactivate(userId))
  },
}
