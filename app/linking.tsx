import AsyncStorage from "@react-native-async-storage/async-storage"
import {
  LinkingOptions,
  getStateFromPath as navGetStateFromPath
} from "@react-navigation/native"
import * as Linking from "expo-linking"
import { router } from "expo-router"
import { Alert, Platform, ToastAndroid } from "react-native"
import { sendNotification } from "../lib/notificationHelper"
import SentryLogger from "../lib/sentryLogging"
import { supabase, withDeviceId } from "../lib/supabase"

// Initialize Sentry
SentryLogger.init()

// Determine environment
const isProduction = !__DEV__
console.log(
  `App running in ${isProduction ? "PRODUCTION" : "DEVELOPMENT"} mode`
)

// Create a reliable cross-platform alert function
const showAlert = (title: string, message: string) => {
  console.log(`ALERT: ${title} - ${message}`)

  // On Android, also show a Toast for better visibility
  if (Platform.OS === "android") {
    ToastAndroid.show(`${title}: ${message}`, ToastAndroid.LONG)
  }

  // Use setTimeout to ensure UI is ready
  setTimeout(() => {
    Alert.alert(title, message, [{ text: "OK" }], { cancelable: false })
  }, 1500)
}

// Debug initial URL with environment info
console.log("LINKING DEBUG: Initializing linking module")
// Log environment information where available
console.log("App environment:", isProduction ? "Production" : "Development")

// Listen for URL events with robust handling
Linking.addEventListener("url", ({ url }) => {
  console.log("🔴 URL event received:", url)

  if (url.includes("schedule_share=")) {
    console.log("🔴 URL event contains schedule_share")
    // Debug breadcrumb removed - routine operation

    try {
      const matches = url.match(/schedule_share=(\d+)/)
      const sharedUserId = matches ? matches[1] : null
      console.log("🔴 Extracted shared ID:", sharedUserId)

      if (sharedUserId) {
        // Debug breadcrumb removed - routine operation

        AsyncStorage.getItem("device_id")
          .then((deviceId) => {
            if (deviceId) {
              console.log("🔴 Found device ID:", deviceId)
              // Set user for error attribution
              SentryLogger.setUser(deviceId)
              processScheduleShare(deviceId, sharedUserId)
            } else {
              console.log("🔴 No device ID found")
              SentryLogger.captureMessage(
                "No device ID found when processing schedule share",
                "warning"
              )
              showAlert("Profile Required", "Please create a profile first.")
            }
          })
          .catch((err) => {
            console.error("🔴 AsyncStorage error:", err)
            SentryLogger.captureError(err, {
              context: "AsyncStorage.getItem",
              feature: "schedule_share"
            })
            showAlert(
              "Error",
              "Could not access your profile. Please try again."
            )
          })
      }
    } catch (error) {
      console.error("🔴 Error in URL handler:", error)
      SentryLogger.captureError(error, { context: "URL handler", url })
      showAlert("Error", "Failed to process the link.")
    }
  }
})

const prefix = Linking.createURL("/")
console.log("Linking setup with prefix:", prefix)

