import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Sparkles,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ApiError, clearAuthSession, requestAuthJson } from "@/lib/api"
import { cn } from "@/lib/utils"

interface CommunicationContact {
  id: number
  nom: string
  prenom: string
  email: string | null
  role: string
}

interface MessageRead {
  id: number
  sender_id: number
  recipient_id: number
  subject: string
  content: string
  sent_at: string
  is_read: boolean
  is_mine: boolean
}

interface ConversationRead {
  contact: CommunicationContact
  last_message: MessageRead | null
  unread_count: number
}

interface ConversationThreadRead {
  contact: CommunicationContact
  messages: MessageRead[]
}

interface MessagesWorkspaceProps {
  title: string
  subtitle: string
  sidebarWarning?: string
}

function isApiErrorStatus(error: unknown, status: number): boolean {
  return error instanceof ApiError && error.status === status
}

function asErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null
  }
  const source = value.includes("T") ? value : `${value}T00:00:00`
  const parsed = new Date(source)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

const TIME_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
})

function formatConversationTime(value: string | null | undefined): string {
  const parsed = parseDate(value)
  if (!parsed) {
    return "-"
  }

  const now = new Date()
  const isSameDay =
    parsed.getFullYear() === now.getFullYear() &&
    parsed.getMonth() === now.getMonth() &&
    parsed.getDate() === now.getDate()

  return isSameDay ? TIME_FORMATTER.format(parsed) : DATE_FORMATTER.format(parsed)
}

