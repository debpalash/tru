import type { JSX } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppHeader } from '@/ui/shell/AppHeader'
import { useThemedStyles, type ThemeTokens } from '@/ui/theme'
const SECTIONS = [
  ['No business built on your data', 'Tru has no ads, analytics SDK, subscription, remote push service or developer-operated data collection endpoint. You can read news without an account. Optional AI connects only to a service you choose; its host and providers have their own data practices.'],
  ['Your device', 'Tru stores saved stories, preferences, monitor terms, drafts, and service usage on your device. X session cookies and your service access token use the operating system’s secure storage. Region selection uses locale and time zone, not GPS.'],
  ['AI and research', 'After you connect a service, questions and selected source excerpts are sent to its configured AI providers. If one provider fails, another may receive the same request. Web research sends your query and selected publisher URLs to Firecrawl through the service.'],
  ['Media verification', 'Safe media sends image previews to the connected service and Google AI before displaying them. This can include avatars and media from your signed-in X feed. Choose Hide media in Settings to stop these preview checks. Automated checks can make mistakes.'],
  ['Network connections', 'Feed publishers and X receive requests needed to load their content. Without a private route, they see your IP address. Relay operators see your IP and requested public URLs. Tor blocks native media rather than connecting directly. Opening an external browser uses that browser’s network settings.'],
  ['Service records', 'The bundled backend stores hashed access tokens, device labels, expiry times, and usage counters. It does not deliberately store questions or image bodies. The service host and upstream providers may keep their own logs; ask your service operator about retention and deletion.'],
  ['Your controls', 'Disconnect X and the AI service to remove saved credentials. Disconnecting X also clears cookies for websites opened inside Tru. Delete saved stories and monitors from their screens. Clear app storage or uninstall to remove remaining local data. Ask the service operator to revoke your access and delete its records.'],
  ['Source and attribution', 'Tru includes AGPL-3.0-only X parsing code from Unbird, adapted from Nitter. This app is independent of OpenAI, Google, and X. See the distributed source, license, and third-party notices for attribution.'],
]
export default function PrivacyScreen(): JSX.Element {
  const styles = useThemedStyles(makeStyles)
  return <SafeAreaView style={styles.screen}><AppHeader title="Privacy & data" subtitle="What leaves your device" /><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.intro}>Know where your information goes.</Text>
    {SECTIONS.map(([title, body]) => <View key={title} style={styles.section}><Text accessibilityRole="header" style={styles.title}>{title}</Text><Text selectable style={styles.body}>{body}</Text></View>)}
  </ScrollView></SafeAreaView>
}
const makeStyles = (t: ThemeTokens) => StyleSheet.create({ screen: { flex: 1, backgroundColor: t.bg }, content: { padding: 24, paddingBottom: 48, maxWidth: 680, width: '100%', alignSelf: 'center' }, intro: { color: t.text, fontSize: 28, lineHeight: 36, letterSpacing: -0.6, marginBottom: 32 }, section: { marginBottom: 28 }, title: { color: t.text, fontSize: 18, lineHeight: 26, fontWeight: '600', marginBottom: 8 }, body: { color: t.textMuted, fontSize: 16, lineHeight: 26 } })
