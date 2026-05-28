export const SESSION_STORAGE_KEYS = {
  accessToken: "stages_access_token",
  refreshToken: "stages_refresh_token",
  tokenType: "stages_token_type",
  userRoleBackend: "stages_user_role_backend",
  userRole: "stages_user_role",
  userEmail: "stages_user_email",
  userName: "stages_user_name",
} as const

export function headersToObject(headers?: HeadersInit): Record<string, string> {
  if (!headers) {
    return {}
  }

  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries())
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers)
  }

  return { ...headers }
}

export function getAccessToken(): string | null {
  return localStorage.getItem(SESSION_STORAGE_KEYS.accessToken)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(SESSION_STORAGE_KEYS.refreshToken)
}

export function getTokenType(): string {
  return localStorage.getItem(SESSION_STORAGE_KEYS.tokenType) || "bearer"
}

export function clearAuthSession() {
  localStorage.removeItem(SESSION_STORAGE_KEYS.accessToken)
  localStorage.removeItem(SESSION_STORAGE_KEYS.refreshToken)
  localStorage.removeItem(SESSION_STORAGE_KEYS.tokenType)
  localStorage.removeItem(SESSION_STORAGE_KEYS.userRoleBackend)
  localStorage.removeItem(SESSION_STORAGE_KEYS.userRole)
  localStorage.removeItem(SESSION_STORAGE_KEYS.userEmail)
  localStorage.removeItem(SESSION_STORAGE_KEYS.userName)
}

export function setSessionTokens(
  accessToken: string,
  refreshToken: string,
  tokenType: string = "bearer",
) {
  localStorage.setItem(SESSION_STORAGE_KEYS.accessToken, accessToken)
  localStorage.setItem(SESSION_STORAGE_KEYS.refreshToken, refreshToken)
  localStorage.setItem(SESSION_STORAGE_KEYS.tokenType, tokenType)
}

export function buildAuthHeaders(headers?: HeadersInit): Record<string, string> {
  const merged = headersToObject(headers)
  const accessToken = getAccessToken()

  if (accessToken) {
    merged.Authorization = `${getTokenType()} ${accessToken}`
  }

  return merged
}
