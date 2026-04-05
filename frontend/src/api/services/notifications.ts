import { apiClient } from "../core/client"
import { apiRoutes } from "../endpoints"

export const notificationsApi = {
  listMine<T>(params?: {
    skip?: number
    limit?: number
    unreadOnly?: boolean
    category?: string
  }) {
    return apiClient.authGet<T>(apiRoutes.notifications.mine(params))
  },
  unreadCount<T>(params?: { category?: string }) {
    return apiClient.authGet<T>(apiRoutes.notifications.unreadCount(params))
  },
  markRead<T>(notificationId: number) {
    return apiClient.authPatch<T>(apiRoutes.notifications.markRead(notificationId))
  },
  markAllRead<T>(params?: { category?: string }) {
    return apiClient.authPatch<T>(apiRoutes.notifications.markAllRead(params))
  },
}
