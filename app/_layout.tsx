import { useFonts } from "expo-font"
import { Stack } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { StatusBar } from "expo-status-bar"
import { useEffect } from "react"
import "react-native-reanimated"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { DebugProvider } from "../context/DebugContext"
import { ThemeProvider, useTheme } from "../context/ThemeContext"

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync()

function RootLayoutNav() {
  const { theme, isDarkMode } = useTheme()

  return (
    <SafeAreaProvider>
      <StatusBar style={isDarkMode ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.colors.background
          },
          headerTintColor: theme.colors.text.primary,
          headerTitleStyle: {
            fontWeight: "bold"
          },
          contentStyle: {
            backgroundColor: theme.colors.background
          }
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ title: "Oops!" }} />
      </Stack>
    </SafeAreaProvider>
  )
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf")
  })

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync()
    }
  }, [loaded])

  // useNotifications()

  if (!loaded) {
    return null
  }

  return (
    <ThemeProvider>
      <DebugProvider>
        <RootLayoutNav />
      </DebugProvider>
    </ThemeProvider>
  )
}
