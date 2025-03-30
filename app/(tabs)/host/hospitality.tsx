import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import React, { useEffect, useState } from "react"
import {
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native"
import { useDebug } from "../../../context/DebugContext"
import { useTheme } from "../../../context/ThemeContext"
import { makeRequest } from "../../../lib/requestHelper"
import { supabase } from "../../../lib/supabase"

interface HospitalityNotification {
  id: string
  profiles?: {
    full_name: string
    email: string
  }
  notification_type: string
  location: string
  time: string
  description: string
  status: string
  created_at: string
}

interface ThemeType {
  colors: {
    background: string
    surface: string
    primary: string
    error: string
    warning: string
    success: string
    text: {
      primary: string
      secondary: string
    }
  }
  spacing: {
    xs: number
    sm: number
    md: number
  }
  typography: {
    h2: object
    h3: object
    body: object
    caption: object
  }
  borderRadius: {
    sm: number
    md: number
  }
  shadows: {
    small: object
  }
}

export default function HospitalityNotifications() {
  const router = useRouter()
  const { theme } = useTheme()
  const { isDebugMode } = useDebug()
  const [notifications, setNotifications] = useState<HospitalityNotification[]>(
    []
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = async () => {
    try {
      const { data, error } = await makeRequest({
        table: "hospitality_notifications",
        isDebugMode,
        query: () =>
          supabase
            .from("hospitality_notifications")
            .select("*, profiles(full_name, email)")
            .order("created_at", { ascending: false })
      })

      if (error) throw error
      setNotifications(data || [])
    } catch (error) {
      console.error("Error fetching hospitality notifications:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      const { error } = await makeRequest({
        table: "hospitality_notifications",
        isDebugMode,
        query: () =>
          supabase
            .from("hospitality_notifications")
            .update({ status: newStatus })
            .eq("id", id)
      })

      if (error) throw error
      fetchNotifications()
    } catch (error) {
      console.error("Error updating notification status:", error)
    }
  }

  const renderItem = ({ item }: { item: HospitalityNotification }) => (
    <View style={styles(theme).notificationCard}>
      <View style={styles(theme).notificationHeader}>
        <Text style={styles(theme).notifierName}>
          {item.profiles?.full_name || "Anonymous"}
        </Text>
        <View
          style={[
            styles(theme).statusBadge,
            {
              backgroundColor:
                item.status === "pending"
                  ? theme.colors.error
                  : item.status === "in_progress"
                  ? theme.colors.warning
                  : theme.colors.success
            }
          ]}
        >
          <Text style={styles(theme).statusText}>
            {item.status.replace("_", " ")}
          </Text>
        </View>
      </View>

      <View style={styles(theme).notificationDetails}>
        <View style={styles(theme).detailRow}>
          <Ionicons name="restaurant" size={16} color={theme.colors.primary} />
          <Text style={styles(theme).detailText}>
            Type: {item.notification_type}
          </Text>
        </View>
        <View style={styles(theme).detailRow}>
          <Ionicons name="location" size={16} color={theme.colors.primary} />
          <Text style={styles(theme).detailText}>
            Location: {item.location}
          </Text>
        </View>
        <View style={styles(theme).detailRow}>
          <Ionicons name="time" size={16} color={theme.colors.primary} />
          <Text style={styles(theme).detailText}>Time: {item.time}</Text>
        </View>
      </View>

      <Text style={styles(theme).description}>{item.description}</Text>
      <Text style={styles(theme).timestamp}>
        Submitted: {new Date(item.created_at).toLocaleDateString()}
      </Text>

      <View style={styles(theme).actionButtons}>
        {item.status === "pending" && (
          <TouchableOpacity
            style={[
              styles(theme).actionButton,
              { backgroundColor: theme.colors.warning }
            ]}
            onPress={() => handleStatusUpdate(item.id, "in_progress")}
          >
            <Text style={styles(theme).actionButtonText}>Start Handling</Text>
          </TouchableOpacity>
        )}

        {item.status === "in_progress" && (
          <TouchableOpacity
            style={[
              styles(theme).actionButton,
              { backgroundColor: theme.colors.success }
            ]}
            onPress={() => handleStatusUpdate(item.id, "completed")}
          >
            <Text style={styles(theme).actionButtonText}>Mark Completed</Text>
          </TouchableOpacity>
        )}

        {item.status === "completed" && (
          <TouchableOpacity
            style={[
              styles(theme).actionButton,
              { backgroundColor: theme.colors.primary }
            ]}
            onPress={() => handleStatusUpdate(item.id, "pending")}
          >
            <Text style={styles(theme).actionButtonText}>Reopen</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )

  return (
    <SafeAreaView style={styles(theme).container}>
      <View style={styles(theme).header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles(theme).backButton}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={theme.colors.background}
          />
        </TouchableOpacity>
        <Text style={styles(theme).title}>Hospitality Notifications</Text>
        {isDebugMode && (
          <View style={styles(theme).debugBadge}>
            <Text style={styles(theme).debugText}>DEBUG</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles(theme).centered}>
          <Text style={styles(theme).loadingText}>
            Loading notifications...
          </Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles(theme).centered}>
          <Text style={styles(theme).emptyText}>
            No hospitality notifications found.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles(theme).listContainer}
        />
      )}
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
      ...theme.typography.h2,
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
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center"
    },
    loadingText: {
      ...theme.typography.body,
      color: theme.colors.text.primary
    },
    emptyText: {
      ...theme.typography.body,
      color: theme.colors.text.secondary
    },
    listContainer: {
      padding: theme.spacing.md
    },
    notificationCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
      ...theme.shadows.small
    },
    notificationHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing.sm
    },
    notifierName: {
      ...theme.typography.h3,
      color: theme.colors.text.primary
    },
    statusBadge: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.borderRadius.md
    },
    statusText: {
      color: theme.colors.background,
      fontSize: 12,
      fontWeight: "500",
      textTransform: "capitalize"
    },
    notificationDetails: {
      marginBottom: theme.spacing.md,
      backgroundColor: theme.colors.background,
      padding: theme.spacing.sm,
      borderRadius: theme.borderRadius.sm
    },
    detailRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.spacing.xs
    },
    detailText: {
      ...theme.typography.body,
      color: theme.colors.text.primary,
      marginLeft: theme.spacing.sm
    },
    description: {
      ...theme.typography.body,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.md,
      lineHeight: 22
    },
    timestamp: {
      ...theme.typography.caption,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing.md
    },
    actionButtons: {
      flexDirection: "row",
      justifyContent: "flex-end"
    },
    actionButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.sm,
      marginLeft: theme.spacing.sm
    },
    actionButtonText: {
      color: theme.colors.background,
      fontWeight: "500"
    }
  })
