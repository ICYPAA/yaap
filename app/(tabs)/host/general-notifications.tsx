import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import React, { useState } from "react"
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native"
import { useTheme } from "../../../context/ThemeContext"
import { sendNotification } from "../../../lib/notificationHelper"
import { getTextColorForBackground } from "../../../lib/theme"

export default function GeneralNotifications() {
  const { theme } = useTheme()
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [isSending, setIsSending] = useState(false)

  const styles = React.useMemo(() => createStyles(theme), [theme])

  const handleSendNotification = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert("Error", "Please enter both title and description.")
      return
    }

    setIsSending(true)
    try {
      // Send notification with specific type for general announcements
      await sendNotification({
        eventType: "host", // Using 'host' as a general category, adjust if needed
        programId: 1, // Assuming programId 1, adjust if dynamic
        data: {
          // Specific data payload for this notification type
          type: "general",
          title: title,
          message: description
        }
      })

      Alert.alert("Success", "Notification sent successfully!")
      setTitle("")
      setDescription("")
    } catch (error: any) {
      console.error("Error sending notification:", error)
      Alert.alert(
        "Error",
        `An error occurred while sending: ${error.message || "Unknown error"}`
      )
    } finally {
      setIsSending(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons
            name="chevron-back"
            size={28}
            color={theme.colors.primary}
          />
        </TouchableOpacity>
        <Text style={styles.headerText}>Send General Notification</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.formContainer}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter notification title"
            placeholderTextColor={theme.colors.text.secondary}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Enter notification description"
            placeholderTextColor={theme.colors.text.secondary}
            multiline
            numberOfLines={4}
          />

          <TouchableOpacity
            style={[styles.button, isSending && styles.buttonDisabled]}
            onPress={handleSendNotification}
            disabled={isSending}
          >
            <Text style={styles.buttonText}>
              {isSending ? "Sending..." : "Send Notification"}
            </Text>
            {!isSending && (
              <Ionicons
                name="send"
                size={18}
                color={getTextColorForBackground(theme.colors.primary)}
                style={styles.icon}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
      paddingHorizontal: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.card
    },
    backButton: {
      padding: 5
    },
    headerText: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.colors.text.primary
    },
    headerRightPlaceholder: {
      width: 28 + 10
    },
    container: {
      flex: 1,
      padding: 20
    },
    formContainer: {
      flex: 1
    },
    label: {
      fontSize: 16,
      color: theme.colors.text.primary,
      marginBottom: 8,
      fontWeight: "600"
    },
    input: {
      backgroundColor: theme.colors.card,
      color: theme.colors.text.primary,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      paddingHorizontal: 15,
      paddingVertical: 12,
      fontSize: 16,
      marginBottom: 20
    },
    textArea: {
      height: 120,
      textAlignVertical: "top"
    },
    button: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 15,
      borderRadius: 8,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      marginTop: 10
    },
    buttonDisabled: {
      backgroundColor: theme.colors.disabled
    },
    buttonText: {
      color: getTextColorForBackground(theme.colors.primary),
      fontSize: 18,
      fontWeight: "bold"
    },
    icon: {
      marginLeft: 8
    }
  })
