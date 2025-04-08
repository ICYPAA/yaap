import { Session } from "@supabase/supabase-js"
import { useFonts } from "expo-font"
import * as Notifications from "expo-notifications"
import { Href, Stack, useRouter, useSegments } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { StatusBar } from "expo-status-bar"
import React, { useEffect, useRef, useState } from "react"
import { Platform } from "react-native"
import "react-native-reanimated"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { DebugProvider } from "../context/DebugContext"
import { ThemeProvider, useTheme } from "../context/ThemeContext"
import { supabase } from "../lib/supabase"
import { storeProgramDesign } from "../lib/theme"
import { Program } from "../types/program"

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync()

// Set global notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true
  })
})

// Helper function to handle registration errors
function handleRegistrationError(errorMessage: string) {
  // Consider using a more robust error handling mechanism than alert
  // For now, logging to console and throwing error as per example
  console.error("Push Notification Registration Error:", errorMessage)
  // alert(errorMessage); // Alert can be disruptive, prefer console logging
  // throw new Error(errorMessage); // Throwing might crash the app depending on context
}

// Function to register for push notifications
async function registerForPushNotificationsAsync() {
  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C" // Consider using theme color
    })
  }
  // Add permissions request logic if needed for iOS/web
  return undefined
}

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
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf")
  })
  const notificationListener = useRef<Notifications.EventSubscription>()
  const responseListener = useRef<Notifications.EventSubscription>()
  const [programLoaded, setProgramLoaded] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    if (error) throw error
  }, [error])

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        console.log("RootLayout: Initial session check:", !!initialSession)
        setSession(initialSession)
        setAuthLoading(false)
      })
      .catch((err) => {
        console.error("RootLayout: Error getting initial session:", err)
        setAuthLoading(false)
      })

    // Set up the listener
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      console.log(`RootLayout: Auth state changed: ${_event}`, !!currentSession)
      const currentSegments = segments
      const currentRoute = currentSegments.join("/")
      console.log(
        `RootLayout: Current route on auth change: ${currentRoute || "(root)"}`
      )

      if (_event === "SIGNED_IN" && currentRoute === "(tabs)/host/login") {
        console.log(
          "RootLayout: Redirecting from Login to Host Index on SIGNED_IN"
        )
        router.replace("/(tabs)/host" as Href)
      } else if (
        _event === "SIGNED_OUT" &&
        currentSegments[0] === "(tabs)" &&
        currentSegments[1] === "host" &&
        currentRoute !== "(tabs)/host/login"
      ) {
        console.log(
          "RootLayout: Redirecting from Host Area to Login on SIGNED_OUT"
        )
        router.replace("/(tabs)/host/login" as Href)
      }

      setSession(currentSession)
    })

    // Cleanup function
    return () => {
      subscription?.unsubscribe()
    }
  }, [router, segments])

  useEffect(() => {
    const fetchProgramData = async () => {
      try {
        const programId = 1
        const { data, error } = await supabase
          .from("programs")
          .select("*")
          .eq("id", programId)
          .maybeSingle()

        if (error) {
          console.error("Error fetching program data:", error)
          return
        }

        if (data) {
          await storeProgramDesign(data as Program)
          console.log("Program data stored successfully")
        }

        setProgramLoaded(true)
      } catch (error) {
        console.error("Error in fetchProgramData:", error)
        setProgramLoaded(true)
      }
    }

    fetchProgramData()
  }, [])

  useEffect(() => {
    if (loaded && programLoaded && !authLoading) {
      SplashScreen.hideAsync()

      registerForPushNotificationsAsync()
        .then((token) => {
          if (token) {
            console.log("Push token obtained:", token)
          }
        })
        .catch((error) =>
          console.error("Error during push notification registration:", error)
        )

      notificationListener.current =
        Notifications.addNotificationReceivedListener((notification) => {
          console.log("Notification Received:", notification)
        })

      responseListener.current =
        Notifications.addNotificationResponseReceivedListener((response) => {
          console.log("Notification Response Received:", response)
          const screen = response.notification.request.content.data?.screen
          if (screen) {
            console.log(`Navigating to screen: ${screen}`)
          }
        })

      return () => {
        notificationListener.current &&
          Notifications.removeNotificationSubscription(
            notificationListener.current
          )
        responseListener.current &&
          Notifications.removeNotificationSubscription(responseListener.current)
      }
    }
  }, [loaded, programLoaded, authLoading])

  if (!loaded || !programLoaded || authLoading) {
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
