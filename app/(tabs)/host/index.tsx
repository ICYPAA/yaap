import { Ionicons } from "@expo/vector-icons"
import { useRouter, useFocusEffect } from "expo-router"
import React, { useEffect, useRef, useState, useCallback } from "react"
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
import { useFeatures } from "../../../context/FeatureContext"
import { useRole } from "../../../context/RoleContext"
import { useTheme } from "../../../context/ThemeContext"
import { makeCountRequest, makeRequest } from "../../../lib/requestHelper"
import { supabase, withDeviceId } from "../../../lib/supabase"
import { getTextColorForBackground } from "../../../lib/theme"

// Define table names to make code more maintainable
const TABLES = {
  ACCESSIBILITY: "accessibility_forms",
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
  count?: number
  icon: React.ComponentProps<typeof Ionicons>["name"]
  table?: string
  isAction?: boolean
  category?: string
}

interface UserProfile {
  id: string
  full_name?: string
  email?: string
}

interface OnCallAssignment {
  id: number
  service_type: string
  user_id: string
  user?: {
    id: string
    email: string
    full_name?: string
  }
}

const ON_CALL_SERVICE_TYPES = [
  { key: "accessibility", label: "Accessibility", icon: "accessibility" },
  { key: "volunteers", label: "Volunteers", icon: "people" },
  { key: "hospitality", label: "Hospitality", icon: "restaurant" },
  { key: "support", label: "Support Chat", icon: "chatbubbles" }
]