const linking: LinkingOptions<{}> = {
  prefixes: [prefix, "yaap://"],
  config: {
    screens: {
      "(tabs)": {
        screens: {
          profile: {
            path: "profile",
            screens: {},
            parse: {
              // Extract schedule_share from query params with correct typing
              schedule_share: (schedule_share: string | undefined) =>
                schedule_share
            }
          },
          program: "program"
        }
      },
      // Handle old format for backward compatibility
      "schedule_share=:id": "(tabs)/profile"
    }
  },

  // Custom URL parsing to extract query parameters
  getStateFromPath: (path, config) => {
    console.log("🔴 Parsing path:", path)
    // Debug breadcrumb removed - routine operation

    // Extract schedule_share parameter if present
    console.log("getStateFromPath: Attempting to match schedule_share in path")

    const matches = path.match(/schedule_share=(\d+)/)
    if (matches) {
      const sharedUserId = matches[1]
      console.log("🔴 Found schedule_share in path:", sharedUserId)
      // Debug breadcrumb removed - routine operation
      console.log("getStateFromPath: schedule_share found in path")

      // Process the share in background (without navigating)
      AsyncStorage.getItem("device_id")
        .then((deviceId) => {
          if (deviceId) {
            console.log("🔴 Processing with deviceId:", deviceId)
            SentryLogger.setUser(deviceId)
            processScheduleShare(deviceId, sharedUserId)
          } else {
            console.log("🔴 No device ID found")
            SentryLogger.captureMessage(
              "No device ID found in getStateFromPath",
              "warning"
            )
            showAlert("Profile Required", "Please create a profile first.")
          }
        })
        .catch((err) => {
          console.error("🔴 AsyncStorage error:", err)
          SentryLogger.captureError(err, {
            context: "getStateFromPath",
            feature: "schedule_share"
          })
          showAlert("Error", "Could not access your profile info.")
        })

      // Direct to profile tab through deep linking system
      console.log("getStateFromPath: Returning custom state for profile tab")
      return {
        routes: [
          {
            name: "(tabs)",
            state: {
              routes: [
                {
                  name: "profile"
                }
              ]
            }
          }
        ]
      }
    }

    console.log("getStateFromPath: schedule_share not found in path, using default handler")
    console.log("🔴 Using default path handling")
    // Default handling by React Navigation
    return navGetStateFromPath(path, config)
  },

  // Handle custom URL schemes for QR code scanning
  async getInitialURL() {
    console.log("🔴 Getting initial URL")
    // Debug breadcrumb removed - routine operation
    try {
      const url = await Linking.getInitialURL()
      console.log("🔴 Initial URL:", url)
      // Debug breadcrumb removed - routine operation
      // Only log to console in development, not to Sentry
      console.log("getInitialURL: Received URL", {
        url: url || "null"
      })

      if (!url) {
        console.log("🔴 No initial URL found")
        return null
      }

      if (url.includes("schedule_share=")) {
        console.log("🔴 Initial URL contains schedule_share")
        // Debug breadcrumb removed - routine operation
        console.log("getInitialURL: schedule_share detected")

        // Extract ID for Sentry context
        try {
          const matches = url.match(/schedule_share=(\d+)/)
          if (matches && matches[1]) {
            // Debug breadcrumb removed - routine operation
          }
        } catch (e) {
          SentryLogger.captureError(e, {
            context: "getInitialURL",
            feature: "schedule_share"
          })
        }
      }

      return url
    } catch (error) {
      console.error("🔴 Error in getInitialURL:", error)
      SentryLogger.captureError(error, { context: "getInitialURL" })
      return null
    }
  },

  subscribe(listener: (url: string) => void) {
    console.log("🔴 Setting up URL subscription")
    // Debug breadcrumb removed - routine operation

    const subscription = Linking.addEventListener("url", ({ url }) => {
      console.log("🔴 URL event in subscribe:", url)
      // Debug breadcrumb removed - routine operation
      // Only log to console in development, not to Sentry
      console.log("subscribe: URL event received", {
        url
      })

      if (url.includes("schedule_share=")) {
        console.log("🔴 URL contains schedule_share")
        // Debug breadcrumb removed - routine operation
        console.log("subscribe: schedule_share detected in URL event")
      }

      console.log("subscribe: Calling original listener")
      listener(url)
    })

    console.log("subscribe: Calling getInitialURL within subscribe")
    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          console.log("🔴 Initial URL in subscribe:", url)
          // Debug breadcrumb removed - routine operation
          console.log("subscribe: Initial URL found, calling listener")
          listener(url)
        } else {
          console.log("subscribe: No initial URL found")
        }
      })
      .catch((error) => {
        console.error("🔴 Error getting initial URL:", error)
        SentryLogger.captureError(error, { context: "subscribe.getInitialURL" })
      })

    return () => {
      console.log("🔴 Removing URL subscription")
      // Only log to console in development, not to Sentry
      console.log("subscribe: Unsubscribing listener")
      subscription.remove()
    }
  }
}

