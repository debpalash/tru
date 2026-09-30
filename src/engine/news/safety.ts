import type { NewsItem } from './types'

// Tru is intentionally general-audience. Mainstream feeds occasionally
// publish explicit or sexual-violence headlines; exclude those before caching,
// briefing, search, or agent grounding so they never enter a product surface.
const EXCLUDED_CONTENT = [
  /\b(?:porn|pornography|pornographic|explicit sexual|sexually explicit|nudity|nudes?|erotic|xxx)\b/i,
  /\b(?:rape|sexual assault|sexual abuse|sexual exploitation)\b/i,
]

// Social posts are less editorially constrained than news headlines and X's
// own sensitive bit is inconsistently applied. This stricter layer is used for
// X text, handles and bios only; it intentionally does not hide legitimate
// mainstream reporting about health or crime from the news feed.
const EXCLUDED_SOCIAL_CONTENT = [
  /\b(?:nsfw|18\+|adults? only|explicit content|spicy (?:page|content)|not safe for work)\b/i,
  /\b(?:onlyfans|fansly|manyvids|chaturbate|camgirl|cam boy|sex worker)\b/i,
  /\b(?:naked|topless|lingerie|striptease|lewd|seductive|horny|fetish|bdsm|kinky?)\b/i,
  /\b(?:boobs?|tits?|pussy|vagina|penis|cock|dick|dildo|cum|orgasm|blowjob|handjob)\b/i,
  /\b(?:anal sex|oral sex|sex tape|sexting|sexual fantasy|erotic cosplay)\b/i,
  /\b(?:[d-h]|dd|ddd)\s*-?\s*cups?\b/i,
]

export function isGeneralAudienceText(text: string): boolean {
  return EXCLUDED_CONTENT.every((pattern) => !pattern.test(text))
}

export function isGeneralAudienceSocialText(text: string): boolean {
  return isGeneralAudienceText(text) && EXCLUDED_SOCIAL_CONTENT.every((pattern) => !pattern.test(text))
}

export function isGeneralAudienceNews(item: NewsItem): boolean {
  const text = `${item.title} ${item.hover ?? ''}`
  return isGeneralAudienceText(text)
}

export function keepGeneralAudienceNews(items: NewsItem[]): NewsItem[] {
  return items.filter(isGeneralAudienceNews)
}
