import AsyncStorage from "@react-native-async-storage/async-storage"
import { LinkingOptions } from "@react-navigation/native"
import * as Linking from "expo-linking"
import { router } from "expo-router"
import { supabase } from "../lib/supabase"

const prefix = Linking.createURL("/")

const linking: LinkingOptions<{}> = {
  prefixes: [prefix, "yaap://"],
  config: {
    screens: {
      "(tabs)": {
        screens: {
          profile: "profile",
          program: "program"
        }
      }
    }
  },

  // Handle custom URL schemes for QR code scanning
  async getInitialURL() {
    // Get the URL from Expo Linking
    const url = await Linking.getInitialURL()

    if (!url) return null

    // Check if this is a schedule share URL
    if (url.includes("schedule_share=")) {
      try {
        // Extract user ID from URL
        const sharedUserId = url.split("schedule_share=")[1]

        if (!sharedUserId) return url

        // Check if the current user has a profile
        const deviceId = await AsyncStorage.getItem("device_id")
        if (!deviceId) {
          // No device ID, redirect to profile creation
          router.replace("/(tabs)/profile" as any)
          return null
        }

        // Get current user from Supabase
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("id")
          .eq("device_id", deviceId)
          .single()

        if (userError || !userData) {
          // No user profile, redirect to profile creation
          router.replace("/(tabs)/profile" as any)
          return null
        }

        // Make request to edge function to update sharing
        const response = await fetch(
          "https://oolqeopfhhiuvsmamxln.supabase.co/functions/v1/schedule_manager",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization:
                "Basic " + btoa(`yaap:${process.env.EDGE_PASSWORD}`)
            },
            body: JSON.stringify({
              requester: userData.id,
              receiver: parseInt(sharedUserId)
            })
          }
        )

        if (!response.ok) {
          console.error(
            "Error calling schedule_manager function:",
            await response.text()
          )
        } else {
          // Show success message or notification
          console.log("Sharing request sent successfully")
        }

        // Navigate to program screen
        router.replace("/(tabs)/program" as any)
        return null
      } catch (error) {
        console.error("Error handling schedule share URL:", error)
        return url
      }
    }

    return url
  },

  subscribe(listener) {
    // Listen for incoming links
    const subscription = Linking.addEventListener("url", ({ url }) => {
      // Handle schedule_share links
      if (url.includes("schedule_share=")) {
        // Extract user ID from URL
        const sharedUserId = url.split("schedule_share=")[1]

        // Navigate to profile page if needed or process the share
        handleScheduleShare(sharedUserId).then(() => {
          // After handling, navigate to program page
          router.replace("/(tabs)/program" as any)
        })

        return
      }

      // For other links, let the default handler work
      listener(url)
    })

    // Check for initial URL
    Linking.getInitialURL().then((url) => {
      if (url) listener(url)
    })

    return () => {
      subscription.remove()
    }
  }
}

// Shared handler for schedule share URLs
async function handleScheduleShare(sharedUserId: string) {
  try {
    // Check if the current user has a profile
    const deviceId = await AsyncStorage.getItem("device_id")
    if (!deviceId) {
      // No device ID, redirect to profile creation
      router.replace("/(tabs)/profile" as any)
      return
    }

    // Get current user from Supabase
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("device_id", deviceId)
      .single()

    if (userError || !userData) {
      // No user profile, redirect to profile creation
      router.replace("/(tabs)/profile" as any)
      return
    }

    // Make request to edge function to update sharing
    const response = await fetch(
      "https://oolqeopfhhiuvsmamxln.supabase.co/functions/v1/schedule_manager",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Basic " + btoa(`yaap:${process.env.EDGE_PASSWORD}`)
        },
        body: JSON.stringify({
          requester: userData.id,
          receiver: parseInt(sharedUserId)
        })
      }
    )

    if (!response.ok) {
      console.error(
        "Error calling schedule_manager function:",
        await response.text()
      )
    } else {
      // Show success message or notification
      console.log("Sharing request sent successfully")
    }
  } catch (error) {
    console.error("Error handling schedule share:", error)
  }
}

export default linking
