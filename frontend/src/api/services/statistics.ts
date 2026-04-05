import { apiClient } from "../core/client"
import { apiRoutes } from "../endpoints"

export const statisticsApi = {
  dashboard<T>() {
    return apiClient.authGet<T>(apiRoutes.statistics.dashboard)
  },
  dashboardFiltered<T>(params?: {
    startDate?: string
    endDate?: string
    departement?: string
    encadreurId?: number
  }) {
    return apiClient.authGet<T>(apiRoutes.statistics.dashboardFiltered(params))
  },
  encadreurOverview<T>(params?: { encadreurId?: number }) {
    return apiClient.authGet<T>(apiRoutes.statistics.encadreurOverview(params))
  },
}
