import { useMemo, useState, type JSX } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'

import { COUNTRY_OPTIONS, setLocationCountry, useLocationProfile } from '@/engine/location'
import { PressableScale } from '@/ui/ios/PressableScale'
import { iosScrollProps } from '@/ui/ios/listProps'
import { AppHeader } from '@/ui/shell/AppHeader'
import { useTheme, useThemedStyles, type ThemeTokens } from '@/ui/theme'

export default function RegionScreen(): JSX.Element {
  const t = useTheme()
  const styles = useThemedStyles(makeStyles)
  const profile = useLocationProfile()
  const [query, setQuery] = useState('')
  const countries = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? COUNTRY_OPTIONS.filter((item) => `${item.name} ${item.code}`.toLowerCase().includes(needle)) : COUNTRY_OPTIONS
  }, [query])

  const choose = async (code: string | null) => {
    await setLocationCountry(code)
    router.back()
  }

  return <SafeAreaView style={styles.screen}>
    <AppHeader title="Local coverage" subtitle="Country only · no GPS" />
    <View style={styles.searchWrap}>
      <Ionicons name="search-outline" size={18} color={t.textMuted} />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search country"
        placeholderTextColor={t.textSubtle}
        style={styles.search}
        autoCapitalize="words"
        autoCorrect={false}
        accessibilityLabel="Search countries"
      />
    </View>
    <ScrollView {...iosScrollProps} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <PressableScale style={styles.row} onPress={() => void choose(null)} accessibilityRole="radio" accessibilityState={{ checked: profile.mode === 'device' }} accessibilityLabel="Use device region automatically">
        <View style={styles.flag}><Ionicons name="phone-portrait-outline" size={17} color={t.textMuted} /></View>
        <View style={styles.copy}><Text style={styles.name}>Automatic</Text><Text style={styles.meta}>{profile.timeZone} · currently {profile.name}</Text></View>
        {profile.mode === 'device' ? <Ionicons name="checkmark" size={19} color={t.accent} /> : null}
      </PressableScale>
      <Text style={styles.section}>Choose a country</Text>
      {!countries.length ? <Text style={styles.noResults}>No countries match “{query.trim()}”.</Text> : null}
      {countries.map((country) => {
        const selected = profile.mode === 'manual' && profile.code === country.code
        return <PressableScale key={country.code} style={styles.row} onPress={() => void choose(country.code)} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={`Use ${country.name} coverage`}>
          <Text style={styles.flag}>{country.code}</Text>
          <View style={styles.copy}><Text style={styles.name}>{country.name}</Text><Text style={styles.meta}>{country.region.replace('-', ' ')}</Text></View>
          {selected ? <Ionicons name="checkmark" size={19} color={t.accent} /> : null}
        </PressableScale>
      })}
    </ScrollView>
  </SafeAreaView>
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  noResults: { padding: 16, color: t.textMuted, fontSize: 14, lineHeight: 20 },
  screen: { flex: 1, backgroundColor: t.bg },
  searchWrap: { height: 48, marginHorizontal: 16, marginVertical: 8, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, backgroundColor: t.surfaceAlt },
  search: { flex: 1, height: 48, color: t.text, fontSize: 14 },
  section: { minHeight: 34, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, color: t.textMuted, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  row: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', gap: 9, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  flag: { width: 34, color: t.textMuted, fontSize: 12, lineHeight: 20, fontWeight: '600', textAlign: 'center' },
  copy: { flex: 1, minWidth: 0 },
  name: { color: t.text, fontSize: 14, lineHeight: 24, fontWeight: '600' },
  meta: { color: t.textMuted, fontSize: 12, lineHeight: 18, textTransform: 'capitalize' },
})
