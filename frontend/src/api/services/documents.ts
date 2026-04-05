import { apiClient } from "../core/client"
import { apiRoutes } from "../endpoints"

export interface DocumentsListParams {
  demandeId?: number
  status?: string
  typeDocument?: string
  search?: string
  skip?: number
  limit?: number
}

export const documentsApi = {
  list<T>(params?: DocumentsListParams) {
    return apiClient.authGet<T>(apiRoutes.documents.list(params))
  },
  listMine<T>(params?: { skip?: number; limit?: number }) {
    return apiClient.authGet<T>(apiRoutes.documents.mine(params))
  },
  uploadForDemande<T>(demandeId: number, formData: FormData) {
    return apiClient.authPostForm<T>(apiRoutes.documents.uploadForDemande(demandeId), formData)
  },
  uploadMyReport<T>(file: File) {
    const formData = new FormData()
    formData.append("file", file)
    return apiClient.authPostForm<T>(apiRoutes.documents.uploadMyReport, formData)
  },
  byDemande<T>(demandeId: number) {
    return apiClient.authGet<T>(apiRoutes.documents.byDemande(demandeId))
  },
  download(documentId: number) {
    return apiClient.authBlob(apiRoutes.documents.download(documentId))
  },
  updateStatus<T>(documentId: number, payload: unknown) {
    return apiClient.authPatchJson<T>(apiRoutes.documents.updateStatus(documentId), payload)
  },
  remove<T>(documentId: number) {
    return apiClient.authRemove<T>(apiRoutes.documents.remove(documentId))
  },
}
