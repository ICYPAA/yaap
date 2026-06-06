import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import React, { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Modal,
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
  user_name?: string // Will be populated with the actual user name
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
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [assigningUser, setAssigningUser] = useState(false)
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

      if (data && data.length > 0) {
        type AuthUserRow = {
          id: string
          email?: string
          full_name?: string
        }
        const assignments = data as OnCallAssignment[]

        // Get user names for the assigned users
        const assignedUserIds = assignments.map((a) => a.user_id)
        const { data: authUsers, error: authError } =
          await supabaseWithDeviceId.rpc("get_auth_user_names", {
            user_ids: assignedUserIds
          })

        // Create a map for easy lookup
        const authUsersMap = new Map<string, AuthUserRow>()
        if (authUsers) {
          ;(authUsers as AuthUserRow[]).forEach((u) => {
            authUsersMap.set(u.id, u)
          })
        }

        // Add user names to assignments
        const assignmentsWithNames = assignments.map((assignment) => {
          const authUser = authUsersMap.get(assignment.user_id)
          return {
            ...assignment,
            user_name:
              authUser?.full_name ||
              authUser?.email ||
              `User ID: ${assignment.user_id.slice(0, 8)}...`
          }
        })

        setAssignments(assignmentsWithNames)
      } else {
        setAssignments([])
      }
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

      // First get users with roles from the roles table
      const { data: rolesData, error: rolesError } = await supabaseWithDeviceId
        .from("roles")
        .select("user_id, role")
        .in("role", ["host", "admin", "steering", "advisory"])

      if (rolesError) throw rolesError

      if (!rolesData || rolesData.length === 0) {
        setAvailableUsers([])
        return
      }

      // Get user IDs to fetch their names
      const userIds = rolesData.map((r) => r.user_id)

      // Get user names from auth.users using the RPC function
      const { data: authUsers, error: authError } =
        await supabaseWithDeviceId.rpc("get_auth_user_names", {
          user_ids: userIds
        })

      if (authError) {
        console.error("Error fetching auth user names:", authError)
        // Fall back to showing role if RPC fails
      }

      // Create a map for easy lookup
      type AuthUserRow = {
        id: string
        email?: string
        full_name?: string
      }
      const authUsersMap = new Map<string, AuthUserRow>()
      if (authUsers) {
        ;(authUsers as AuthUserRow[]).forEach((u) => {
          authUsersMap.set(u.id, u)
        })
      }

      // Combine the data
      const users = rolesData.map((r) => {
        const authUser = authUsersMap.get(r.user_id)
        let displayName =
          authUser?.full_name ||
          authUser?.email ||
          `${r.role.charAt(0).toUpperCase() + r.role.slice(1)} User`

        // Add role to the name for clarity
        if (authUser?.full_name || authUser?.email) {
          displayName = `${displayName} (${r.role})`
        }

        return {
          id: r.user_id,
          email: displayName,
          role: r.role
        }
      })

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
      const {
        data: { user }
      } = await supabase.auth.getUser()
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
    setSelectedService(serviceType)
    setModalVisible(true)
  }

  const handleUserSelection = async (userId: string) => {
    if (!selectedService) return

    setAssigningUser(true)
    await assignOnCall(selectedService, userId)
    setAssigningUser(false)
    setModalVisible(false)
    setSelectedService(null)
  }

  const styles = createStyles(theme)

  const isAdmin = isAnyRole([UserRole.ADMIN, UserRole.STEERING])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons
            name="chevron-back"
            size={28}
            color={theme.colors.primary}
          />
        </TouchableOpacity>
        <Text style={styles.headerText}>On-Call Management</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              fetchAssignments()
            }}
          />
        }
      >
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Current On-Call Assignments</Text>
          <Text style={styles.sectionDescription}>
            Users assigned here will receive push notifications for their
            service area
          </Text>

          {SERVICE_TYPES.map((service) => {
            const assignment = assignments.find(
              (a) => a.service_type === service.key
            )

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
                        {assignment.user_name}
                      </Text>
                      {isAdmin && (
                        <TouchableOpacity
                          onPress={() => removeAssignment(assignment.id)}
                          style={styles.removeButton}
                        >
                          <Ionicons
                            name="close-circle"
                            size={20}
                            color={theme.colors.error}
                          />
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
          <Ionicons
            name="information-circle"
            size={20}
            color={theme.colors.primary}
          />
          <Text style={styles.infoText}>
            On-call users will automatically receive push notifications when new
            requests come in for their assigned service area. Make sure assigned
            users have notifications enabled.
          </Text>
        </View>
      </ScrollView>

      {/* User Selection Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setModalVisible(false)
          setSelectedService(null)
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Assign On-Call for{" "}
                {SERVICE_TYPES.find((s) => s.key === selectedService)?.label}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false)
                  setSelectedService(null)
                }}
                style={styles.modalCloseButton}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.colors.text.secondary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalUserList}>
              {availableUsers.length > 0 ? (
                availableUsers.map((user) => (
                  <TouchableOpacity
                    key={user.id}
                    style={styles.modalUserItem}
                    onPress={() => handleUserSelection(user.id)}
                    disabled={assigningUser}
                  >
                    <View style={styles.modalUserInfo}>
                      <Ionicons
                        name="person-circle"
                        size={32}
                        color={theme.colors.primary}
                      />
                      <View style={styles.modalUserText}>
                        <Text style={styles.modalUserName}>{user.email}</Text>
                        <Text style={styles.modalUserRole}>{user.role}</Text>
                      </View>
                    </View>
                    {assigningUser && (
                      <ActivityIndicator
                        size="small"
                        color={theme.colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.modalEmptyState}>
                  <Text style={styles.modalEmptyText}>No users available</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center"
    },
    modalContent: {
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.lg,
      width: "90%",
      maxHeight: "70%",
      padding: theme.spacing.lg
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing.lg
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.colors.text.primary,
      flex: 1
    },
    modalCloseButton: {
      padding: theme.spacing.xs
    },
    modalUserList: {
      maxHeight: 400
    },
    modalUserItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border
    },
    modalUserInfo: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1
    },
    modalUserText: {
      marginLeft: theme.spacing.md,
      flex: 1
    },
    modalUserName: {
      fontSize: 16,
      color: theme.colors.text.primary,
      fontWeight: "500"
    },
    modalUserRole: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      marginTop: 2
    },
    modalEmptyState: {
      padding: theme.spacing.xl,
      alignItems: "center"
    },
    modalEmptyText: {
      fontSize: 16,
      color: theme.colors.text.secondary
    }
  })
