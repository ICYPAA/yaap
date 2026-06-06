import SentryLogger from "@/lib/sentryLogging"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Session } from "@supabase/supabase-js"
import { useFonts } from "expo-font"
import * as Linking from "expo-linking"
import * as Notifications from "expo-notifications"
import { Stack, useRouter, useSegments } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { StatusBar } from "expo-status-bar"
import * as Updates from "expo-updates"
import React, { useEffect, useRef, useState } from "react"
import { AppState, Platform } from "react-native"
import "react-native-reanimated"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { SafetyModal, useSafetyModal } from "../components/SafetyModal"
import { TutorialModal } from "../components/TutorialModal"
import { DebugProvider } from "../context/DebugContext"
import { FeatureProvider } from "../context/FeatureContext"
import { I18nProvider } from "../context/I18nContext"
import { RoleProvider } from "../context/RoleContext"
import { ThemeProvider, useTheme } from "../context/ThemeContext"
import { getOrCreateDeviceId } from "../lib/security/deviceId"
import { checkAppIntegrity } from "../lib/security/integrity"
import { getSessionManager } from "../lib/security/session"
import { supabase, withDeviceId } from "../lib/supabase"
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
  let token
  if (Platform.OS === "android") {
    try {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C" // Consider using theme color
      })
    } catch (channelError) {
      console.error(
        "Error setting up Android notification channel:",
        channelError
      )
      // Continue execution even if channel setup fails
    }
  }

  try {
    // Check if we have permissions first
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== "granted") {
      console.log("Push notification permissions not granted")
      // Don't show alert - just log
      return null
    }

    token = (
      await Notifications.getExpoPushTokenAsync({
        projectId: "15c03e66-5f31-409b-b31a-b53b92e00fb1"
      })
    ).data
    return token
  } catch (error) {
    console.error("Error getting push token:", error)
    // Don't show alert for emulator/simulator - just log the error
    // Emulators don't support push tokens and that's okay
    if (__DEV__) {
      console.log("Push tokens may not be supported on emulators/simulators")
    }
    return null
  }
}

function RootLayoutNav() {
  const { theme, isDarkMode } = useTheme()
  const { shouldShow: shouldShowSafety, markAsViewed: markSafetyAsViewed } =
    useSafetyModal()
  const [tutorialClosed, setTutorialClosed] = useState(false)
  const [showSafetyModal, setShowSafetyModal] = useState(false)

  // Show safety modal after tutorial is closed (if needed)
  useEffect(() => {
    if (tutorialClosed && shouldShowSafety) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setShowSafetyModal(true)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [tutorialClosed, shouldShowSafety])

  const handleTutorialClose = () => {
    setTutorialClosed(true)
  }

  const handleSafetyClose = () => {
    setShowSafetyModal(false)
    markSafetyAsViewed()
  }

  return (
    <>
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

      {/* Tutorial Modal - shows first on first app open */}
      <TutorialModal onClose={handleTutorialClose} />

      {/* Safety Modal - shows after tutorial on first app open */}
      <SafetyModal
        visible={showSafetyModal}
        onClose={handleSafetyClose}
        isInitialView={true}
      />
    </>
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

  // Function to get device identifier - now uses secure device ID
  const getIdentifier = async () => {
    return await getOrCreateDeviceId()
  }

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
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
      // Just update the session state, let individual layouts handle their own navigation
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
        const programId = 3
        const supabaseWithDeviceId = await withDeviceId()
        const { data, error } = await supabaseWithDeviceId
          .from("programs")
          .select("*")
          .eq("id", programId)
          .maybeSingle()

        if (error) {
          console.error("Error fetching program data:", error)
          setProgramLoaded(true)
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
    if (loaded && programLoaded) {
      // Initialize security features
      const initSecurity = async () => {
        const sessionManager = getSessionManager()
        await sessionManager.initialize()

        // Check app integrity (non-blocking)
        checkAppIntegrity().then((result) => {
          if (!result.isValid && result.riskLevel === "high") {
            console.warn("App integrity check failed:", result.issues)
          }
        })
      }

      initSecurity()

      // Check for OTA updates
      const checkForUpdates = async () => {
        try {
          if (!__DEV__) {
            const update = await Updates.checkForUpdateAsync()
            if (update.isAvailable) {
              console.log("OTA update available, downloading...")
              await Updates.fetchUpdateAsync()
              console.log("OTA update downloaded, reloading app...")
              await Updates.reloadAsync()
            } else {
              console.log("No OTA updates available")
            }
          }
        } catch (error) {
          console.error("Error checking for OTA updates:", error)
        }
      }

      checkForUpdates()
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
              }
            }
          } catch (error) {
          console.error("Error updating push token:", error)
        }
      }

      updatePushToken()

      notificationListener.current =
        Notifications.addNotificationReceivedListener((notification) => {
          SentryLogger.addBreadcrumb("notification", "Push notification received")
        })

      responseListener.current =
        Notifications.addNotificationResponseReceivedListener((response) => {
          const screen = response.notification.request.content.data?.screen
          if (screen) {
            SentryLogger.addBreadcrumb("notification", "Push notification opened")
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
  }, [loaded, programLoaded])

  // Initialize URL handler
  useEffect(() => {
    // Setup deep linking handling
    const initializeUrlHandler = async () => {
      // Log initial URL here as well for confirmation
      try {
        const initialUrl = await Linking.getInitialURL()
        if (initialUrl) {
          // Process the URL (our linking.tsx SHOULD handle this now)
        }
      } catch (error) {
        SentryLogger.captureError(error, {
          context: "RootLayout.initializeUrlHandler.getInitialURL"
        })
        console.error("Error getting initial URL in RootLayout:", error)
      }

      // Add event listener for URL changes when app is open
      const subscription = Linking.addEventListener("url", (event) => {
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
    if (!loaded || !programLoaded) return

    // Initial fetch
    fetchAndStoreUserSchedule()

    // Setup AppState listener to handle app going to background/foreground
    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === "active"
        ) {
          console.log("App has come to the foreground, fetching schedule")
          fetchAndStoreUserSchedule()

          // Check for OTA updates when app becomes active
          if (!__DEV__) {
            try {
              const update = await Updates.checkForUpdateAsync()
              if (update.isAvailable) {
                console.log(
                  "OTA update available on app resume, downloading..."
                )
                await Updates.fetchUpdateAsync()
                console.log("OTA update downloaded, reloading app...")
                await Updates.reloadAsync()
              }
            } catch (error) {
              console.error("Error checking for OTA updates on resume:", error)
            }
          }
        }

        appState.current = nextAppState
      }
    )

    // Start polling when component mounts
    schedulePollingInterval.current = setInterval(() => {
      if (appState.current === "active") {
        // console.log("Polling user schedule")
        fetchAndStoreUserSchedule()
      }
    }, 5000) // Poll every 5 seconds

    // Cleanup function
    return () => {
      subscription.remove()
      if (schedulePollingInterval.current) {
        clearInterval(schedulePollingInterval.current)
        schedulePollingInterval.current = null
      }
    }
  }, [loaded, programLoaded])

  useEffect(() => {
    SentryLogger.init()
    // Info message removed - not needed in production
    console.log("App loaded")
  }, [])

  if (!loaded || !programLoaded) {
    return null
  }

  return (
    <I18nProvider>
      <ThemeProvider>
        <DebugProvider>
          <FeatureProvider>
            <RoleProvider>
              <RootLayoutNav />
            </RoleProvider>
          </FeatureProvider>
        </DebugProvider>
      </ThemeProvider>
    </I18nProvider>
  )
}
