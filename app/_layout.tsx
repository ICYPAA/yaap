import SentryLogger from "@/lib/sentryLogging"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Session } from "@supabase/supabase-js"
import * as Application from "expo-application"
import { useFonts } from "expo-font"
import * as Linking from "expo-linking"
import * as Notifications from "expo-notifications"
import { Href, Stack, useRouter, useSegments } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { StatusBar } from "expo-status-bar"
import React, { useEffect, useRef, useState } from "react"
import { AppState, Platform } from "react-native"
import "react-native-reanimated"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { DebugProvider } from "../context/DebugContext"
import { ThemeProvider, useTheme } from "../context/ThemeContext"
import { supabase, withDeviceId } from "../lib/supabase"
import { storeProgramDesign } from "../lib/theme"
import { Program } from "../types/program"
import linking from "./linking"

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
  let token
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C" // Consider using theme color
    })
  }

  try {
    token = (
      await Notifications.getExpoPushTokenAsync({
        projectId: "15c03e66-5f31-409b-b31a-b53b92e00fb1"
      })
    ).data
    console.log("Expo push token:", token)
    return token
  } catch (error) {
    console.error("Error getting push token:", error)
    alert(`Failed to get push token: ${JSON.stringify(error)}`)
    return null
  }
}

function RootLayoutNav() {
  const { theme, isDarkMode } = useTheme()

  // Log that we are attempting to use the linking config again
  SentryLogger.captureMessage(
    "RootLayoutNav: Attempting to pass linking config to Stack",
    "debug",
    {
      hasLinkingConfig: !!linking,
      configKeys: linking ? Object.keys(linking) : null
    }
  )

  return (
    <SafeAreaProvider>
      <StatusBar style={isDarkMode ? "light" : "dark"} />
      <Stack
        linking={linking}
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
  const appState = useRef(AppState.currentState)
  const schedulePollingInterval = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (error) throw error
  }, [error])

  // Function to get device identifier based on platform
  const getIdentifier = async () => {
    if (Platform.OS === "ios") {
      let idfv = await Application.getIosIdForVendorAsync()
      //console.log("iOS IDFV:", idfv)
      return idfv
    }
    if (Platform.OS === "android") {
      let androidId = Application.getAndroidId()
      // console.log("Android ID:", androidId)
      return androidId
    }
    return null
  }

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
      const currentSegments = segments as string[]
      const currentRoute =
        currentSegments.length > 0 ? currentSegments.join("/") : ""
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

  Notifications.requestPermissionsAsync()

  useEffect(() => {
    const fetchProgramData = async () => {
      try {
        const programId = 1
        const supabaseWithDeviceId = await withDeviceId()
        const { data, error } = await supabaseWithDeviceId
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

      // Get device ID and update push token in user profile
      const updatePushToken = async () => {
        try {
          const deviceId = await getIdentifier()
          if (!deviceId) {
            console.error("Could not get a device identifier")
            return
          }

          const token = await registerForPushNotificationsAsync()
          if (token) {
            console.log("Push token obtained:", token)

            // Check if a user profile exists for this device
            const supabaseWithDeviceId = await withDeviceId()
            const { data: userData, error: userError } =
              await supabaseWithDeviceId
                .from("users")
                .select("id")
                .eq("device_id", deviceId)
                .maybeSingle()

            if (userError && userError.code !== "PGRST116") {
              console.error("Error checking for user profile:", userError)
              return
            }

            // If user exists, update their push token
            if (userData) {
              const supabaseWithDeviceId = await withDeviceId()
              const { error: updateError } = await supabaseWithDeviceId
                .from("users")
                .update({ expo_push_token: token })
                .eq("device_id", deviceId)

              if (updateError) {
                console.error("Error updating push token:", updateError)
              } else {
                console.log("Push token updated in user profile")
              }
            } else {
              console.log(
                "No user profile found for this device. Token will be saved when profile is created."
              )
            }
          }
        } catch (error) {
          console.error("Error updating push token:", error)
        }
      }

      updatePushToken()

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

  // Log initial segments
  useEffect(() => {
    SentryLogger.captureMessage("RootLayout: Initial segments", "debug", {
      segments
    })
  }, []) // Log only on initial mount

  // Initialize URL handler
  useEffect(() => {
    // Setup deep linking handling
    const initializeUrlHandler = async () => {
      // Log initial URL here as well for confirmation
      try {
        const initialUrl = await Linking.getInitialURL()
        SentryLogger.captureMessage(
          "RootLayout: initializeUrlHandler initial URL",
          "debug",
          { initialUrl: initialUrl || "null" }
        )
        if (initialUrl) {
          console.log("App opened with URL:", initialUrl)
          // Process the URL (our linking.tsx SHOULD handle this now)
        } else {
          console.log("App opened without an initial URL")
        }
      } catch (error) {
        SentryLogger.captureError(error, {
          context: "RootLayout.initializeUrlHandler.getInitialURL"
        })
        console.error("Error getting initial URL in RootLayout:", error)
      }

      // Add event listener for URL changes when app is open
      const subscription = Linking.addEventListener("url", (event) => {
        console.log("Received URL event:", event.url)
        // Process the URL (our linking.tsx will handle this)
      })

      return () => {
        subscription.remove()
      }
    }

    initializeUrlHandler()
  }, [])

  // Function to fetch user schedule and store it in AsyncStorage
  const fetchAndStoreUserSchedule = async () => {
    try {
      const deviceId = await getIdentifier()
      if (!deviceId) {
        console.error("Could not get a device identifier")
        return
      }

      const supabaseWithDeviceId = await withDeviceId()
      const { data, error } = await supabaseWithDeviceId
        .from("users")
        .select("schedule")
        .eq("device_id", deviceId)
        .maybeSingle()

      if (error) {
        console.error("Error fetching user schedule:", error)
        return
      }

      // Get shared saved events from users who are sharing their schedule with this user
      const { data: sharedEventsData, error: sharedEventsError } =
        await supabaseWithDeviceId.rpc("get_shared_saved_events", {
          p_device_id: deviceId
        })
      // console.log("Shared events data:", sharedEventsData)

      if (sharedEventsError) {
        console.error("Error fetching shared events:", sharedEventsError)
      } else if (sharedEventsData) {
        // Store shared events separately
        // console.log("Storing shared events in AsyncStorage")
        await AsyncStorage.setItem(
          "sharedEvents",
          JSON.stringify(sharedEventsData)
        )
      }

      if (data && data.schedule) {
        // Store user's own schedule
        // console.log("Storing user schedule in AsyncStorage")
        await AsyncStorage.setItem(
          "userSchedule",
          JSON.stringify(data.schedule)
        )
      }
    } catch (error) {
      console.error("Error in fetchAndStoreUserSchedule:", error)
    }
  }

  // Setup schedule polling
  useEffect(() => {
    // Initial fetch
    if (loaded && programLoaded && !authLoading) {
      fetchAndStoreUserSchedule()
    }

    // Setup AppState listener to handle app going to background/foreground
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        console.log("App has come to the foreground, fetching schedule")
        fetchAndStoreUserSchedule()
      }

      appState.current = nextAppState
    })

    // Start polling when component mounts
    if (loaded && programLoaded && !authLoading) {
      schedulePollingInterval.current = setInterval(() => {
        if (appState.current === "active") {
          // console.log("Polling user schedule")
          fetchAndStoreUserSchedule()
        }
      }, 5000) // Poll every 5 seconds
    }

    // Cleanup function
    return () => {
      subscription.remove()
      if (schedulePollingInterval.current) {
        clearInterval(schedulePollingInterval.current)
        schedulePollingInterval.current = null
      }
    }
  }, [loaded, programLoaded, authLoading])

  useEffect(() => {
    SentryLogger.init()
    SentryLogger.captureMessage("App loaded", "info")
    SentryLogger.captureError(error, { context: "RootLayout", error })
  }, [])

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
