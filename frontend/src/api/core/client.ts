import {
  buildAuthHeaders,
  clearAuthSession,
  getRefreshToken,
  headersToObject,
  setSessionTokens,
} from "./session"

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

function mergeHeaders(base?: HeadersInit, extra?: HeadersInit): Record<string, string> {
  return {
    ...headersToObject(base),
    ...headersToObject(extra),
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
      .filter((message): message is string => Boolean(message))

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

interface RefreshResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken()
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

function createJsonRequestInit(method: string, body?: unknown, init?: RequestInit): RequestInit {
  return {
    ...init,
    method,
    headers: mergeHeaders({ "Content-Type": "application/json" }, init?.headers),
    body: body === undefined ? init?.body : JSON.stringify(body),
  }
}

interface RequestOptions extends RequestInit {
  auth?: boolean
  retryOn401?: boolean
}

type ResponseParser<T> = (response: Response) => Promise<T>

async function performRequest<T>(
  path: string,
  options: RequestOptions | undefined,
  parser: ResponseParser<T>,
): Promise<T> {
  const { auth = false, retryOn401 = auth, ...init } = options || {}
  const runRequest = () => fetch(buildApiUrl(path), auth ? withAuthInit(init) : init)

  let response = await runRequest()

  if (auth && response.status === 401 && retryOn401) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      response = await runRequest()
    }
  }

  if (!response.ok) {
    const payload = await readPayload(response)
    throw new ApiError(
      extractErrorMessage(payload) || `Erreur HTTP ${response.status}`,
      response.status,
      payload,
    )
  }

  return parser(response)
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return null as T
  }

  return (await readPayload(response)) as T
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  return performRequest(path, init, parseJsonResponse)
}

export async function requestAuthJson<T>(
  path: string,
  init?: RequestInit,
  retryOn401: boolean = true,
): Promise<T> {
  return performRequest(path, { ...init, auth: true, retryOn401 }, parseJsonResponse)
}

export async function requestBlob(path: string, init?: RequestInit): Promise<Blob> {
  return performRequest(path, init, (response) => response.blob())
}

export async function requestAuthBlob(
  path: string,
  init?: RequestInit,
  retryOn401: boolean = true,
): Promise<Blob> {
  return performRequest(path, { ...init, auth: true, retryOn401 }, (response) => response.blob())
}

export const apiClient = {
  get<T>(path: string, init?: RequestInit) {
    return requestJson<T>(path, { ...init, method: "GET" })
  },
  post<T>(path: string, init?: RequestInit) {
    return requestJson<T>(path, { ...init, method: "POST" })
  },
  put<T>(path: string, init?: RequestInit) {
    return requestJson<T>(path, { ...init, method: "PUT" })
  },
  patch<T>(path: string, init?: RequestInit) {
    return requestJson<T>(path, { ...init, method: "PATCH" })
  },
  remove<T>(path: string, init?: RequestInit) {
    return requestJson<T>(path, { ...init, method: "DELETE" })
  },
  postJson<T>(path: string, body?: unknown, init?: RequestInit) {
    return requestJson<T>(path, createJsonRequestInit("POST", body, init))
  },
  putJson<T>(path: string, body?: unknown, init?: RequestInit) {
    return requestJson<T>(path, createJsonRequestInit("PUT", body, init))
  },
  patchJson<T>(path: string, body?: unknown, init?: RequestInit) {
    return requestJson<T>(path, createJsonRequestInit("PATCH", body, init))
  },
  postForm<T>(path: string, formData: FormData, init?: RequestInit) {
    return requestJson<T>(path, { ...init, method: "POST", body: formData })
  },
  authGet<T>(path: string, init?: RequestInit) {
    return requestAuthJson<T>(path, { ...init, method: "GET" })
  },
  authPost<T>(path: string, init?: RequestInit) {
    return requestAuthJson<T>(path, { ...init, method: "POST" })
  },
  authPut<T>(path: string, init?: RequestInit) {
    return requestAuthJson<T>(path, { ...init, method: "PUT" })
  },
  authPatch<T>(path: string, init?: RequestInit) {
    return requestAuthJson<T>(path, { ...init, method: "PATCH" })
  },
  authRemove<T>(path: string, init?: RequestInit) {
    return requestAuthJson<T>(path, { ...init, method: "DELETE" })
  },
  authPostJson<T>(path: string, body?: unknown, init?: RequestInit) {
    return requestAuthJson<T>(path, createJsonRequestInit("POST", body, init))
  },
  authPutJson<T>(path: string, body?: unknown, init?: RequestInit) {
    return requestAuthJson<T>(path, createJsonRequestInit("PUT", body, init))
  },
  authPatchJson<T>(path: string, body?: unknown, init?: RequestInit) {
    return requestAuthJson<T>(path, createJsonRequestInit("PATCH", body, init))
  },
  authPostForm<T>(path: string, formData: FormData, init?: RequestInit) {
    return requestAuthJson<T>(path, { ...init, method: "POST", body: formData })
  },
  blob(path: string, init?: RequestInit) {
    return requestBlob(path, { ...init, method: "GET" })
  },
  authBlob(path: string, init?: RequestInit) {
    return requestAuthBlob(path, { ...init, method: "GET" })
  },
}
