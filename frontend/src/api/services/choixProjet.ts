import { apiClient } from "../core/client"
import { apiRoutes } from "../endpoints"

export const choixProjetApi = {
  selection<T>(token: string) {
    return apiClient.get<T>(apiRoutes.choixProjet.selection(token))
  },
  choose<T>(payload: { token: string; projet_id: number }) {
    return apiClient.postJson<T>(apiRoutes.choixProjet.choose, payload)
  },
  selectedByEncadreur<T>(encadreurId: number) {
    return apiClient.get<T>(apiRoutes.choixProjet.selectedByEncadreur(encadreurId))
  },
}
