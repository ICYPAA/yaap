import { Ionicons } from "@expo/vector-icons"
import { useFocusEffect } from "@react-navigation/native"
import { useRouter } from "expo-router"
import React, { useCallback, useEffect, useRef, useState } from "react"
import {
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native"
import { ProtectedComponent } from "../../../components/ProtectedComponent"
import { useDebug } from "../../../context/DebugContext"
import { useTheme } from "../../../context/ThemeContext"
import { Permission } from "../../../lib/roleChecker"
import { withDeviceId } from "../../../lib/supabase"
import { getTextColorForBackground } from "../../../lib/theme"
import {
  getAllVolunteerInterest,
  updateVolunteerStatus,
  deleteVolunteerInterest,
  getVolunteerStats,
  VolunteeringInterest,
  VolunteerStatus
} from "../../../lib/volunteerInterestAPI"

function VolunteerManagementContent() {
  const router = useRouter()
  const { theme } = useTheme()
  const { isDebugMode } = useDebug()
  const [volunteers, setVolunteers] = useState<VolunteeringInterest[]>([])
  const [filteredVolunteers, setFilteredVolunteers] = useState<
    VolunteeringInterest[]
  >([])
  const [selectedStatus, setSelectedStatus] = useState<VolunteerStatus | "all">(
    "all"
  )
  const [searchTerm, setSearchTerm] = useState("")
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    contacted: 0
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const styles = createStyles(theme)
  const subscriptionRef = useRef<{ unsubscribe?: () => void }>({})

  const fetchInitialData = useCallback(async () => {
    try {
      setLoading(true)
      const [volunteersData, statsData] = await Promise.all([
        getAllVolunteerInterest(),
        getVolunteerStats()
      ])

      setVolunteers(volunteersData)
      setStats(statsData)
    } catch (error) {
      console.error("Error fetching initial data:", error)
      Alert.alert("Error", "Failed to load volunteer data")
    } finally {
      setLoading(false)
    }
  }, [])

  const setupRealtimeSubscription = useCallback(async () => {
    try {
      const supabaseWithDeviceId = await withDeviceId()

      const subscription = supabaseWithDeviceId
        .channel("volunteering_interest_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "volunteering_interest"
          },
          () => {
            console.log("Volunteer interest data changed, refreshing...")
            fetchInitialData()
          }
        )
        .subscribe()

      subscriptionRef.current = subscription
    } catch (error) {
      console.error("Error setting up realtime subscription:", error)
    }
  }, [fetchInitialData])

  useEffect(() => {
    fetchInitialData()
    setupRealtimeSubscription()

    return () => {
      if (subscriptionRef.current.unsubscribe) {
        subscriptionRef.current.unsubscribe()
      }
    }
  }, [fetchInitialData, setupRealtimeSubscription])

  // Refetch data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log("Volunteers screen focused, fetching data")
      fetchInitialData()
      return () => {
        console.log("Volunteers screen unfocused")
      }
    }, [fetchInitialData])
  )

  const filterVolunteers = useCallback(() => {
    let filtered = [...volunteers]

    // Filter by status
    if (selectedStatus !== "all") {
      filtered = filtered.filter((v) => v.status === selectedStatus)
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (v) =>
          v.name?.toLowerCase().includes(term) ||
          v.email?.toLowerCase().includes(term) ||
          v.phone?.includes(term)
      )
    }

    setFilteredVolunteers(filtered)
  }, [searchTerm, selectedStatus, volunteers])

  // Filter volunteers when search term or status changes
  useEffect(() => {
    filterVolunteers()
  }, [filterVolunteers])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchInitialData()
    setRefreshing(false)
  }

  const handleStatusUpdate = async (id: string, newStatus: VolunteerStatus) => {
    try {
      await updateVolunteerStatus(id, newStatus)
      await fetchInitialData()
      Alert.alert("Success", `Volunteer status updated to ${newStatus}`)
    } catch (error) {
      console.error("Error updating volunteer status:", error)
      Alert.alert("Error", "Failed to update volunteer status")
    }
  }

  const handleDelete = async (id: string) => {
    Alert.alert(
      "Delete Volunteer",
      "Are you sure you want to delete this volunteer record?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteVolunteerInterest(id)
              await fetchInitialData()
              Alert.alert("Success", "Volunteer record deleted")
            } catch (error) {
              console.error("Error deleting volunteer:", error)
              Alert.alert("Error", "Failed to delete volunteer record")
            }
          }
        }
      ]
    )
  }

  const renderVolunteerItem = ({ item }: { item: VolunteeringInterest }) => {
    const statusStyle =
      {
        pending: styles.status_pending,
        approved: styles.status_approved,
        rejected: styles.status_rejected,
        contacted: styles.status_contacted
      }[item.status] || styles.status_pending

    return (
      <TouchableOpacity style={styles.volunteerCard} activeOpacity={0.95}>
        <View style={styles.volunteerHeader}>
          <View style={styles.volunteerInfo}>
            <Text style={styles.volunteerName}>
              {item.name || "Unknown"}{" "}
              {item.last_initial ? `${item.last_initial}.` : ""}
            </Text>
            <View style={styles.contactRow}>
              {item.email && (
                <View style={styles.contactItem}>
                  <Ionicons
                    name="mail-outline"
                    size={14}
                    color={theme.colors.text.secondary}
                  />
                  <Text style={styles.volunteerContact}>{item.email}</Text>
                </View>
              )}
              {item.phone && (
                <View style={styles.contactItem}>
                  <Ionicons
                    name="call-outline"
                    size={14}
                    color={theme.colors.text.secondary}
                  />
                  <Text style={styles.volunteerContact}>{item.phone}</Text>
                </View>
              )}
            </View>
            {item.type && (
              <View style={styles.typeTag}>
                <Text style={styles.volunteerType}>{item.type}</Text>
              </View>
            )}
          </View>
          <View style={styles.rightSection}>
            <View style={[styles.statusBadge, statusStyle]}>
              <Text style={styles.statusText}>{item.status}</Text>
            </View>
            <TouchableOpacity
              style={styles.moreButton}
              onPress={() => handleDelete(item.id)}
            >
              <Ionicons
                name="ellipsis-vertical"
                size={20}
                color={theme.colors.text.secondary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.quickActions}>
          {item.status !== "approved" && (
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => handleStatusUpdate(item.id, "approved")}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={20}
                color="#4CAF50"
              />
              <Text style={[styles.quickActionText, { color: "#4CAF50" }]}>
                Approve
              </Text>
            </TouchableOpacity>
          )}
          {item.status !== "contacted" && (
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => handleStatusUpdate(item.id, "contacted")}
            >
              <Ionicons name="call-outline" size={20} color="#2196F3" />
              <Text style={[styles.quickActionText, { color: "#2196F3" }]}>
                Contact
              </Text>
            </TouchableOpacity>
          )}
          {item.status !== "rejected" && (
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => handleStatusUpdate(item.id, "rejected")}
            >
              <Ionicons name="close-circle-outline" size={20} color="#F44336" />
              <Text style={[styles.quickActionText, { color: "#F44336" }]}>
                Reject
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.volunteerFooter}>
          <Text style={styles.volunteerDate}>
            {new Date(item.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            })}
          </Text>
        </View>
      </TouchableOpacity>
    )
  }

  const StatusFilter = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterContainer}
    >
      {(["all", "pending", "approved", "contacted", "rejected"] as const).map(
        (status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterButton,
              selectedStatus === status && styles.filterButtonActive
            ]}
            onPress={() => setSelectedStatus(status)}
          >
            <Text
              style={[
                styles.filterButtonText,
                selectedStatus === status && styles.filterButtonTextActive
              ]}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {status === "all" && ` (${stats.total})`}
              {status === "pending" && ` (${stats.pending})`}
              {status === "approved" && ` (${stats.approved})`}
              {status === "contacted" && ` (${stats.contacted})`}
              {status === "rejected" && ` (${stats.rejected})`}
            </Text>
          </TouchableOpacity>
        )
      )}
    </ScrollView>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={getTextColorForBackground(theme.colors.primary)}
          />
        </TouchableOpacity>
        <Text style={styles.title}>Volunteer Management</Text>
        {isDebugMode && (
          <View style={styles.debugBadge}>
            <Text style={styles.debugText}>DEBUG</Text>
          </View>
        )}
      </View>

      {/* Stats Summary */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, styles.pendingColor]}>
            {stats.pending}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, styles.approvedColor]}>
            {stats.approved}
          </Text>
          <Text style={styles.statLabel}>Approved</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, styles.contactedColor]}>
            {stats.contacted}
          </Text>
          <Text style={styles.statLabel}>Contacted</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.colors.text.secondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, email, or phone..."
          placeholderTextColor={theme.colors.text.secondary}
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={() => setSearchTerm("")}>
            <Ionicons
              name="close-circle"
              size={20}
              color={theme.colors.text.secondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Status Filter */}
      <StatusFilter />

      {loading ? (
        <View style={styles.centered}>
          <Text style={styles.centeredText}>Loading volunteer data...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredVolunteers}
          renderItem={renderVolunteerItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="people-outline"
                size={64}
                color={theme.colors.text.secondary}
              />
              <Text style={styles.emptyText}>
                {searchTerm || selectedStatus !== "all"
                  ? "No volunteers found matching your criteria"
                  : "No volunteer signups yet"}
              </Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const createStyles = (theme: ReturnType<typeof useTheme>["theme"]) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      backgroundColor: theme.colors.primary
    },
    backButton: {
      marginRight: 16
    },
    title: {
      fontSize: 20,
      fontWeight: "bold",
      color: getTextColorForBackground(theme.colors.primary),
      flex: 1
    },
    debugBadge: {
      backgroundColor: theme.colors.error,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12
    },
    debugText: {
      color: getTextColorForBackground(theme.colors.error),
      fontSize: 12,
      fontWeight: "bold"
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 16
    },
    centeredText: {
      color: theme.colors.text.primary,
      fontSize: 16
    },
    statsContainer: {
      flexDirection: "row",
      padding: 16,
      justifyContent: "space-around",
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border
    },
    statCard: {
      alignItems: "center"
    },
    statNumber: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.colors.text.primary
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      marginTop: 4
    },
    pendingColor: {
      color: "#FFA500"
    },
    approvedColor: {
      color: "#4CAF50"
    },
    contactedColor: {
      color: "#2196F3"
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.surface,
      margin: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border
    },
    searchInput: {
      flex: 1,
      marginLeft: 8,
      fontSize: 16,
      color: theme.colors.text.primary
    },
    filterContainer: {
      paddingHorizontal: 16,
      marginBottom: 8,
      maxHeight: 50
    },
    filterButton: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      marginRight: 8,
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      height: 32
    },
    filterButtonActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary
    },
    filterButtonText: {
      fontSize: 14,
      color: theme.colors.text.primary
    },
    filterButtonTextActive: {
      color: getTextColorForBackground(theme.colors.primary)
    },
    listContent: {
      padding: 16
    },
    volunteerCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden"
    },
    volunteerHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      padding: 16,
      paddingBottom: 12
    },
    volunteerInfo: {
      flex: 1,
      marginRight: 12
    },
    volunteerName: {
      fontSize: 17,
      fontWeight: "600",
      color: theme.colors.text.primary,
      marginBottom: 6
    },
    contactRow: {
      marginBottom: 6
    },
    contactItem: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4
    },
    volunteerContact: {
      fontSize: 13,
      color: theme.colors.text.secondary,
      marginLeft: 6
    },
    typeTag: {
      alignSelf: "flex-start",
      backgroundColor: theme.colors.background,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      marginTop: 4
    },
    volunteerType: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      textTransform: "capitalize"
    },
    rightSection: {
      alignItems: "flex-end"
    },
    moreButton: {
      marginTop: 8,
      padding: 4
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16
    },
    status_pending: {
      backgroundColor: "#FFA500"
    },
    status_approved: {
      backgroundColor: "#4CAF50"
    },
    status_rejected: {
      backgroundColor: "#F44336"
    },
    status_contacted: {
      backgroundColor: "#2196F3"
    },
    statusText: {
      color: "#fff",
      fontSize: 11,
      fontWeight: "600",
      textTransform: "uppercase"
    },
    quickActions: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingHorizontal: 8
    },
    quickActionButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      paddingHorizontal: 8
    },
    quickActionText: {
      fontSize: 13,
      fontWeight: "500",
      marginLeft: 6
    },
    volunteerFooter: {
      paddingHorizontal: 16,
      paddingBottom: 12,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border
    },
    volunteerDate: {
      fontSize: 11,
      color: theme.colors.text.secondary
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 48
    },
    emptyText: {
      fontSize: 16,
      color: theme.colors.text.secondary,
      marginTop: 16,
      textAlign: "center"
    }
  })

// Default export wrapped with ProtectedComponent
export default function VolunteerManagement() {
  return (
    <ProtectedComponent requiredPermissions={[Permission.MANAGE_VOLUNTEERS]}>
      <VolunteerManagementContent />
    </ProtectedComponent>
  )
}
