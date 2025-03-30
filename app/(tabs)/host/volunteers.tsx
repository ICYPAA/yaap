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
import { supabase } from "../../../lib/supabase"

interface VolunteerSignup {
  id: string
  profiles?: {
    full_name: string
    email: string
  }
  phone?: string
  availability: string
  preferred_role: string
  additional_info?: string
  status: string
  created_at: string
}

export default function VolunteerSignups() {
  const router = useRouter()
  const { theme } = useTheme()
  const { isDebugMode } = useDebug()
  const [volunteers, setVolunteers] = useState<VolunteerSignup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchVolunteers()
  }, [])

  const fetchVolunteers = async () => {
    try {
      const { data, error } = await makeRequest({
        table: "volunteer_signups",
        isDebugMode,
        query: () =>
          supabase
            .from("volunteer_signups")
            .select("*, profiles(full_name, email)")
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
      const { error } = await makeRequest({
        table: "volunteer_signups",
        isDebugMode,
        query: () =>
          supabase
            .from("volunteer_signups")
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
          {item.profiles?.full_name || "Anonymous"}
        </Text>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                item.status === "pending"
                  ? "#e74c3c"
                  : item.status === "assigned"
                  ? "#f39c12"
                  : "#2ecc71"
            }
          ]}
        >
          <Text style={styles.statusText}>{item.status.replace("_", " ")}</Text>
        </View>
      </View>

      <View style={styles.volunteerDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="mail" size={16} color="#3498db" />
          <Text style={styles.detailText}>
            {item.profiles?.email || "No email provided"}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="call" size={16} color="#3498db" />
          <Text style={styles.detailText}>
            {item.phone || "No phone provided"}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="calendar" size={16} color="#3498db" />
          <Text style={styles.detailText}>Available: {item.availability}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="briefcase" size={16} color="#3498db" />
          <Text style={styles.detailText}>
            Preferred Role: {item.preferred_role}
          </Text>
        </View>
      </View>

      <Text style={styles.additionalInfo}>{item.additional_info}</Text>
      <Text style={styles.timestamp}>
        Signed up: {new Date(item.created_at).toLocaleDateString()}
      </Text>

      <View style={styles.actionButtons}>
        {item.status === "pending" && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#f39c12" }]}
            onPress={() => handleStatusUpdate(item.id, "assigned")}
          >
            <Text style={styles.actionButtonText}>Assign Volunteer</Text>
          </TouchableOpacity>
        )}

        {item.status === "assigned" && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#2ecc71" }]}
            onPress={() => handleStatusUpdate(item.id, "completed")}
          >
            <Text style={styles.actionButtonText}>Mark Completed</Text>
          </TouchableOpacity>
        )}

        {item.status === "completed" && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#3498db" }]}
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
          <Ionicons name="arrow-back" size={24} color="white" />
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
          <Text>Loading volunteer sign-ups...</Text>
        </View>
      ) : volunteers.length === 0 ? (
        <View style={styles.centered}>
          <Text>No volunteer sign-ups found.</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#3498db"
  },
  backButton: {
    marginRight: 16
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
    flex: 1
  },
  debugBadge: {
    backgroundColor: "#e74c3c",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  debugText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold"
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  listContainer: {
    padding: 16
  },
  volunteerCard: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
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
    fontWeight: "500"
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  statusText: {
    color: "white",
    fontSize: 12,
    fontWeight: "500",
    textTransform: "capitalize"
  },
  volunteerDetails: {
    marginBottom: 12,
    backgroundColor: "#f8f9fa",
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
    fontSize: 14
  },
  additionalInfo: {
    fontSize: 16,
    marginBottom: 12,
    lineHeight: 22
  },
  timestamp: {
    fontSize: 12,
    color: "#7f8c8d",
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
    color: "white",
    fontWeight: "500",
    fontSize: 14
  }
})
