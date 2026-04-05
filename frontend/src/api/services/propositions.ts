import { apiClient } from "../core/client"
import { apiRoutes } from "../endpoints"

export const propositionsApi = {
  list<T>() {
    return apiClient.authGet<T>(apiRoutes.propositions.list)
  },
  proposeForDemande<T>(demandeId: number) {
    return apiClient.authPost<T>(apiRoutes.propositions.proposeForDemande(demandeId))
  },
}