// New function to process schedule share in background
async function processScheduleShare(deviceId: string, sharedUserId: string) {
  console.log("🔴 Processing schedule share:", { deviceId, sharedUserId })
  // Debug breadcrumb removed - routine operation

  try {
    // Get current user from Supabase
    const supabaseWithDeviceId = await withDeviceId(supabase)
    console.log("🔴 Supabase client initialized")

    const { data: userData, error: userError } = await supabaseWithDeviceId
      .from("users")
      .select("id, first_name, last_initial")
      .eq("device_id", deviceId)
      .single()

    console.log(
      "🔴 User query result:",
      userData ? "found" : "not found",
      userError ? `Error: ${userError.message}` : "No error"
    )

    if (userError || !userData) {
      console.log("🔴 No user profile found")
      SentryLogger.captureMessage(
        "User profile not found when processing schedule share",
        "warning",
        { deviceId }
      )
      showAlert("Profile Required", "Please create a profile first.")
      return
    }

    // Make request to edge function to update sharing
    const requestData = {
      requester: userData.id,
      receiver: parseInt(sharedUserId)
    }

    // Debug breadcrumb removed - routine operation
    console.log("🔴 Calling edge function with:", JSON.stringify(requestData))

    // Include explicit timeout and credentials
    const password = process.env.EDGE_PASSWORD || "hacypaa9"
    console.log("🔴 Using auth password length:", password.length)

    const response = await fetch(
      "https://oolqeopfhhiuvsmamxln.supabase.co/functions/v1/schedule_manager",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Basic " + btoa(`yaap:${password}`),
          // Add explicit cache control
          "Cache-Control": "no-cache"
        },
        body: JSON.stringify(requestData),
        // Ensure credentials are included
        credentials: "include"
      }
    )

    // Log response details for debugging
    const responseText = await response.text()
    const responseDetails = {
      status: response.status,
      statusText: response.statusText,
      body: responseText.substring(0, 100) // Log first 100 chars
    }

    console.log("🔴 Edge function response:", responseDetails)
    SentryLogger.addBreadcrumb(
      "schedule_share",
      "Edge function responded",
      responseDetails
    )

    if (!response.ok) {
      console.error("🔴 Edge function error:", responseText)
      SentryLogger.captureMessage("Edge function error", "error", {
        response: responseDetails,
        request: requestData
      })
      showAlert(
        "Schedule Sharing Failed",
        "We couldn't send your request. Please try again."
      )
    } else {
      console.log("🔴 Schedule share successful")
      // Debug breadcrumb removed - routine operation
      showAlert(
        "Schedule Shared",
        "Your schedule sharing request has been sent successfully."
      )

      // Send notification through the edge function
      console.log("🔴 Sending notification")
      try {
        await sendNotification({
          eventType: "schedule",
          programId: 1,
          userId: parseInt(sharedUserId),
          data: {
            status: "requested",
            user: {
              first_name: userData.first_name,
              last_initial: userData.last_initial
            }
          }
        })
        console.log("🔴 Notification sent successfully")
        // Debug breadcrumb removed - routine operation
      } catch (error) {
        console.error("🔴 Notification error:", error)
        SentryLogger.captureError(error, {
          context: "notification",
          feature: "schedule_share"
        })
        showAlert(
          "Notification Issue",
          "Your request was sent, but we couldn't notify the recipient."
        )
      }
    }
  } catch (error) {
    console.error("🔴 processScheduleShare error:", error)
    SentryLogger.captureError(error, {
      context: "processScheduleShare",
      deviceId,
      sharedUserId
    })
    showAlert(
      "Schedule Sharing Error",
      "There was a problem processing your request."
    )
  }
}

// Shared handler for schedule share URLs (kept for backward compatibility)
async function handleScheduleShare(sharedUserId: string) {
  console.log("handleScheduleShare called with ID:", sharedUserId)
  try {
    // Check if the current user has a profile
    const deviceId = await AsyncStorage.getItem("device_id")
    console.log("Device ID in handleScheduleShare:", deviceId)
    if (!deviceId) {
      // No device ID, redirect to profile creation
      console.log("No device ID in handleScheduleShare, redirecting to profile")
      router.navigate("/(tabs)/profile")
      return
    }

    return processScheduleShare(deviceId, sharedUserId)
  } catch (error) {
    console.error("Error in handleScheduleShare:", error)
  }
}

export default linking
