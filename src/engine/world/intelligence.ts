import { headlineSimilarity } from '../feed/evidence'
import type { NewsItem } from '../news/types'

export type WorldTier = 'Critical' | 'Elevated' | 'Watch'
export interface WorldSignal { id: string; title: string; region: string; tier: WorldTier; confidence: number; momentum: number; reports: NewsItem[]; entities: string[] }

const REGIONS: [string, RegExp][] = [
  ['India', /\bindia|delhi|mumbai|bengaluru|kashmir\b/i], ['Europe', /\beurope|eu\b|ukraine|russia|france|germany|britain|uk\b/i],
  ['Middle East', /\bisrael|gaza|iran|iraq|syria|lebanon|yemen\b/i], ['East Asia', /\bchina|japan|korea|taiwan|hong kong\b/i],
  ['Americas', /\bunited states|u\.s\.|canada|mexico|brazil|argentina\b/i], ['Africa', /\bafrica|sudan|congo|nigeria|ethiopia|kenya\b/i],
]

const HIGH_IMPACT = /\bwar|attack|strike|earthquake|cyclone|flood|wildfire|outbreak|emergency|crisis|killed|sanctions\b/i

function region(title: string): string { return REGIONS.find(([, pattern]) => pattern.test(title))?.[0] ?? 'Global' }
function entities(title: string): string[] { return [...new Set(title.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?\b/g) ?? [])].filter((value) => !['The', 'New', 'World'].includes(value)).slice(0, 5) }

export function buildWorldSignals(items: NewsItem[]): WorldSignal[] {
  const remaining = new Set(items.map((item) => item.id)); const signals: WorldSignal[] = []
  for (const item of items) {
    if (!remaining.has(item.id)) continue
    const reports = [item, ...items.filter((candidate) => candidate.id !== item.id && remaining.has(candidate.id) && headlineSimilarity(item.title, candidate.title) >= 0.66)]
    for (const report of reports) remaining.delete(report.id)
    const fresh = item.time ? Date.now() - item.time < 12 * 60 * 60 * 1000 : false
    const impact = HIGH_IMPACT.test(item.title); const tier: WorldTier = impact && reports.length >= 2 ? 'Critical' : impact || reports.length >= 2 ? 'Elevated' : 'Watch'
    signals.push({ id: item.id, title: item.title, region: region(item.title), tier, confidence: Math.min(94, 52 + reports.length * 14), momentum: Math.min(99, reports.length * 24 + (fresh ? 28 : 10)), reports, entities: entities(item.title) })
  }
  const weight = { Critical: 3, Elevated: 2, Watch: 1 }
  return signals.sort((a, b) => weight[b.tier] - weight[a.tier] || b.momentum - a.momentum)
}
