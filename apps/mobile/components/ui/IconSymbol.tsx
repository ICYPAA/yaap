// This file is a fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons"
import { SymbolWeight } from "expo-symbols"
import React from "react"
import { OpaqueColorValue, StyleProp, TextStyle } from "react-native"

// Add your SFSymbol to MaterialIcons mappings here.
type SymbolName = Extract<
  import("expo-symbols").SymbolViewProps["name"],
  string
>
type MaterialIconName = React.ComponentProps<typeof MaterialIcons>["name"]

const MAPPING = {
  // See MaterialIcons here: https://icons.expo.fyi
  // See SF Symbols in the SF Symbols app on Mac.
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  // Tutorial icons
  "hand.wave": "waving-hand",
  calendar: "calendar-today",
  "square.and.arrow.up": "share",
  bell: "notifications",
  map: "map",
  accessibility: "accessibility",
  "figure.and.child.holdinghands": "child-care",
  message: "chat",
  "fork.knife": "restaurant",
  "checkmark.circle": "check-circle"
} as const satisfies Partial<Record<SymbolName, MaterialIconName>>

export type IconSymbolName = keyof typeof MAPPING

/**
 * An icon component that uses native SFSymbols on iOS, and MaterialIcons on Android and web. This ensures a consistent look across platforms, and optimal resource usage.
 *
 * Icon `name`s are based on SFSymbols and require manual mapping to MaterialIcons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style
}: {
  name: IconSymbolName
  size?: number
  color: string | OpaqueColorValue
  style?: StyleProp<TextStyle>
  weight?: SymbolWeight
}) {
  return (
    <MaterialIcons
      color={color}
      size={size}
      name={MAPPING[name]}
      style={style}
    />
  )
}
