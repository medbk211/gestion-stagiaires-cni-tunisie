import { apiClient } from "../core/client"
import { apiRoutes } from "../endpoints"

export const encadreursApi = {
  list<T>() {
    return apiClient.authGet<T>(apiRoutes.encadreurs.list)
  },
  create<T>(payload: unknown) {
    return apiClient.authPostJson<T>(apiRoutes.encadreurs.create, payload)
  },
  available<T>() {
    return apiClient.authGet<T>(apiRoutes.encadreurs.available)
  },
  myStagiaires<T>() {
    return apiClient.authGet<T>(apiRoutes.encadreurs.myStagiaires)
  },
  byId<T>(encadreurId: number) {
    return apiClient.authGet<T>(apiRoutes.encadreurs.byId(encadreurId))
  },
  stagiaires<T>(encadreurId: number) {
    return apiClient.authGet<T>(apiRoutes.encadreurs.stagiaires(encadreurId))
  },
  update<T>(encadreurId: number, payload: unknown) {
    return apiClient.authPutJson<T>(apiRoutes.encadreurs.byId(encadreurId), payload)
  },
  remove<T>(encadreurId: number) {
    return apiClient.authRemove<T>(apiRoutes.encadreurs.byId(encadreurId))
  },
}
