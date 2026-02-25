const DEFAULT_API_BASE_URL = "http://localhost:8000"

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(
  /\/+$/,
  "",
)

export class ApiError extends Error {
  status: number
  payload: unknown

  constructor(message: string, status: number, payload: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.payload = payload
  }
}

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}

function buildHeadersObject(headers?: HeadersInit): Record<string, string> {
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

function mergeHeaders(base?: HeadersInit, extra?: HeadersInit): Record<string, string> {
  return {
    ...buildHeadersObject(base),
    ...buildHeadersObject(extra),
  }
}

async function readPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || ""

  if (contentType.includes("application/json")) {
    return response.json()
  }

  const text = await response.text()
  return text || null
}

function detailToMessage(detail: unknown): string | null {
  if (typeof detail === "string") {
    return detail
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === "string") {
          return item
        }
        if (item && typeof item === "object" && "msg" in item) {
          const rawMsg = (item as { msg?: unknown }).msg
          return typeof rawMsg === "string" ? rawMsg : null
        }
        return null
      })
      .filter((msg): msg is string => Boolean(msg))

    return messages.length ? messages.join(", ") : null
  }

  return null
}

export function extractErrorMessage(payload: unknown): string | null {
  if (typeof payload === "string" && payload.trim()) {
    return payload
  }

  if (payload && typeof payload === "object") {
    if ("detail" in payload) {
      const detailMessage = detailToMessage((payload as { detail?: unknown }).detail)
      if (detailMessage) {
        return detailMessage
      }
    }
    if ("message" in payload) {
      const message = (payload as { message?: unknown }).message
      if (typeof message === "string" && message.trim()) {
        return message
      }
    }
  }

  return null
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(path), init)
  const payload = await readPayload(response)

  if (!response.ok) {
    throw new ApiError(
      extractErrorMessage(payload) || `Erreur HTTP ${response.status}`,
      response.status,
      payload,
    )
  }

  return payload as T
}

export function clearAuthSession() {
  localStorage.removeItem("cni_access_token")
  localStorage.removeItem("cni_refresh_token")
  localStorage.removeItem("cni_token_type")
  localStorage.removeItem("cni_user_role_backend")
  localStorage.removeItem("cni_user_role")
  localStorage.removeItem("cni_user_email")
  localStorage.removeItem("cni_user_name")
}

function setSessionTokens(accessToken: string, refreshToken: string, tokenType: string = "bearer") {
  localStorage.setItem("cni_access_token", accessToken)
  localStorage.setItem("cni_refresh_token", refreshToken)
  localStorage.setItem("cni_token_type", tokenType)
}

export function buildAuthHeaders(headers?: HeadersInit): Record<string, string> {
  const accessToken = localStorage.getItem("cni_access_token")
  const tokenType = localStorage.getItem("cni_token_type") || "bearer"
  const merged = mergeHeaders(headers)

  if (accessToken) {
    merged.Authorization = `${tokenType} ${accessToken}`
  }

  return merged
}

interface RefreshResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem("cni_refresh_token")
  if (!refreshToken) {
    clearAuthSession()
    return false
  }

  try {
    const response = await fetch(buildApiUrl("/auth/refresh"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    const payload = await readPayload(response)

    if (!response.ok) {
      clearAuthSession()
      return false
    }

    const session = payload as RefreshResponse
    if (!session.access_token || !session.refresh_token) {
      clearAuthSession()
      return false
    }

    setSessionTokens(session.access_token, session.refresh_token, session.token_type || "bearer")
    return true
  } catch {
    clearAuthSession()
    return false
  }
}

function withAuthInit(init?: RequestInit): RequestInit {
  return {
    ...init,
    headers: buildAuthHeaders(init?.headers),
  }
}

export async function requestAuthJson<T>(path: string, init?: RequestInit, retryOn401: boolean = true): Promise<T> {
  let response = await fetch(buildApiUrl(path), withAuthInit(init))

  if (response.status === 401 && retryOn401) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      response = await fetch(buildApiUrl(path), withAuthInit(init))
    }
  }

  const payload = await readPayload(response)

  if (!response.ok) {
    throw new ApiError(
      extractErrorMessage(payload) || `Erreur HTTP ${response.status}`,
      response.status,
      payload,
    )
  }

  return payload as T
}
