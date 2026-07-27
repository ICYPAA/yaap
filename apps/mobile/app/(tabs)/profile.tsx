import { Ionicons } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as Application from "expo-application"
import * as ImagePicker from "expo-image-picker"
import * as Notifications from "expo-notifications"
import { useRouter } from "expo-router"
import React, { useCallback, useEffect, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native"
import { TutorialModal } from "../../components/TutorialModal"
import { SafetyModal } from "../../components/SafetyModal"
import { useCurrentConference } from "../../context/CurrentConferenceContext"
import { useFeatures } from "../../context/FeatureContext"
import { useTheme } from "../../context/ThemeContext"
import { sendNotification } from "../../lib/notificationHelper"
import { clearImageCache, uploadProfilePicture } from "../../lib/profilePicture"
import { supabase, withDeviceId } from "../../lib/supabase"
import { sanitizeName, sanitizeLastInitial } from "../../lib/security"
import { getTextColorForBackground } from "../../lib/theme"
import { Schedule, User } from "../../types/user"

// Function to get device identifier based on platform
async function getIdentifier() {
  if (Platform.OS === "ios") {
    const idfv = await Application.getIosIdForVendorAsync()
    return idfv // Example: T563P9YS-856G-473X-H1J2-FC94L0T37IC6 or null
  }
  if (Platform.OS === "android") {
    const androidId = Application.getAndroidId()
    return androidId // Example: '9774d56d682e549c' or null
  }
  return null
}

// Function to register for push notifications and get token
async function registerForPushNotificationsAsync() {
  let token
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C"
    })
  }

  try {
    token = (
      await Notifications.getExpoPushTokenAsync({
        projectId: "15c03e66-5f31-409b-b31a-b53b92e00fb1"
      })
    ).data
    return token
  } catch (error) {
    console.error("Error getting push token:", error)
    // Silently fail on emulators/simulators
    if (__DEV__) {
      console.log("Push tokens may not be supported on emulators/simulators")
    }
    return null
  }
}

// Type for the data needed for display in lists (subset of User)
type DisplayUser = Pick<
  User,
  "id" | "device_id" | "first_name" | "last_initial" | "profile_image"
>

