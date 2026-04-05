import { apiClient } from "../core/client"
import { apiRoutes } from "../endpoints"

export const communicationApi = {
  conversations<T>() {
    return apiClient.authGet<T>(apiRoutes.communication.conversations)
  },
  thread<T>(contactId: number) {
    return apiClient.authGet<T>(apiRoutes.communication.thread(contactId))
  },
  send<T>(payload: unknown) {
    return apiClient.authPostJson<T>(apiRoutes.communication.send, payload)
  },
}
