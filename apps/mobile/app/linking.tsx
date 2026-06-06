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

const SCHEDULE_MANAGER_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
  ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/schedule_manager`
  : ""

// Create a reliable cross-platform alert function
const showAlert = (title: string, message: string) => {
  // On Android, also show a Toast for better visibility
  if (Platform.OS === "android") {
    ToastAndroid.show(`${title}: ${message}`, ToastAndroid.LONG)
  }

  // Use setTimeout to ensure UI is ready
  setTimeout(() => {
    Alert.alert(title, message, [{ text: "OK" }], { cancelable: false })
  }, 1500)
}

// Listen for URL events with robust handling
Linking.addEventListener("url", ({ url }) => {
  if (url.includes("schedule_share=")) {
    try {
      const matches = url.match(/schedule_share=(\d+)/)
      const sharedUserId = matches ? matches[1] : null

      if (sharedUserId) {
        AsyncStorage.getItem("device_id")
          .then((deviceId) => {
            if (deviceId) {
              // Set user for error attribution
              SentryLogger.setUser(deviceId)
              processScheduleShare(deviceId, sharedUserId)
            } else {
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

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
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
          program: "program",
          host: {
            screens: {
              index: "host"
            }
          }
        }
      },
      // Auth callback route for OAuth redirects
      "auth/callback": "(tabs)/host",
      // Handle old format for backward compatibility
      "schedule_share=:id": "(tabs)/profile"
    }
  },

  // Custom URL parsing to extract query parameters
  getStateFromPath: (path, config) => {
    // Extract schedule_share parameter if present
    const matches = path.match(/schedule_share=(\d+)/)
    if (matches) {
      const sharedUserId = matches[1]

      // Process the share in background (without navigating)
      AsyncStorage.getItem("device_id")
        .then((deviceId) => {
          if (deviceId) {
            SentryLogger.setUser(deviceId)
            processScheduleShare(deviceId, sharedUserId)
          } else {
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

    // Default handling by React Navigation
    return navGetStateFromPath(path, config)
  },

  // Handle custom URL schemes for QR code scanning
  async getInitialURL() {
    try {
      const url = await Linking.getInitialURL()

      if (!url) {
        return null
      }

      if (url.includes("schedule_share=")) {
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
    const subscription = Linking.addEventListener("url", ({ url }) => {
      listener(url)
    })

    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          listener(url)
        }
      })
      .catch((error) => {
        console.error("🔴 Error getting initial URL:", error)
        SentryLogger.captureError(error, {
          context: "subscribe.getInitialURL"
        })
      })

    return () => {
      subscription.remove()
    }
  }
}

// New function to process schedule share in background
async function processScheduleShare(deviceId: string, sharedUserId: string) {
  try {
    // Get current user from Supabase
    const supabaseWithDeviceId = await withDeviceId(supabase)

    const { data: userData, error: userError } = await supabaseWithDeviceId
      .from("users")
      .select("id, first_name, last_initial")
      .eq("device_id", deviceId)
      .single()

    if (userError || !userData) {
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

    const {
      data: { session }
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      showAlert(
        "Sign In Required",
        "Please sign in before requesting schedule access."
      )
      return
    }

    if (!SCHEDULE_MANAGER_URL) {
      showAlert(
        "Schedule Sharing Unavailable",
        "Schedule sharing is not configured for this app build."
      )
      return
    }

    const response = await fetch(SCHEDULE_MANAGER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        // Add explicit cache control
        "Cache-Control": "no-cache"
      },
      body: JSON.stringify(requestData),
      // Ensure credentials are included
      credentials: "include"
    })

    // Log response details for debugging
    const responseText = await response.text()
    const responseDetails = {
      status: response.status,
      statusText: response.statusText,
      body: responseText.substring(0, 100) // Log first 100 chars
    }

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
      showAlert(
        "Schedule Shared",
        "Your schedule sharing request has been sent successfully."
      )

      // Send notification through the edge function
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
  try {
    // Check if the current user has a profile
    const deviceId = await AsyncStorage.getItem("device_id")
    if (!deviceId) {
      // No device ID, redirect to profile creation
      router.navigate("/(tabs)/profile")
      return
    }

    return processScheduleShare(deviceId, sharedUserId)
  } catch (error) {
    console.error("Error in handleScheduleShare:", error)
  }
}

export default linking
