import 'react-native-reanimated'

import { useEffect, useState, type ComponentProps, type JSX } from 'react'
import { ActivityIndicator, View, Platform, type ColorValue } from 'react-native'
import { DarkTheme, DefaultTheme, router, Tabs, ThemeProvider } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Notifications from 'expo-notifications'
import Ionicons from '@expo/vector-icons/Ionicons'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'

import { loadServiceConnection } from '@/engine/service/connection'
import { loadXSession } from '@/engine/x/session'
import { validateXSession } from '@/engine/x/client'
import { loadXMediaMode } from '@/engine/x/mediaPreference'
import { initializePrivacy } from '@/engine/privacy'
import { initializeLocationProfile } from '@/engine/location'
import { initializeThemePreference, useTheme } from '@/ui/theme'
import '@/engine/monitor/background'

type IconName = ComponentProps<typeof Ionicons>['name']

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
})

export const unstable_settings = {
  initialRouteName: 'index',
}

function TabIcon({ name, color, focused }: { name: IconName; color: ColorValue; focused: boolean }): JSX.Element {
  return <Ionicons name={name} size={focused ? 24 : 23} color={color} />
}

function RootTabs(): JSX.Element {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const baseNavigationTheme = theme.scheme === 'dark' ? DarkTheme : DefaultTheme
  const navigationTheme = {
    ...baseNavigationTheme,
    dark: theme.scheme === 'dark',
    colors: {
      ...baseNavigationTheme.colors,
      background: theme.bg,
      card: theme.bg,
      border: theme.border,
      text: theme.text,
      primary: theme.accent,
      notification: theme.negative,
    },
  }

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar key={theme.scheme} animated style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: theme.bg },
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: theme.textSubtle,
          tabBarHideOnKeyboard: true,
          tabBarLabelStyle: { fontSize: 12, lineHeight: 14, fontWeight: '600', paddingTop: 1 },
          tabBarItemStyle: { minHeight: 56, paddingTop: 4 },
          tabBarStyle: {
            height: 64 + Math.max(insets.bottom, Platform.OS === 'android' ? 6 : 0),
            paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 6 : 0),
            borderTopColor: theme.border,
            borderTopWidth: 1,
            backgroundColor: theme.bg,
            elevation: 0,
            shadowOpacity: 0,
          },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'newspaper' : 'newspaper-outline'} color={color} focused={focused} /> }} />
        <Tabs.Screen name="x" options={{ title: 'X', tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'at-circle' : 'at-circle-outline'} color={color} focused={focused} /> }} />
        <Tabs.Screen name="research" options={{ title: 'Ask', tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'sparkles' : 'sparkles-outline'} color={color} focused={focused} /> }} />
        <Tabs.Screen name="monitors" options={{ title: 'Monitors', tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'notifications' : 'notifications-outline'} color={color} focused={focused} /> }} />
        <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'menu' : 'menu-outline'} color={color} focused={focused} /> }} />

        <Tabs.Screen name="browser" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="hn" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="library" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="media" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="reader" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="region" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="privacy" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="settings" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="sources" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="world" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      </Tabs>
    </ThemeProvider>
  )
}

export default function RootLayout(): JSX.Element {
  const [ready, setReady] = useState(false)
  const t = useTheme()
  useEffect(() => {
    let live = true
    void Promise.all([initializeThemePreference(), loadXMediaMode(), initializePrivacy(), initializeLocationProfile(), loadServiceConnection()]).then(async () => {
      const session = await loadXSession()
      if (live) setReady(true)
      if (session && (!session.username || !session.userId)) {
        void validateXSession().catch(() => { /* the X screen surfaces session and network errors */ })
      }
    })

    const openResponse = (response: Notifications.NotificationResponse | null) => {
      const url = response?.notification.request.content.data?.url
      if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
        router.push({ pathname: '/browser', params: { url, title: 'Monitor match' } })
        void Notifications.clearLastNotificationResponse()
      }
    }
    const listener = Notifications.addNotificationResponseReceivedListener(openResponse)
    void Notifications.getLastNotificationResponseAsync().then(openResponse)
    return () => { live = false; listener.remove() }
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {ready ? <RootTabs /> : <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={t.text} accessibilityLabel="Preparing Tru" /></View>}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
