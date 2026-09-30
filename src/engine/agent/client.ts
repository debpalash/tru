import {
  configuredProviders,
  providerById,
  type LlmProvider,
  type LlmProviderId,
  type LlmTier,
} from './providers'
import { serviceFetch, serviceHasProvider } from '../service/connection'

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LlmOptions {
  maxTokens?: number
  temperature?: number
  timeoutMs?: number
  tier?: LlmTier
  signal?: AbortSignal
}

export interface LlmResult {
  text: string
  providerId: LlmProviderId
  providerLabel: string
  elapsedMs: number
}

export interface ProviderTestResult {
  ok: boolean
  elapsedMs: number
  detail: string
}

interface ChatResponse {
  choices?: { message?: { content?: string } }[]
  error?: { message?: string }
}

function statusHint(status: number): string {
  if (status === 401 || status === 403) return ': key rejected or missing permission'
  if (status === 402) return ': account credits or billing required'
  if (status === 404) return ': model or endpoint unavailable'
  if (status === 429) return ': rate limit reached'
  return ''
}

async function callProvider(provider: LlmProvider, messages: LlmMessage[], options: LlmOptions): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 25_000)
  const abort = () => controller.abort()
  options.signal?.addEventListener('abort', abort)
  try {
    const response = await serviceFetch(`/v1/chat/${provider.id}`, {
      messages, max_tokens: options.maxTokens ?? 900,
    }, controller.signal)
    if (!response.ok) {
      let detail = ''
      try {
        const body = (await response.json()) as ChatResponse
        if (body.error?.message) detail = `: ${body.error.message.slice(0, 120)}`
      } catch {
        // Status still provides a useful failure reason.
      }
      throw new Error(`HTTP ${response.status}${detail || statusHint(response.status)}`)
    }
    const body = (await response.json()) as ChatResponse
    const text = body.choices?.[0]?.message?.content?.trim()
    if (!text) throw new Error('Empty response')
    return text
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', abort)
  }
}

export async function llmChat(messages: LlmMessage[], options: LlmOptions = {}): Promise<LlmResult | null> {
  for (const provider of configuredProviders(options.tier)) {
    if (options.signal?.aborted) return null
    const startedAt = Date.now()
    try {
      const text = await callProvider(provider, messages, options)
      return {
        text,
        providerId: provider.id,
        providerLabel: provider.label,
        elapsedMs: Date.now() - startedAt,
      }
    } catch (error) {
      console.warn(`[agent] ${provider.id} failed: ${(error as Error)?.message ?? 'request failed'}`)
    }
  }
  return null
}

export async function testProvider(id: LlmProviderId): Promise<ProviderTestResult> {
  const provider = providerById(id)
  if (!provider) return { ok: false, elapsedMs: 0, detail: 'Unknown provider' }
  if (!serviceHasProvider(id)) return { ok: false, elapsedMs: 0, detail: 'Connect Tru service in Settings.' }
  const startedAt = Date.now()
  try {
    const text = await callProvider(
      provider,
      [{ role: 'user', content: 'Reply with the single word: ok' }],
      { maxTokens: 200, temperature: 0, timeoutMs: 40_000 },
    )
    return { ok: true, elapsedMs: Date.now() - startedAt, detail: text.slice(0, 48) }
  } catch (error) {
    return {
      ok: false,
      elapsedMs: Date.now() - startedAt,
      detail: (error as Error)?.message ?? 'Request failed',
    }
  }
}