function enumToLabel(value: string | null | undefined): string {
  if (!value) {
    return "-"
  }
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getInitials(contact: CommunicationContact): string {
  const first = (contact.prenom || "").trim().charAt(0)
  const last = (contact.nom || "").trim().charAt(0)
  const initials = `${first}${last}`.toUpperCase()
  return initials || "CT"
}

function fullName(contact: CommunicationContact): string {
  return `${contact.prenom || ""} ${contact.nom || ""}`.trim() || contact.email || `Utilisateur #${contact.id}`
}

function sortConversations(items: ConversationRead[]): ConversationRead[] {
  return [...items].sort((a, b) => {
    const dateA = parseDate(a.last_message?.sent_at)?.getTime() || 0
    const dateB = parseDate(b.last_message?.sent_at)?.getTime() || 0
    return dateB - dateA
  })
}

function avatarClasses(role: string): string {
  const value = (role || "").toUpperCase()
  if (value === "ENCADREUR") {
    return "bg-blue-100 text-blue-700"
  }
  if (value === "ADMIN") {
    return "bg-violet-100 text-violet-700"
  }
  return "bg-emerald-100 text-emerald-700"
}

export function MessagesWorkspace({ title, subtitle, sidebarWarning = "" }: MessagesWorkspaceProps) {
  const navigate = useNavigate()
  const [conversations, setConversations] = useState<ConversationRead[]>([])
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null)
  const [thread, setThread] = useState<ConversationThreadRead | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [newMessage, setNewMessage] = useState("")

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isThreadLoading, setIsThreadLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const [pageError, setPageError] = useState("")
  const [threadError, setThreadError] = useState("")
  const [sendError, setSendError] = useState("")

  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const loadConversations = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent === true
      if (silent) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      setPageError("")

      const accessToken = localStorage.getItem("stages_access_token")
      if (!accessToken) {
        if (silent) {
          setIsRefreshing(false)
        } else {
          setIsLoading(false)
        }
        navigate("/connexion", { replace: true })
        return
      }

      try {
        const response = await requestAuthJson<ConversationRead[]>("/communication/conversations")
        const sorted = sortConversations(response)
        setConversations(sorted)
        setSelectedContactId((previous) => {
          if (previous && sorted.some((item) => item.contact.id === previous)) {
            return previous
          }
          return sorted[0]?.contact.id ?? null
        })
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setPageError(asErrorMessage(error, "Chargement des conversations impossible pour le moment."))
      } finally {
        if (silent) {
          setIsRefreshing(false)
        } else {
          setIsLoading(false)
        }
      }
    },
    [navigate],
  )

  const loadThread = useCallback(
    async (contactId: number) => {
      setIsThreadLoading(true)
      setThreadError("")
      setSendError("")
      try {
        const response = await requestAuthJson<ConversationThreadRead>(`/communication/with/${contactId}`)
        setThread(response)
        setConversations((previous) =>
          previous.map((item) =>
            item.contact.id === contactId
              ? {
                  ...item,
                  unread_count: 0,
                }
              : item,
          ),
        )
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setThread(null)
        setThreadError(asErrorMessage(error, "Chargement des messages impossible pour ce contact."))
      } finally {
        setIsThreadLoading(false)
      }
    },
    [navigate],
  )

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  useEffect(() => {
    if (!selectedContactId) {
      setThread(null)
      return
    }
    void loadThread(selectedContactId)
  }, [loadThread, selectedContactId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [thread?.messages.length])

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return conversations
    }

    return conversations.filter((item) => {
      const name = fullName(item.contact).toLowerCase()
      const email = (item.contact.email || "").toLowerCase()
      const role = enumToLabel(item.contact.role).toLowerCase()
      const lastContent = (item.last_message?.content || "").toLowerCase()
      return (
        name.includes(query) ||
        email.includes(query) ||
        role.includes(query) ||
        lastContent.includes(query)
      )
    })
  }, [conversations, searchQuery])

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.contact.id === selectedContactId) || null,
    [conversations, selectedContactId],
  )

  const unreadCount = useMemo(
    () => conversations.reduce((sum, conversation) => sum + conversation.unread_count, 0),
    [conversations],
  )

  const sendMessage = useCallback(async () => {
    const content = newMessage.trim()
    if (!selectedContactId || !content) {
      return
    }

    setSendError("")
    setIsSending(true)

    try {
      const created = await requestAuthJson<MessageRead>("/communication/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient_id: selectedContactId,
          content,
        }),
      })

      setNewMessage("")
      setThread((previous) => {
        if (!previous || previous.contact.id !== selectedContactId) {
          return previous
        }
        return {
          ...previous,
          messages: [...previous.messages, created],
        }
      })
      setConversations((previous) => {
        const updated = previous.map((item) =>
          item.contact.id === selectedContactId
            ? {
                ...item,
                last_message: created,
                unread_count: 0,
              }
            : item,
        )
        return sortConversations(updated)
      })
    } catch (error) {
      if (isApiErrorStatus(error, 401)) {
        clearAuthSession()
        navigate("/connexion", { replace: true })
        return
      }
      setSendError(asErrorMessage(error, "Envoi du message impossible pour le moment."))
    } finally {
      setIsSending(false)
    }
  }, [navigate, newMessage, selectedContactId])

  return (
    <div className="flex flex-col gap-6">
      <DashboardPageHeader
        title={title}
        subtitle={subtitle}
        actions={(
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => void loadConversations({ silent: true })}
            disabled={isLoading || isRefreshing}
          >
            {isRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Actualiser
          </Button>
        )}
      />

      {pageError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {pageError}
        </div>
      )}

      {sidebarWarning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {sidebarWarning}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-indigo-100 bg-white/95 shadow-sm">
          <CardContent className="py-4">
            <p className="text-xs font-medium text-muted-foreground">Conversations</p>
            <p className="mt-1 text-xl font-bold text-foreground">{conversations.length}</p>
          </CardContent>
        </Card>
        <Card className="border-indigo-100 bg-white/95 shadow-sm">
          <CardContent className="py-4">
            <p className="text-xs font-medium text-muted-foreground">Non lus</p>
            <p className="mt-1 text-xl font-bold text-indigo-700">{unreadCount}</p>
          </CardContent>
        </Card>
        <Card className="border-indigo-100 bg-white/95 shadow-sm">
          <CardContent className="py-4">
            <p className="text-xs font-medium text-muted-foreground">Contact actif</p>
            <p className="mt-1 truncate text-sm font-semibold text-foreground">
              {selectedConversation ? fullName(selectedConversation.contact) : "Aucun"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="overflow-hidden border-indigo-100 bg-white/95 shadow-sm">
          <CardHeader className="space-y-3 border-b border-border pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="h-4 w-4 text-indigo-600" />
              Conversations
            </CardTitle>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher un contact..."
                className="h-9 pl-9 text-xs"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {isLoading ? (
                <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Chargement...
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex h-24 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                  Aucune conversation disponible.
                </div>
              ) : (
                filteredConversations.map((conversation) => {
                  const isSelected = selectedContactId === conversation.contact.id
                  return (
                    <button
                      key={conversation.contact.id}
                      onClick={() => setSelectedContactId(conversation.contact.id)}
                      className={cn(
                        "group flex w-full items-start gap-3 border-b border-border/50 px-3 py-3 text-left transition-colors",
                        isSelected ? "bg-indigo-50/60" : "hover:bg-secondary/40",
                      )}
                    >
                      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold", avatarClasses(conversation.contact.role))}>
                        {getInitials(conversation.contact)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">{fullName(conversation.contact)}</p>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {formatConversationTime(conversation.last_message?.sent_at)}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{enumToLabel(conversation.contact.role)}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {conversation.last_message?.content || "Aucun message pour le moment."}
                        </p>
                      </div>
                      {conversation.unread_count > 0 && (
                        <Badge className="h-5 w-5 shrink-0 rounded-full bg-indigo-600 p-0 text-[10px] text-white">
                          {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
                        </Badge>
                      )}
                    </button>
                  )
                })
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-indigo-100 bg-gradient-to-b from-white via-white to-indigo-50/20 shadow-sm">
          <CardHeader className="flex-row items-center justify-between border-b border-border pb-3">
            <div className="flex min-w-0 items-center gap-3">
              {selectedConversation ? (
                <>
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold", avatarClasses(selectedConversation.contact.role))}>
                    {getInitials(selectedConversation.contact)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{fullName(selectedConversation.contact)}</p>
                    <p className="text-xs text-muted-foreground">{enumToLabel(selectedConversation.contact.role)}</p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Selectionnez une conversation.</p>
              )}
            </div>
            <Badge variant="outline" className="gap-1 text-xs">
              <Sparkles className="h-3 w-3" />
              Espace live
            </Badge>
          </CardHeader>

          {threadError && (
            <div className="border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {threadError}
            </div>
          )}

          <CardContent className="flex h-[500px] flex-col p-0">
            <div className="flex-1">
              <ScrollArea className="h-full px-4 py-4">
                {!selectedContactId ? (
                  <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                    Choisissez un contact pour afficher les messages.
                  </div>
                ) : isThreadLoading ? (
                  <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Chargement des messages...
                  </div>
                ) : !thread || thread.messages.length === 0 ? (
                  <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                    Aucun message pour cette conversation.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 pb-2">
                    {thread.messages.map((message) => (
                      <div key={message.id} className={cn("flex", message.is_mine ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[78%] rounded-2xl px-4 py-2.5 shadow-sm",
                            message.is_mine
                              ? "rounded-br-md bg-indigo-600 text-white"
                              : "rounded-bl-md border border-border bg-white text-foreground",
                          )}
                        >
                          {message.subject && message.subject !== "Message" && (
                            <p className={cn("mb-1 text-[10px] font-semibold uppercase tracking-wide", message.is_mine ? "text-white/75" : "text-muted-foreground")}>
                              {message.subject}
                            </p>
                          )}
                          <p className="text-sm leading-relaxed">{message.content}</p>
                          <p
                            className={cn(
                              "mt-1 text-[10px]",
                              message.is_mine ? "text-white/75" : "text-muted-foreground",
                            )}
                          >
                            {formatConversationTime(message.sent_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>
            </div>

            <div className="border-t border-border px-3 py-3">
              {sendError && (
                <div className="mb-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {sendError}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input
                  placeholder={selectedContactId ? "Ecrire un message..." : "Selectionnez une conversation"}
                  className="h-10 flex-1 text-sm"
                  value={newMessage}
                  onChange={(event) => setNewMessage(event.target.value)}
                  disabled={!selectedContactId || isSending}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault()
                      void sendMessage()
                    }
                  }}
                />
                <Button
                  className="h-10 gap-1.5 px-3 text-xs"
                  onClick={() => void sendMessage()}
                  disabled={!selectedContactId || !newMessage.trim() || isSending}
                >
                  {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Envoyer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