export default function HostDashboard() {
  const router = useRouter()
  const { theme, isDarkMode } = useTheme()
  const { isFeatureEnabled } = useFeatures()
  const { isDebugMode } = useDebug()
  const { isHostAdmin, isSuperAdmin } = useRole()
  const [user, setUser] = useState<any>(null)
  const [onCallAssignments, setOnCallAssignments] = useState<OnCallAssignment[]>([])
  
  const getServiceSections = () => {
    const sections: ServiceSection[] = []
    
    if (isFeatureEnabled("accessibility_enabled")) {
      sections.push({
        title: "Accessibility Requests",
        route: "accessibility",
        count: 0,
        icon: "accessibility",
        table: TABLES.ACCESSIBILITY,
        category: "services"
      })
    }
    
    // Temporarily disabled - volunteer forms should go through the public volunteer form
    // if (isFeatureEnabled("volunteering_enabled")) {
    //   sections.push({
    //     title: "Volunteer Sign-ups",
    //     route: "volunteers",
    //     count: 0,
    //     icon: "people",
    //     table: TABLES.VOLUNTEERS,
    //     category: "services"
    //   })
    // }
    
    if (isFeatureEnabled("hospitality_enabled")) {
      sections.push({
        title: "Hospitality Notifications",
        route: "hospitality",
        count: 0,
        icon: "restaurant",
        table: TABLES.HOSPITALITY,
        category: "services"
      })
    }
    
    if (isFeatureEnabled("support_chat_enabled")) {
      sections.push({
        title: "Support Chats",
        route: "support",
        count: 0,
        icon: "chatbubbles",
        table: TABLES.SUPPORT,
        category: "services"
      })
    }
    
    // Tools section - only for steering members and admins
    if (isHostAdmin() || isSuperAdmin()) {
      sections.push({
        title: "Send General Notification",
        route: "general-notifications",
        icon: "notifications",
        isAction: true,
        category: "tools"
      })
      
      sections.push({
        title: "On-Call Management",
        route: "oncall",
        icon: "call",
        isAction: true,
        category: "tools"
      })
      
      sections.push({
        title: "Feature Management",
        route: "features",
        icon: "settings",
        isAction: true,
        category: "tools"
      })
    }
    
    sections.push({
      title: "Chairperson Schedule",
      route: "chairperson",
      icon: "calendar",
      isAction: true,
      category: "user"
    })
    
    return sections
  }
  
  const [serviceSections, setServiceSections] = useState<ServiceSection[]>(getServiceSections())
  const [loading, setLoading] = useState(true)
  const subscriptionsRef = useRef<{ [key: string]: any }>({})

  useEffect(() => {
    fetchUserProfile()
    fetchPendingCounts()
    fetchOnCallAssignments()
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
  
  // Update sections when features or role change
  useEffect(() => {
    setServiceSections(getServiceSections())
  }, [isFeatureEnabled, isHostAdmin, isSuperAdmin])

  // Refresh data when screen gets focus
  useFocusEffect(
    useCallback(() => {
      fetchOnCallAssignments()
      fetchPendingCounts()
    }, [])
  )

  const setupRealtimeSubscriptions = async () => {
    try {
      const supabaseWithDeviceId = await withDeviceId()

      // Set up subscriptions for each table
      serviceSections.forEach((section) => {
        // Skip sections without a table (like General Notifications)
        if (!section.table) return

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
                filter: `program_id=eq.3`
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
                  updateServiceSectionCount(section.table!, 1)
                }
                // For updates, check if status changed to/from resolved
                else if (eventType === "UPDATE" && oldRecord && newRecord) {
                  // Changed from resolved to something else (increment)
                  if (
                    oldRecord.status === "resolved" &&
                    newRecord.status !== "resolved"
                  ) {
                    updateServiceSectionCount(section.table!, 1)
                  }
                  // Changed from something else to resolved (decrement)
                  else if (
                    oldRecord.status !== "resolved" &&
                    newRecord.status === "resolved"
                  ) {
                    updateServiceSectionCount(section.table!, -1)
                  }
                }
                // For deletes, decrement if it wasn't resolved
                else if (
                  eventType === "DELETE" &&
                  oldRecord &&
                  oldRecord.status !== "resolved"
                ) {
                  updateServiceSectionCount(section.table!, -1)
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
              filter: `program_id=eq.3`
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
                  updateServiceSectionCount(section.table!, 1)
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
                  updateServiceSectionCount(section.table!, 1)
                }
                // If status changed from pending/in_progress/null to completed/closed
                else if (
                  (!oldStatus ||
                    ["pending", "in_progress"].includes(oldStatus)) &&
                  newStatus &&
                  ["completed", "closed"].includes(newStatus)
                ) {
                  updateServiceSectionCount(section.table!, -1)
                }
              }
              // For deletes - if the record had a pending status, decrease count
              else if (eventType === "DELETE") {
                updateServiceSectionCount(section.table!, -1)
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
            count: Math.max(0, (section.count ?? 0) + delta)
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
              .eq("program_id", 3)
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
            .eq("program_id", 3)
            .or("status.is.null,status.eq.pending,status.eq.in_progress")
      })

      // Get debug default count
      let debugDefault = 0
      switch (table) {
        case TABLES.ACCESSIBILITY:
          debugDefault = 2
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

  const fetchOnCallAssignments = async () => {
    try {
      const supabaseWithDeviceId = await withDeviceId()
      const { data } = await makeRequest({
        table: "oncall_assignments",
        isDebugMode,
        query: () =>
          supabaseWithDeviceId
            .from("oncall_assignments")
            .select("*")
            .eq("program_id", 3)
            .eq("is_active", true)
      })
      
      if (data && data.length > 0) {
        // Get user names for the assigned users
        const assignedUserIds = data.map(a => a.user_id)
        const { data: authUsers, error: authError } = await supabaseWithDeviceId
          .rpc("get_auth_user_names", {
            user_ids: assignedUserIds
          })

        if (authError) {
          console.error("Error fetching auth user names:", authError)
        }

        // Create a map for easy lookup
        const authUsersMap = new Map()
        if (authUsers) {
          authUsers.forEach(u => {
            authUsersMap.set(u.id, u)
          })
        }

        // Add user info to assignments
        const assignmentsWithUsers = data.map(assignment => {
          const authUser = authUsersMap.get(assignment.user_id)
          return {
            ...assignment,
            user: authUser || { id: assignment.user_id, email: "Unknown", full_name: "Unknown User" }
          }
        })

        setOnCallAssignments(assignmentsWithUsers)
      } else {
        setOnCallAssignments([])
      }
    } catch (error) {
      console.error("Error fetching on-call assignments:", error)
    }
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
    // Get fresh service sections to ensure we have latest data
    const sections = getServiceSections()
    
    try {
      await Promise.all(
        sections
          .filter((section) => section.table)
          .map((section) => fetchCountForTable(section.table!))
      )
    } catch (error) {
      console.error("Error triggering fetch counts:", error)
      // Don't show alert for count fetching errors
      console.log("Could not fetch pending item counts:", error)
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

      {/* On-Call Status Display */}
      <View style={styles(theme).onCallStatusContainer}>
        <Text style={styles(theme).onCallStatusTitle}>Current On-Call Status</Text>
        <View style={styles(theme).onCallGrid}>
          {ON_CALL_SERVICE_TYPES.map(service => {
            const assignment = onCallAssignments.find(a => a.service_type === service.key)
            
            return (
              <View key={service.key} style={styles(theme).onCallItem}>
                <View style={styles(theme).onCallItemHeader}>
                  <Ionicons
                    name={service.icon as any}
                    size={16}
                    color={theme.colors.primary}
                    style={styles(theme).onCallItemIcon}
                  />
                  <Text style={styles(theme).onCallItemLabel}>{service.label}</Text>
                </View>
                <Text style={styles(theme).onCallItemAssignment}>
                  {assignment
                    ? (assignment.user?.full_name || assignment.user?.email || "Unknown User")
                    : "No one assigned"
                  }
                </Text>
              </View>
            )
          })}
        </View>
      </View>

      <ScrollView style={styles(theme).scrollContainer}>
        {/* Services Section */}
        <View style={styles(theme).sectionContainer}>
          <Text style={styles(theme).sectionHeader}>Services</Text>
          <Text style={styles(theme).sectionDescription}>
            Handle incoming requests and notifications from attendees
          </Text>
          <View style={styles(theme).servicesContainer}>
            {serviceSections
              .filter((service) => service.category === "services")
              .map((service) => (
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
                        {service.count} {service.count === 1 ? "item" : "items"}{" "}
                        to handle
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
        </View>

        {/* Tools Section - only visible to steering members and admins */}
        {serviceSections.some((service) => service.category === "tools") && (
          <View style={styles(theme).sectionContainer}>
            <Text style={styles(theme).sectionHeader}>Tools</Text>
            <Text style={styles(theme).sectionDescription}>
              Send notifications and manage app features
            </Text>
            <View style={styles(theme).servicesContainer}>
              {serviceSections
                .filter((service) => service.category === "tools")
                .map((service) => (
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
                          {service.route === "general-notifications" 
                            ? "Send notifications to attendees"
                            : service.route === "oncall"
                            ? "Manage on-call assignments"
                            : "Control available app features"}
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
          </View>
        )}

        {/* User Section */}
        <View style={styles(theme).sectionContainer}>
          <Text style={styles(theme).sectionHeader}>User</Text>
          <Text style={styles(theme).sectionDescription}>
            Personal schedule and account settings
          </Text>
          <View style={styles(theme).servicesContainer}>
            {serviceSections
              .filter((service) => service.category === "user")
              .map((service) => (
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
                        View your chairperson responsibilities
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
    sectionContainer: {
      marginBottom: theme.spacing.xl
    },
    sectionHeader: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.xs
    },
    sectionDescription: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing.md
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
    },
    onCallStatusContainer: {
      backgroundColor: theme.colors.surface,
      margin: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      ...theme.shadows.small
    },
    onCallStatusTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.sm
    },
    onCallGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm
    },
    onCallItem: {
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.sm,
      padding: theme.spacing.sm,
      flex: 1,
      minWidth: "45%",
      borderWidth: 1,
      borderColor: theme.colors.border
    },
    onCallItemHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.spacing.xs
    },
    onCallItemIcon: {
      marginRight: theme.spacing.xs
    },
    onCallItemLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.text.primary
    },
    onCallItemAssignment: {
      fontSize: 11,
      color: theme.colors.text.secondary
    }
  })
