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
import { supabase } from "../lib/supabase"

const ADMIN_API_BASE_URL =
  process.env.EXPO_PUBLIC_ADMIN_API_BASE_URL?.replace(/\/$/, "") ||
  "https://www.icyhost.org"

interface Shift {
  id: string
  date: string
  start_time: string
  end_time: string
  job_type: string
  location: string[] | null
  min_volunteers: number
  max_volunteers: number
  assignments: any[]
  notes: string | null
  created_at: string
  updated_at: string
}

interface ChairpersonScheduleProps {
  userId?: string // Can be email, phone, or user ID
}

const ChairpersonSchedule: React.FC<ChairpersonScheduleProps> = ({
  userId
}) => {
  const { theme } = useTheme()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(
    {}
  )
  const [error, setError] = useState<string | null>(null)

  const styles = createStyles(theme)

  useEffect(() => {
    // Only fetch if we have a userId
    if (userId) {
      fetchChairpersonSchedule()
    }
  }, [userId])

  const fetchChairpersonSchedule = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      // Get the auth token from Supabase session
      const {
        data: { session },
        error: sessionError
      } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
        console.error("Error getting session:", sessionError)
        setError("Authentication required")
        setLoading(false)
        return
      }

      // Fetch shifts from the admin API (defaults to production host).
      let response: Response
      
      try {
        response = await fetch(`${ADMIN_API_BASE_URL}/api/schedule`, {
          method: "GET",
          headers: {
            "x-authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json"
          }
        })
      } catch (networkError) {
        console.error("Network error fetching shifts:", networkError)
        // On Android, sometimes HTTPS issues occur. Log more details.
        if (networkError instanceof TypeError && networkError.message.includes("Network request failed")) {
          throw new Error(
            "Unable to connect to the schedule server. Please check your internet connection and try again."
          )
        }
        throw networkError
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `Failed to fetch shifts: ${response.status}${errorText ? ` - ${errorText}` : ''}`
        )
      }

      const data = await response.json()
      
      console.log("=== Shift Schedule API Response ===")
      console.log("Response type:", typeof data)
      console.log("Is array:", Array.isArray(data))
      console.log("Keys:", data ? Object.keys(data) : 'null')
      console.log("Full response:", JSON.stringify(data, null, 2))

      // Handle different response formats
      let shiftsData: Shift[] = []
      
      if (Array.isArray(data)) {
        // Direct array of shifts
        shiftsData = data
      } else if (data && Array.isArray(data.shifts)) {
        // Shifts nested in object
        shiftsData = data.shifts
      } else if (data && Array.isArray(data.data)) {
        // Data nested in object
        shiftsData = data.data
      } else {
        console.error("Unexpected API response format:", data)
        shiftsData = []
      }

      // Log shifts data for debugging
      console.log("=== Processing Shifts ===")
      console.log("Total shifts received:", shiftsData.length)
      console.log("User identifier (email/phone/id):", userId)
      
      if (shiftsData.length > 0) {
        console.log("First shift structure:", JSON.stringify(shiftsData[0], null, 2))
        
        // Check assignment structure
        if (shiftsData[0].assignments) {
          console.log("Assignments in first shift:", shiftsData[0].assignments)
          console.log("Assignment structure:", shiftsData[0].assignments.length > 0 ? shiftsData[0].assignments[0] : 'No assignments')
        }
      }
      
      // Filter shifts where current user is in assignments if userId is provided
      const userShifts = userId && shiftsData.length > 0
        ? shiftsData.filter((shift: Shift) => {
            if (!shift.assignments || !Array.isArray(shift.assignments)) {
              console.log(`Shift ${shift.id} has no assignments array`)
              return false
            }
            
            const isUserAssigned = shift.assignments.some(
              (assignment: any) => {
                // Match by multiple fields: email, phone, user ID, etc.
                // userId could be email, but also check against all possible identifiers
                const matches = 
                  // Email matching
                  assignment.contact === userId ||
                  assignment.email === userId ||
                  // Phone matching (in case userId is a phone number)
                  assignment.phone === userId ||
                  assignment.phone_number === userId ||
                  // ID matching (various ID fields)
                  assignment.id === userId ||
                  assignment.user_id === userId ||
                  assignment.userId === userId ||
                  assignment.discord_id === userId ||
                  assignment.volunteering_interest_id === userId ||
                  // Also check if userId is numeric and matches numeric IDs
                  (userId && !isNaN(Number(userId)) && (
                    assignment.id === Number(userId) ||
                    assignment.volunteering_interest_id === Number(userId)
                  ))
                  
                if (matches) {
                  console.log(`User ${userId} matched in shift ${shift.id}:`, {
                    assignmentId: assignment.id,
                    contact: assignment.contact,
                    name: assignment.name,
                    matchedField: 
                      assignment.contact === userId ? 'contact/email' :
                      assignment.phone === userId ? 'phone' :
                      assignment.id === userId ? 'id' :
                      assignment.volunteering_interest_id === userId ? 'volunteering_interest_id' :
                      'other'
                  })
                }
                return matches
              }
            )
            
            return isUserAssigned
          })
        : shiftsData
      
      console.log("Filtered user shifts:", userShifts.length)
      setShifts(userShifts)
    } catch (error) {
      console.error("Error fetching chairperson schedule:", error)
      setError("Failed to load schedule. Please try again later.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Format time for display (already in CST, no conversion needed)
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":")
    const hour = parseInt(hours)
    const period = hour >= 12 ? "PM" : "AM"
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes} ${period}`
  }

  // Group shifts by date
  const getShiftsByDate = () => {
    const grouped: Record<string, Shift[]> = {}
    shifts.forEach((shift) => {
      if (!grouped[shift.date]) {
        grouped[shift.date] = []
      }
      grouped[shift.date].push(shift)
    })

    // Sort shifts within each date by start time
    Object.keys(grouped).forEach((date) => {
      grouped[date].sort((a, b) => a.start_time.localeCompare(b.start_time))
    })

    return grouped
  }

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const getJobTypeColor = (jobType: string) => {
    switch (jobType.toLowerCase()) {
      case "registration":
        return theme.colors.primary
      case "security":
        return theme.colors.error
      case "hospitality":
        return theme.colors.warning
      case "marathon meetings":
        return theme.colors.success
      case "merch":
        return theme.colors.info
      case "greeting":
        return "#9333ea"
      case "clean up":
        return "#f59e0b"
      default:
        return theme.colors.text.secondary
    }
  }

  const formatDate = (dateString: string) => {
    // Date is already formatted as YYYY-MM-DD in CST
    const [year, month, day] = dateString.split("-")
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec"
    ]
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    // Create date in CST (no conversion needed)
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    const dayOfWeek = dayNames[date.getDay()]
    const monthName = monthNames[parseInt(month) - 1]

    return `${dayOfWeek}, ${monthName} ${parseInt(day)}`
  }

  if (loading || !userId) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Your Chairperson Schedule</Text>
        </View>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Chairperson Schedule</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    )
  }

  if (shifts.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Your Shift Schedule</Text>
          <Text style={styles.noEventsText}>You have no shifts scheduled.</Text>
        </View>
      </View>
    )
  }

  const shiftsByDate = getShiftsByDate()
  const sortedDates = Object.keys(shiftsByDate).sort()

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Your Shift Schedule</Text>
            <Text style={styles.subtitle}>
              {shifts.length} shift{shifts.length !== 1 ? "s" : ""} assigned
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.refreshButton} 
            onPress={() => fetchChairpersonSchedule(true)}
            activeOpacity={0.7}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator 
                size="small" 
                color={theme.colors.primary} 
              />
            ) : (
              <Ionicons 
                name="refresh" 
                size={24} 
                color={theme.colors.primary}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.eventsList}
        showsVerticalScrollIndicator={false}
      >
        {sortedDates.map((date) => (
          <View key={date} style={styles.dateSection}>
            <Text style={styles.dateHeader}>{formatDate(date)}</Text>
            {shiftsByDate[date].map((shift) => {
              const isExpanded = expandedItems[shift.id]

              return (
                <TouchableOpacity
                  key={shift.id}
                  style={styles.eventItem}
                  onPress={() => toggleExpanded(shift.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.eventHeader}>
                    <View
                      style={[
                        styles.categoryIndicator,
                        { backgroundColor: getJobTypeColor(shift.job_type) }
                      ]}
                    />

                    <View style={styles.eventContent}>
                      <Text style={styles.eventCategory}>{shift.job_type}</Text>
                      <View style={styles.eventDetails}>
                        <View style={styles.eventDetailRow}>
                          <Ionicons
                            name="time-outline"
                            size={14}
                            color={theme.colors.text.secondary}
                          />
                          <Text style={styles.eventTime}>
                            {formatTime(shift.start_time)} -{" "}
                            {formatTime(shift.end_time)}
                          </Text>
                        </View>
                        {shift.location && shift.location.length > 0 && (
                          <View style={styles.eventDetailRow}>
                            <Ionicons
                              name="location-outline"
                              size={14}
                              color={theme.colors.text.secondary}
                            />
                            <Text style={styles.eventLocation}>
                              {shift.location.join(", ")}
                            </Text>
                          </View>
                        )}
                        {shift.assignments.length > 1 && (
                          <View style={styles.eventDetailRow}>
                            <Ionicons
                              name="people-outline"
                              size={14}
                              color={theme.colors.text.secondary}
                            />
                            <Text style={styles.eventTime}>
                              {shift.assignments.length - 1} other volunteer
                              {shift.assignments.length > 2 ? "s" : ""}
                            </Text>
                          </View>
                        )}
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
                      {shift.notes && (
                        <View style={styles.infoSection}>
                          <Text style={styles.infoLabel}>Notes:</Text>
                          <Text style={styles.infoText}>{shift.notes}</Text>
                        </View>
                      )}

                      {shift.assignments.length > 1 && (
                        <View style={styles.infoSection}>
                          <Text style={styles.infoLabel}>Co-volunteers:</Text>
                          {shift.assignments
                            .filter(
                              (a: any) =>
                                a.id !== userId && a.user_id !== userId
                            )
                            .map((assignment: any, index: number) => (
                              <Text key={index} style={styles.infoText}>
                                • {assignment.name || "Volunteer"}
                              </Text>
                            ))}
                        </View>
                      )}

                      <View style={styles.infoSection}>
                        <Text style={styles.infoLabel}>Staffing:</Text>
                        <Text style={styles.infoText}>
                          {shift.assignments.length} of {shift.min_volunteers}-
                          {shift.max_volunteers} volunteers
                        </Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              )
            })}
          </View>
        ))}
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
    headerTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start"
    },
    headerTextContainer: {
      flex: 1
    },
    refreshButton: {
      padding: theme.spacing.sm,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginLeft: theme.spacing.md
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
    errorText: {
      ...theme.typography.body,
      color: theme.colors.error,
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
    },
    dateSection: {
      marginBottom: theme.spacing.lg
    },
    dateHeader: {
      ...theme.typography.h3,
      color: theme.colors.text.primary,
      fontWeight: "bold",
      marginBottom: theme.spacing.sm,
      paddingBottom: theme.spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border
    }
  })

export default ChairpersonSchedule
