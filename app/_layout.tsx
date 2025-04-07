import { useFonts } from "expo-font"
import * as Notifications from "expo-notifications"
import { Stack } from "expo-router"
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
  return undefined // Return undefined in case of errors or not on device
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
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf")
  })
  const notificationListener = useRef<Notifications.EventSubscription>()
  const responseListener = useRef<Notifications.EventSubscription>()
  const [programLoaded, setProgramLoaded] = useState(false)

  // Fetch program data on app start
  useEffect(() => {
    const fetchProgramData = async () => {
      try {
        // Assume program ID 1 for now
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
          // Store program data in AsyncStorage
          await storeProgramDesign(data as Program)
          console.log("Program data stored successfully")
        }

        setProgramLoaded(true)
      } catch (error) {
        console.error("Error in fetchProgramData:", error)
        setProgramLoaded(true) // Set to true even on error to not block app loading
      }
    }

    fetchProgramData()
  }, [])

  useEffect(() => {
    if (loaded && programLoaded) {
      SplashScreen.hideAsync()

      // Register for push notifications after fonts are loaded
      registerForPushNotificationsAsync()
        .then((token) => {
          if (token) {
            // You might want to store the token in state/context or send it to your backend
            console.log("Push token obtained:", token)
          }
        })
        .catch((error) =>
          console.error("Error during push notification registration:", error)
        )

      // Listener for when a notification is received while the app is foregrounded
      notificationListener.current =
        Notifications.addNotificationReceivedListener((notification) => {
          console.log("Notification Received:", notification)
          // You could update app state or display an in-app message here
        })

      // Listener for when a user taps on or interacts with a notification
      // (works when app is foregrounded, backgrounded, or killed)
      responseListener.current =
        Notifications.addNotificationResponseReceivedListener((response) => {
          console.log("Notification Response Received:", response)
          const screen = response.notification.request.content.data?.screen
          if (screen) {
            // Navigate to the specified screen
            // Note: Ensure your navigation is ready before attempting to navigate
            // You might need to use Linking or Expo Router's imperative API
            console.log(`Navigating to screen: ${screen}`)
            // Example using expo-router (ensure router is available)
            // import { router } from 'expo-router';
            // router.push(`/${screen}`);
          }
        })

      // Cleanup listeners on component unmount
      return () => {
        notificationListener.current &&
          Notifications.removeNotificationSubscription(
            notificationListener.current
          )
        responseListener.current &&
          Notifications.removeNotificationSubscription(responseListener.current)
      }
    }
  }, [loaded, programLoaded]) // Rerun effect when both fonts and program are loaded

  // useNotifications() // Keep this commented out unless it's a custom hook you intend to use

  if (!loaded || !programLoaded) {
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
