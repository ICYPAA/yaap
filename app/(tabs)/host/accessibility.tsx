import { Ionicons } from "@expo/vector-icons"
import { useFocusEffect } from "@react-navigation/native"
import { useRouter } from "expo-router"
import React, { useCallback, useEffect, useRef, useState } from "react"
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
import { supabase, withDeviceId } from "../../../lib/supabase"
import { getTextColorForBackground } from "../../../lib/theme"

// Define interface for the requests
interface AccessibilityRequest {
  id: string
  program_id: number
  name: string
  phone: string
  email: string
  need_type: string
  details: string
  arrival_date: string
  duration: string
  status?: string
  owner_id?: string
  owner_email?: string
  created_at: string
}

type FilterType = "all" | "active" | "completed" | "closed"

export default function AccessibilityRequests() {
  const router = useRouter()
  const { theme } = useTheme()
  const { isDebugMode } = useDebug()
  const [requests, setRequests] = useState<AccessibilityRequest[]>([])
  const [filteredRequests, setFilteredRequests] = useState<
    AccessibilityRequest[]
  >([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterType>("all")
  const subscriptionRef = useRef<{ unsubscribe?: () => void }>({})
  const currentUserEmailRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session?.user) {
        setCurrentUser(data.session.user.id)
        currentUserEmailRef.current = data.session.user.email
      }
    }

    getUser()
    fetchRequests()
    setupRealtimeSubscription()

    // Cleanup subscription when component unmounts
    return () => {
      if (subscriptionRef.current.unsubscribe) {
        subscriptionRef.current.unsubscribe()
      }
    }
  }, [])

  const setupRealtimeSubscription = async () => {
    try {
      const supabaseWithDeviceId = await withDeviceId()

      const subscription = supabaseWithDeviceId
        .channel("accessibility_forms_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "accessibility_forms",
            filter: "program_id=eq.1"
          },
          (payload) => {
            const { eventType, new: newRecord, old: oldRecord } = payload

            // Handle different event types
            if (eventType === "INSERT") {
              // Add the new request to the list
              handleNewRequest(newRecord)
            } else if (eventType === "UPDATE") {
              // Update the changed request in the list
              handleUpdatedRequest(newRecord)
            } else if (eventType === "DELETE") {
              // Remove the deleted request from the list
              handleDeletedRequest(oldRecord?.id)
            }
          }
        )
        .subscribe()

      subscriptionRef.current = subscription
    } catch (error) {
      console.error("Error setting up realtime subscription:", error)
    }
  }

  const handleNewRequest = (newRecord: any) => {
    if (!newRecord) return

    // Format the new request with current user info if needed
    const formattedRequest: AccessibilityRequest = {
      ...newRecord,
      owner_email:
        newRecord.owner_id === currentUser
          ? currentUserEmailRef.current
          : newRecord.owner_id
          ? "User " + newRecord.owner_id.substring(0, 6)
          : undefined
    }

    // Add to requests list
    setRequests((prev) => [formattedRequest, ...prev])
  }

  const handleUpdatedRequest = (updatedRecord: any) => {
    if (!updatedRecord) return

    // Format the updated request with current user info
    const formattedRequest: AccessibilityRequest = {
      ...updatedRecord,
      owner_email:
        updatedRecord.owner_id === currentUser
          ? currentUserEmailRef.current
          : updatedRecord.owner_id
          ? "User " + updatedRecord.owner_id.substring(0, 6)
          : undefined
    }

    // Update in the list
    setRequests((prev) =>
      prev.map((request) =>
        request.id === updatedRecord.id ? formattedRequest : request
      )
    )
  }

  const handleDeletedRequest = (id?: string) => {
    if (!id) return

    // Remove from the list
    setRequests((prev) => prev.filter((request) => request.id !== id))
  }

  useEffect(() => {
    if (requests.length > 0) {
      filterRequests(activeFilter)
    }
  }, [requests, activeFilter])

  const filterRequests = (filter: FilterType) => {
    switch (filter) {
      case "active":
        setFilteredRequests(
          requests.filter(
            (req) =>
              !req.status ||
              req.status === "pending" ||
              req.status === "in_progress"
          )
        )
        break
      case "completed":
        setFilteredRequests(
          requests.filter((req) => req.status === "completed")
        )
        break
      case "closed":
        setFilteredRequests(requests.filter((req) => req.status === "closed"))
        break
      case "all":
      default:
        setFilteredRequests(requests)
        break
    }
  }

  const fetchRequests = async () => {
    try {
      const supabaseWithDeviceId = await withDeviceId()
      const { data, error } = await makeRequest({
        table: "accessibility_forms",
        isDebugMode,
        query: () =>
          supabaseWithDeviceId
            .from("accessibility_forms")
            .select("*")
            .eq("program_id", 1)
            .order("created_at", { ascending: false })
      })

      if (error) throw error

      // Get the list of accessibility requests
      const requests = data || []

      // Since we can't directly query auth.users from the client,
      // we'll use the current user's session to at least identify the current user's records
      const { data: sessionData } = await supabase.auth.getSession()
      const currentUserEmail = sessionData.session?.user?.email || "Unknown"
      const currentUserId = sessionData.session?.user?.id

      // Add owner identification to each request
      const mappedRequests = requests.map((req: AccessibilityRequest) => ({
        ...req,
        owner_email:
          req.owner_id === currentUserId
            ? currentUserEmail
            : "User " + req.owner_id?.substring(0, 6)
      }))

      setRequests(mappedRequests)
    } catch (error) {
      console.error("Error fetching accessibility requests:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      const updateData: { status: string; owner_id?: string } = {
        status: newStatus
      }

      // If transitioning to in_progress, set the current user as owner
      if (newStatus === "in_progress" && currentUser) {
        updateData.owner_id = currentUser
      }

      const supabaseWithDeviceId = await withDeviceId()
      const { error } = await makeRequest({
        table: "accessibility_forms",
        isDebugMode,
        query: () =>
          supabaseWithDeviceId
            .from("accessibility_forms")
            .update(updateData)
            .eq("id", id)
      })

      if (error) throw error
      fetchRequests()
    } catch (error) {
      console.error("Error updating request status:", error)
    }
  }

  const renderItem = ({ item }: { item: AccessibilityRequest }) => (
    <View style={styles(theme).requestCard}>
      <View style={styles(theme).requestHeader}>
        <Text style={styles(theme).requesterName}>
          {item.name || "Anonymous"}
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

      <View style={styles(theme).requestInfo}>
        <View style={styles(theme).infoRow}>
          <Ionicons name="mail" size={16} color={theme.colors.primary} />
          <Text style={styles(theme).infoText}>Email: {item.email}</Text>
        </View>
        <View style={styles(theme).infoRow}>
          <Ionicons name="call" size={16} color={theme.colors.primary} />
          <Text style={styles(theme).infoText}>Phone: {item.phone}</Text>
        </View>
        <View style={styles(theme).infoRow}>
          <Ionicons name="options" size={16} color={theme.colors.primary} />
          <Text style={styles(theme).infoText}>
            Need Type: {item.need_type}
          </Text>
        </View>
        <View style={styles(theme).infoRow}>
          <Ionicons name="calendar" size={16} color={theme.colors.primary} />
          <Text style={styles(theme).infoText}>
            Arrival: {item.arrival_date}
          </Text>
        </View>
        <View style={styles(theme).infoRow}>
          <Ionicons name="time" size={16} color={theme.colors.primary} />
          <Text style={styles(theme).infoText}>Duration: {item.duration}</Text>
        </View>
      </View>

      <Text style={styles(theme).requestDetails}>{item.details}</Text>
      <Text style={styles(theme).timestamp}>
        Submitted: {new Date(item.created_at).toLocaleDateString()}
      </Text>

      <View style={styles(theme).actionButtons}>
        {(!item.status || item.status === "pending") && (
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
          <>
            <TouchableOpacity
              style={[
                styles(theme).actionButton,
                { backgroundColor: theme.colors.success }
              ]}
              onPress={() => handleStatusUpdate(item.id, "completed")}
            >
              <Text style={styles(theme).actionButtonText}>Complete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles(theme).actionButton,
                { backgroundColor: theme.colors.error }
              ]}
              onPress={() => handleStatusUpdate(item.id, "closed")}
            >
              <Text style={styles(theme).actionButtonText}>Close</Text>
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

  // Refetch data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log("Screen focused, fetching accessibility requests")
      fetchRequests()
      return () => {
        // This runs when the screen is unfocused
        console.log("Screen unfocused")
      }
    }, [])
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
        <Text style={styles(theme).title}>Accessibility Requests</Text>
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
          <Text style={styles(theme).loadingText}>Loading requests...</Text>
        </View>
      ) : filteredRequests.length === 0 ? (
        <View style={styles(theme).centered}>
          <Text style={styles(theme).emptyText}>
            No accessibility requests found.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredRequests}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles(theme).listContainer}
        />
      )}
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
    requestCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
      ...theme.shadows.small
    },
    requestHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing.sm
    },
    requesterName: {
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
    requestDetails: {
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
      color: getTextColorForBackground(theme.colors.primary),
      fontWeight: "500"
    },
    requestInfo: {
      marginBottom: theme.spacing.md
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.spacing.xs
    },
    infoText: {
      ...theme.typography.body,
      color: theme.colors.text.primary,
      marginLeft: theme.spacing.sm
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
    }
  })
