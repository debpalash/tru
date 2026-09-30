// Compact relative-time from an epoch-ms timestamp (news items carry ms, unlike
// HN's unix-seconds). Kept local so the news UI doesn't couple to the HN module.

export function timeAgoMs(ms?: number): string {
  if (!ms) return ''
  const secs = Math.max(0, Math.floor((Date.now() - ms) / 1000))
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo`
  return `${Math.floor(months / 12)}y`
}
