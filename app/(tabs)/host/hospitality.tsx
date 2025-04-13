import { Ionicons } from "@expo/vector-icons"
import * as Notifications from "expo-notifications"
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
import { getTextColorForBackground } from "../../../lib/theme"

interface HospitalityNotification {
  id: string
  program_id: number
  group_name: string
  item_description: string
  allergies: string
  notes: string
  status?: string
  owner_id?: string
  owner_email?: string
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
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [filteredNotifications, setFilteredNotifications] = useState<
    HospitalityNotification[]
  >([])
  const [activeFilter, setActiveFilter] = useState<
    "all" | "active" | "completed" | "closed"
  >("all")

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session?.user) {
        setCurrentUser(data.session.user.id)
      }
    }

    getUser()
    fetchNotifications()
  }, [])

  useEffect(() => {
    if (notifications.length > 0) {
      filterNotifications(activeFilter)
    }
  }, [notifications, activeFilter])

  const filterNotifications = (
    filter: "all" | "active" | "completed" | "closed"
  ) => {
    switch (filter) {
      case "active":
        setFilteredNotifications(
          notifications.filter(
            (item) =>
              !item.status ||
              item.status === "pending" ||
              item.status === "in_progress"
          )
        )
        break
      case "completed":
        setFilteredNotifications(
          notifications.filter((item) => item.status === "completed")
        )
        break
      case "closed":
        setFilteredNotifications(
          notifications.filter((item) => item.status === "closed")
        )
        break
      case "all":
      default:
        setFilteredNotifications(notifications)
        break
    }
  }

  const fetchNotifications = async () => {
    try {
      const { data, error } = await makeRequest({
        table: "hospitality_forms",
        isDebugMode,
        query: () =>
          supabase
            .from("hospitality_forms")
            .select("*")
            .eq("program_id", 1)
            .order("created_at", { ascending: false })
      })

      if (error) throw error

      // Get the list of hospitality notifications
      const items = data || []

      // Since we can't directly query auth.users from the client,
      // we'll use the current user's session to at least identify the current user's records
      const { data: sessionData } = await supabase.auth.getSession()
      const currentUserEmail = sessionData.session?.user?.email || "Unknown"
      const currentUserId = sessionData.session?.user?.id

      // Add owner identification to each notification
      const mappedNotifications = items.map(
        (item: HospitalityNotification) => ({
          ...item,
          owner_email:
            item.owner_id === currentUserId
              ? currentUserEmail
              : "User " + item.owner_id?.substring(0, 6)
        })
      )

      setNotifications(mappedNotifications)
    } catch (error) {
      console.error("Error fetching hospitality notifications:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (
    id: string,
    newStatus: string,
    shouldNotify = false
  ) => {
    try {
      const updateData: { status: string; owner_id?: string } = {
        status: newStatus
      }

      // If transitioning to in_progress, set the current user as owner
      if (newStatus === "in_progress" && currentUser) {
        updateData.owner_id = currentUser
      }

      const { error } = await makeRequest({
        table: "hospitality_forms",
        isDebugMode,
        query: () =>
          supabase.from("hospitality_forms").update(updateData).eq("id", id)
      })

      if (error) throw error

      // If this is an approval and notification is requested, send notifications
      if (shouldNotify && newStatus === "completed") {
        await sendHospitalityNotifications(id)
      }

      fetchNotifications()
    } catch (error) {
      console.error("Error updating notification status:", error)
    }
  }

  const sendHospitalityNotifications = async (hospitalityId: string) => {
    try {
      // Find the hospitality item
      const item = notifications.find((n) => n.id === hospitalityId)
      if (!item) return

      // Get all users with hospitality notifications enabled
      const { data: users, error } = await makeRequest({
        table: "users",
        isDebugMode,
        query: () =>
          supabase
            .from("users")
            .select("id, device_id, expo_push_token, settings")
            .neq("device_id", null)
      })

      if (error) throw error

      // Filter users who have notifications and hospitality notifications enabled
      const eligibleUsers = users.filter((user: any) => {
        const settings = user.settings || {}
        return (
          settings.notifications === true &&
          settings.hospitality_notifications === true
        )
      })

      // Send notifications to eligible users
      for (const user of eligibleUsers) {
        if (user.expo_push_token) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "Hospitality Item Approved",
              body: `${item.group_name}'s item "${item.item_description}" has been approved`,
              data: { screen: "/hospitality" }
            },
            trigger: null // Send immediately
          })
        }
      }

      console.log(
        `Sent hospitality notifications to ${eligibleUsers.length} users`
      )
    } catch (error) {
      console.error("Error sending hospitality notifications:", error)
    }
  }

  const renderItem = ({ item }: { item: HospitalityNotification }) => (
    <View style={styles(theme).notificationCard}>
      <View style={styles(theme).notificationHeader}>
        <Text style={styles(theme).notifierName}>
          {item.group_name || "Anonymous"}
        </Text>
        <View
          style={[
            styles(theme).statusBadge,
            {
              backgroundColor:
                !item.status || item.status === "pending"
                  ? theme.colors.warning
                  : item.status === "in_progress"
                  ? theme.colors.warning
                  : item.status === "completed"
                  ? theme.colors.success
                  : theme.colors.error
            }
          ]}
        >
          <Text style={styles(theme).statusText}>
            {item.status?.replace("_", " ") || "pending"}
          </Text>
        </View>
      </View>

      {item.owner_id && (
        <View style={styles(theme).ownerContainer}>
          <Ionicons name="person" size={16} color={theme.colors.primary} />
          <Text style={styles(theme).ownerText}>
            Owner: {item.owner_email || "Unknown"}
          </Text>
        </View>
      )}

      <View style={styles(theme).notificationDetails}>
        <View style={styles(theme).detailRow}>
          <Ionicons name="restaurant" size={16} color={theme.colors.primary} />
          <Text style={styles(theme).detailText}>
            Item Description: {item.item_description}
          </Text>
        </View>
        <View style={styles(theme).detailRow}>
          <Ionicons name="warning" size={16} color={theme.colors.primary} />
          <Text style={styles(theme).detailText}>
            Allergies: {item.allergies}
          </Text>
        </View>
        <View style={styles(theme).detailRow}>
          <Ionicons name="time" size={16} color={theme.colors.primary} />
          <Text style={styles(theme).detailText}>
            Submitted: {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>

      <Text style={styles(theme).description}>{item.notes}</Text>

      <View style={styles(theme).actionButtons}>
        {(!item.status || item.status === "pending") && (
          <>
            <TouchableOpacity
              style={[
                styles(theme).actionButton,
                { backgroundColor: theme.colors.success }
              ]}
              onPress={() => handleStatusUpdate(item.id, "completed", true)}
            >
              <Text style={styles(theme).actionButtonText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles(theme).actionButton,
                { backgroundColor: theme.colors.error }
              ]}
              onPress={() => handleStatusUpdate(item.id, "closed")}
            >
              <Text style={styles(theme).actionButtonText}>Deny</Text>
            </TouchableOpacity>
          </>
        )}

        {item.status === "in_progress" && (
          <>
            <TouchableOpacity
              style={[
                styles(theme).actionButton,
                { backgroundColor: theme.colors.success }
              ]}
              onPress={() => handleStatusUpdate(item.id, "completed", true)}
            >
              <Text style={styles(theme).actionButtonText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles(theme).actionButton,
                { backgroundColor: theme.colors.error }
              ]}
              onPress={() => handleStatusUpdate(item.id, "closed")}
            >
              <Text style={styles(theme).actionButtonText}>Deny</Text>
            </TouchableOpacity>
          </>
        )}

        {(item.status === "completed" || item.status === "closed") && (
          <TouchableOpacity
            style={[
              styles(theme).actionButton,
              { backgroundColor: theme.colors.primary }
            ]}
            onPress={() => handleStatusUpdate(item.id, "in_progress")}
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
            color={getTextColorForBackground(theme.colors.primary)}
          />
        </TouchableOpacity>
        <Text style={styles(theme).title}>Hospitality Notifications</Text>
        {isDebugMode && (
          <View style={styles(theme).debugBadge}>
            <Text style={styles(theme).debugText}>DEBUG</Text>
          </View>
        )}
      </View>

      <View style={styles(theme).filterContainer}>
        <TouchableOpacity
          style={[
            styles(theme).filterButton,
            activeFilter === "all" && styles(theme).activeFilterButton
          ]}
          onPress={() => setActiveFilter("all")}
        >
          <Text style={styles(theme).filterButtonText}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles(theme).filterButton,
            activeFilter === "active" && styles(theme).activeFilterButton
          ]}
          onPress={() => setActiveFilter("active")}
        >
          <Text style={styles(theme).filterButtonText}>Active</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles(theme).filterButton,
            activeFilter === "completed" && styles(theme).activeFilterButton
          ]}
          onPress={() => setActiveFilter("completed")}
        >
          <Text style={styles(theme).filterButtonText}>Completed</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles(theme).filterButton,
            activeFilter === "closed" && styles(theme).activeFilterButton
          ]}
          onPress={() => setActiveFilter("closed")}
        >
          <Text style={styles(theme).filterButtonText}>Closed</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles(theme).centered}>
          <Text style={styles(theme).loadingText}>
            Loading notifications...
          </Text>
        </View>
      ) : filteredNotifications.length === 0 ? (
        <View style={styles(theme).centered}>
          <Text style={styles(theme).emptyText}>
            No hospitality notifications found.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
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
      color: getTextColorForBackground(theme.colors.primary),
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
      color: getTextColorForBackground(theme.colors.error),
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
      color: getTextColorForBackground(theme.colors.warning),
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
      color: getTextColorForBackground(theme.colors.primary),
      fontWeight: "500"
    },
    ownerContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.background,
      padding: theme.spacing.xs,
      borderRadius: theme.borderRadius.sm,
      marginBottom: theme.spacing.sm
    },
    ownerText: {
      ...theme.typography.body,
      color: theme.colors.text.primary,
      marginLeft: theme.spacing.sm,
      fontStyle: "italic"
    },
    filterContainer: {
      flexDirection: "row",
      padding: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.background,
      justifyContent: "space-around"
    },
    filterButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.background
    },
    activeFilterButton: {
      backgroundColor: theme.colors.primary
    },
    filterButtonText: {
      fontWeight: "500",
      color: theme.colors.text.primary
    }
  })
