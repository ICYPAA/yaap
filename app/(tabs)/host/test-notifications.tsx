import { Ionicons } from "@expo/vector-icons"
import Constants from "expo-constants"
import * as Notifications from "expo-notifications"
import { useRouter } from "expo-router"
import React, { useEffect, useState } from "react"
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native"
import { useDebug } from "../../../context/DebugContext"
import { useTheme } from "../../../context/ThemeContext"

interface NotificationTest {
  id: string
  title: string
  description: string
  icon: React.ComponentProps<typeof Ionicons>["name"]
  color: string
}

interface ThemeType {
  colors: {
    background: string
    surface: string
    primary: string
    secondary: string
    error: string
    warning: string
    success: string
    info: string
    text: {
      primary: string
      secondary: string
    }
  }
  spacing: {
    xs: number
    sm: number
    md: number
    lg: number
    xl: number
  }
  typography: {
    h1?: { fontSize?: number }
    h2?: { fontSize?: number }
    h3?: { fontSize?: number }
    body?: { fontSize?: number }
    subtitle?: { fontSize?: number }
    caption?: { fontSize?: number }
    button?: { fontSize?: number }
  }
  borderRadius: {
    sm: number
    md: number
  }
  shadows: {
    small: object
  }
}

export default function TestNotifications() {
  const router = useRouter()
  const { theme } = useTheme()
  const { isDebugMode } = useDebug()
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)

  // Redirect if not in debug mode
  useEffect(() => {
    if (!isDebugMode) {
      router.replace("/host/index" as any)
    }
  }, [isDebugMode, router])

  const testNotifications: NotificationTest[] = [
    {
      id: "hospitality",
      title: "Hospitality Update",
      description: "Test push notification for hospitality updates",
      icon: "restaurant",
      color: theme.colors.primary
    },
    {
      id: "schedule",
      title: "Schedule Shared",
      description: "Test push notification for when you share your schedule",
      icon: "calendar",
      color: theme.colors.success
    },
    {
      id: "event",
      title: "Event Starting Soon",
      description: "Test push notification for event starting soon alerts",
      icon: "time",
      color: theme.colors.warning
    },
    {
      id: "mainmeeting",
      title: "Main Meeting",
      description: "Test push notification for main meeting starting soon",
      icon: "people",
      color: theme.colors.info
    },
    {
      id: "host",
      title: "Host Committee",
      description: "Test push notification for host committee updates",
      icon: "megaphone",
      color: theme.colors.secondary
    },
    {
      id: "registration",
      title: "Registration Status",
      description: "Test push notification for registration opened/closed",
      icon: "card",
      color: theme.colors.primary
    },
    {
      id: "mafia",
      title: "Game Update: Mafia",
      description: "Test push notification for custom game updates",
      icon: "game-controller",
      color: theme.colors.error
    }
  ]

  useEffect(() => {
    const updateStatus = async () => {
      const { status } = await Notifications.getPermissionsAsync()
      setPermissionStatus(status)
    }
    updateStatus()
  }, [])

  const requestPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync()
    setPermissionStatus(status)
    return status
  }

  const sendPushNotification = async (
    expoPushToken: string,
    notification: NotificationTest
  ) => {
    const message = {
      to: expoPushToken,
      sound: "default",
      title: notification.title,
      body: getNotificationBody(notification.id),
      data: { screen: getTargetScreen(notification.id) }
    }

    try {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(message)
      })
      Alert.alert(
        "Success",
        `Test push notification for "${notification.title}" sent successfully!`
      )
    } catch (error) {
      console.error("Error sending push notification via Expo server:", error)
      Alert.alert(
        "Error",
        `Failed to send push notification: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }

  const handleSendTestNotification = async (notification: NotificationTest) => {
    if (isSending) return
    setIsSending(true)

    try {
      let { status: currentStatus } = await Notifications.getPermissionsAsync()
      setPermissionStatus(currentStatus)
      if (currentStatus !== "granted") {
        const { status: newStatus } =
          await Notifications.requestPermissionsAsync()
        currentStatus = newStatus
        setPermissionStatus(currentStatus)
      }

      if (currentStatus !== "granted") {
        Alert.alert(
          "Permission Required",
          "Notification permissions are needed to get the push token and send a test notification."
        )
        setIsSending(false)
        return
      }

      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId
      if (!projectId) {
        Alert.alert(
          "Project ID Error",
          "Could not find Project ID. Configure it in eas.json or app.json."
        )
        setIsSending(false)
        return
      }

      let token: string | null = null
      try {
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
        console.log("Expo Push Token:", token)
      } catch (e) {
        console.error("Error getting Expo Push Token:", e)
        Alert.alert(
          "Token Error",
          `Failed to get Expo Push Token: ${
            e instanceof Error ? e.message : String(e)
          }`
        )
        setIsSending(false)
        return
      }

      if (!token) {
        Alert.alert("Token Error", "Failed to get Expo Push Token.")
        setIsSending(false)
        return
      }

      await sendPushNotification(token, notification)
    } catch (error) {
      console.error("Error in handleSendTestNotification:", error)
      Alert.alert(
        "Error",
        `An unexpected error occurred: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    } finally {
      setIsSending(false)
    }
  }

  const getNotificationBody = (id: string): string => {
    switch (id) {
      case "hospitality":
        return "New food options available! Coffee and pastries now serving in the hospitality room."
      case "schedule":
        return "You've shared your personal schedule with 2 other attendees."
      case "event":
        return "The Meditation Meeting you're interested in starts in 15 minutes!"
      case "mainmeeting":
        return "The Main Speaker Meeting starts in 30 minutes. Don't miss it!"
      case "host":
        return "New support request received. Someone needs assistance at registration."
      case "registration":
        return "Registration is now open! Register early for special pricing."
      case "mafia":
        return "It's your turn in the Mafia game! The town is waiting for your vote."
      default:
        return "New push notification from ICYPAA."
    }
  }

  const getTargetScreen = (id: string): string => {
    switch (id) {
      case "hospitality":
        return "host/hospitality"
      case "schedule":
        return "schedule"
      case "event":
        return "events"
      case "mainmeeting":
        return "events"
      case "host":
        return "host"
      case "registration":
        return "registration"
      case "mafia":
        return "games"
      default:
        return "home"
    }
  }

  // If not in debug mode, don't render anything (redirect handles it)
  if (!isDebugMode) {
    return null
  }

  return (
    <SafeAreaView style={styles(theme).container}>
      <View style={styles(theme).header}>
        <TouchableOpacity
          style={styles(theme).backButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={theme.colors.background}
          />
        </TouchableOpacity>
        <Text style={styles(theme).title}>Test Push Notifications</Text>
        <View style={styles(theme).debugBadge}>
          <Text style={styles(theme).debugText}>DEBUG</Text>
        </View>
      </View>

      <ScrollView style={styles(theme).scrollContainer}>
        <Text style={styles(theme).description}>
          Tap on any card below to send a test push notification. These
          notifications will appear on your device immediately, even when the
          app is in the background. This testing feature is only available in
          debug mode.
        </Text>

        <View style={styles(theme).notificationsContainer}>
          {testNotifications.map((notification) => (
            <TouchableOpacity
              key={notification.id}
              style={styles(theme).notificationCard}
              onPress={() => handleSendTestNotification(notification)}
              disabled={isSending}
            >
              <View
                style={[
                  styles(theme).iconContainer,
                  { backgroundColor: notification.color }
                ]}
              >
                <Ionicons
                  name={notification.icon}
                  size={24}
                  color={theme.colors.background}
                />
              </View>
              <View style={styles(theme).textContainer}>
                <Text style={styles(theme).notificationTitle}>
                  {notification.title}
                </Text>
                <Text style={styles(theme).notificationDescription}>
                  {notification.description}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles(theme).permissionSection}>
          <Text style={styles(theme).permissionTitle}>
            Push Notification Permission Status
          </Text>
          <Text
            style={[
              styles(theme).permissionStatus,
              {
                color:
                  permissionStatus === "granted"
                    ? theme.colors.success
                    : theme.colors.error
              }
            ]}
          >
            {permissionStatus === "granted"
              ? "✓ Push Notification Permissions Granted"
              : "✗ Push Notification Permissions Not Granted"}
          </Text>
          {permissionStatus !== "granted" && (
            <TouchableOpacity
              style={styles(theme).requestPermissionButton}
              onPress={requestPermissions}
              disabled={isSending}
            >
              <Text style={styles(theme).requestPermissionText}>
                Request Push Notification Permissions
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = (theme: ThemeType) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      padding: theme.spacing.md,
      backgroundColor: theme.colors.primary
    },
    backButton: {
      marginRight: theme.spacing.md
    },
    title: {
      fontSize: theme.typography.h1?.fontSize || 24,
      color: theme.colors.background,
      fontWeight: "bold",
      flex: 1
    },
    debugBadge: {
      backgroundColor: theme.colors.error,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.borderRadius.md
    },
    debugText: {
      color: theme.colors.background,
      fontSize: 12,
      fontWeight: "bold"
    },
    scrollContainer: {
      flex: 1,
      padding: theme.spacing.md
    },
    description: {
      fontSize: theme.typography.body?.fontSize || 16,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing.lg,
      lineHeight: 22
    },
    notificationsContainer: {
      marginBottom: theme.spacing.lg
    },
    notificationCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
      ...theme.shadows.small
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: "center",
      alignItems: "center",
      marginRight: theme.spacing.md
    },
    textContainer: {
      flex: 1
    },
    notificationTitle: {
      fontSize: theme.typography.subtitle?.fontSize || 18,
      color: theme.colors.text.primary,
      fontWeight: "600",
      marginBottom: theme.spacing.xs
    },
    notificationDescription: {
      fontSize: theme.typography.caption?.fontSize || 14,
      color: theme.colors.text.secondary
    },
    permissionSection: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.xl,
      ...theme.shadows.small
    },
    permissionTitle: {
      fontSize: theme.typography.subtitle?.fontSize || 18,
      color: theme.colors.text.primary,
      fontWeight: "600",
      marginBottom: theme.spacing.sm
    },
    permissionStatus: {
      fontSize: theme.typography.body?.fontSize || 16,
      marginBottom: theme.spacing.md
    },
    requestPermissionButton: {
      backgroundColor: theme.colors.primary,
      padding: theme.spacing.sm,
      borderRadius: theme.borderRadius.sm,
      alignItems: "center"
    },
    requestPermissionText: {
      color: theme.colors.background,
      fontSize: theme.typography.button?.fontSize || 16,
      fontWeight: "500"
    }
  })
