import { Ionicons } from "@expo/vector-icons"
import * as Application from "expo-application"
import * as ImagePicker from "expo-image-picker"
import React, { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Alert,
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
import { useTheme } from "../../context/ThemeContext"
import { supabase } from "../../lib/supabase"
import { getTextColorForBackground } from "../../lib/theme"
import { Schedule, User } from "../../types/user"

// Function to get device identifier based on platform
async function getIdentifier() {
  if (Platform.OS === "ios") {
    let idfv = await Application.getIosIdForVendorAsync()
    console.log("iOS IDFV:", idfv)
    return idfv // Example: T563P9YS-856G-473X-H1J2-FC94L0T37IC6 or null
  }
  if (Platform.OS === "android") {
    let androidId = Application.getAndroidId()
    console.log("Android ID:", androidId)
    return androidId // Example: '9774d56d682e549c' or null
  }
  return null
}

// Type for the data needed for display in lists (subset of User)
type DisplayUser = Pick<
  User,
  "device_id" | "first_name" | "last_initial" | "profile_image"
>

export default function Profile() {
  const { theme, isDarkMode, toggleTheme } = useTheme()

  // State for current user data
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)

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
        console.log("Device ID:", id)
        setDeviceId(id)
      } catch (error) {
        console.error("Error getting device identifier:", error)
      }
    }

    fetchDeviceId()
  }, [])

  // Fetch current user profile and schedule data based on deviceId
  useEffect(() => {
    if (!deviceId) return // Don't fetch until deviceId is available

    const fetchUserData = async () => {
      setLoadingProfile(true)
      setLoadingSharing(true)
      console.log(`Fetching user data for device ID: ${deviceId}`)
      try {
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("*")
          .eq("device_id", deviceId)
          .single()

        if (userError && userError.code !== "PGRST116") {
          // PGRST116: Row not found
          console.error("Error fetching user data:", userError)
          throw userError
        }

        if (userData) {
          console.log("User data found:", userData.first_name)
          setCurrentUser(userData as User)
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
          const schedule = userData.schedule || {
            requested_share: [],
            shared_with: [],
            pending_share: [],
            shared_by: [],
            banned: []
          } // Use fetched or default empty schedule
          await fetchSharingListsDetails(schedule)
        } else {
          console.log("No user found for this device ID. Need to create one?")
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
  }, [deviceId]) // Re-run if deviceId changes

  // Function to fetch user details for sharing lists
  const fetchSharingListsDetails = async (schedule: Schedule) => {
    // Helper to get device_ids from user IDs
    const getDeviceIdsFromUserIds = async (
      userIds: number[]
    ): Promise<string[]> => {
      if (!userIds || userIds.length === 0) return []
      try {
        const { data, error } = await supabase
          .from("users")
          .select("device_id")
          .in("id", userIds) // Filter by primary user ID
        if (error) throw error
        return data ? data.map((u) => u.device_id) : []
      } catch (error) {
        console.error("Error fetching device IDs from user IDs:", error)
        return []
      }
    }

    // Original helper to get display details from device_ids
    const fetchUserDetailsByDeviceIds = async (
      deviceIds: string[]
    ): Promise<DisplayUser[]> => {
      if (!deviceIds || deviceIds.length === 0) return []
      try {
        const { data, error } = await supabase
          .from("users")
          .select("device_id, first_name, last_initial, profile_image")
          .in("device_id", deviceIds) // Filter by device_id
        if (error) throw error
        return data || []
      } catch (error) {
        console.error("Error fetching user details by device IDs:", error)
        return [] // Return empty on error
      }
    }

    // Fetch device IDs first, then fetch details
    try {
      const [
        incomingDeviceIds,
        sharingDeviceIds,
        pendingDeviceIds,
        viewingDeviceIds,
        bannedDeviceIds
      ] = await Promise.all([
        getDeviceIdsFromUserIds(schedule.requested_share || []),
        getDeviceIdsFromUserIds(schedule.shared_with || []),
        getDeviceIdsFromUserIds(schedule.pending_share || []),
        getDeviceIdsFromUserIds(schedule.shared_by || []),
        getDeviceIdsFromUserIds(schedule.banned || [])
      ])

      // Now fetch display details using the obtained device IDs
      const [incoming, sharing, pending, viewing, banned] = await Promise.all([
        fetchUserDetailsByDeviceIds(incomingDeviceIds),
        fetchUserDetailsByDeviceIds(sharingDeviceIds),
        fetchUserDetailsByDeviceIds(pendingDeviceIds),
        fetchUserDetailsByDeviceIds(viewingDeviceIds),
        fetchUserDetailsByDeviceIds(bannedDeviceIds)
      ])

      setIncomingRequests(incoming)
      setSharingWith(sharing)
      setPendingRequests(pending)
      setViewingFrom(viewing)
      setBannedUsers(banned)
      console.log("Fetched sharing list details.")
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
  }

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
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8
    })

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setProfileImage(result.assets[0].uri)
      // TODO: Add logic to upload image URI to Supabase storage and get URL
    }
  }

  // Save profile information (Only Name/Image)
  const saveUserProfileInfo = async () => {
    if (!deviceId) {
      Alert.alert("Error", "Device ID not found. Cannot save profile.")
      return
    }
    // TODO: Implement proper image upload and get URL before saving
    const profileDataToSave = {
      first_name: firstName,
      last_initial: lastInitial,
      profile_image: profileImage // This should be the URL after upload
    }
    console.log("Saving Profile Info:", profileDataToSave)

    try {
      const { error } = await supabase
        .from("users")
        .update(profileDataToSave)
        .eq("device_id", deviceId)

      if (error) throw error

      Alert.alert(
        "Profile Updated",
        "Your profile information has been updated."
      )
      // Re-fetch user data to ensure UI consistency if needed, or update currentUser state directly
      // Example direct update:
      // setCurrentUser(prev => prev ? { ...prev, ...profileDataToSave } : null);
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

    console.log(`Updating setting ${settingKey} to ${value}`)

    // Prepare the update payload for the settings JSONB column
    const currentSettings = currentUser.settings || {}
    const newSettings = { ...currentSettings, [settingKey]: value }

    try {
      const { error } = await supabase
        .from("users")
        .update({ settings: newSettings })
        .eq("device_id", deviceId)

      if (error) throw error

      // Update the currentUser state as well for consistency
      setCurrentUser((prev) =>
        prev ? { ...prev, settings: newSettings } : null
      )
      console.log(`Successfully updated ${settingKey}`)
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
            if (!deviceId) return
            console.log("Banning user:", user.device_id)
            // TODO: Implement API call to add user.device_id to current user's schedule.banned list
            // AND potentially remove from other lists atomically (e.g., via RPC)
            try {
              // Example RPC: await supabase.rpc('ban_user', { current_user_device_id: deviceId, target_user_device_id: user.device_id });
              await new Promise((resolve) => setTimeout(resolve, 300)) // Simulate API
              sourceListUpdateFn?.() // Update source list UI
              if (
                !bannedUsers.some(
                  (banned) => banned.device_id === user.device_id
                )
              ) {
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
    if (!deviceId) return
    console.log("Accepting request from:", user.device_id)
    // TODO: Implement API call to:
    // 1. Remove user.device_id from current user's schedule.requested_share
    // 2. Add user.device_id to current user's schedule.shared_with
    // 3. Add deviceId to target user's schedule.shared_by
    // 4. Remove deviceId from target user's schedule.pending_share
    // (Consider doing this atomically with an RPC)
    try {
      // Example RPC: await supabase.rpc('accept_share_request', { requester_device_id: user.device_id, acceptor_device_id: deviceId });
      await new Promise((resolve) => setTimeout(resolve, 300)) // Simulate API
      setIncomingRequests((prev) =>
        prev.filter((u) => u.device_id !== user.device_id)
      )
      setSharingWith((prev) => [...prev, user])
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
            if (!deviceId) return
            console.log("Denying request from:", user.device_id)
            // TODO: Implement API call to remove user.device_id from current user's schedule.requested_share
            try {
              // Example: await supabase.rpc('deny_share_request', { requester_device_id: user.device_id, current_user_device_id: deviceId });
              await new Promise((resolve) => setTimeout(resolve, 300)) // Simulate API
              setIncomingRequests((prev) =>
                prev.filter((u) => u.device_id !== user.device_id)
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
                prev.filter((u) => u.device_id !== user.device_id)
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
            if (!deviceId) return
            console.log("Removing sharing with:", user.device_id)
            // TODO: Implement API call to:
            // 1. Remove user.device_id from current user's schedule.shared_with
            // 2. Remove deviceId from target user's schedule.shared_by
            // (Consider RPC)
            try {
              // Example: await supabase.rpc('remove_sharing', { current_user_device_id: deviceId, target_user_device_id: user.device_id });
              await new Promise((resolve) => setTimeout(resolve, 300)) // Simulate API
              setSharingWith((prev) =>
                prev.filter((u) => u.device_id !== user.device_id)
              )
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
              setSharingWith((prev) =>
                prev.filter((u) => u.device_id !== user.device_id)
              )
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
            if (!deviceId) return
            console.log("Cancelling pending request for:", user.device_id)
            // TODO: Implement API call to:
            // 1. Remove user.device_id from current user's schedule.pending_share
            // 2. Remove deviceId from target user's schedule.requested_share
            // (Consider RPC)
            try {
              // Example: await supabase.rpc('cancel_share_request', { current_user_device_id: deviceId, target_user_device_id: user.device_id });
              await new Promise((resolve) => setTimeout(resolve, 300)) // Simulate API
              setPendingRequests((prev) =>
                prev.filter((u) => u.device_id !== user.device_id)
              )
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
            if (!deviceId) return
            console.log("Stopping viewing schedule from:", user.device_id)
            // TODO: Implement API call to:
            // 1. Remove user.device_id from current user's schedule.shared_by
            // 2. Remove deviceId from target user's schedule.shared_with
            // (Consider RPC)
            try {
              // Example: await supabase.rpc('stop_viewing_schedule', { current_user_device_id: deviceId, target_user_device_id: user.device_id });
              await new Promise((resolve) => setTimeout(resolve, 300)) // Simulate API
              setViewingFrom((prev) =>
                prev.filter((u) => u.device_id !== user.device_id)
              )
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
            if (!deviceId) return
            console.log("Unbanning user:", user.device_id)
            // TODO: Implement API call to remove user.device_id from current user's schedule.banned list
            try {
              // Example: await supabase.rpc('unban_user', { current_user_device_id: deviceId, target_user_device_id: user.device_id });
              await new Promise((resolve) => setTimeout(resolve, 300)) // Simulate API
              setBannedUsers((prev) =>
                prev.filter((u) => u.device_id !== user.device_id)
              )
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
      <View style={[styles.container, styles.centerContent]}>
        <Ionicons
          name="person-add-outline"
          size={60}
          color={theme.colors.text.secondary}
          style={{ marginBottom: theme.spacing.lg }}
        />
        <Text style={styles.sectionTitle}>Create Profile</Text>
        <Text>It looks like you don't have a profile yet.</Text>
        <Text>Enter your name below to get started.</Text>
        {/* Simplified form to create initial profile */}
        <View style={styles.formContainerMinimal}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>First Name</Text>
            <TextInput
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
                console.log("Creating user:", {
                  device_id: deviceId,
                  first_name: firstName,
                  last_initial: lastInitial
                })
                // Actual Supabase insert call
                const { error: insertError } = await supabase
                  .from("users")
                  .insert({
                    device_id: deviceId,
                    first_name: firstName,
                    last_initial: lastInitial,
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
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
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

          {/* Notification Settings (Updated with direct updates) */}
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
        </View>

        {/* Schedule Sharing Section (Now uses fetched data) */}
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
                    key={`incoming-${user.device_id}`}
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
                    key={`sharing-${user.device_id}`}
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
                    key={`pending-${user.device_id}`}
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
                    key={`viewing-${user.device_id}`}
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
                    key={`banned-${user.device_id}`}
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
      </ScrollView>
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
    }
  })
