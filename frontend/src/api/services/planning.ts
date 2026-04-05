import { apiClient } from "../core/client"
import { apiRoutes } from "../endpoints"

export const planningApi = {
  overview<T>(params?: { weekStart?: string }) {
    return apiClient.authGet<T>(apiRoutes.planning.overview(params))
  },
  createEvent<T>(payload: unknown) {
    return apiClient.authPostJson<T>(apiRoutes.planning.createEvent, payload)
  },
  updateEvent<T>(eventId: number, payload: unknown) {
    return apiClient.authPutJson<T>(apiRoutes.planning.eventById(eventId), payload)
  },
  removeEvent<T>(eventId: number) {
    return apiClient.authRemove<T>(apiRoutes.planning.eventById(eventId))
  },
}
