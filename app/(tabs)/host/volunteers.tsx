import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import React, { useEffect, useState } from "react"
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native"
import { useDebug } from "../../../context/DebugContext"
import { useTheme } from "../../../context/ThemeContext"
import { makeRequest } from "../../../lib/requestHelper"
import { withDeviceId } from "../../../lib/supabase"
import { getTextColorForBackground } from "../../../lib/theme"

interface VolunteerSignup {
  id: string
  program_id: number
  name: string
  last_initial: string
  phone: string
  email: string
  type: string
  data: {
    interests: {
      greeter: boolean
      security: boolean
      cleanup: boolean
      setup: boolean
      host_committee: boolean
      wherever_needed: boolean
    }
    time_slots: {
      thursday_pm: boolean
      friday_am: boolean
      friday_midday: boolean
      friday_pm: boolean
      saturday_am: boolean
      saturday_midday: boolean
      saturday_pm: boolean
      sunday_am: boolean
      sunday_midday: boolean
      sunday_pm: boolean
      other: string
    }
    comments: string
  }
  status?: string
  created_at: string
}

export default function VolunteerSignups() {
  const router = useRouter()
  const { theme } = useTheme()
  const { isDebugMode } = useDebug()
  const [volunteers, setVolunteers] = useState<VolunteerSignup[]>([])
  const [loading, setLoading] = useState(true)
  const styles = createStyles(theme)

  useEffect(() => {
    fetchVolunteers()
  }, [])

  const fetchVolunteers = async () => {
    try {
      const supabaseWithDeviceId = await withDeviceId()
      const { data, error } = await makeRequest({
        table: "volunteering_interest",
        isDebugMode,
        query: () =>
          supabaseWithDeviceId
            .from("volunteering_interest")
            .select("*")
            .eq("program_id", 1)
            .order("created_at", { ascending: false })
      })

      if (error) throw error
      setVolunteers(data || [])
    } catch (error) {
      console.error("Error fetching volunteer signups:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      const supabaseWithDeviceId = await withDeviceId()
      const { error } = await makeRequest({
        table: "volunteering_interest",
        isDebugMode,
        query: () =>
          supabaseWithDeviceId
            .from("volunteering_interest")
            .update({ status: newStatus })
            .eq("id", id)
      })

      if (error) throw error
      fetchVolunteers()
    } catch (error) {
      console.error("Error updating volunteer status:", error)
    }
  }

  const renderItem = ({ item }: { item: VolunteerSignup }) => (
    <View style={styles.volunteerCard}>
      <View style={styles.volunteerHeader}>
        <Text style={styles.volunteerName}>
          {item.name} {item.last_initial}.
        </Text>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                !item.status || item.status === "pending"
                  ? theme.colors.warning
                  : item.status === "assigned"
                  ? theme.colors.warning
                  : theme.colors.success
            }
          ]}
        >
          <Text style={styles.statusText}>
            {item.status?.replace("_", " ") || "pending"}
          </Text>
        </View>
      </View>

      <View style={styles.volunteerDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="mail" size={16} color={theme.colors.primary} />
          <Text style={styles.detailText}>Email: {item.email}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="call" size={16} color={theme.colors.primary} />
          <Text style={styles.detailText}>Phone: {item.phone}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="person" size={16} color={theme.colors.primary} />
          <Text style={styles.detailText}>Type: {item.type}</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Interests</Text>
      </View>
      <View style={styles.interestsContainer}>
        {Object.entries(item.data.interests).map(
          ([key, value]) =>
            value && (
              <View key={key} style={styles.interestItem}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={theme.colors.success}
                />
                <Text style={styles.interestText}>
                  {key
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (l) => l.toUpperCase())}
                </Text>
              </View>
            )
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Available Times</Text>
      </View>
      <View style={styles.timeSlotsContainer}>
        {Object.entries(item.data.time_slots)
          .filter(([key, value]) => key !== "other" && value)
          .map(([key, value]) => (
            <View key={key} style={styles.timeSlotItem}>
              <Ionicons name="time" size={16} color={theme.colors.primary} />
              <Text style={styles.timeSlotText}>
                {key
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (l) => l.toUpperCase())}
              </Text>
            </View>
          ))}
        {item.data.time_slots.other && (
          <View style={styles.timeSlotItem}>
            <Ionicons name="time" size={16} color={theme.colors.primary} />
            <Text style={styles.timeSlotText}>
              Other: {item.data.time_slots.other}
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.additionalInfo}>{item.data.comments}</Text>
      <Text style={styles.timestamp}>
        Signed up: {new Date(item.created_at).toLocaleDateString()}
      </Text>

      <View style={styles.actionButtons}>
        {(!item.status || item.status === "pending") && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: theme.colors.warning }
            ]}
            onPress={() => handleStatusUpdate(item.id, "assigned")}
          >
            <Text style={styles.actionButtonText}>Assign Volunteer</Text>
          </TouchableOpacity>
        )}

        {item.status === "assigned" && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: theme.colors.success }
            ]}
            onPress={() => handleStatusUpdate(item.id, "completed")}
          >
            <Text style={styles.actionButtonText}>Mark Completed</Text>
          </TouchableOpacity>
        )}

        {item.status === "completed" && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: theme.colors.primary }
            ]}
            onPress={() => handleStatusUpdate(item.id, "pending")}
          >
            <Text style={styles.actionButtonText}>Reassign</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
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
        <Text style={styles.title}>Volunteer Sign-ups</Text>
        {isDebugMode && (
          <View style={styles.debugBadge}>
            <Text style={styles.debugText}>DEBUG</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <Text style={styles.centeredText}>Loading volunteer sign-ups...</Text>
        </View>
      ) : volunteers.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.centeredText}>No volunteer sign-ups found.</Text>
        </View>
      ) : (
        <FlatList
          data={volunteers}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
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
    listContainer: {
      padding: 16
    },
    volunteerCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      padding: 16,
      marginBottom: 16,
      elevation: 2,
      shadowColor: theme.colors.border,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2
    },
    volunteerHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8
    },
    volunteerName: {
      fontSize: 18,
      fontWeight: "500",
      color: theme.colors.text.primary
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12
    },
    statusText: {
      color: getTextColorForBackground(theme.colors.warning),
      fontSize: 12,
      fontWeight: "500",
      textTransform: "capitalize"
    },
    volunteerDetails: {
      marginBottom: 12,
      backgroundColor: theme.colors.surface,
      padding: 10,
      borderRadius: 6
    },
    detailRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 6
    },
    detailText: {
      marginLeft: 8,
      fontSize: 14,
      color: theme.colors.text.primary
    },
    additionalInfo: {
      fontSize: 16,
      marginBottom: 12,
      lineHeight: 22,
      color: theme.colors.text.primary
    },
    timestamp: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      marginBottom: 12
    },
    actionButtons: {
      flexDirection: "row",
      justifyContent: "flex-end"
    },
    actionButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 6,
      marginLeft: 8
    },
    actionButtonText: {
      color: getTextColorForBackground(theme.colors.primary),
      fontWeight: "500",
      fontSize: 14
    },
    sectionHeader: {
      marginBottom: 8
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.colors.text.primary
    },
    interestsContainer: {
      marginBottom: 12
    },
    interestItem: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4
    },
    interestText: {
      marginLeft: 8,
      fontSize: 14,
      color: theme.colors.text.primary
    },
    timeSlotsContainer: {
      marginBottom: 12
    },
    timeSlotItem: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4
    },
    timeSlotText: {
      marginLeft: 8,
      fontSize: 14,
      color: theme.colors.text.primary
    }
  })
