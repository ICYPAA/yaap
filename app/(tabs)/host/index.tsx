import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import React, { useEffect, useRef, useState } from "react"
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
import { makeCountRequest, makeRequest } from "../../../lib/requestHelper"
import { supabase, withDeviceId } from "../../../lib/supabase"
import { getTextColorForBackground } from "../../../lib/theme"

// Define table names to make code more maintainable
const TABLES = {
  ACCESSIBILITY: "accessibility_forms",
  RIDES: "ride_forms",
  VOLUNTEERS: "volunteering_interest",
  HOSPITALITY: "hospitality_forms",
  SUPPORT: "support_chats"
}

// Type for form record payloads in realtime subscriptions
interface FormRecord {
  id: string
  program_id?: number
  status?: string | null
  [key: string]: any
}

type ServiceSection = {
  title: string
  route: string
  count: number
  icon: React.ComponentProps<typeof Ionicons>["name"]
  table: string
}

interface UserProfile {
  id: string
  full_name?: string
  email?: string
}

export default function HostDashboard() {
  const router = useRouter()
  const { theme, isDarkMode } = useTheme()
  const { isDebugMode } = useDebug()
  const [user, setUser] = useState<any>(null)
  const [serviceSections, setServiceSections] = useState<ServiceSection[]>([
    {
      title: "Accessibility Requests",
      route: "accessibility",
      count: 0,
      icon: "accessibility",
      table: TABLES.ACCESSIBILITY
    },
    {
      title: "Ride Requests",
      route: "rides",
      count: 0,
      icon: "car",
      table: TABLES.RIDES
    },
    {
      title: "Volunteer Sign-ups",
      route: "volunteers",
      count: 0,
      icon: "people",
      table: TABLES.VOLUNTEERS
    },
    {
      title: "Hospitality Notifications",
      route: "hospitality",
      count: 0,
      icon: "restaurant",
      table: TABLES.HOSPITALITY
    },
    {
      title: "Support Chats",
      route: "support",
      count: 0,
      icon: "chatbubbles",
      table: TABLES.SUPPORT
    }
  ])
  const [loading, setLoading] = useState(true)
  const subscriptionsRef = useRef<{ [key: string]: any }>({})

  useEffect(() => {
    fetchUserProfile()
    fetchPendingCounts()
    setupRealtimeSubscriptions()

    // Cleanup subscriptions when component unmounts
    return () => {
      Object.values(subscriptionsRef.current).forEach((subscription: any) => {
        if (subscription && subscription.unsubscribe) {
          subscription.unsubscribe()
        }
      })
    }
  }, [])

  const setupRealtimeSubscriptions = async () => {
    try {
      const supabaseWithDeviceId = await withDeviceId()

      // Set up subscriptions for each table
      serviceSections.forEach((section) => {
        // Skip if support chats, as they need different handling
        if (section.table === TABLES.SUPPORT) {
          const supportSubscription = supabaseWithDeviceId
            .channel(`${section.table}_changes`)
            .on(
              "postgres_changes",
              {
                event: "*", // Listen for all events (insert, update, delete)
                schema: "public",
                table: section.table,
                filter: `program_id=eq.1`
              },
              (payload: any) => {
                const { eventType } = payload
                const newRecord = payload.new as FormRecord | null
                const oldRecord = payload.old as FormRecord | null

                // For inserts, count if not resolved
                if (
                  eventType === "INSERT" &&
                  newRecord &&
                  newRecord.status !== "resolved"
                ) {
                  updateServiceSectionCount(section.table, 1)
                }
                // For updates, check if status changed to/from resolved
                else if (eventType === "UPDATE" && oldRecord && newRecord) {
                  // Changed from resolved to something else (increment)
                  if (
                    oldRecord.status === "resolved" &&
                    newRecord.status !== "resolved"
                  ) {
                    updateServiceSectionCount(section.table, 1)
                  }
                  // Changed from something else to resolved (decrement)
                  else if (
                    oldRecord.status !== "resolved" &&
                    newRecord.status === "resolved"
                  ) {
                    updateServiceSectionCount(section.table, -1)
                  }
                }
                // For deletes, decrement if it wasn't resolved
                else if (
                  eventType === "DELETE" &&
                  oldRecord &&
                  oldRecord.status !== "resolved"
                ) {
                  updateServiceSectionCount(section.table, -1)
                }
              }
            )
            .subscribe()

          subscriptionsRef.current[section.table] = supportSubscription
          return
        }

        // For other forms, we need to check the status
        const subscription = supabaseWithDeviceId
          .channel(`${section.table}_changes`)
          .on(
            "postgres_changes",
            {
              event: "*", // Listen for all events (insert, update, delete)
              schema: "public",
              table: section.table,
              filter: `program_id=eq.1`
            },
            (payload: any) => {
              const { eventType } = payload
              const newRecord = payload.new as FormRecord | null
              const oldRecord = payload.old as FormRecord | null

              // For inserts
              if (eventType === "INSERT" && newRecord) {
                // If new record has null, pending or in_progress status, we increase the count
                if (
                  !newRecord.status ||
                  ["pending", "in_progress"].includes(newRecord.status)
                ) {
                  updateServiceSectionCount(section.table, 1)
                }
              }
              // For updates
              else if (eventType === "UPDATE" && oldRecord && newRecord) {
                const oldStatus = oldRecord.status
                const newStatus = newRecord.status

                // If status changed from completed/closed to pending/in_progress/null
                if (
                  oldStatus &&
                  ["completed", "closed"].includes(oldStatus) &&
                  (!newStatus || ["pending", "in_progress"].includes(newStatus))
                ) {
                  updateServiceSectionCount(section.table, 1)
                }
                // If status changed from pending/in_progress/null to completed/closed
                else if (
                  (!oldStatus ||
                    ["pending", "in_progress"].includes(oldStatus)) &&
                  newStatus &&
                  ["completed", "closed"].includes(newStatus)
                ) {
                  updateServiceSectionCount(section.table, -1)
                }
              }
              // For deletes - if the record had a pending status, decrease count
              else if (eventType === "DELETE") {
                updateServiceSectionCount(section.table, -1)
              }
            }
          )
          .subscribe()

        subscriptionsRef.current[section.table] = subscription
      })
    } catch (error) {
      console.error("Error setting up realtime subscriptions:", error)
    }
  }

  const updateServiceSectionCount = (table: string, delta: number) => {
    setServiceSections((prev) =>
      prev.map((section) => {
        if (section.table === table) {
          return {
            ...section,
            count: Math.max(0, section.count + delta) // Ensure count doesn't go below 0
          }
        }
        return section
      })
    )
  }

  const fetchCountForTable = async (table: string) => {
    try {
      const supabaseWithDeviceId = await withDeviceId()

      // Handle support chats differently - no status filtering
      if (table === TABLES.SUPPORT) {
        const { count } = await makeCountRequest({
          table: table,
          isDebugMode,
          query: () =>
            supabaseWithDeviceId
              .from(table)
              .select("*", { count: "exact", head: true })
              .eq("program_id", 1)
              .not("status", "eq", "resolved")
        })

        updateServiceSectionFromFetchedCount(
          table,
          count || (isDebugMode ? 4 : 0)
        )
        return
      }

      // For other form tables, filter by status
      const { count } = await makeCountRequest({
        table: table,
        isDebugMode,
        query: () =>
          supabaseWithDeviceId
            .from(table)
            .select("*", { count: "exact", head: true })
            .eq("program_id", 1)
            .or("status.is.null,status.eq.pending,status.eq.in_progress")
      })

      // Get debug default count
      let debugDefault = 0
      switch (table) {
        case TABLES.ACCESSIBILITY:
          debugDefault = 2
          break
        case TABLES.RIDES:
          debugDefault = 3
          break
        case TABLES.VOLUNTEERS:
          debugDefault = 5
          break
        case TABLES.HOSPITALITY:
          debugDefault = 1
          break
      }

      updateServiceSectionFromFetchedCount(
        table,
        count || (isDebugMode ? debugDefault : 0)
      )
    } catch (error) {
      console.error(`Error fetching count for ${table}:`, error)
    }
  }

  const updateServiceSectionFromFetchedCount = (
    table: string,
    count: number
  ) => {
    setServiceSections((prev) =>
      prev.map((section) => {
        if (section.table === table) {
          return { ...section, count }
        }
        return section
      })
    )
  }

  const fetchUserProfile = async () => {
    try {
      // For the auth call, we still use supabase directly (could be modified to support debug in future)
      const {
        data: { user }
      } = await supabase.auth.getUser()

      if (user) {
        const supabaseWithDeviceId = await withDeviceId()
        const { data: profile } = await makeRequest({
          table: "profiles",
          isDebugMode,
          query: () =>
            supabaseWithDeviceId
              .from("profiles")
              .select("*")
              .eq("id", user.id)
              .single()
        })

        setUser({ ...user, profile })
      }
    } catch (error) {
      console.error("Error fetching user profile:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingCounts = async () => {
    try {
      // Fetch counts for each service type using makeCountRequest
      const supabaseWithDeviceId = await withDeviceId()
      const [
        { count: accessibilityCount },
        { count: ridesCount },
        { count: volunteersCount },
        { count: hospitalityCount },
        { count: supportCount }
      ] = await Promise.all([
        makeCountRequest({
          table: TABLES.ACCESSIBILITY,
          isDebugMode,
          query: () =>
            supabaseWithDeviceId
              .from(TABLES.ACCESSIBILITY)
              .select("*", { count: "exact", head: true })
              .eq("program_id", 1)
              .or("status.is.null,status.eq.pending,status.eq.in_progress")
        }),
        makeCountRequest({
          table: TABLES.RIDES,
          isDebugMode,
          query: () =>
            supabaseWithDeviceId
              .from(TABLES.RIDES)
              .select("*", { count: "exact", head: true })
              .eq("program_id", 1)
              .or("status.is.null,status.eq.pending,status.eq.in_progress")
        }),
        makeCountRequest({
          table: TABLES.VOLUNTEERS,
          isDebugMode,
          query: () =>
            supabaseWithDeviceId
              .from(TABLES.VOLUNTEERS)
              .select("*", { count: "exact", head: true })
              .eq("program_id", 1)
              .or("status.is.null,status.eq.pending,status.eq.in_progress")
        }),
        makeCountRequest({
          table: TABLES.HOSPITALITY,
          isDebugMode,
          query: () =>
            supabaseWithDeviceId
              .from(TABLES.HOSPITALITY)
              .select("*", { count: "exact", head: true })
              .eq("program_id", 1)
              .or("status.is.null,status.eq.pending,status.eq.in_progress")
        }),
        makeCountRequest({
          table: TABLES.SUPPORT,
          isDebugMode,
          query: () =>
            supabaseWithDeviceId
              .from(TABLES.SUPPORT)
              .select("*", { count: "exact", head: true })
              .eq("program_id", 1)
              .not("status", "eq", "resolved")
        })
      ])

      console.log("Counts fetched:", {
        accessibility: accessibilityCount,
        rides: ridesCount,
        volunteers: volunteersCount,
        hospitality: hospitalityCount,
        support: supportCount
      })

      // Force some dummy values for debug display if all counts are 0
      const counts = [
        accessibilityCount || (isDebugMode ? 2 : 0),
        ridesCount || (isDebugMode ? 3 : 0),
        volunteersCount || (isDebugMode ? 5 : 0),
        hospitalityCount || (isDebugMode ? 1 : 0),
        supportCount || (isDebugMode ? 4 : 0)
      ]

      setServiceSections((prev) => [
        { ...prev[0], count: counts[0] },
        { ...prev[1], count: counts[1] },
        { ...prev[2], count: counts[2] },
        { ...prev[3], count: counts[3] },
        { ...prev[4], count: counts[4] }
      ])
    } catch (error) {
      console.error("Error fetching pending counts:", error)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace("/host/login" as any)
  }

  const handleDeleteAccount = async () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone. We will delete all data stored on our systems, but you will have to uninstall the app to delete all data on your device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true)

              // Call the admin_delete_user function
              const { data, error } = await supabase.functions.invoke(
                "admin_delete_user",
                {
                  method: "POST"
                  // No body needed - the function gets user from JWT
                }
              )

              if (error) {
                console.error("Error calling admin delete function:", error)
                Alert.alert(
                  "Deletion Failed",
                  "There was an error deleting your account. Please try again later."
                )
              } else if (data.partial) {
                // Handle partial success
                Alert.alert(
                  "Account Marked for Deletion",
                  "Your account has been marked for deletion, but some parts of the process require administrator assistance."
                )

                // Sign out the user anyway
                await supabase.auth.signOut()
                router.replace("/host/login" as any)
              } else {
                // Full success
                Alert.alert(
                  "Account Deleted",
                  "Your account has been successfully deleted."
                )

                // Sign out and redirect
                await supabase.auth.signOut()
                router.replace("/host/login" as any)
              }
            } catch (error) {
              console.error("Error in deletion process:", error)
              Alert.alert(
                "Error",
                "Failed to delete account. Please try again later."
              )
            } finally {
              setLoading(false)
            }
          }
        }
      ]
    )
  }

  const navigateToService = (route: string) => {
    router.push(`/host/${route}` as any)
  }

  if (loading) {
    return (
      <View style={styles(theme).container}>
        <Text style={styles(theme).loadingText}>Loading...</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles(theme).container}>
      <View style={styles(theme).header}>
        <View style={styles(theme).headerContent}>
          <Text style={styles(theme).title}>Host Dashboard</Text>
          {user && (
            <Text style={styles(theme).userInfo}>
              Logged in as: {user.profile?.full_name || user.email}
            </Text>
          )}
        </View>
        {isDebugMode && (
          <View style={styles(theme).debugBadge}>
            <Text style={styles(theme).debugText}>DEBUG</Text>
          </View>
        )}
      </View>

      <ScrollView style={styles(theme).scrollContainer}>
        <View style={styles(theme).servicesContainer}>
          {serviceSections.map((service) => (
            <TouchableOpacity
              key={service.route}
              style={styles(theme).serviceCard}
              onPress={() => navigateToService(service.route)}
            >
              <View style={styles(theme).serviceCardContent}>
                <View
                  style={[
                    styles(theme).serviceIconContainer,
                    { backgroundColor: theme.colors.primary }
                  ]}
                >
                  <Ionicons
                    name={service.icon}
                    size={28}
                    color={getTextColorForBackground(theme.colors.primary)}
                  />
                </View>
                <View style={styles(theme).serviceTextContainer}>
                  <Text style={styles(theme).serviceTitle}>
                    {service.title}
                  </Text>
                  <Text style={styles(theme).serviceSubtitle}>
                    {service.count} {service.count === 1 ? "item" : "items"} to
                    handle
                  </Text>
                </View>
              </View>
              <View style={styles(theme).serviceCardAction}>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.colors.text.secondary}
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles(theme).logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles(theme).logoutButtonText}>Logout</Text>
          <Ionicons
            name="log-out-outline"
            size={20}
            color={getTextColorForBackground(theme.colors.error)}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles(theme).deleteAccountButton}
          onPress={handleDeleteAccount}
        >
          <Text style={styles(theme).deleteAccountButtonText}>
            Delete Account
          </Text>
          <Ionicons
            name="trash-outline"
            size={20}
            color={getTextColorForBackground(theme.colors.error)}
          />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing.md,
      backgroundColor: theme.colors.primary
    },
    headerContent: {
      flex: 1
    },
    title: {
      fontSize: 24,
      fontWeight: "bold",
      color: getTextColorForBackground(theme.colors.primary),
      marginBottom: 4
    },
    userInfo: {
      fontSize: 14,
      color: getTextColorForBackground(theme.colors.primary),
      opacity: 0.8
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
    loadingText: {
      color: theme.colors.text.primary,
      fontSize: 16,
      textAlign: "center",
      marginTop: 20
    },
    scrollContainer: {
      flex: 1,
      padding: theme.spacing.md
    },
    servicesContainer: {
      gap: theme.spacing.md
    },
    serviceCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      ...theme.shadows.small
    },
    serviceCardContent: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1
    },
    serviceIconContainer: {
      width: 50,
      height: 50,
      borderRadius: 25,
      justifyContent: "center",
      alignItems: "center",
      marginRight: theme.spacing.md
    },
    serviceTextContainer: {
      flex: 1
    },
    serviceTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text.primary,
      marginBottom: 2
    },
    serviceSubtitle: {
      fontSize: 14,
      color: theme.colors.text.secondary
    },
    serviceCardAction: {
      marginLeft: theme.spacing.sm
    },
    countBadge: {
      minWidth: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.error,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 6
    },
    countText: {
      color: getTextColorForBackground(theme.colors.error),
      fontSize: 12,
      fontWeight: "bold"
    },
    logoutButton: {
      marginTop: theme.spacing.xl,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.error,
      borderRadius: theme.borderRadius.md,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center"
    },
    logoutButtonText: {
      color: getTextColorForBackground(theme.colors.error),
      fontSize: 16,
      fontWeight: "600",
      marginRight: theme.spacing.sm
    },
    deleteAccountButton: {
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.xl,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.error,
      borderRadius: theme.borderRadius.md,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center"
    },
    deleteAccountButtonText: {
      color: getTextColorForBackground(theme.colors.error),
      fontSize: 16,
      fontWeight: "600",
      marginRight: theme.spacing.sm
    }
  })
