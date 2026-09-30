import { useEffect, useState, type JSX } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { connectService, disconnectService, serviceConnection, useServiceConnected } from '@/engine/service/connection'
import { Button } from '@/ui/design/Button'
import { useTheme, useThemedStyles, type ThemeTokens } from '@/ui/theme'

export function ServiceSection({ onChange }: { onChange: () => void }): JSX.Element {
  const t = useTheme(); const styles = useThemedStyles(makeStyles)
  const connected = useServiceConnected()
  const params = useLocalSearchParams<{ connect?: string }>()
  const [expanded, setExpanded] = useState(params.connect === '1')
  useEffect(() => { if (params.connect === '1') setExpanded(true) }, [params.connect])
  const [url, setUrl] = useState(serviceConnection()?.url ?? '')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function connect() {
    setBusy(true); setError('')
    try { await connectService(url, token); setToken(''); onChange() }
    catch (e) { setError(e instanceof Error ? e.message : 'Connection failed. Try again.') }
    finally { setBusy(false) }
  }
  async function disconnect() {
    setBusy(true); setError('')
    try { await disconnectService(); onChange() }
    catch { setError('Could not remove the saved connection. Try again.') }
    finally { setBusy(false) }
  }
  return <View style={styles.section}>
    <View style={styles.header}><View style={styles.copy}><Text style={styles.title}>AI service</Text><Text style={styles.body}>{connected ? 'Connected' : 'Not connected'}</Text></View><Button label={expanded ? 'Close' : connected ? 'Manage' : 'Connect'} variant="ghost" onPress={() => setExpanded(!expanded)} /></View>
    {expanded ? <>
    <Text style={styles.body}>Questions, source excerpts and media previews are sent to this service and its AI providers.</Text>
    {connected ? <>
      <View style={styles.status}><View style={styles.dot} /><Text style={styles.statusText}>Connected</Text></View>
      <Text selectable style={styles.body}>{serviceConnection()?.url}</Text>
      <Button label="Disconnect service" onPress={() => void disconnect()} disabled={busy} />
    </> : <>
      <TextInput value={url} onChangeText={setUrl} placeholder="https://your-service.example" placeholderTextColor={t.textMuted} style={styles.input} autoCapitalize="none" autoCorrect={false} keyboardType="url" accessibilityLabel="Tru service address" />
      <TextInput value={token} onChangeText={setToken} placeholder="Access token" placeholderTextColor={t.textMuted} style={styles.input} secureTextEntry autoCapitalize="none" autoCorrect={false} accessibilityLabel="Tru service access token" />
      <Button label={busy ? 'Connecting…' : 'Agree and connect'} variant="primary" onPress={() => void connect()} disabled={busy || !url.trim() || !token.trim()} trailing={busy ? <ActivityIndicator color={t.onAccent} /> : undefined} />
    </>}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </> : null}
    <Button label="Privacy & data" variant="ghost" icon="shield-checkmark-outline" onPress={() => router.push('/privacy')} />
  </View>
}
const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  section: { marginHorizontal: 16, marginVertical: 8, padding: 12, gap: 8, backgroundColor: t.surface, borderRadius: 16 },
  header: { flexDirection: 'row', alignItems: 'center' },
  copy: { flex: 1 },
  title: { color: t.text, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { color: t.textMuted, fontSize: 13, lineHeight: 20 },
  input: { minHeight: 48, padding: 12, backgroundColor: t.bg, borderRadius: 16, borderWidth: 1, borderColor: t.border, color: t.text, fontSize: 16 },
  status: { flexDirection: 'row', gap: 8, alignItems: 'center' }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.positive },
  statusText: { color: t.text, fontSize: 16, fontWeight: '600' }, error: { color: t.negative, fontSize: 13, lineHeight: 20 },
})
