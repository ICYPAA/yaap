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

// ADD THIS LOG HERE
SentryLogger.captureMessage("linking.tsx module loaded", "info")

// Determine environment
const isProduction = !__DEV__
console.log(
  `App running in ${isProduction ? "PRODUCTION" : "DEVELOPMENT"} mode`
)

// Create a reliable cross-platform alert function
const showAlert = (title: string, message: string) => {
  console.log(`ALERT: ${title} - ${message}`)
  SentryLogger.addBreadcrumb("alert", `${title}: ${message}`)

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
  SentryLogger.addBreadcrumb("deeplink", "URL event received", { url })

  if (url.includes("schedule_share=")) {
    console.log("🔴 URL event contains schedule_share")
    SentryLogger.addBreadcrumb(
      "schedule_share",
      "Detected schedule_share in URL",
      { url }
    )

    try {
      const matches = url.match(/schedule_share=(\d+)/)
      const sharedUserId = matches ? matches[1] : null
      console.log("🔴 Extracted shared ID:", sharedUserId)

      if (sharedUserId) {
        SentryLogger.addBreadcrumb("schedule_share", "Extracted user ID", {
          sharedUserId
        })

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
    SentryLogger.addBreadcrumb("deeplink", "getStateFromPath called", { path })

    // Extract schedule_share parameter if present
    SentryLogger.captureMessage(
      "getStateFromPath: Attempting to match schedule_share in path",
      "debug",
      { path }
    )

    const matches = path.match(/schedule_share=(\d+)/)
    if (matches) {
      const sharedUserId = matches[1]
      console.log("🔴 Found schedule_share in path:", sharedUserId)
      SentryLogger.addBreadcrumb(
        "schedule_share",
        "Found schedule_share in path",
        { sharedUserId }
      )
      SentryLogger.captureMessage(
        "getStateFromPath: schedule_share found in path",
        "info",
        { sharedUserId }
      )

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
      SentryLogger.captureMessage(
        "getStateFromPath: Returning custom state for profile tab",
        "debug"
      )
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

    SentryLogger.captureMessage(
      "getStateFromPath: schedule_share not found in path, using default handler",
      "debug",
      { path }
    )
    console.log("🔴 Using default path handling")
    // Default handling by React Navigation
    return navGetStateFromPath(path, config)
  },

  // Handle custom URL schemes for QR code scanning
  async getInitialURL() {
    console.log("🔴 Getting initial URL")
    SentryLogger.addBreadcrumb("deeplink", "getInitialURL called")
    try {
      const url = await Linking.getInitialURL()
      console.log("🔴 Initial URL:", url)
      SentryLogger.addBreadcrumb("deeplink", "Initial URL", { url })
      SentryLogger.captureMessage("getInitialURL: Received URL", "debug", {
        url: url || "null"
      })

      if (!url) {
        console.log("🔴 No initial URL found")
        return null
      }

      if (url.includes("schedule_share=")) {
        console.log("🔴 Initial URL contains schedule_share")
        SentryLogger.addBreadcrumb(
          "schedule_share",
          "Initial URL contains schedule_share",
          { url }
        )
        SentryLogger.captureMessage(
          "getInitialURL: schedule_share detected",
          "info",
          { url }
        )

        // Extract ID for Sentry context
        try {
          const matches = url.match(/schedule_share=(\d+)/)
          if (matches && matches[1]) {
            SentryLogger.addBreadcrumb(
              "schedule_share",
              "Extracted ID from initial URL",
              { sharedUserId: matches[1] }
            )
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
    SentryLogger.addBreadcrumb("deeplink", "subscribe called")

    const subscription = Linking.addEventListener("url", ({ url }) => {
      console.log("🔴 URL event in subscribe:", url)
      SentryLogger.addBreadcrumb("deeplink", "URL event in subscribe", { url })
      SentryLogger.captureMessage("subscribe: URL event received", "debug", {
        url
      })

      if (url.includes("schedule_share=")) {
        console.log("🔴 URL contains schedule_share")
        SentryLogger.addBreadcrumb(
          "schedule_share",
          "URL in subscribe contains schedule_share",
          { url }
        )
        SentryLogger.captureMessage(
          "subscribe: schedule_share detected in URL event",
          "info",
          { url }
        )
      }

      SentryLogger.captureMessage(
        "subscribe: Calling original listener",
        "debug",
        { url }
      )
      listener(url)
    })

    SentryLogger.captureMessage(
      "subscribe: Calling getInitialURL within subscribe",
      "debug"
    )
    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          console.log("🔴 Initial URL in subscribe:", url)
          SentryLogger.addBreadcrumb("deeplink", "Initial URL in subscribe", {
            url
          })
          SentryLogger.captureMessage(
            "subscribe: Initial URL found, calling listener",
            "debug",
            { url }
          )
          listener(url)
        } else {
          SentryLogger.captureMessage(
            "subscribe: No initial URL found",
            "debug"
          )
        }
      })
      .catch((error) => {
        console.error("🔴 Error getting initial URL:", error)
        SentryLogger.captureError(error, { context: "subscribe.getInitialURL" })
      })

    return () => {
      console.log("🔴 Removing URL subscription")
      SentryLogger.captureMessage("subscribe: Unsubscribing listener", "debug")
      subscription.remove()
    }
  }
}

// New function to process schedule share in background
async function processScheduleShare(deviceId: string, sharedUserId: string) {
  console.log("🔴 Processing schedule share:", { deviceId, sharedUserId })
  SentryLogger.addBreadcrumb("schedule_share", "Processing schedule share", {
    deviceId,
    sharedUserId
  })

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

    SentryLogger.addBreadcrumb("schedule_share", "Calling edge function", {
      requestData
    })
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
      SentryLogger.addBreadcrumb("schedule_share", "Share request successful")
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
        SentryLogger.addBreadcrumb(
          "schedule_share",
          "Notification sent successfully"
        )
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
