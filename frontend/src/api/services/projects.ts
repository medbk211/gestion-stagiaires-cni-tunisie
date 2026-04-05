import { apiClient } from "../core/client"
import { apiRoutes } from "../endpoints"

export interface ProjectsListParams {
  skip?: number
  limit?: number
  search?: string
  departement?: string
  statusFilter?: string
}

export const projectsApi = {
  list<T>(params?: ProjectsListParams) {
    return apiClient.authGet<T>(apiRoutes.projects.list(params))
  },
  search<T>(params?: ProjectsListParams) {
    return apiClient.authGet<T>(apiRoutes.projects.search(params))
  },
  options<T>() {
    return apiClient.authGet<T>(apiRoutes.projects.options)
  },
  byId<T>(projectId: number) {
    return apiClient.authGet<T>(apiRoutes.projects.byId(projectId))
  },
  byStage<T>(stageId: number) {
    return apiClient.authGet<T>(apiRoutes.projects.byStage(stageId))
  },
  create<T>(formData: FormData) {
    return apiClient.authPostForm<T>(apiRoutes.projects.root, formData)
  },
  update<T>(projectId: number, payload: unknown) {
    return apiClient.authPutJson<T>(apiRoutes.projects.byId(projectId), payload)
  },
  remove<T>(projectId: number) {
    return apiClient.authRemove<T>(apiRoutes.projects.byId(projectId))
  },
  downloadSheet(projectId: number) {
    return apiClient.authBlob(apiRoutes.projects.sheet(projectId))
  },
}
