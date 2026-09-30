import { useCallback, useEffect, useState, type JSX } from 'react'
import { ActivityIndicator, ScrollView, Switch, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'

import { checkMonitorsNow, disableMonitorBackground, enableMonitorBackground, monitorBackgroundEnabled } from '@/engine/monitor/background'
import { addMonitor, loadMonitors, removeMonitor, toggleMonitor, type Monitor } from '@/engine/monitor/store'
import { PressableScale } from '@/ui/ios/PressableScale'
import { AppHeader } from '@/ui/shell/AppHeader'
import { useTheme, useThemedStyles, type ThemeTokens } from '@/ui/theme'

export default function MonitorsScreen(): JSX.Element {
  const t = useTheme()
  const styles = useThemedStyles(makeStyles)
  const [items, setItems] = useState<Monitor[]>([])
  const [query, setQuery] = useState('')
  const [background, setBackground] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('Alert timing depends on your device.')
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const refresh = useCallback(async () => {
    setItems(await loadMonitors())
    setBackground(await monitorBackgroundEnabled())
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const edit = async (change: () => Promise<Monitor[]>) => {
    if (saving) return false
    setSaving(true)
    setEditError('')
    try { setItems(await change()); return true }
    catch { setEditError('Couldn’t save changes. Try again.'); return false }
    finally { setSaving(false) }
  }
  const add = async () => {
    if (!query.trim() || saving) return
    if (await edit(() => addMonitor(query))) setQuery('')
  }

  const toggleBackground = async () => {
    setBusy(true)
    try {
      if (background) {
        await disableMonitorBackground()
        setBackground(false)
        setStatus('Background alerts are off.')
      } else {
        const result = await enableMonitorBackground()
        setBackground(result.enabled)
        setStatus(result.detail)
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Background setup failed.')
    } finally {
      setBusy(false)
    }
  }

  const check = async () => {
    setBusy(true)
    try {
      const count = await checkMonitorsNow()
      setStatus(count ? `${count} new match${count === 1 ? '' : 'es'} found.` : 'No new matches.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Check failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <AppHeader back={false} title="Monitors" subtitle="Follow topics" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.composer}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => void add()}
            placeholder="Topic or exact phrase"
            placeholderTextColor={t.textMuted}
            style={styles.input}
            returnKeyType="done"
            maxLength={80}
            editable={!saving}
            accessibilityLabel="Monitor topic"
          />
          <PressableScale style={[styles.add, (!query.trim() || saving) && styles.disabled]} disabled={!query.trim() || saving} onPress={() => void add()} accessibilityRole="button" accessibilityLabel="Add monitor" accessibilityState={{ disabled: !query.trim() || saving }}>
            <Text style={styles.addText}>Add</Text>
          </PressableScale>
        </View>

        {editError ? <Text style={styles.editError} accessibilityRole="alert">{editError}</Text> : null}
        <View style={styles.control}>
          <View style={styles.controlCopy}>
            <Text style={styles.controlTitle}>Background alerts</Text>
            <Text style={styles.controlBody}>{status}</Text>
          </View>
          <View style={styles.toggleTouch}>{busy ? <ActivityIndicator size="small" color={t.accent} /> : <Switch value={background} onValueChange={() => void toggleBackground()} disabled={busy} trackColor={{ false: t.surfaceAlt, true: t.positive }} thumbColor={t.text} accessibilityLabel="Background alerts" />}</View>
        </View>

        <PressableScale style={[styles.check, busy && styles.disabled]} disabled={busy} onPress={() => void check()} accessibilityRole="button" accessibilityLabel="Check every source now" accessibilityState={{ busy, disabled: busy }}>
          <Ionicons name="refresh-outline" size={16} color={t.accent} />
          <Text style={styles.checkText}>Check now</Text>
        </PressableScale>

        <Text style={styles.section}>Topics · {items.length}</Text>
        <View style={styles.rules}>
          {items.length ? items.map((item) => (
            <View key={item.id} style={styles.row}>
              <PressableScale
                style={styles.ruleState}
                disabled={saving}
                onPress={() => void edit(() => toggleMonitor(item.id))}
                accessibilityRole="switch"
                accessibilityState={{ checked: item.enabled, disabled: saving }}
                accessibilityLabel={`${item.query} monitor`}
              >
                <Ionicons name={item.enabled ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={item.enabled ? t.positive : t.textMuted} />
              </PressableScale>
              <View style={styles.ruleCopy}>
                <Text style={styles.ruleTitle}>{item.query}</Text>
                <Text style={styles.ruleBody}>All words must match</Text>
              </View>
              <PressableScale style={styles.remove} disabled={saving} onPress={() => void edit(() => removeMonitor(item.id))} accessibilityRole="button" accessibilityLabel={`Remove ${item.query}`}>
                <Ionicons name="close" size={18} color={t.textMuted} />
              </PressableScale>
            </View>
          )) : (
            <Text style={styles.empty}>Add a topic above to highlight matching headlines and get alerts.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  editError: { color: t.negative, fontSize: 13, lineHeight: 20, marginHorizontal: 16, marginTop: 8 },
  screen: { flex: 1, backgroundColor: t.bg },
  content: { paddingTop: 8, paddingBottom: 32 },
  composer: { height: 48, paddingHorizontal: 16, flexDirection: 'row', gap: 8 },
  input: { flex: 1, minWidth: 0, height: 48, paddingHorizontal: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border, borderRadius: 12, backgroundColor: t.surface, color: t.text, fontSize: 14 },
  add: { minWidth: 60, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: t.accent },
  addText: { color: t.onAccent, fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.4 },
  control: { minHeight: 62, marginTop: 12, paddingLeft: 16, paddingRight: 4, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.border },
  controlCopy: { flex: 1, minWidth: 0 },
  controlTitle: { color: t.text, fontSize: 14, lineHeight: 18, fontWeight: '600' },
  controlBody: { color: t.textMuted, fontSize: 12, lineHeight: 18, marginTop: 2 },
  toggleTouch: { width: 56, height: 48, alignItems: 'center', justifyContent: 'center' },
  check: { minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', gap: 8, alignItems: 'center' },
  checkText: { color: t.accent, fontSize: 14, fontWeight: '600' },
  section: { minHeight: 34, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 5, color: t.textMuted, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  rules: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
  row: { minHeight: 58, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  ruleState: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  ruleCopy: { flex: 1, minWidth: 0 },
  ruleTitle: { color: t.text, fontSize: 14, lineHeight: 18, fontWeight: '600' },
  ruleBody: { color: t.textMuted, fontSize: 12, lineHeight: 18, marginTop: 1 },
  remove: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  empty: { color: t.textMuted, fontSize: 14, lineHeight: 18, paddingHorizontal: 16, paddingVertical: 16 },
})
