import { Ionicons } from "@expo/vector-icons"
import * as ImagePicker from "expo-image-picker"
import React, { useEffect, useState } from "react"
import {
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
import { useDebug } from "../../context/DebugContext"
import { useTheme } from "../../context/ThemeContext"
import { supabase } from "../../lib/supabase"

// TODO: Replace this with actual device ID retrieval logic
const currentUserDeviceId = "DEVICE_ID_PLACEHOLDER"

export default function Profile() {
  const { theme, isDarkMode, toggleTheme } = useTheme()
  const { isDebugMode, toggleDebugMode } = useDebug()

  const [firstName, setFirstName] = useState("")
  const [lastInitial, setLastInitial] = useState("")
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [eventRemindersEnabled, setEventRemindersEnabled] = useState(true)
  const [messageNotificationsEnabled, setMessageNotificationsEnabled] =
    useState(true)
  const [sharedWithList, setSharedWithList] = useState<string[]>([])
  const [loadingSharing, setLoadingSharing] = useState(true)

  // Fetch sharing info
  useEffect(() => {
    const fetchSharingInfo = async () => {
      if (
        !currentUserDeviceId ||
        currentUserDeviceId === "DEVICE_ID_PLACEHOLDER"
      ) {
        console.warn("Device ID not available for fetching sharing info.")
        setLoadingSharing(false)
        return
      }

      setLoadingSharing(true)
      try {
        const { data, error } = await supabase
          .from("schedule")
          .select("shared_with")
          .eq("id", currentUserDeviceId)
          .single()

        if (error && error.code !== "PGRST116") {
          // PGRST116 = Row not found, which is okay
          throw error
        }

        if (data && data.shared_with) {
          setSharedWithList(data.shared_with)
        } else {
          setSharedWithList([]) // No one shared with yet, or no row exists
        }
      } catch (error: any) {
        console.error("Error fetching sharing info:", error)
        Alert.alert("Error", "Could not load sharing information.")
      } finally {
        setLoadingSharing(false)
      }
    }

    fetchSharingInfo()
  }, [])

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

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri)
    }
  }

  // Save profile information
  const saveProfile = () => {
    // In a real app, you would save this to AsyncStorage or a backend
    Alert.alert("Profile Saved", "Your profile information has been updated.")
  }

  // Handle removing a shared user
  const handleRemoveShare = async (deviceIdToRemove: string) => {
    const updatedList = sharedWithList.filter((id) => id !== deviceIdToRemove)

    try {
      const { error } = await supabase
        .from("schedule")
        .update({ shared_with: updatedList })
        .eq("id", currentUserDeviceId)

      if (error) {
        throw error
      }

      setSharedWithList(updatedList) // Update local state on success
      Alert.alert("Success", `Sharing removed for ${deviceIdToRemove}.`)
    } catch (error: any) {
      console.error("Error removing share:", error)
      Alert.alert("Error", "Could not remove sharing.")
    }
  }

  // Create styles with the current theme
  const styles = createStyles(theme)

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

          <TouchableOpacity style={styles.saveButton} onPress={saveProfile}>
            <Text style={styles.saveButtonText}>Save Profile</Text>
          </TouchableOpacity>
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

          {/* Notification Settings */}
          <Text style={styles.subsectionTitle}>Notifications</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Enable Notifications</Text>
              <Text style={styles.settingDescription}>
                Master toggle for all notifications
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: "#767577", true: theme.colors.primary }}
              thumbColor={notificationsEnabled ? "#f4f3f4" : "#f4f3f4"}
            />
          </View>

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
                Event Reminders
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  !notificationsEnabled && styles.disabledText
                ]}
              >
                Receive reminders for upcoming events
              </Text>
            </View>
            <Switch
              value={eventRemindersEnabled && notificationsEnabled}
              onValueChange={setEventRemindersEnabled}
              disabled={!notificationsEnabled}
              trackColor={{ false: "#767577", true: theme.colors.primary }}
              thumbColor={
                eventRemindersEnabled && notificationsEnabled
                  ? "#f4f3f4"
                  : "#f4f3f4"
              }
            />
          </View>

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
                Messages
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  !notificationsEnabled && styles.disabledText
                ]}
              >
                Receive notifications for new messages
              </Text>
            </View>
            <Switch
              value={messageNotificationsEnabled && notificationsEnabled}
              onValueChange={setMessageNotificationsEnabled}
              disabled={!notificationsEnabled}
              trackColor={{ false: "#767577", true: theme.colors.primary }}
              thumbColor={
                messageNotificationsEnabled && notificationsEnabled
                  ? "#f4f3f4"
                  : "#f4f3f4"
              }
            />
          </View>
        </View>

        {/* Schedule Sharing Section */}
        <View style={styles.settingsContainer}>
          <Text style={styles.sectionTitle}>Schedule Sharing</Text>
          {loadingSharing ? (
            <Text style={styles.loadingText}>Loading sharing info...</Text>
          ) : sharedWithList.length > 0 ? (
            sharedWithList.map((deviceId) => (
              <View key={deviceId} style={styles.shareRow}>
                <View style={styles.shareUserInfo}>
                  <Ionicons
                    name="person-circle-outline"
                    size={24}
                    color={theme.colors.text.secondary}
                    style={styles.shareUserIcon}
                  />
                  {/* TODO: Fetch and display actual user name based on deviceId */}
                  <Text style={styles.shareUserText}>
                    User ({deviceId.substring(0, 6)}...)
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleRemoveShare(deviceId)}
                  style={styles.removeButton}
                >
                  <Ionicons
                    name="close-circle"
                    size={24}
                    color={theme.colors.error}
                  />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={styles.noSharingText}>
              You haven't shared your schedule with anyone.
            </Text>
          )}
        </View>

        {/* Privacy Notice */}
        <View style={styles.privacyContainer}>
          <Text style={styles.privacyTitle}>Privacy Information</Text>
          <Text style={styles.privacyText}>
            Your profile information is only shared with other conference
            attendees when you choose to share your schedule. Your personal
            information is always kept private.
          </Text>
        </View>

        {/* Debug Mode Toggle (hidden at the bottom) */}
        <View style={styles.debugContainer}>
          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Debug Mode</Text>
              <Text style={styles.settingDescription}>
                Enable debug features for development and testing
              </Text>
            </View>
            <Switch
              value={isDebugMode}
              onValueChange={toggleDebugMode}
              trackColor={{ false: "#767577", true: theme.colors.error }}
              thumbColor={isDebugMode ? "#f4f3f4" : "#f4f3f4"}
            />
          </View>

          {isDebugMode && (
            <View style={styles.debugWarning}>
              <Ionicons name="warning" size={16} color={theme.colors.error} />
              <Text style={styles.debugWarningText}>
                Debug mode bypasses authentication and uses mock data
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// Move styles to a function to use the current theme
const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background
    },
    scrollContent: {
      padding: theme.spacing.lg
    },
    header: {
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
      padding: theme.spacing.md,
      alignItems: "center",
      marginTop: theme.spacing.lg
    },
    saveButtonText: {
      color: "#FFFFFF", // White text for buttons
      fontWeight: "bold"
    },
    settingsContainer: {
      marginBottom: theme.spacing.xl
    },
    sectionTitle: {
      ...theme.typography.h2,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.md,
      fontWeight: "bold"
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
      opacity: 0.6
    },
    disabledText: {
      color: theme.colors.text.secondary
    },
    privacyContainer: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.lg,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.xl
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
      color: theme.colors.text.secondary
    },
    debugContainer: {
      marginBottom: theme.spacing.xl,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.error
    },
    debugWarning: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: "rgba(255, 0, 0, 0.05)",
      borderRadius: theme.borderRadius.sm
    },
    debugWarningText: {
      ...theme.typography.caption,
      color: theme.colors.error,
      marginLeft: theme.spacing.xs
    },
    shareRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border
    },
    shareUserInfo: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1 // Allow user info to take available space
    },
    shareUserIcon: {
      marginRight: theme.spacing.sm
    },
    shareUserText: {
      ...theme.typography.body,
      color: theme.colors.text.primary,
      flexShrink: 1 // Prevent text from pushing button away
    },
    removeButton: {
      paddingLeft: theme.spacing.md // Add padding to make it easier to tap
    },
    loadingText: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      textAlign: "center",
      paddingVertical: theme.spacing.md
    },
    noSharingText: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      textAlign: "center",
      paddingVertical: theme.spacing.md
    }
  })
