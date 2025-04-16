import AsyncStorage from "@react-native-async-storage/async-storage"
import {
  LinkingOptions,
  getStateFromPath as navGetStateFromPath
} from "@react-navigation/native"
import * as Linking from "expo-linking"
import { router } from "expo-router"
import { sendNotification } from "../lib/notificationHelper"
import { supabase, withDeviceId } from "../lib/supabase"

// Listen for URL events but don't try to navigate (navigation handled by deep linking)
Linking.addEventListener("url", ({ url }) => {
  console.log("Global URL event listener received:", url)
  if (url.includes("schedule_share=")) {
    console.log("Global handler detected schedule_share URL:", url)
    // Extract ID and process the share in background
    try {
      const matches = url.match(/schedule_share=(\d+)/)
      const sharedUserId = matches ? matches[1] : null
      console.log("Extracted ID in global handler:", sharedUserId)

      if (sharedUserId) {
        // Only process the share request in background
        AsyncStorage.getItem("device_id").then((deviceId) => {
          if (deviceId) {
            processScheduleShare(deviceId, sharedUserId)
          }
        })
      }
    } catch (error) {
      console.error("Error in global URL handler:", error)
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
    console.log("getStateFromPath called with:", path)

    // Extract schedule_share parameter if present
    const matches = path.match(/schedule_share=(\d+)/)
    if (matches) {
      const sharedUserId = matches[1]
      console.log("Extracted schedule_share parameter:", sharedUserId)

      // Process the share in background (without navigating)
      AsyncStorage.getItem("device_id").then((deviceId) => {
        if (deviceId) {
          processScheduleShare(deviceId, sharedUserId)
        }
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
    // Get the URL from Expo Linking
    const url = await Linking.getInitialURL()
    console.log("Linking.getInitialURL returned:", url)

    if (!url) return null

    // Pass the URL through - let getStateFromPath handle it
    return url
  },

  subscribe(listener: (url: string) => void) {
    console.log("Setting up URL event listener in subscribe")
    // Listen for incoming links
    const subscription = Linking.addEventListener("url", ({ url }) => {
      console.log("URL event received in subscribe:", url)
      // Always pass URL to listener for normal processing
      listener(url)
    })

    // Check for initial URL
    Linking.getInitialURL()
      .then((url) => {
        console.log("getInitialURL in subscribe returned:", url)
        if (url) {
          console.log("Calling listener with initial URL:", url)
          listener(url)
        }
      })
      .catch((error) => {
        console.error("Error getting initial URL in subscribe:", error)
      })

    return () => {
      console.log("Removing URL event subscription")
      subscription.remove()
    }
  }
}

// New function to process schedule share in background
async function processScheduleShare(deviceId: string, sharedUserId: string) {
  console.log("Processing schedule share in background:", {
    deviceId,
    sharedUserId
  })
  try {
    // Get current user from Supabase
    const supabaseWithDeviceId = await withDeviceId(supabase)
    const { data: userData, error: userError } = await supabaseWithDeviceId
      .from("users")
      .select("id, first_name, last_initial")
      .eq("device_id", deviceId)
      .single()

    console.log(
      "User data in processScheduleShare:",
      userData,
      "Error:",
      userError
    )

    if (userError || !userData) {
      console.log("No user profile found in processScheduleShare")
      return
    }

    // Make request to edge function to update sharing
    console.log("Calling edge function with data:", {
      requester: userData.id,
      receiver: parseInt(sharedUserId)
    })

    const response = await fetch(
      "https://oolqeopfhhiuvsmamxln.supabase.co/functions/v1/schedule_manager",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            "Basic " + btoa(`yaap:${process.env.EDGE_PASSWORD ?? "hacypaa9"}`)
        },
        body: JSON.stringify({
          requester: userData.id,
          receiver: parseInt(sharedUserId)
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Error calling schedule_manager function:", errorText)
    } else {
      // Show success message or notification
      console.log("Sharing request sent successfully")

      // Send notification through the edge function
      console.log("Sending schedule notification")
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
        console.log("Sent schedule request notification successfully")
      } catch (error) {
        console.error("Error sending notification:", error)
      }
    }
  } catch (error) {
    console.error("Error processing schedule share:", error)
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
