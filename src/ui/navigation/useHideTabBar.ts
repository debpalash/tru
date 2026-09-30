import { useCallback } from 'react'
import { useFocusEffect, useNavigation } from 'expo-router'

/** Temporarily removes the parent tab bar for focused, task-oriented screens. */
export function useHideTabBar(): void {
  const navigation = useNavigation()
  useFocusEffect(useCallback(() => {
    const parent = navigation.getParent()
    parent?.setOptions({ tabBarStyle: { display: 'none' } })
    return () => parent?.setOptions({ tabBarStyle: undefined })
  }, [navigation]))
}
