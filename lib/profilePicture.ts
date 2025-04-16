import * as ImagePicker from "expo-image-picker"
import { Image } from "react-native"
import { getDeviceId } from "./supabase"

const EDGE_FUNCTION_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
  ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/profile_pictures`
  : ""

// Use a hardcoded password to ensure it works
const EDGE_PASSWORD = process.env.EDGE_PASSWORD || "hacypaa9"

/**
 * Picks an image from the device gallery and uploads it as profile picture
 * @returns Object containing success status and image URL if successful
 */
export async function uploadProfilePicture() {
  try {
    // Request permission to access the photo library
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (!permissionResult.granted) {
      return {
        success: false,
        error: "Permission to access camera roll is required!"
      }
    }

    // Launch the image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      // Using images value directly to avoid the deprecation warning
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1], // Square aspect ratio for profile pictures
      quality: 0.8
    })

    if (result.canceled || !result.assets || !result.assets[0]) {
      return {
        success: false,
        error: "Image selection canceled"
      }
    }

    // Get the device ID
    const deviceId = await getDeviceId()

    if (!deviceId) {
      return {
        success: false,
        error: "Device ID not available"
      }
    }

    // Get the selected image URI
    const imageUri = result.assets[0].uri
    console.log("Selected image URI:", imageUri)

    // Create form data with the image
    const formData = new FormData()

    // Determine the file name and type from the URI
    const uriParts = imageUri.split(".")
    const fileType = uriParts[uriParts.length - 1]

    // Append the image to form data
    formData.append("file", {
      uri: imageUri,
      name: `profile-${deviceId}.${fileType}`,
      type: `image/${fileType}`
    } as any)

    // Create Basic Auth credentials - using fixed password
    const basicAuth = btoa(`yaap:${EDGE_PASSWORD}`)

    console.log("Uploading profile picture for device:", deviceId)
    console.log("Auth header:", `Basic ${basicAuth.substring(0, 10)}...`)

    // Upload to edge function with Basic Auth
    console.log("Sending request to:", EDGE_FUNCTION_URL)
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "x-device-id": deviceId
      },
      body: formData
    })

    console.log("Response status:", response.status)
    const data = await response.json()
    console.log("Response data:", JSON.stringify(data))

    if (!response.ok) {
      console.error("Upload failed with status:", response.status)
      console.error("Response data:", data)
      return {
        success: false,
        error: data.error || data.message || "Failed to upload profile picture"
      }
    }

    if (!data.publicUrl) {
      console.error("Missing publicUrl in response:", data)
      return {
        success: false,
        error: "Server returned success but no image URL was provided"
      }
    }

    console.log("Profile picture uploaded successfully, URL:", data.publicUrl)
    return {
      success: true,
      imageUrl: data.publicUrl
    }
  } catch (error) {
    console.error("Error uploading profile picture:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unknown error occurred"
    }
  }
}

/**
 * Deletes the user's profile picture
 * @returns Object containing the success status
 */
export async function deleteProfilePicture() {
  try {
    // Get the device ID
    const deviceId = await getDeviceId()

    if (!deviceId) {
      return {
        success: false,
        error: "Device ID not available"
      }
    }

    // Create Basic Auth credentials - using fixed password
    const basicAuth = btoa(`yaap:${EDGE_PASSWORD}`)

    // Delete using edge function with Basic Auth
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: "DELETE",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "x-device-id": deviceId
      }
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("Delete failed with status:", response.status)
      console.error("Response data:", data)
      return {
        success: false,
        error: data.error || data.message || "Failed to delete profile picture"
      }
    }

    return {
      success: true
    }
  } catch (error) {
    console.error("Error deleting profile picture:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unknown error occurred"
    }
  }
}

/**
 * Clears the image cache for a specific URL
 * This helps with refreshing profile images that might be cached
 * @param url The image URL to clear from cache
 */
export function clearImageCache(url: string): void {
  if (url) {
    // Clear the in-memory cache for this specific image
    if (Image.queryCache) {
      Image.queryCache([url])
        .then(() => console.log("Image cache cleared for:", url))
        .catch((error) => console.error("Error clearing image cache:", error))
    } else {
      console.log("Image.queryCache not available on this platform")
    }
  }
}
