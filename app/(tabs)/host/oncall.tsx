import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import React, { useEffect, useState } from "react"
import {
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native"
import { useRole } from "../../../context/RoleContext"
import { UserRole } from "../../../lib/roleChecker"
import { useTheme } from "../../../context/ThemeContext"
import { supabase, withDeviceId } from "../../../lib/supabase"
import { getTextColorForBackground } from "../../../lib/theme"

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

const SERVICE_TYPES = [
  { key: "accessibility", label: "Accessibility", icon: "accessibility" },
  { key: "volunteers", label: "Volunteers", icon: "people" },
  { key: "hospitality", label: "Hospitality", icon: "restaurant" },
  { key: "support", label: "Support Chat", icon: "chatbubbles" }
]

export default function OnCallManagement() {
  const { theme } = useTheme()
  const router = useRouter()
  const { isAnyRole } = useRole()
  const [assignments, setAssignments] = useState<OnCallAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [availableUsers, setAvailableUsers] = useState<any[]>([])
  const programId = 3

  useEffect(() => {
    fetchAssignments()
    fetchAvailableUsers()
  }, [])

  const fetchAssignments = async () => {
    try {
      const supabaseWithDeviceId = await withDeviceId()
      const { data, error } = await supabaseWithDeviceId
        .from("oncall_assignments")
        .select("*")
        .eq("program_id", programId)
        .eq("is_active", true)

      if (error) throw error
      setAssignments(data || [])
    } catch (error) {
      console.error("Error fetching on-call assignments:", error)
      Alert.alert("Error", "Failed to load on-call assignments")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const fetchAvailableUsers = async () => {
    try {
      const supabaseWithDeviceId = await withDeviceId()
      // Get users with roles from the roles table
      const { data, error } = await supabaseWithDeviceId
        .from("roles")
        .select("user_id, role")
        .in("role", ["host", "admin", "steering", "advisory"])

      if (error) throw error

      // For now, just use user IDs as we don't have a proper profiles table
      // In production, you'd join with a profiles/users table
      const users = (data || []).map(r => ({
        id: r.user_id,
        email: `User (${r.role})`, // Placeholder - would get from profiles table
        role: r.role
      }))
      
      setAvailableUsers(users)
    } catch (error) {
      console.error("Error fetching users:", error)
    }
  }

  const assignOnCall = async (serviceType: string, userId: string) => {
    try {
      const supabaseWithDeviceId = await withDeviceId()
      
      // First, deactivate any existing assignments for this service
      await supabaseWithDeviceId
        .from("oncall_assignments")
        .update({ is_active: false })
        .eq("program_id", programId)
        .eq("service_type", serviceType)
        .eq("is_active", true)

      // Create new assignment
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabaseWithDeviceId
        .from("oncall_assignments")
        .insert({
          program_id: programId,
          service_type: serviceType,
          user_id: userId,
          assigned_by: user?.id,
          is_active: true
        })

      if (error) throw error

      Alert.alert("Success", "On-call assignment updated successfully")
      fetchAssignments()
    } catch (error) {
      console.error("Error assigning on-call:", error)
      Alert.alert("Error", "Failed to update on-call assignment")
    }
  }

  const removeAssignment = async (assignmentId: number) => {
    Alert.alert(
      "Remove Assignment",
      "Are you sure you want to remove this on-call assignment?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const supabaseWithDeviceId = await withDeviceId()
              const { error } = await supabaseWithDeviceId
                .from("oncall_assignments")
                .update({ is_active: false })
                .eq("id", assignmentId)

              if (error) throw error
              
              Alert.alert("Success", "Assignment removed successfully")
              fetchAssignments()
            } catch (error) {
              console.error("Error removing assignment:", error)
              Alert.alert("Error", "Failed to remove assignment")
            }
          }
        }
      ]
    )
  }

  const showAssignmentDialog = (serviceType: string) => {
    const currentAssignment = assignments.find(a => a.service_type === serviceType)
    
    Alert.alert(
      "Assign On-Call",
      `Select a user to be on-call for ${SERVICE_TYPES.find(s => s.key === serviceType)?.label}`,
      [
        ...availableUsers.map(user => ({
          text: user.email || `User ${user.id.slice(0, 8)}`,
          onPress: () => assignOnCall(serviceType, user.id)
        })),
        { text: "Cancel", style: "cancel" }
      ]
    )
  }

  const styles = createStyles(theme)

  const isAdmin = isAnyRole([UserRole.ADMIN, UserRole.STEERING])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerText}>On-Call Management</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true)
            fetchAssignments()
          }} />
        }
      >
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Current On-Call Assignments</Text>
          <Text style={styles.sectionDescription}>
            Users assigned here will receive push notifications for their service area
          </Text>

          {SERVICE_TYPES.map(service => {
            const assignment = assignments.find(a => a.service_type === service.key)
            
            return (
              <View key={service.key} style={styles.serviceCard}>
                <View style={styles.serviceHeader}>
                  <View style={styles.serviceInfo}>
                    <Ionicons
                      name={service.icon as any}
                      size={24}
                      color={theme.colors.primary}
                      style={styles.serviceIcon}
                    />
                    <Text style={styles.serviceLabel}>{service.label}</Text>
                  </View>
                </View>
                
                <View style={styles.assignmentInfo}>
                  {assignment ? (
                    <View style={styles.assignedUser}>
                      <Text style={styles.assignedText}>
                        User ID: {assignment.user_id.slice(0, 8)}...
                      </Text>
                      {isAdmin && (
                        <TouchableOpacity
                          onPress={() => removeAssignment(assignment.id)}
                          style={styles.removeButton}
                        >
                          <Ionicons name="close-circle" size={20} color={theme.colors.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <Text style={styles.unassignedText}>No one assigned</Text>
                  )}
                  
                  {isAdmin && (
                    <TouchableOpacity
                      style={styles.assignButton}
                      onPress={() => showAssignmentDialog(service.key)}
                    >
                      <Text style={styles.assignButtonText}>
                        {assignment ? "Reassign" : "Assign"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )
          })}
        </View>

        <View style={styles.infoSection}>
          <Ionicons name="information-circle" size={20} color={theme.colors.primary} />
          <Text style={styles.infoText}>
            On-call users will automatically receive push notifications when new requests
            come in for their assigned service area. Make sure assigned users have
            notifications enabled.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
      paddingHorizontal: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.card
    },
    backButton: {
      padding: 5
    },
    headerText: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.colors.text.primary
    },
    headerRightPlaceholder: {
      width: 38
    },
    scrollContainer: {
      flex: 1
    },
    sectionContainer: {
      padding: theme.spacing.lg
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.xs
    },
    sectionDescription: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing.lg
    },
    serviceCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
      ...theme.shadows.small
    },
    serviceHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing.sm
    },
    serviceInfo: {
      flexDirection: "row",
      alignItems: "center"
    },
    serviceIcon: {
      marginRight: theme.spacing.sm
    },
    serviceLabel: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text.primary
    },
    assignmentInfo: {
      marginTop: theme.spacing.sm
    },
    assignedUser: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center"
    },
    assignedText: {
      fontSize: 14,
      color: theme.colors.text.primary
    },
    unassignedText: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      fontStyle: "italic"
    },
    removeButton: {
      padding: theme.spacing.xs
    },
    assignButton: {
      marginTop: theme.spacing.sm,
      backgroundColor: theme.colors.primary,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.borderRadius.sm,
      alignSelf: "flex-start"
    },
    assignButtonText: {
      color: getTextColorForBackground(theme.colors.primary),
      fontSize: 14,
      fontWeight: "600"
    },
    infoSection: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: theme.colors.info + "20",
      padding: theme.spacing.md,
      margin: theme.spacing.lg,
      borderRadius: theme.borderRadius.md
    },
    infoText: {
      flex: 1,
      marginLeft: theme.spacing.sm,
      fontSize: 14,
      color: theme.colors.text.primary,
      lineHeight: 20
    }
  })