export default function Profile() {
  const { theme, isDarkMode, toggleTheme } = useTheme()
  const { isFeatureEnabled } = useFeatures()
  const currentConference = useCurrentConference()
  const router = useRouter()

  // State for current user data
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const programId =
    currentConference.status === "active"
      ? currentConference.currentProgramId
      : null

  // Profile Info State (will be populated from currentUser)
  const [firstName, setFirstName] = useState("")
  const [lastInitial, setLastInitial] = useState("")
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)

  // Notification State (will be populated from currentUser.settings)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [scheduleNotificationsEnabled, setScheduleNotificationsEnabled] =
    useState(true)
  const [mainSpeakerNotificationsEnabled, setMainSpeakerNotificationsEnabled] =
    useState(true)
  const [eventNotificationsEnabled, setEventNotificationsEnabled] =
    useState(true)
  const [gameNotificationsEnabled, setGameNotificationsEnabled] = useState(true)
  const [hospitalityNotificationsEnabled, setHospitalityNotificationsEnabled] =
    useState(true)

  // Tutorial modal state
  const [tutorialVisible, setTutorialVisible] = useState(false)
  
  // Safety modal state
  const [safetyVisible, setSafetyVisible] = useState(false)
  
  // Bid schedule toggle state - defaults to false (user must opt-in)
  const [showBidSchedule, setShowBidSchedule] = useState(false)
  
  // Load bid schedule preference
  useEffect(() => {
    AsyncStorage.getItem("showBidSchedule").then((value) => {
      if (value !== null) {
        setShowBidSchedule(value === "true")
      }
    })
  }, [])
  
  // Save bid schedule preference
  const handleBidScheduleToggle = async (value: boolean) => {
    setShowBidSchedule(value)
    await AsyncStorage.setItem("showBidSchedule", value.toString())
  }

  // Sharing State (will be populated by fetching related users)
  const [incomingRequests, setIncomingRequests] = useState<DisplayUser[]>([])
  const [sharingWith, setSharingWith] = useState<DisplayUser[]>([])
  const [pendingRequests, setPendingRequests] = useState<DisplayUser[]>([])
  const [viewingFrom, setViewingFrom] = useState<DisplayUser[]>([])
  const [bannedUsers, setBannedUsers] = useState<DisplayUser[]>([])
  const [loadingSharing, setLoadingSharing] = useState(true)

  // Get Device ID on mount
  useEffect(() => {
    async function fetchDeviceId() {
      try {
        const id = await getIdentifier()
        if (!id) {
          console.error("Could not get a device identifier")
          return
        }
        setDeviceId(id)
      } catch (error) {
        console.error("Error getting device identifier:", error)
      }
    }

    fetchDeviceId()
  }, [])

  // Function to fetch user details for sharing lists
  const fetchSharingListsDetails = useCallback(async (schedule: Schedule) => {
    // Helper to get display details from user IDs
    const fetchUserDetailsByUserIds = async (
      userIds: number[]
    ): Promise<DisplayUser[]> => {
      if (!userIds || userIds.length === 0) return []
      try {
        const { data, error } = await supabase.rpc("get_public_users_info", {
          user_ids: userIds
        })
        if (error) throw error
        return data || []
      } catch (error) {
        console.error("Error fetching user details by user IDs:", error)
        return [] // Return empty on error
      }
    }

    // Fetch details using the user IDs
    try {
      const [incoming, sharing, pending, viewing, banned] = await Promise.all([
        fetchUserDetailsByUserIds(schedule.requested_share || []),
        fetchUserDetailsByUserIds(schedule.shared_with || []),
        fetchUserDetailsByUserIds(schedule.pending_share || []),
        fetchUserDetailsByUserIds(schedule.shared_by || []),
        fetchUserDetailsByUserIds(schedule.banned || [])
      ])

      setIncomingRequests(incoming)
      setSharingWith(sharing)
      setPendingRequests(pending)
      setViewingFrom(viewing)
      setBannedUsers(banned)
      // console.log("Fetched sharing list details.")
    } catch (error) {
      console.error(
        "Error fetching details for one or more sharing lists:",
        error
      )
      // Optionally set lists to empty or show an error
      setIncomingRequests([])
      setSharingWith([])
      setPendingRequests([])
      setViewingFrom([])
      setBannedUsers([])
    }
  }, [])

  // Function to load schedule from AsyncStorage and update UI
  const loadScheduleFromStorage = useCallback(async () => {
    try {
      const scheduleJson = await AsyncStorage.getItem("userSchedule")
      if (scheduleJson) {
        const schedule = JSON.parse(scheduleJson) as Schedule
        // console.log("Loaded schedule from AsyncStorage")

        // Update the sharing lists based on the schedule from AsyncStorage
        await fetchSharingListsDetails(schedule)

        // If we have currentUser, update its schedule
        setCurrentUser((prev) => (prev ? { ...prev, schedule } : null))
      }
    } catch (error) {
      console.error("Error loading schedule from AsyncStorage:", error)
    }
  }, [fetchSharingListsDetails])

  // Listen for changes to userSchedule in AsyncStorage
  useEffect(() => {
    // Initial load from AsyncStorage
    loadScheduleFromStorage()

    // Create a setInterval to check AsyncStorage periodically
    const checkStorageInterval = setInterval(() => {
      // console.log("Checking AsyncStorage for schedule updates")
      loadScheduleFromStorage()
    }, 3000) // Check every 3 seconds

    // Also check when app comes to foreground
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        console.log("App state changed to active, reloading schedule")
        // When app comes to foreground, check if schedule has been updated
        loadScheduleFromStorage()
      }
    })

    return () => {
      clearInterval(checkStorageInterval)
      subscription.remove()
    }
  }, [deviceId, loadScheduleFromStorage]) // Add deviceId as dependency to ensure this effect runs after deviceId is set

  // Fetch current user profile data based on deviceId
  useEffect(() => {
    if (!deviceId) return // Don't fetch until deviceId is available

    const fetchUserData = async () => {
      setLoadingProfile(true)
      setLoadingSharing(true)
      try {
        const supabaseWithDeviceId = await withDeviceId()
        const { data: userData, error: userError } = await supabaseWithDeviceId
          .from("users")
          .select("*, settings")
          .eq("device_id", deviceId)
          .single()

        if (userError && userError.code !== "PGRST116") {
          // PGRST116: Row not found
          console.error("Error fetching user data:", userError)
          throw userError
        }

        if (userData) {
          // Get schedule from AsyncStorage instead of directly from database
          const scheduleJson = await AsyncStorage.getItem("userSchedule")
          let schedule: Schedule

          if (scheduleJson) {
            schedule = JSON.parse(scheduleJson)
            console.log("Using schedule from AsyncStorage")
          } else {
            // Fallback to database schedule if not in AsyncStorage
            schedule = userData.schedule || {
              requested_share: [],
              shared_with: [],
              pending_share: [],
              shared_by: [],
              banned: []
            }
            console.log("Using fallback schedule from database")
          }

          // Update userData with the schedule we got
          const userWithSchedule = { ...userData, schedule }

          setCurrentUser(userWithSchedule as User)
          // Populate profile state
          setFirstName(userData.first_name || "")
          setLastInitial(userData.last_initial || "")
          setProfileImage(userData.profile_image || null)
          // Populate notification settings state
          const settings = userData.settings || {}
          setNotificationsEnabled(settings.notifications ?? true)
          setScheduleNotificationsEnabled(
            settings.schedule_notifications ?? true
          )
          setMainSpeakerNotificationsEnabled(
            settings.main_meeting_notifications ?? true
          )
          setEventNotificationsEnabled(settings.event_notifications ?? true)
          setGameNotificationsEnabled(settings.game_notifications ?? true)
          setHospitalityNotificationsEnabled(
            settings.hospitality_notifications ?? true
          )

          // Fetch details for sharing lists based on schedule
          await fetchSharingListsDetails(schedule)
        } else {
          // Handle case where user doesn't exist yet (e.g., prompt to create profile?)
          // For now, set default empty states
          setCurrentUser(null)
          setFirstName("")
          setLastInitial("")
          setProfileImage(null)
          setIncomingRequests([])
          setSharingWith([])
          setPendingRequests([])
          setViewingFrom([])
          setBannedUsers([])
        }
      } catch (error) {
        console.error("Failed to fetch initial user data:", error)
        Alert.alert("Error", "Could not load your profile data.")
        // Set default empty states on error
        setCurrentUser(null)
        setFirstName("")
        setLastInitial("")
        setProfileImage(null)
        setIncomingRequests([])
        setSharingWith([])
        setPendingRequests([])
        setViewingFrom([])
        setBannedUsers([])
      } finally {
        setLoadingProfile(false)
        setLoadingSharing(false)
      }
    }

    fetchUserData()
  }, [deviceId, fetchSharingListsDetails]) // Re-run if deviceId changes

  // Request permissions on component mount
  useEffect(() => {
    ;(async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Sorry, we need camera roll permissions to upload a profile picture."
        )
      }
    })()
  }, [])

  // Handle image selection
  const pickImage = async () => {
    try {
      // If there's a current profile image, clear its cache
      if (profileImage) {
        clearImageCache(profileImage)
      }

      const result = await uploadProfilePicture()

      if (result.success && result.imageUrl) {
        // Add a cache-busting parameter to the URL
        const cacheBustUrl = `${result.imageUrl}?t=${new Date().getTime()}`

        // Clear the cache for the new image URL as well
        clearImageCache(result.imageUrl)

        // Update the image in state
        setProfileImage(cacheBustUrl)

        // Save the profile information immediately to ensure database is updated
        await saveUserProfileInfo()

        // Force a UI refresh by updating the current user state
        setCurrentUser((prev) => {
          if (!prev) return null
          return {
            ...prev,
            profile_image: cacheBustUrl
          }
        })
      } else if (result.error) {
        console.error("Error in upload:", result.error)
        Alert.alert("Error", result.error)
      }
    } catch (error) {
      console.error("Unexpected error in pickImage:", error)
      Alert.alert(
        "Error",
        "An unexpected error occurred while processing your image"
      )
    }
  }

  // Save profile information (Only Name/Image)
  const saveUserProfileInfo = async () => {
    if (!deviceId) {
      Alert.alert("Error", "Device ID not found. Cannot save profile.")
      return
    }

    try {
      // Get the latest push token
      const pushToken = await registerForPushNotificationsAsync()

      // Get current auth session to get user ID
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData?.session?.user?.id

      // No need to upload image here anymore as it's handled by the uploadProfilePicture function
      // Just use the current profileImage value which is already the URL from Supabase

      // Sanitize user input before saving
      const profileDataToSave = {
        first_name: sanitizeName(firstName),
        last_initial: sanitizeLastInitial(lastInitial),
        profile_image: profileImage || "", // Ensure it's never null
        expo_push_token: pushToken,
        user_id: userId // This will be string | undefined, not string | null
      }
      const supabaseWithDeviceId = await withDeviceId(supabase, '/profile/update')
      const { error } = await supabaseWithDeviceId
        .from("users")
        .update(profileDataToSave)
        .eq("device_id", deviceId)

      if (error) throw error

      Alert.alert(
        "Profile Updated",
        "Your profile information has been updated."
      )

      // Update the current user state with new data
      if (currentUser) {
        const updatedUser: User = {
          ...currentUser,
          first_name: firstName,
          last_initial: lastInitial,
          profile_image: profileImage || "",
          user_id: userId || undefined
        }
        setCurrentUser(updatedUser)
      }
    } catch (error: any) {
      console.error("Error saving profile info:", error)
      Alert.alert(
        "Save Failed",
        "Could not save profile information: " + error.message
      )
    }
  }

  // Update individual notification setting
  const updateNotificationSetting = async (
    settingKey: keyof User["settings"], // Use keys from type
    value: boolean
  ) => {
    if (!currentUser || !deviceId) return // Need user and deviceId

    const optimisticStateUpdater = (
      setter: React.Dispatch<React.SetStateAction<boolean>>
    ) => setter(value)
    const revertState = (
      setter: React.Dispatch<React.SetStateAction<boolean>>
    ) => setter(!value)

    let stateSetter: React.Dispatch<React.SetStateAction<boolean>> | null = null

    // Update state optimistically
    switch (settingKey) {
      case "notifications":
        stateSetter = setNotificationsEnabled
        break
      case "schedule_notifications":
        stateSetter = setScheduleNotificationsEnabled
        break
      case "main_meeting_notifications":
        stateSetter = setMainSpeakerNotificationsEnabled
        break
      case "event_notifications":
        stateSetter = setEventNotificationsEnabled
        break
      case "game_notifications":
        stateSetter = setGameNotificationsEnabled
        break
      case "hospitality_notifications":
        stateSetter = setHospitalityNotificationsEnabled
        break
      default:
        console.warn("Unknown setting key:", settingKey)
        return
    }

    if (stateSetter) optimisticStateUpdater(stateSetter)

    // Prepare the update payload for the settings JSONB column
    const currentSettings = currentUser.settings || {}
    const newSettings = { ...currentSettings, [settingKey]: value }

    try {
      const supabaseWithDeviceId = await withDeviceId()
      const { error } = await supabaseWithDeviceId
        .from("users")
        .update({ settings: newSettings })
        .eq("device_id", deviceId)

      if (error) throw error

      // Update the currentUser state as well for consistency
      setCurrentUser((prev) =>
        prev ? { ...prev, settings: newSettings } : null
      )
    } catch (error: any) {
      console.error(`Failed to update setting ${settingKey}:`, error)
      Alert.alert(
        "Update Failed",
        `Could not update setting: ${settingKey}. Please try again.`
      )
      // Revert state on failure
      if (stateSetter) {
        revertState(stateSetter)
      }
    }
  }

  // --- Sharing Action Handlers (using DisplayUser type) ---

  const executeBan = (user: DisplayUser, sourceListUpdateFn?: () => void) => {
    Alert.alert(
      "Confirm Ban",
      `Are you sure you want to ban ${user.first_name} ${user.last_initial}? They will not be able to request or see your schedule.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Ban User",
          style: "destructive",
          onPress: async () => {
            if (!deviceId || !currentUser) return
            try {
              const supabaseWithDeviceId = await withDeviceId()
              const { error } = await supabaseWithDeviceId.rpc(
                "ban_user",
                {
                  current_user_id: currentUser.id,
                  target_user_id: user.id
                }
              )

              if (error) throw error

              // Update local AsyncStorage to match DB changes
              const scheduleJson = await AsyncStorage.getItem("userSchedule")
              if (scheduleJson) {
                const schedule = JSON.parse(scheduleJson) as Schedule

                // Add to banned list using user.id (int4)
                if (!schedule.banned.includes(user.id)) {
                  schedule.banned.push(user.id)
                }

                // Remove from other lists if present
                schedule.shared_with = schedule.shared_with.filter(
                  (id) => id !== user.id
                )
                schedule.requested_share = schedule.requested_share.filter(
                  (id) => id !== user.id
                )
                schedule.pending_share = schedule.pending_share.filter(
                  (id) => id !== user.id
                )

                // Save updated schedule
                await AsyncStorage.setItem(
                  "userSchedule",
                  JSON.stringify(schedule)
                )
              }

              sourceListUpdateFn?.() // Update source list UI
              if (!bannedUsers.some((banned) => banned.id === user.id)) {
                setBannedUsers((prev) => [...prev, user]) // Add to banned list UI
              }
            } catch (error) {
              console.error("Error banning user:", error)
              Alert.alert("Error", "Failed to ban user.")
            }
          }
        }
      ]
    )
  }

  const handleAcceptRequest = async (user: DisplayUser) => {
    if (!deviceId || !currentUser) return
    try {
      const supabaseWithDeviceId = await withDeviceId()
      const { error } = await supabaseWithDeviceId.rpc(
        "accept_share_request",
        {
          requester_id: user.id,
          acceptor_id: currentUser.id
        }
      )

      if (error) throw error

      // Update local AsyncStorage to match DB changes
      const scheduleJson = await AsyncStorage.getItem("userSchedule")
      if (scheduleJson) {
        const schedule = JSON.parse(scheduleJson) as Schedule

        // Move from requested_share to shared_with using user.id directly
        schedule.requested_share = schedule.requested_share.filter(
          (id) => id !== user.id
        )
        if (!schedule.shared_with.includes(user.id)) {
          schedule.shared_with.push(user.id)
        }

        // Save updated schedule
        await AsyncStorage.setItem("userSchedule", JSON.stringify(schedule))
      }

      // Update UI state
      setIncomingRequests((prev) => prev.filter((u) => u.id !== user.id))
      setSharingWith((prev) => [...prev, user])

      // Send notification with correct user ID
      if (currentUser && programId) {
        // Send schedule notification through the edge function
        await sendNotification({
          eventType: "schedule",
          programId: programId,
          userId: user.id,
          data: {
            status: "accepted",
            user: {
              first_name: currentUser.first_name,
              last_initial: currentUser.last_initial
            }
          }
        })
      }
    } catch (error) {
      console.error("Error accepting request:", error)
      Alert.alert("Error", "Failed to accept request.")
    }
  }

  const handleDenyRequestFlow = (user: DisplayUser) => {
    Alert.alert(
      "Deny Request",
      `Deny schedule request from ${user.first_name} ${user.last_initial}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deny Request",
          style: "default",
          onPress: async () => {
            if (!deviceId || !currentUser) return
            try {
              const supabaseWithDeviceId = await withDeviceId()
              const { error } = await supabaseWithDeviceId.rpc(
                "deny_share_request",
                {
                  requester_id: user.id,
                  current_user_id: currentUser.id
                }
              )

              if (error) throw error

              // Update local AsyncStorage to match DB changes
              const scheduleJson = await AsyncStorage.getItem("userSchedule")
              if (scheduleJson) {
                const schedule = JSON.parse(scheduleJson) as Schedule

                // Remove from requested_share
                schedule.requested_share = schedule.requested_share.filter(
                  (id) => id !== user.id
                )

                // Save updated schedule
                await AsyncStorage.setItem(
                  "userSchedule",
                  JSON.stringify(schedule)
                )
              }

              setIncomingRequests((prev) =>
                prev.filter((u) => u.id !== user.id)
              )
            } catch (error) {
              console.error("Error denying request:", error)
              Alert.alert("Error", "Failed to deny request.")
            }
          }
        },
        {
          text: "Deny and Ban User",
          style: "destructive",
          onPress: () => {
            // Ban flow handles API call and UI update internally
            executeBan(user, () => {
              setIncomingRequests((prev) =>
                prev.filter((u) => u.id !== user.id)
              )
            })
          }
        }
      ]
    )
  }

  const handleRemoveSharingFlow = (user: DisplayUser) => {
    Alert.alert(
      "Stop Sharing",
      `Stop sharing your schedule with ${user.first_name} ${user.last_initial}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop Sharing",
          style: "default",
          onPress: async () => {
            if (!deviceId || !currentUser) return
            try {
              const supabaseWithDeviceId = await withDeviceId()
              const { error } = await supabaseWithDeviceId.rpc(
                "remove_sharing",
                {
                  current_user_id: currentUser.id,
                  target_user_id: user.id
                }
              )

              if (error) throw error

              // Update local AsyncStorage to match DB changes
              const scheduleJson = await AsyncStorage.getItem("userSchedule")
              if (scheduleJson) {
                const schedule = JSON.parse(scheduleJson) as Schedule

                // Remove from shared_with
                schedule.shared_with = schedule.shared_with.filter(
                  (id) => id !== user.id
                )

                // Save updated schedule
                await AsyncStorage.setItem(
                  "userSchedule",
                  JSON.stringify(schedule)
                )
              }

              setSharingWith((prev) => prev.filter((u) => u.id !== user.id))
            } catch (error) {
              console.error("Error removing sharing:", error)
              Alert.alert("Error", "Failed to remove sharing.")
            }
          }
        },
        {
          text: "Stop Sharing and Ban",
          style: "destructive",
          onPress: () => {
            executeBan(user, () => {
              setSharingWith((prev) => prev.filter((u) => u.id !== user.id))
            })
          }
        }
      ]
    )
  }

  const handleCancelRequest = (user: DisplayUser) => {
    Alert.alert(
      "Cancel Request",
      `Are you sure you want to cancel your request to see ${user.first_name} ${user.last_initial}.\'s schedule?`,
      [
        { text: "Keep Request", style: "cancel" },
        {
          text: "Cancel Request",
          style: "destructive",
          onPress: async () => {
            if (!deviceId || !currentUser) return
            try {
              const supabaseWithDeviceId = await withDeviceId()
              const { error } = await supabaseWithDeviceId.rpc(
                "cancel_share_request",
                {
                  current_user_id: currentUser.id,
                  target_user_id: user.id
                }
              )

              if (error) throw error

              // Update local AsyncStorage to match DB changes
              const scheduleJson = await AsyncStorage.getItem("userSchedule")
              if (scheduleJson) {
                const schedule = JSON.parse(scheduleJson) as Schedule

                // Remove from pending_share
                schedule.pending_share = schedule.pending_share.filter(
                  (id) => id !== user.id
                )

                // Save updated schedule
                await AsyncStorage.setItem(
                  "userSchedule",
                  JSON.stringify(schedule)
                )
              }

              setPendingRequests((prev) => prev.filter((u) => u.id !== user.id))
            } catch (error) {
              console.error("Error cancelling request:", error)
              Alert.alert("Error", "Failed to cancel request.")
            }
          }
        }
      ]
    )
  }

  const handleStopViewing = (user: DisplayUser) => {
    Alert.alert(
      "Stop Viewing Schedule",
      `Are you sure you want to stop viewing ${user.first_name} ${user.last_initial}.\'s schedule?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop Viewing",
          style: "destructive",
          onPress: async () => {
            if (!deviceId || !currentUser) return
            try {
              const supabaseWithDeviceId = await withDeviceId()
              const { error } = await supabaseWithDeviceId.rpc(
                "stop_viewing_schedule",
                {
                  current_user_id: currentUser.id,
                  target_user_id: user.id
                }
              )

              if (error) throw error

              // Update local AsyncStorage to match DB changes
              const scheduleJson = await AsyncStorage.getItem("userSchedule")
              if (scheduleJson) {
                const schedule = JSON.parse(scheduleJson) as Schedule

                // Remove from shared_by
                schedule.shared_by = schedule.shared_by.filter(
                  (id) => id !== user.id
                )

                // Save updated schedule
                await AsyncStorage.setItem(
                  "userSchedule",
                  JSON.stringify(schedule)
                )
              }

              setViewingFrom((prev) => prev.filter((u) => u.id !== user.id))
            } catch (error) {
              console.error("Error stopping viewing:", error)
              Alert.alert("Error", "Failed to stop viewing schedule.")
            }
          }
        }
      ]
    )
  }

  const handleUnbanUser = (user: DisplayUser) => {
    Alert.alert(
      "Confirm Unban",
      `Are you sure you want to unban ${user.first_name} ${user.last_initial}? They will be able to request your schedule again.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unban User",
          style: "default",
          onPress: async () => {
            if (!deviceId || !currentUser) return
            try {
              const supabaseWithDeviceId = await withDeviceId()
              const { error } = await supabaseWithDeviceId.rpc(
                "unban_user",
                {
                  current_user_id: currentUser.id,
                  target_user_id: user.id
                }
              )

              if (error) throw error

              // Update local AsyncStorage to match DB changes
              const scheduleJson = await AsyncStorage.getItem("userSchedule")
              if (scheduleJson) {
                const schedule = JSON.parse(scheduleJson) as Schedule

                // Remove from banned
                schedule.banned = schedule.banned.filter((id) => id !== user.id)

                // Save updated schedule
                await AsyncStorage.setItem(
                  "userSchedule",
                  JSON.stringify(schedule)
                )
              }

              setBannedUsers((prev) => prev.filter((u) => u.id !== user.id))
            } catch (error) {
              console.error("Error unbanning user:", error)
              Alert.alert("Error", "Failed to unban user.")
            }
          }
        }
      ]
    )
  }


  // --- End Handlers ---

  const styles = createStyles(theme)

  // Helper component for rendering user rows in sharing lists
  const UserRow = ({
    user,
    actions
  }: {
    user: DisplayUser
    actions: React.ReactNode
  }) => (
    <View style={styles.shareRow}>
      <View style={styles.shareUserInfo}>
        {user.profile_image ? (
          <Image
            source={{ uri: user.profile_image }}
            style={styles.shareUserImage}
          />
        ) : (
          <View style={styles.shareUserPlaceholderImage}>
            <Ionicons
              name="person"
              size={20}
              color={theme.colors.text.secondary}
            />
          </View>
        )}
        <Text style={styles.shareUserText} numberOfLines={1}>
          {user.first_name} {user.last_initial}.
        </Text>
      </View>
      <View style={styles.shareActionsContainer}>{actions}</View>
    </View>
  )

  // Function to handle profile deletion
  const handleDeleteProfile = () => {
    Alert.alert(
      "Delete Profile",
      "Are you sure you want to delete your profile? This action cannot be undone. We will delete all data stored on our systems, but you will have to uninstall the app to delete all data on your device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!deviceId) {
              Alert.alert("Error", "Cannot delete profile: Device ID not found")
              return
            }

            try {
              setLoadingProfile(true)

              // First, update any support chats to mark the device_id as "deleted"
              // This preserves chat history but disassociates it from the deleted user
              const supabaseWithDeviceId = await withDeviceId()
              const { error: supportChatsError } = await supabaseWithDeviceId
                .from("support_chats")
                .update({ device_id: "deleted" })
                .eq("device_id", deviceId)

              if (supportChatsError) {
                console.error(
                  "Error updating support chats:",
                  supportChatsError
                )
                // Continue with deletion even if support chat update fails
              }

              // Delete the user from the database
              const { error } = await supabaseWithDeviceId
                .from("users")
                .delete()
                .eq("device_id", deviceId)

              if (error) throw error

              // Clear AsyncStorage
              await AsyncStorage.clear()

              // Sign out from Supabase auth if authenticated
              await supabase.auth.signOut()

              Alert.alert(
                "Profile Deleted",
                "Your profile has been deleted successfully",
                [
                  {
                    text: "OK",
                    onPress: () => {
                      // Navigate to the main screen or restart the app
                      router.replace("/")
                    }
                  }
                ]
              )
            } catch (error) {
              console.error("Error deleting profile:", error)
              Alert.alert(
                "Deletion Failed",
                "There was an error deleting your profile. Please try again."
              )
              setLoadingProfile(false)
            }
          }
        }
      ]
    )
  }

  // Loading state for profile section
  if (loadingProfile) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading Profile...</Text>
      </View>
    )
  }

  // Handle case where user profile doesn't exist yet after loading
  if (!currentUser && !loadingProfile) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView 
          contentContainerStyle={[styles.scrollContent, styles.centerContent]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Ionicons
            name="person-add-outline"
            size={60}
            color={theme.colors.text.secondary}
            style={{ marginBottom: theme.spacing.lg }}
          />
          <Text style={styles.sectionTitle}>Create Profile</Text>
          <Text style={styles.instructionText}>
            It looks like you don't have a profile yet.
          </Text>
          <Text style={styles.instructionText}>
            Enter your name below to get started.
          </Text>
          {/* Simplified form to create initial profile */}
          <View style={styles.formContainerMinimal}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                testID="profile-first-name"
                accessibilityLabel="First name"
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Your first name"
                placeholderTextColor={theme.colors.text.secondary}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Last Initial</Text>
              <TextInput
                testID="profile-last-initial"
                accessibilityLabel="Last initial"
                style={styles.input}
                value={lastInitial}
                onChangeText={(text) =>
                  setLastInitial(text.charAt(0).toUpperCase())
                }
                placeholder="Your last initial"
                placeholderTextColor={theme.colors.text.secondary}
                maxLength={1}
                autoCapitalize="characters"
              />
            </View>
            <TouchableOpacity
              testID="profile-create"
              accessibilityLabel="Create profile"
              style={styles.saveButton}
              onPress={async () => {
                if (!deviceId || !firstName || !lastInitial) {
                  Alert.alert(
                    "Missing Info",
                    "Please enter both first name and last initial."
                  )
                  return
                }
                try {
                  // Get push token
                  const pushToken = await registerForPushNotificationsAsync()

                  // Actual Supabase insert call
                  const supabaseWithDeviceId = await withDeviceId()
                  const { error: insertError } = await supabaseWithDeviceId
                    .from("users")
                    .insert({
                      device_id: deviceId,
                      first_name: firstName,
                      last_initial: lastInitial,
                      expo_push_token: pushToken, // Add push token
                      // Initialize settings and schedule with defaults if needed by your schema
                      settings: {
                        notifications: true,
                        schedule_notifications: true,
                        event_notifications: true,
                        main_meeting_notifications: true,
                        game_notifications: true,
                        hospitality_notifications: true
                      },
                      schedule: {
                        saved_events: [],
                        requested_share: [],
                        shared_with: [],
                        pending_share: [],
                        shared_by: [],
                        banned: []
                      }
                    })
                    .select() // Optionally select to confirm insert, though not strictly necessary here
                    .single() // Expecting to insert one row

                  if (insertError) {
                    console.error("Error inserting user:", insertError)
                    // Check for unique constraint violation (user likely already exists)
                    if (insertError.code === "23505") {
                      // PostgreSQL unique violation code
                      Alert.alert(
                        "Error",
                        "A profile for this device might already exist. Trying to load data."
                      )
                    } else {
                      Alert.alert(
                        "Error",
                        `Could not create profile: ${insertError.message}`
                      )
                      return // Stop if insert failed for other reasons
                    }
                  }

                  // Re-trigger data fetch by resetting deviceId momentarily
                  const currentId = deviceId
                  setDeviceId(null)
                  setTimeout(() => setDeviceId(currentId), 50)
                  // Removed success alert
                } catch (error) {
                  // Catch any other unexpected errors during the process
                  console.error("Unexpected error creating profile:", error)
                  Alert.alert(
                    "Error",
                    "An unexpected error occurred while creating the profile."
                  )
                }
              }}
            >
              <Text style={styles.saveButtonText}>Create Profile</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>My Profile</Text>
        </View>

        {/* Profile Picture */}
        <View style={styles.profileImageContainer}>
          <TouchableOpacity onPress={pickImage} style={styles.imageWrapper}>
            {profileImage ? (
              <Image
                source={{ uri: profileImage }}
                style={styles.profileImage}
                key={profileImage}
              />
            ) : (
              <View style={styles.placeholderImage}>
                <Ionicons
                  name="person"
                  size={80}
                  color={theme.colors.text.secondary}
                />
              </View>
            )}
            <View style={styles.editIconContainer}>
              <Ionicons
                name="camera"
                size={20}
                color={theme.colors.background}
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Profile Information Form */}
        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>First Name</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Enter your first name"
              placeholderTextColor={theme.colors.text.secondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Last Initial</Text>
            <TextInput
              style={styles.input}
              value={lastInitial}
              onChangeText={(text) =>
                setLastInitial(text.charAt(0).toUpperCase())
              }
              placeholder="Enter your last initial"
              placeholderTextColor={theme.colors.text.secondary}
              maxLength={1}
              autoCapitalize="characters"
            />
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={saveUserProfileInfo}
          >
            <Text style={styles.saveButtonText}>Save Profile Info</Text>
          </TouchableOpacity>

          {/* Privacy Notice (Moved) */}
          <View style={styles.privacyContainer}>
            <Text style={styles.privacyTitle}>Privacy Information</Text>
            <Text style={styles.privacyText}>
              Your profile information (name, picture) is only shared with
              others when you explicitly accept their request to view your
              schedule. Banning a user prevents them from requesting or seeing
              your schedule.
            </Text>
          </View>
        </View>

        {/* Settings Section */}
        <View style={styles.settingsContainer}>
          <Text style={styles.sectionTitle}>Settings</Text>

          {/* Dark Mode Toggle */}
          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Dark Mode</Text>
              <Text style={styles.settingDescription}>
                Switch between light and dark themes
              </Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={toggleTheme}
              trackColor={{ false: "#767577", true: theme.colors.primary }}
              thumbColor={isDarkMode ? "#f4f3f4" : "#f4f3f4"}
            />
          </View>

          {/* Language Picker - Hidden for now */}
          {/* {isFeatureEnabled("language_option_enabled") && (
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setLanguagePickerVisible(true)}
            >
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Language</Text>
                <Text style={styles.settingDescription}>
                  {availableLanguages.find(
                    (lang) => lang.code === currentLanguage
                  )?.name || "English"}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.text.secondary}
              />
            </TouchableOpacity>
          )} */}

          {/* Notification Settings (Updated with direct updates) */}
          {isFeatureEnabled("push_notifications_enabled") && (
          <>
          <Text style={styles.subsectionTitle}>Notifications</Text>

          {/* Master Toggle */}
          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Enable Notifications</Text>
              <Text style={styles.settingDescription}>
                Master toggle for all app notifications
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={(value) =>
                updateNotificationSetting("notifications", value)
              }
              trackColor={{ false: "#767577", true: theme.colors.primary }}
              thumbColor={notificationsEnabled ? "#f4f3f4" : "#f4f3f4"}
            />
          </View>

          {/* Schedule Sharing Notifications */}
          <View
            style={[
              styles.settingRow,
              !notificationsEnabled && styles.disabledSetting
            ]}
          >
            <View style={styles.settingTextContainer}>
              <Text
                style={[
                  styles.settingLabel,
                  !notificationsEnabled && styles.disabledText
                ]}
              >
                Schedule Sharing Notifications
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  !notificationsEnabled && styles.disabledText
                ]}
              >
                Notify on requests and approvals
              </Text>
            </View>
            <Switch
              value={scheduleNotificationsEnabled && notificationsEnabled}
              onValueChange={(value) =>
                updateNotificationSetting("schedule_notifications", value)
              }
              disabled={!notificationsEnabled}
              trackColor={{ false: "#767577", true: theme.colors.primary }}
              thumbColor={
                scheduleNotificationsEnabled && notificationsEnabled
                  ? "#f4f3f4"
                  : "#f4f3f4"
              }
            />
          </View>

          {/* Main Speaker Notifications */}
          <View
            style={[
              styles.settingRow,
              !notificationsEnabled && styles.disabledSetting
            ]}
          >
            <View style={styles.settingTextContainer}>
              <Text
                style={[
                  styles.settingLabel,
                  !notificationsEnabled && styles.disabledText
                ]}
              >
                Main Speaker Notifications
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  !notificationsEnabled && styles.disabledText
                ]}
              >
                Notify when main speakers begin
              </Text>
            </View>
            <Switch
              value={mainSpeakerNotificationsEnabled && notificationsEnabled}
              onValueChange={(value) =>
                updateNotificationSetting("main_meeting_notifications", value)
              }
              disabled={!notificationsEnabled}
              trackColor={{ false: "#767577", true: theme.colors.primary }}
              thumbColor={
                mainSpeakerNotificationsEnabled && notificationsEnabled
                  ? "#f4f3f4"
                  : "#f4f3f4"
              }
            />
          </View>

          {/* Event Notifications */}
          <View
            style={[
              styles.settingRow,
              !notificationsEnabled && styles.disabledSetting
            ]}
          >
            <View style={styles.settingTextContainer}>
              <Text
                style={[
                  styles.settingLabel,
                  !notificationsEnabled && styles.disabledText
                ]}
              >
                Event Notifications
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  !notificationsEnabled && styles.disabledText
                ]}
              >
                Reminders for saved events
              </Text>
            </View>
            <Switch
              value={eventNotificationsEnabled && notificationsEnabled}
              onValueChange={(value) =>
                updateNotificationSetting("event_notifications", value)
              }
              disabled={!notificationsEnabled}
              trackColor={{ false: "#767577", true: theme.colors.primary }}
              thumbColor={
                eventNotificationsEnabled && notificationsEnabled
                  ? "#f4f3f4"
                  : "#f4f3f4"
              }
            />
          </View>

          {/* Game Notifications */}
          <View
            style={[
              styles.settingRow,
              !notificationsEnabled && styles.disabledSetting
            ]}
          >
            <View style={styles.settingTextContainer}>
              <Text
                style={[
                  styles.settingLabel,
                  !notificationsEnabled && styles.disabledText
                ]}
              >
                Game Notifications
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  !notificationsEnabled && styles.disabledText
                ]}
              >
                Notify when games start
              </Text>
            </View>
            <Switch
              value={gameNotificationsEnabled && notificationsEnabled}
              onValueChange={(value) =>
                updateNotificationSetting("game_notifications", value)
              }
              disabled={!notificationsEnabled}
              trackColor={{ false: "#767577", true: theme.colors.primary }}
              thumbColor={
                gameNotificationsEnabled && notificationsEnabled
                  ? "#f4f3f4"
                  : "#f4f3f4"
              }
            />
          </View>

          {/* Hospitality Notifications */}
          <View
            style={[
              styles.settingRow,
              !notificationsEnabled && styles.disabledSetting
            ]}
          >
            <View style={styles.settingTextContainer}>
              <Text
                style={[
                  styles.settingLabel,
                  !notificationsEnabled && styles.disabledText
                ]}
              >
                Hospitality Notifications
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  !notificationsEnabled && styles.disabledText
                ]}
              >
                Notify when hospitality suite opens/closes
              </Text>
            </View>
            <Switch
              value={hospitalityNotificationsEnabled && notificationsEnabled}
              onValueChange={(value) =>
                updateNotificationSetting("hospitality_notifications", value)
              }
              disabled={!notificationsEnabled}
              trackColor={{ false: "#767577", true: theme.colors.primary }}
              thumbColor={
                hospitalityNotificationsEnabled && notificationsEnabled
                  ? "#f4f3f4"
                  : "#f4f3f4"
              }
            />
          </View>
          </>
          )}

        </View>

        {/* Other Settings Section */}
        {isFeatureEnabled("bid_schedule_enabled") && (
        <View style={styles.settingsContainer}>
          <Text style={styles.sectionTitle}>Other Settings</Text>
          
          {/* Bid Schedule Toggle */}
          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Show Bid Schedule</Text>
              <Text style={styles.settingDescription}>
                Display bid presentation schedule in Program
              </Text>
            </View>
            <Switch
              value={showBidSchedule}
              onValueChange={handleBidScheduleToggle}
              trackColor={{ false: "#767577", true: theme.colors.primary }}
              thumbColor={showBidSchedule ? "#f4f3f4" : "#f4f3f4"}
            />
          </View>
        </View>
        )}

        {/* Schedule Sharing Section (Now uses fetched data) */}
        {isFeatureEnabled("schedule_sharing_enabled") && (
        <View style={styles.settingsContainer}>
          <Text style={styles.sectionTitle}>Schedule Sharing</Text>
          {/* Show loading indicator while fetching sharing lists */}
          {loadingSharing ? (
            <ActivityIndicator
              color={theme.colors.primary}
              style={{ marginVertical: theme.spacing.lg }}
            />
          ) : (
            <>
              {/* Lists using UserRow with fetched data */}
              {/* 1. Incoming Requests */}
              <Text style={styles.subsectionTitle}>Incoming Requests</Text>
              {incomingRequests.length > 0 ? (
                incomingRequests.map((user) => (
                  <UserRow
                    key={`incoming-${user.id}`}
                    user={user}
                    actions={
                      <>
                        <TouchableOpacity
                          onPress={() => handleAcceptRequest(user)}
                          style={[styles.actionButton, styles.acceptButton]}
                        >
                          <Ionicons
                            name="checkmark-circle-outline"
                            size={24}
                            color={theme.colors.success}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDenyRequestFlow(user)}
                          style={[styles.actionButton, styles.denyButton]}
                        >
                          <Ionicons
                            name="close-circle-outline"
                            size={24}
                            color={theme.colors.error}
                          />
                        </TouchableOpacity>
                      </>
                    }
                  />
                ))
              ) : (
                <Text style={styles.noSharingText}>
                  No incoming schedule requests.
                </Text>
              )}

              {/* 2. Sharing My Schedule With */}
              <Text style={styles.subsectionTitle}>
                Sharing My Schedule With
              </Text>
              {sharingWith.length > 0 ? (
                sharingWith.map((user) => (
                  <UserRow
                    key={`sharing-${user.id}`}
                    user={user}
                    actions={
                      <>
                        <TouchableOpacity
                          onPress={() => handleRemoveSharingFlow(user)}
                          style={[styles.actionButton, styles.denyButton]}
                        >
                          <Ionicons
                            name="close-circle-outline"
                            size={24}
                            color={theme.colors.error}
                          />
                        </TouchableOpacity>
                      </>
                    }
                  />
                ))
              ) : (
                <Text style={styles.noSharingText}>
                  You are not sharing your schedule with anyone.
                </Text>
              )}

              {/* 3. Pending Requests */}
              <Text style={styles.subsectionTitle}>Pending Requests</Text>
              {pendingRequests.length > 0 ? (
                pendingRequests.map((user) => (
                  <UserRow
                    key={`pending-${user.id}`}
                    user={user}
                    actions={
                      <TouchableOpacity
                        onPress={() => handleCancelRequest(user)}
                        style={[styles.actionButton, styles.denyButton]}
                      >
                        <Ionicons
                          name="close-circle-outline"
                          size={24}
                          color={theme.colors.error}
                        />
                      </TouchableOpacity>
                    }
                  />
                ))
              ) : (
                <Text style={styles.noSharingText}>
                  You have no pending requests to view others' schedules.
                </Text>
              )}

              {/* 4. Viewing Schedules From */}
              <Text style={styles.subsectionTitle}>Viewing Schedules From</Text>
              {viewingFrom.length > 0 ? (
                viewingFrom.map((user) => (
                  <UserRow
                    key={`viewing-${user.id}`}
                    user={user}
                    actions={
                      <TouchableOpacity
                        onPress={() => handleStopViewing(user)}
                        style={[styles.actionButton, styles.stopViewingButton]}
                      >
                        <Ionicons
                          name="close-circle-outline"
                          size={24}
                          color={theme.colors.error}
                        />
                      </TouchableOpacity>
                    }
                  />
                ))
              ) : (
                <Text style={styles.noSharingText}>
                  No one has shared their schedule with you yet.
                </Text>
              )}

              {/* 5. Banned Users */}
              <Text style={styles.subsectionTitle}>Banned Users</Text>
              {bannedUsers.length > 0 ? (
                bannedUsers.map((user) => (
                  <UserRow
                    key={`banned-${user.id}`}
                    user={user}
                    actions={
                      <TouchableOpacity
                        onPress={() => handleUnbanUser(user)}
                        style={[styles.actionButton, styles.unbanButton]}
                      >
                        <Text style={styles.actionButtonText}>Unban</Text>
                      </TouchableOpacity>
                    }
                  />
                ))
              ) : (
                <Text style={styles.noSharingText}>
                  You have not banned any users.
                </Text>
              )}
            </>
          )}
        </View>
        )}

        {/* Help & Safety Section */}
        <View style={styles.settingsContainer}>
          <Text style={styles.sectionTitle}>Help & Safety</Text>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => setTutorialVisible(true)}
          >
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Feature Tutorial</Text>
              <Text style={styles.settingDescription}>
                Learn about all the features available in the app
              </Text>
            </View>
            <Ionicons
              name="help-circle-outline"
              size={24}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => setSafetyVisible(true)}
          >
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Safety & Anonymity</Text>
              <Text style={styles.settingDescription}>
                Read our safety statement and policies
              </Text>
            </View>
            <Ionicons
              name="shield-checkmark-outline"
              size={24}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={styles.dangerZoneContainer}>
          <Text style={styles.dangerZoneTitle}>Danger Zone</Text>
          <Text style={styles.dangerZoneDescription}>
            Once you delete your profile, there is no going back. Please be
            certain.
          </Text>
          <TouchableOpacity
            style={styles.deleteProfileButton}
            onPress={handleDeleteProfile}
          >
            <Ionicons
              name="trash-outline"
              size={20}
              color={getTextColorForBackground(theme.colors.error)}
            />
            <Text style={styles.deleteProfileButtonText}>Delete Profile</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {/* Language Picker Modal - Hidden for now */}
      {/* <LanguagePicker 
        visible={languagePickerVisible}
        onClose={() => setLanguagePickerVisible(false)}
        changeLanguage={changeLanguage}
      /> */}
      
      {/* Tutorial Modal */}
      <TutorialModal 
        visible={tutorialVisible}
        onClose={() => setTutorialVisible(false)}
      />
      
      {/* Safety Modal */}
      <SafetyModal
        visible={safetyVisible}
        onClose={() => setSafetyVisible(false)}
      />
    </KeyboardAvoidingView>
  )
}

