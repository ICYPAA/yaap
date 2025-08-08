import { Ionicons } from "@expo/vector-icons"
import React, { useEffect, useState } from "react"
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native"
import { useTheme } from "../context/ThemeContext"
import { supabase, withDeviceId } from "../lib/supabase"

interface ChairpersonEvent {
  id: string
  event_id: number
  event_name: string
  event_time: string
  event_date: string
  location: string
  responsibilities?: string
  notes?: string
  category: string
}

interface ChairpersonScheduleProps {
  userId?: string
}

const ChairpersonSchedule: React.FC<ChairpersonScheduleProps> = ({
  userId
}) => {
  const { theme } = useTheme()
  const [chairEvents, setChairEvents] = useState<ChairpersonEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(
    {}
  )
  const [userRole, setUserRole] = useState<string | null>(null)

  const styles = createStyles(theme)

  useEffect(() => {
    fetchChairpersonSchedule()
  }, [userId])

  const fetchChairpersonSchedule = async () => {
    try {
      setLoading(true)
      const supabaseWithDeviceId = await withDeviceId()

      // Get current user if no userId provided
      let currentUserId = userId
      if (!currentUserId) {
        const {
          data: { user }
        } = await supabase.auth.getUser()
        currentUserId = user?.id
      }

      if (!currentUserId) {
        setLoading(false)
        return
      }

      // Fetch user's role from users table
      const { data: userData, error: userError } = await supabaseWithDeviceId
        .from("users")
        .select("committee_role")
        .eq("user_id", currentUserId)
        .single()

      if (userError) {
        console.error("Error fetching user data:", userError)
        // Try a default role for demo purposes
        setUserRole("Program Chair")
      } else {
        setUserRole(userData?.committee_role || "Program Chair")
      }

      // For now, use mock data based on role
      // In production, this would fetch from a chairperson_events table
      const mockEvents = getMockEventsForRole(userData?.committee_role || "Program Chair")
      setChairEvents(mockEvents)
    } catch (error) {
      console.error("Error fetching chairperson schedule:", error)
    } finally {
      setLoading(false)
    }
  }

  const getMockEventsForRole = (role: string | null): ChairpersonEvent[] => {
    if (!role) return []

    const baseEvents: ChairpersonEvent[] = [
      {
        id: "cp-1",
        event_id: 1,
        event_name: "Opening Ceremony",
        event_time: "9:00 AM",
        event_date: "2025-03-01",
        location: "Main Ballroom",
        category: "Main Meeting",
        responsibilities: "Welcome attendees, introduce speakers",
        notes: "Arrive 30 minutes early for mic check"
      },
      {
        id: "cp-2",
        event_id: 2,
        event_name: "Speaker Meeting - Recovery Stories",
        event_time: "10:30 AM",
        event_date: "2025-03-01",
        location: "Conference Room A",
        category: "Speaker",
        responsibilities: "Introduce speakers, manage Q&A session",
        notes: "Review speaker bios beforehand"
      },
      {
        id: "cp-3",
        event_id: 3,
        event_name: "Lunch Hospitality Check",
        event_time: "12:00 PM",
        event_date: "2025-03-01",
        location: "Hospitality Suite",
        category: "Hospitality",
        responsibilities: "Ensure hospitality suite is running smoothly",
        notes: "Check with volunteers about supplies"
      }
    ]

    // Add role-specific events
    if (role.toLowerCase().includes("registration")) {
      baseEvents.push({
        id: "cp-4",
        event_id: 4,
        event_name: "Registration Desk Setup",
        event_time: "7:30 AM",
        event_date: "2025-03-01",
        location: "Hotel Lobby",
        category: "Setup",
        responsibilities: "Oversee registration desk setup and volunteer training",
        notes: "Bring extra name tags and lanyards"
      })
    }

    if (role.toLowerCase().includes("program")) {
      baseEvents.push({
        id: "cp-5",
        event_id: 5,
        event_name: "Workshop Coordination Meeting",
        event_time: "2:00 PM",
        event_date: "2025-03-01",
        location: "Meeting Room B",
        category: "Meeting",
        responsibilities: "Coordinate with workshop leaders",
        notes: "Confirm AV equipment for each room"
      })
    }

    return baseEvents.sort((a, b) => {
      const dateA = new Date(`${a.event_date} ${a.event_time}`)
      const dateB = new Date(`${b.event_date} ${b.event_time}`)
      return dateA.getTime() - dateB.getTime()
    })
  }

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case "main meeting":
        return theme.colors.primary
      case "speaker":
        return theme.colors.success
      case "hospitality":
        return theme.colors.warning
      case "setup":
        return theme.colors.info
      default:
        return theme.colors.text.secondary
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric"
    })
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Your Chairperson Schedule</Text>
        </View>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    )
  }

  if (!userRole) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Chairperson Schedule</Text>
          <Text style={styles.noRoleText}>
            You are not assigned as a chairperson for any events.
          </Text>
        </View>
      </View>
    )
  }

  if (chairEvents.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Your Chairperson Schedule</Text>
          <Text style={styles.roleText}>Role: {userRole}</Text>
          <Text style={styles.noEventsText}>
            No events scheduled for your role yet.
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Chairperson Schedule</Text>
        <Text style={styles.roleText}>Role: {userRole}</Text>
        <Text style={styles.subtitle}>
          Events where you have chairperson responsibilities
        </Text>
      </View>

      <ScrollView
        style={styles.eventsList}
        showsVerticalScrollIndicator={false}
      >
        {chairEvents.map((event) => {
          const isExpanded = expandedItems[event.id]

          return (
            <TouchableOpacity
              key={event.id}
              style={styles.eventItem}
              onPress={() => toggleExpanded(event.id)}
              activeOpacity={0.7}
            >
              <View style={styles.eventHeader}>
                <View
                  style={[
                    styles.categoryIndicator,
                    { backgroundColor: getCategoryColor(event.category) }
                  ]}
                />

                <View style={styles.eventContent}>
                  <Text style={styles.eventCategory}>{event.category}</Text>
                  <Text style={styles.eventName}>{event.event_name}</Text>
                  <View style={styles.eventDetails}>
                    <View style={styles.eventDetailRow}>
                      <Ionicons
                        name="time-outline"
                        size={14}
                        color={theme.colors.text.secondary}
                      />
                      <Text style={styles.eventTime}>
                        {formatDate(event.event_date)} at {event.event_time}
                      </Text>
                    </View>
                    <View style={styles.eventDetailRow}>
                      <Ionicons
                        name="location-outline"
                        size={14}
                        color={theme.colors.text.secondary}
                      />
                      <Text style={styles.eventLocation}>{event.location}</Text>
                    </View>
                  </View>
                </View>

                <Ionicons
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={theme.colors.text.secondary}
                />
              </View>

              {isExpanded && (
                <View style={styles.expandedContent}>
                  {event.responsibilities && (
                    <View style={styles.infoSection}>
                      <Text style={styles.infoLabel}>Your Responsibilities:</Text>
                      <Text style={styles.infoText}>{event.responsibilities}</Text>
                    </View>
                  )}

                  {event.notes && (
                    <View style={styles.infoSection}>
                      <Text style={styles.infoLabel}>Notes:</Text>
                      <Text style={styles.infoText}>{event.notes}</Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  )
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.lg,
      marginVertical: theme.spacing.md,
      ...theme.shadows.small
    },
    header: {
      marginBottom: theme.spacing.lg
    },
    title: {
      ...theme.typography.h2,
      color: theme.colors.text.primary,
      fontWeight: "bold",
      marginBottom: theme.spacing.xs
    },
    roleText: {
      ...theme.typography.body,
      color: theme.colors.primary,
      fontWeight: "600",
      marginBottom: theme.spacing.xs
    },
    subtitle: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      lineHeight: 20
    },
    noRoleText: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      fontStyle: "italic",
      marginTop: theme.spacing.sm
    },
    noEventsText: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      fontStyle: "italic",
      marginTop: theme.spacing.sm
    },
    eventsList: {
      maxHeight: 500
    },
    eventItem: {
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.sm,
      marginBottom: theme.spacing.sm,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: theme.colors.border
    },
    eventHeader: {
      flexDirection: "row",
      alignItems: "center",
      padding: theme.spacing.md
    },
    categoryIndicator: {
      width: 4,
      height: "100%",
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0
    },
    eventContent: {
      flex: 1,
      marginLeft: theme.spacing.md
    },
    eventCategory: {
      ...theme.typography.caption,
      color: theme.colors.text.secondary,
      textTransform: "uppercase",
      fontWeight: "bold",
      marginBottom: theme.spacing.xs
    },
    eventName: {
      ...theme.typography.body,
      color: theme.colors.text.primary,
      fontWeight: "bold",
      marginBottom: theme.spacing.sm
    },
    eventDetails: {
      gap: theme.spacing.xs
    },
    eventDetailRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs
    },
    eventTime: {
      ...theme.typography.caption,
      color: theme.colors.text.secondary
    },
    eventLocation: {
      ...theme.typography.caption,
      color: theme.colors.text.secondary
    },
    expandedContent: {
      padding: theme.spacing.md,
      paddingTop: 0,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border
    },
    infoSection: {
      marginBottom: theme.spacing.md
    },
    infoLabel: {
      ...theme.typography.caption,
      color: theme.colors.text.secondary,
      fontWeight: "bold",
      marginBottom: theme.spacing.xs
    },
    infoText: {
      ...theme.typography.body,
      color: theme.colors.text.primary,
      lineHeight: 20
    }
  })

export default ChairpersonSchedule