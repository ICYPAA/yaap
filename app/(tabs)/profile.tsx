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
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native"
import { theme } from "../../constants/theme"

export default function Profile() {
  const [firstName, setFirstName] = useState("")
  const [lastInitial, setLastInitial] = useState("")
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [sobrietyDate, setSobrietyDate] = useState("")
  const [homeGroup, setHomeGroup] = useState("")
  const [bio, setBio] = useState("")

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

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Sobriety Date (Optional)</Text>
            <TextInput
              style={styles.input}
              value={sobrietyDate}
              onChangeText={setSobrietyDate}
              placeholder="MM/DD/YYYY"
              placeholderTextColor={theme.colors.text.secondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Home Group (Optional)</Text>
            <TextInput
              style={styles.input}
              value={homeGroup}
              onChangeText={setHomeGroup}
              placeholder="Enter your home group"
              placeholderTextColor={theme.colors.text.secondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>About Me (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Share a little about yourself"
              placeholderTextColor={theme.colors.text.secondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={saveProfile}>
            <Text style={styles.saveButtonText}>Save Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Privacy Notice */}
        <View style={styles.privacyContainer}>
          <Text style={styles.privacyTitle}>Privacy Information</Text>
          <Text style={styles.privacyText}>
            Your profile information is only shared with other conference
            attendees when you choose to share your schedule. Your sobriety date
            and personal information are always kept private.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
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
  textArea: {
    minHeight: 100,
    textAlignVertical: "top"
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: "center",
    marginTop: theme.spacing.lg
  },
  saveButtonText: {
    color: theme.colors.background,
    ...theme.typography.body,
    fontWeight: "bold"
  },
  privacyContainer: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xl
  },
  privacyTitle: {
    ...theme.typography.h3,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
    fontWeight: "bold"
  },
  privacyText: {
    ...theme.typography.body,
    color: theme.colors.text.secondary
  }
})
