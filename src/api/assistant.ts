import { httpClient } from "@/api/httpClient"
import type { AssistantMessage } from "@/lib/assistantTranscript"

/**
 * One turn of the conversation.
 *
 * <p><strong>The browser holds the history and the server holds none of it.</strong> Every question
 * carries the whole conversation back and the answer returns the whole of it again, grown by what the
 * assistant said and by whatever the tools returned. A reload therefore starts a new conversation —
 * which is a decision with a retention question behind it, not an omission.
 */
export interface AssistantAsk {
  question: string
  /** Exactly what the previous answer returned; empty opens a new conversation. */
  messages: AssistantMessage[]
}

export interface AssistantAnswer {
  answer: string
  messages: AssistantMessage[]
  /**
   * False when the assistant ran out of rounds or tokens part-way through — the answer is then a
   * description of where it stopped, and the screen says so rather than presenting an interrupted
   * task as a finished one.
   */
  finished: boolean
  toolCalls: number
  inputTokens: number
  outputTokens: number
}

export interface AssistantAvailability {
  /**
   * Whether this installation has a model configured at all. An installation with tools and no
   * provider is supported — a connected Model Context Protocol client still works — so the screen is
   * drawn absent rather than present and broken.
   */
  available: boolean
}

export async function askAssistant(payload: AssistantAsk): Promise<AssistantAnswer> {
  const response = await httpClient.post<AssistantAnswer>("/assistant/ask", payload)

  return response.data
}

export async function fetchAssistantAvailability(): Promise<AssistantAvailability> {
  const response = await httpClient.get<AssistantAvailability>("/assistant/availability")

  return response.data
}
