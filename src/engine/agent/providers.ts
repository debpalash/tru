import { serviceHasProvider } from '../service/connection'
export type LlmProviderId = 'gemini' | 'groq' | 'cerebras' | 'openrouter' | 'nvidia'
export type LlmTier = 'fast' | 'long' | 'variety'

export interface LlmProvider {
  id: LlmProviderId
  label: string
  baseUrl: string
  key: string
  model: string
  disabled: boolean
}

interface ProviderDefinition {
  id: LlmProviderId
  label: string
  defaultBaseUrl: string
  defaultModel: string
}

const DEFINITIONS: ProviderDefinition[] = [
  {
    id: 'gemini',
    label: 'Google AI (Gemini)',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-flash-lite-latest',



  },
  {
    id: 'groq',
    label: 'Groq',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',



  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    defaultBaseUrl: 'https://api.cerebras.ai/v1',
    defaultModel: 'qwen-3.8-27b',



  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'nvidia/nemotron-3-super-120b-a12b:free',



  },
  {
    id: 'nvidia',
    label: 'NVIDIA NIM',
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
    defaultModel: 'nvidia/nemotron-3-super-120b-a12b',



  },
]

const TIER_ORDER: Record<LlmTier, LlmProviderId[]> = {
  fast: ['nvidia', 'cerebras', 'groq', 'openrouter', 'gemini'],
  long: ['gemini', 'openrouter', 'cerebras', 'groq', 'nvidia'],
  variety: ['openrouter', 'gemini', 'cerebras', 'nvidia', 'groq'],
}

function resolve(definition: ProviderDefinition): LlmProvider {
  return {
    id: definition.id,
    label: definition.label,
    baseUrl: definition.defaultBaseUrl.replace(/\/+$/, ''),
    key: '',
    model: definition.defaultModel.trim(),
    disabled: false,
  }
}

export function allProviders(): (LlmProvider & { hasKey: boolean })[] {
  return DEFINITIONS.map(resolve).map((provider) => ({ ...provider, hasKey: serviceHasProvider(provider.id) }))
}

export function providerById(id: LlmProviderId): LlmProvider | null {
  const definition = DEFINITIONS.find((candidate) => candidate.id === id)
  return definition ? resolve(definition) : null
}

export function configuredProviders(tier: LlmTier = 'fast'): LlmProvider[] {
  const rank = TIER_ORDER[tier]
  return allProviders()
    .filter((provider) => provider.hasKey && !provider.disabled && provider.baseUrl && provider.model)
    .sort((a, b) => rank.indexOf(a.id) - rank.indexOf(b.id))
}

export function llmConfigured(): boolean {
  return configuredProviders().length > 0
}

