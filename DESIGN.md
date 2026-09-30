# Tru mobile design contract

Tru is a quiet news reader for people who want reporting they can trace to its sources. It combines verified news, X, world signals, research and monitoring without making each source feel like a separate app.

## Design read

Native intelligence feed for power users. Editorial utility, dark-first, compact and calm.

- ENERGY 1: content speaks first. No decorative hero, AI orb, glow or mascot.
- RHYTHM 2: one stable reading grid with controlled variation for news, X media and agent findings.
- MOTION 1: native navigation, press feedback and state transitions only.

## Identity

- Tru should feel factual, alert and quiet.
- Bluesky and X set the interaction-quality bar, not the visual identity.
- The repeated motif is evidence beside the claim: source, age and support are visible where a headline is read.
- Density comes from flat rows, tighter structure and progressive disclosure. Never shrink text or touch targets to manufacture density.

## Color

- Base: neutral midnight ink, not saturated navy.
- Surfaces: two restrained elevation steps plus hairline dividers.
- Accent: clear blue, reserved for the current destination and primary action.
- Semantic colors: green for corroborated, amber for single-source or uncertain, red for failure or destructive state.
- Publisher colors may identify a source, but must not become card backgrounds.

## Type and spacing

- Use the native system sans. It is fast, familiar and legible on Android and iOS.
- Body text starts at 13sp. Metadata may use 11sp when contrast remains strong.
- Use weight and tone before introducing another type size.
- Use a 4dp spacing base. Feed rows use 10 to 12dp horizontal padding.
- Visual controls may look compact, but their touch area is at least 44pt on iOS and 48dp on Android.

## Surfaces and controls

- Prefer flat lists with dividers over cards around every item.
- Use cards only for a temporary agent result, expanded briefing or state that must sit above the stream.
- Avoid pills as a universal shape. Tabs use an underline or restrained selected surface.
- The full feed row opens its destination. Keep only evidence and save as visible secondary actions.
- Put detailed citations, verification and Ask actions in the expanded evidence state.
- Bottom navigation has five real destinations: Today, X, Ask, Monitors and More.

## Copy

- Labels name the action: Save, Verify headline, Generate cited brief.
- Remove greetings, slogans, filler and claims about being powerful or intelligent.
- Prefer one line to two. Prefer a clear noun to a sentence.
- Keep real source names, counts, timings and limitations. Never invent social proof or performance claims.

## Non-negotiable checks

- No dead controls.
- Empty, loading and error states explain what happened and the next action.
- No text below WCAG AA contrast.
- No horizontal clipping at narrow widths or larger system text.
- The last feed row remains reachable above bottom navigation.
- Run and inspect every changed screen on the Android emulator before delivery.

## Brand

Name: **Tru**. Tagline: **News. With evidence.**
The white T mark uses a broad horizontal bar and a clear vertical stem against
charcoal. It represents a steady point of reference, with no badge suggesting
that every claim has been certified true. Copy should name sources, distinguish
facts from inference, and make uncertainty visible. Keep the feed minimal.
