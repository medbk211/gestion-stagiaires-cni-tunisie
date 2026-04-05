import { apiClient, requestJson } from "../core/client"
import { apiRoutes } from "../endpoints"

export interface LoginPayload {
  username: string
  password: string
}

export interface RefreshTokenPayload {
  refresh_token: string
}

export interface ForgotPasswordPayload {
  email: string
}

export interface ResetPasswordPayload {
  token: string
  new_password: string
}

export interface LogoutPayload {
  refresh_token: string
}

export interface ChangePasswordPayload {
  current_password: string
  new_password: string
}

export const authApi = {
  login<T>(payload: LoginPayload) {
    const formData = new URLSearchParams()
    formData.set("username", payload.username)
    formData.set("password", payload.password)

    return requestJson<T>(apiRoutes.auth.login, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    })
  },
  me<T>(accessToken?: string) {
    if (accessToken) {
      return apiClient.get<T>(apiRoutes.auth.me, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    }

    return apiClient.authGet<T>(apiRoutes.auth.me)
  },
  refresh<T>(payload: RefreshTokenPayload) {
    return apiClient.postJson<T>(apiRoutes.auth.refresh, payload)
  },
  logout<T>(payload: LogoutPayload) {
    return apiClient.authPostJson<T>(apiRoutes.auth.logout, payload)
  },
  forgotPassword<T>(payload: ForgotPasswordPayload) {
    return apiClient.postJson<T>(apiRoutes.auth.forgotPassword, payload)
  },
  resetPassword<T>(payload: ResetPasswordPayload) {
    return apiClient.postJson<T>(apiRoutes.auth.resetPassword, payload)
  },
  changePassword<T>(payload: ChangePasswordPayload) {
    return apiClient.authPostJson<T>(apiRoutes.auth.changePassword, payload)
  },
}
