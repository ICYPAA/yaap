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
import { getTextColorForBackground } from "../../../lib/theme"

interface RideRequest {
  id: string
  program_id: number
  name: string
  phone: string
  location: string
  destination: string
  datetime: string
  passengers: number
  notes?: string
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

export default function RideRequests() {
  const router = useRouter()
  const { theme } = useTheme()
  const { isDebugMode } = useDebug()
  const [requests, setRequests] = useState<RideRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRequests()
  }, [])

  const fetchRequests = async () => {
    try {
      const { data, error } = await makeRequest({
        table: "ride_forms",
        isDebugMode,
        query: () =>
          supabase
            .from("ride_forms")
            .select("*")
            .eq("program_id", 1)
            .order("created_at", { ascending: false })
      })

      if (error) throw error
      setRequests(data || [])
    } catch (error) {
      console.error("Error fetching ride requests:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      const { error } = await makeRequest({
        table: "ride_forms",
        isDebugMode,
        query: () =>
          supabase.from("ride_forms").update({ status: newStatus }).eq("id", id)
      })

      if (error) throw error
      fetchRequests()
    } catch (error) {
      console.error("Error updating request status:", error)
    }
  }

  const renderItem = ({ item }: { item: RideRequest }) => (
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
                  : theme.colors.success
            }
          ]}
        >
          <Text style={styles(theme).statusText}>
            {item.status ? item.status.replace("_", " ") : "pending"}
          </Text>
        </View>
      </View>

      <View style={styles(theme).rideDetails}>
        <View style={styles(theme).locationContainer}>
          <Ionicons name="location" size={16} color={theme.colors.primary} />
          <Text style={styles(theme).locationText}>From: {item.location}</Text>
        </View>
        <View style={styles(theme).locationContainer}>
          <Ionicons name="navigate" size={16} color={theme.colors.primary} />
          <Text style={styles(theme).locationText}>To: {item.destination}</Text>
        </View>
        <View style={styles(theme).locationContainer}>
          <Ionicons name="time" size={16} color={theme.colors.primary} />
          <Text style={styles(theme).locationText}>
            When: {new Date(item.datetime).toLocaleString()}
          </Text>
        </View>
        <View style={styles(theme).locationContainer}>
          <Ionicons name="people" size={16} color={theme.colors.primary} />
          <Text style={styles(theme).locationText}>
            Passengers: {item.passengers}
          </Text>
        </View>
      </View>

      <Text style={styles(theme).requestDetails}>{item.notes}</Text>
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
            color={getTextColorForBackground(theme.colors.primary)}
          />
        </TouchableOpacity>
        <Text style={styles(theme).title}>Ride Requests</Text>
        {isDebugMode && (
          <View style={styles(theme).debugBadge}>
            <Text style={styles(theme).debugText}>DEBUG</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles(theme).centered}>
          <Text style={styles(theme).loadingText}>Loading requests...</Text>
        </View>
      ) : requests.length === 0 ? (
        <View style={styles(theme).centered}>
          <Text style={styles(theme).emptyText}>No ride requests found.</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
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
      color: getTextColorForBackground(theme.colors.error),
      fontSize: 12,
      fontWeight: "500",
      textTransform: "capitalize"
    },
    rideDetails: {
      marginBottom: theme.spacing.md,
      backgroundColor: theme.colors.background,
      padding: theme.spacing.sm,
      borderRadius: theme.borderRadius.sm
    },
    locationContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.spacing.xs
    },
    locationText: {
      ...theme.typography.body,
      color: theme.colors.text.primary,
      marginLeft: theme.spacing.sm
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
    }
  })
