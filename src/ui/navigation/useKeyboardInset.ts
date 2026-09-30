import { useEffect, useState } from 'react'
import { Keyboard, Platform } from 'react-native'

/** Keyboard height for edge-to-edge screens where Android does not resize the root view. */
export function useKeyboardInset(extra = 0): number {
  const [height, setHeight] = useState(0)
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const show = Keyboard.addListener(showEvent, (event) => setHeight(event.endCoordinates.height))
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0))
    return () => { show.remove(); hide.remove() }
  }, [])
  return height ? height + extra : 0
}