// Styles Function
const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background
    },
    scrollContent: {
      paddingBottom: theme.spacing.xl * 2,
      paddingHorizontal: theme.spacing.lg
    },
    centerContent: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center"
    },
    header: {
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.lg
    },
    title: {
      ...theme.typography.h1,
      color: theme.colors.text.primary,
      fontWeight: "bold"
    },
    profileImageContainer: {
      alignItems: "center",
      marginBottom: theme.spacing.xl
    },
    imageWrapper: {
      position: "relative"
    },
    profileImage: {
      width: 150,
      height: 150,
      borderRadius: 75,
      borderWidth: 3,
      borderColor: theme.colors.primary
    },
    placeholderImage: {
      width: 150,
      height: 150,
      borderRadius: 75,
      backgroundColor: theme.colors.surface,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 3,
      borderColor: theme.colors.border
    },
    editIconContainer: {
      position: "absolute",
      bottom: 0,
      right: 0,
      backgroundColor: theme.colors.primary,
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 3,
      borderColor: theme.colors.background
    },
    formContainer: {
      marginBottom: theme.spacing.xl
    },
    inputGroup: {
      marginBottom: theme.spacing.md
    },
    label: {
      ...theme.typography.body,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.xs,
      fontWeight: "bold"
    },
    input: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      color: theme.colors.text.primary,
      ...theme.typography.body,
      borderWidth: 1,
      borderColor: theme.colors.border
    },
    saveButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.md,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      alignItems: "center",
      marginTop: theme.spacing.lg
    },
    saveButtonText: {
      color: getTextColorForBackground(theme.colors.primary),
      fontWeight: "bold",
      ...theme.typography.button
    },
    settingsContainer: {
      marginBottom: theme.spacing.xl
    },
    sectionTitle: {
      ...theme.typography.h1,
      fontSize: 24,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.md,
      fontWeight: "bold",
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      paddingBottom: theme.spacing.sm
    },
    subsectionTitle: {
      ...theme.typography.h2,
      fontSize: 18,
      color: theme.colors.text.primary,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
      fontWeight: "bold"
    },
    settingRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border
    },
    settingTextContainer: {
      flex: 1,
      marginRight: theme.spacing.md
    },
    settingLabel: {
      ...theme.typography.body,
      color: theme.colors.text.primary,
      fontWeight: "bold",
      marginBottom: 4
    },
    settingDescription: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      fontSize: 14
    },
    disabledSetting: {
      opacity: 0.5
    },
    disabledText: {},
    privacyContainer: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.lg,
      borderRadius: theme.borderRadius.md,
      marginTop: theme.spacing.xl,
      borderWidth: 1,
      borderColor: theme.colors.border
    },
    privacyTitle: {
      ...theme.typography.h2,
      fontSize: 18,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.sm,
      fontWeight: "bold"
    },
    privacyText: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      lineHeight: 20
    },
    shareRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border
    },
    shareUserInfo: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1
    },
    shareUserImage: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: theme.spacing.md,
      backgroundColor: theme.colors.border
    },
    shareUserPlaceholderImage: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.border
    },
    shareUserText: {
      ...theme.typography.body,
      color: theme.colors.text.primary,
      fontWeight: "500",
      flexShrink: 1
    },
    shareActionsContainer: {
      flexDirection: "row",
      alignItems: "center"
    },
    actionButton: {
      marginLeft: theme.spacing.sm,
      padding: theme.spacing.xs,
      borderRadius: theme.borderRadius.sm
    },
    acceptButton: {},
    denyButton: {},
    removeButton: {},
    cancelButton: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.sm
    },
    unbanButton: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.sm
    },
    actionButtonText: {
      ...theme.typography.button,
      color: theme.colors.primary,
      fontSize: 14
    },
    loadingText: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      textAlign: "center",
      marginTop: theme.spacing.md,
      paddingVertical: theme.spacing.md
    },
    noSharingText: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      textAlign: "center",
      paddingVertical: theme.spacing.lg,
      fontStyle: "italic"
    },
    stopViewingButton: {
      // Inherits from actionButton, specific styles can go here if needed
    },
    formContainerMinimal: {
      width: "80%",
      marginTop: theme.spacing.lg
    },
    dangerZoneContainer: {
      marginTop: theme.spacing.xl,
      marginBottom: theme.spacing.xl,
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.error
    },
    dangerZoneTitle: {
      ...theme.typography.h2,
      fontSize: 18,
      color: theme.colors.error,
      marginBottom: theme.spacing.sm,
      fontWeight: "bold"
    },
    dangerZoneDescription: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing.lg
    },
    deleteProfileButton: {
      backgroundColor: theme.colors.error,
      borderRadius: theme.borderRadius.md,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: theme.spacing.sm
    },
    deleteProfileButtonText: {
      color: getTextColorForBackground(theme.colors.error),
      fontWeight: "bold",
      ...theme.typography.button
    },
    instructionText: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing.md
    }
  })
