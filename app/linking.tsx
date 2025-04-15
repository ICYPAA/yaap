import AsyncStorage from "@react-native-async-storage/async-storage"
import { LinkingOptions } from "@react-navigation/native"
import * as Linking from "expo-linking"
import { router } from "expo-router"
import { sendNotification } from "../lib/notificationHelper"
import { supabase, withDeviceId } from "../lib/supabase"

// Immediately set up direct URL handler to ensure events are caught
Linking.addEventListener("url", ({ url }) => {
  console.log("Global URL event listener received:", url)
  if (url.includes("schedule_share=")) {
    console.log("Global handler detected schedule_share URL:", url)
    // Extract ID and immediately navigate to avoid page not found
    try {
      const sharedUserId = url.split("schedule_share=")[1].split("&")[0]
      console.log("Extracted ID in global handler:", sharedUserId)

      // Force redirect to program index page with absolute path
      setTimeout(() => {
        router.navigate("/(tabs)/program")
      }, 100)

      // Process the share in background
      AsyncStorage.getItem("device_id").then((deviceId) => {
        if (deviceId) {
          processScheduleShare(deviceId, sharedUserId)
        }
      })
    } catch (error) {
      console.error("Error in global URL handler:", error)
      setTimeout(() => {
        router.navigate("/(tabs)/program")
      }, 100)
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
          profile: "profile",
          program: {
            initialRouteName: "index",
            screens: {
              index: "program",
              schedule_share: "schedule_share=:id"
            }
          },
          // Add route for the root path to capture the yaap:// schema
          index: {
            initialRouteName: "program",
            screens: {
              schedule_share: "schedule_share=:id"
            }
          }
        }
      },
      // Add a direct path for schedule_share at the root level too
      schedule_share: "schedule_share=:id",
      // Add fallback for path mapping
      program: "program"
    }
  },

  // Handle custom URL schemes for QR code scanning
  async getInitialURL() {
    // Get the URL from Expo Linking
    const url = await Linking.getInitialURL()
    console.log("Linking.getInitialURL returned:", url)

    if (!url) return null

    // Check if this is a schedule share URL
    if (url.includes("schedule_share=")) {
      console.log("Detected schedule_share URL in getInitialURL:", url)
      try {
        // Extract user ID from URL
        const sharedUserId = url.split("schedule_share=")[1].split("&")[0]
        console.log("Extracted sharedUserId:", sharedUserId)

        if (!sharedUserId) return url

        // Check if the current user has a profile
        const deviceId = await AsyncStorage.getItem("device_id")
        console.log("Device ID from AsyncStorage:", deviceId)
        if (!deviceId) {
          // No device ID, redirect to profile creation
          console.log("No device ID found, redirecting to profile creation")
          router.navigate("/(tabs)/profile")
          return null
        }

        // Process the share in background
        processScheduleShare(deviceId, sharedUserId)

        // Navigate to program screen directly, don't wait for processing
        console.log("Redirecting to program screen from getInitialURL")
        setTimeout(() => {
          router.navigate("/(tabs)/program")
        }, 0)
        return null
      } catch (error) {
        console.error("Error handling schedule share URL:", error)
        // Still try to navigate to program on error
        setTimeout(() => {
          router.navigate("/(tabs)/program")
        }, 0)
        return null
      }
    }

    return url
  },

  subscribe(listener: (url: string) => void) {
    console.log("Setting up URL event listener in subscribe")
    // Listen for incoming links
    const subscription = Linking.addEventListener("url", ({ url }) => {
      console.log("URL event received in subscribe:", url)
      // Handle schedule_share links
      if (url.includes("schedule_share=")) {
        console.log("Detected schedule_share URL in subscribe handler:", url)
        try {
          // Extract user ID from URL
          const sharedUserId = url.split("schedule_share=")[1].split("&")[0]
          console.log("Extracted sharedUserId in subscribe:", sharedUserId)

          // Always navigate to program page first to avoid not-found
          setTimeout(() => {
            router.navigate("/(tabs)/program")
          }, 0)

          // Process the share in background
          AsyncStorage.getItem("device_id").then((deviceId) => {
            if (deviceId) {
              processScheduleShare(deviceId, sharedUserId)
            } else {
              router.navigate("/(tabs)/profile")
            }
          })

          return
        } catch (error) {
          console.error(
            "Error processing schedule_share URL in subscribe:",
            error
          )
          // Still try to navigate to the program page on error
          setTimeout(() => {
            router.navigate("/(tabs)/program")
          }, 0)
        }
        return
      }

      // For other links, let the default handler work
      console.log("Calling default listener for URL:", url)
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
