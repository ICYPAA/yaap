import * as Notifications from "expo-notifications"
import { Stack } from "expo-router"
import React from "react"
import { FlatList, Platform, StyleSheet, Text, View } from "react-native"
import { useTheme } from "../context/ThemeContext"

// Sample notification data
const notifications = [
  {
    id: "1",
    title: "Event Starting Soon",
    message: "Speaker Meeting starts in 15 minutes in Grand Ballroom A",
    time: "10 minutes ago"
  },
  {
    id: "2",
    title: "Schedule Change",
    message: "Workshop location changed to Conference Room B",
    time: "1 hour ago"
  },
  {
    id: "3",
    title: "New Message",
    message: "You have a new message from the host committee",
    time: "3 hours ago"
  }
]

export default function NotificationsScreen() {
  const { theme } = useTheme()
  const styles = createStyles(theme)

  const renderNotification = ({ item }) => (
    <View style={styles.notificationItem}>
      <View style={styles.notificationContent}>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        <Text style={styles.notificationMessage}>{item.message}</Text>
        <Text style={styles.notificationTime}>{item.time}</Text>
      </View>
    </View>
  )

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Notifications" }} />
      {notifications.length > 0 ? (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      )}
    </View>
  )
}

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background
    },
    listContent: {
      padding: theme.spacing.md
    },
    notificationItem: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.md,
      padding: theme.spacing.md,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.primary
    },
    notificationContent: {
      flex: 1
    },
    notificationTitle: {
      ...theme.typography.body,
      fontWeight: "bold",
      color: theme.colors.text.primary,
      marginBottom: 4
    },
    notificationMessage: {
      ...theme.typography.body,
      color: theme.colors.text.primary,
      marginBottom: 8
    },
    notificationTime: {
      ...theme.typography.caption,
      color: theme.colors.text.secondary
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing.lg
    },
    emptyText: {
      ...theme.typography.body,
      color: theme.colors.text.secondary
    }
  })

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

  token = (
    await Notifications.getExpoPushTokenAsync({
      projectId: "15c03e66-5f31-409b-b31a-b53b92e00fb1"
    })
  ).data
  console.log(token)

  return token
}
