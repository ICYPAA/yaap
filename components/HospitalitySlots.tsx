import { Ionicons } from "@expo/vector-icons"
import React, { useEffect, useState } from "react"
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native"
import { useTheme } from "../context/ThemeContext"
import { withDeviceId } from "../lib/supabase"

export interface HospitalitySlot {
  id: number
  program_id: number
  date_time: string
  group_hosting: string
  planning_to_bring: string
  room: string
  scheduled_hours: number
}

interface HospitalitySlotsProps {
  programId: number
  onCurrentHostChange?: (host: HospitalitySlot | null) => void
}

// Helper function to get current hospitality host
export const getCurrentHospitalityHost = (slots: HospitalitySlot[]): HospitalitySlot | null => {
  const now = new Date()
  return slots.find((slot) => {
    if (!slot.date_time) return false
    const slotStart = new Date(slot.date_time)
    const slotEnd = new Date(slotStart.getTime() + (slot.scheduled_hours || 2) * 60 * 60 * 1000)
    return now >= slotStart && now <= slotEnd
  }) || null
}

export const HospitalitySlots: React.FC<HospitalitySlotsProps> = ({
  programId,
  onCurrentHostChange
}) => {
  const { theme } = useTheme()
  const [slots, setSlots] = useState<HospitalitySlot[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [currentHost, setCurrentHost] = useState<HospitalitySlot | null>(null)

  useEffect(() => {
    // Always fetch to get current host
    fetchHospitalitySlots()
  }, [programId])

  const fetchHospitalitySlots = async () => {
    try {
      setLoading(true)
      const supabaseWithDeviceId = await withDeviceId()

      const { data, error } = await supabaseWithDeviceId.rpc(
        "get_hospitality_slots",
        { p_program_id: programId }
      )

      // TEST DATA: Add mock data for demonstration
      const now = new Date()
      const testSlots: HospitalitySlot[] = [
        {
          id: 1,
          program_id: programId,
          date_time: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), // Started 30 mins ago
          group_hosting: "Denver Young People's Group",
          planning_to_bring: "Coffee, snacks, and games",
          room: "Suite 2301",
          scheduled_hours: 2
        },
        {
          id: 2,
          program_id: programId,
          date_time: new Date(now.getTime() + 90 * 60 * 1000).toISOString(), // Starts in 90 mins
          group_hosting: "Phoenix Unity Group",
          planning_to_bring: "Pizza and sodas",
          room: "Suite 2301",
          scheduled_hours: 2
        },
        {
          id: 3,
          program_id: programId,
          date_time: new Date(now.getTime() + 210 * 60 * 1000).toISOString(), // Starts in 3.5 hours
          group_hosting: "Los Angeles Fellowship",
          planning_to_bring: "Desserts and coffee",
          room: "Suite 2301",
          scheduled_hours: 2
        }
      ]

      if (error) {
        console.error("Error fetching hospitality slots:", error)
        console.log("Using test data instead")
        setSlots(testSlots)
        const currentSlot = getCurrentHospitalityHost(testSlots)
        setCurrentHost(currentSlot)
        if (onCurrentHostChange) {
          onCurrentHostChange(currentSlot)
        }
      } else {
        console.log("Hospitality slots data from DB:", data)
        const slotsData = data && data.length > 0 ? data : testSlots // Use test data if no real data
        setSlots(slotsData)
        
        // Find current host based on current time
        const currentSlot = getCurrentHospitalityHost(slotsData)
        setCurrentHost(currentSlot)
        
        // Notify parent component if callback provided
        if (onCurrentHostChange) {
          onCurrentHostChange(currentSlot)
        }
      }
    } catch (error) {
      console.error("Error in fetchHospitalitySlots:", error)
      // Use test data on error
      const now = new Date()
      const testSlots: HospitalitySlot[] = [
        {
          id: 1,
          program_id: programId,
          date_time: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
          group_hosting: "Denver Young People's Group",
          planning_to_bring: "Coffee, snacks, and games",
          room: "Suite 2301",
          scheduled_hours: 2
        }
      ]
      setSlots(testSlots)
      const currentSlot = getCurrentHospitalityHost(testSlots)
      setCurrentHost(currentSlot)
    } finally {
      setLoading(false)
    }
  }

  const formatDateTime = (dateTimeString: string) => {
    try {
      if (!dateTimeString) return { date: "", time: "TBD", endTime: "TBD" }
      
      // Parse the date - JavaScript Date constructor handles ISO strings with timezone correctly
      const date = new Date(dateTimeString)
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.error("Invalid date:", dateTimeString)
        return { date: "", time: "TBD", endTime: "TBD" }
      }
      
      // Format date using local timezone methods
      const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      
      // Use local timezone getters
      const dayOfWeek = weekdays[date.getDay()]
      const month = months[date.getMonth()] // getMonth() returns 0-11
      const dayNum = date.getDate()
      const formattedDate = `${dayOfWeek}, ${month} ${dayNum}`
      
      // Format start time using local timezone
      const hours = date.getHours()
      const minutes = date.getMinutes()
      const period = hours >= 12 ? "PM" : "AM"
      const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
      const displayMinute = minutes.toString().padStart(2, "0")
      const formattedTime = `${displayHour}:${displayMinute} ${period}`
      
      return { date: formattedDate, time: formattedTime, endTime: "" }
    } catch (error) {
      console.error("Error formatting date/time:", error, dateTimeString)
      return { date: "", time: "TBD", endTime: "TBD" }
    }
  }
  
  const calculateEndTime = (dateTimeString: string, hours: number) => {
    try {
      const startDate = new Date(dateTimeString)
      const endDate = new Date(startDate.getTime() + (hours * 60 * 60 * 1000))
      
      const endHours = endDate.getHours()
      const endMinutes = endDate.getMinutes()
      const endPeriod = endHours >= 12 ? "PM" : "AM"
      const endDisplayHour = endHours === 0 ? 12 : endHours > 12 ? endHours - 12 : endHours
      const endDisplayMinute = endMinutes.toString().padStart(2, "0")
      
      return `${endDisplayHour}:${endDisplayMinute} ${endPeriod}`
    } catch (error) {
      console.error("Error calculating end time:", error)
      return "TBD"
    }
  }

  // Group slots by date
  const groupedSlots = slots.reduce(
    (groups: { [key: string]: HospitalitySlot[] }, slot) => {
      const { date } = formatDateTime(slot.date_time)
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(slot)
      return groups
    },
    {}
  )

  const styles = StyleSheet.create({
    container: {
      marginTop: 16,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingTop: 16
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: expanded ? 12 : 0
    },
    title: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text.primary
    },
    expandButton: {
      padding: 4
    },
    loadingContainer: {
      paddingVertical: 20,
      alignItems: "center"
    },
    loadingText: {
      marginTop: 8,
      color: theme.colors.text.secondary,
      fontSize: 14
    },
    dateHeader: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.primary,
      marginTop: 12,
      marginBottom: 8
    },
    slotCard: {
      backgroundColor: theme.colors.background,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.colors.border
    },
    slotTime: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4
    },
    timeText: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      marginLeft: 6
    },
    groupName: {
      fontSize: 15,
      fontWeight: "500",
      color: theme.colors.text.primary,
      marginBottom: 2
    },
    roomText: {
      fontSize: 13,
      color: theme.colors.text.secondary,
      marginBottom: 2
    },
    planningToBring: {
      fontSize: 13,
      color: theme.colors.text.secondary,
      fontStyle: "italic"
    },
    emptyContainer: {
      paddingVertical: 20,
      alignItems: "center"
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      fontStyle: "italic"
    },
    currentHostCard: {
      backgroundColor: theme.colors.primary + "15",
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.colors.primary + "30"
    },
    currentHostHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 6
    },
    currentHostLabel: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      marginLeft: 6,
      textTransform: "uppercase",
      letterSpacing: 0.5
    },
    currentHostName: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text.primary,
      marginBottom: 6
    },
    currentHostTime: {
      flexDirection: "row",
      alignItems: "center"
    },
    currentHostTimeText: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      marginLeft: 6
    },
    currentHostRoom: {
      fontSize: 13,
      color: theme.colors.text.secondary,
      marginTop: 4
    }
  })

  return (
    <View style={styles.container}>
      {/* Current Host Display */}
      {currentHost && (
        <View style={styles.currentHostCard}>
          <View style={styles.currentHostHeader}>
            <Ionicons
              name="people"
              size={18}
              color={theme.colors.primary}
            />
            <Text style={styles.currentHostLabel}>Currently Hosting:</Text>
          </View>
          <Text style={styles.currentHostName}>{currentHost.group_hosting}</Text>
          <View style={styles.currentHostTime}>
            <Ionicons
              name="time-outline"
              size={14}
              color={theme.colors.text.secondary}
            />
            <Text style={styles.currentHostTimeText}>
              Until {calculateEndTime(currentHost.date_time, currentHost.scheduled_hours || 2)}
            </Text>
          </View>
          {currentHost.room && (
            <Text style={styles.currentHostRoom}>Room: {currentHost.room}</Text>
          )}
        </View>
      )}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Text style={styles.title}>Full Hospitality Schedule</Text>
        <View style={styles.expandButton}>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={theme.colors.text.secondary}
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Loading schedule...</Text>
            </View>
          ) : slots.length > 0 ? (
            Object.entries(groupedSlots).map(([dateKey, dateSlots]) => (
              <View key={dateKey}>
                <Text style={styles.dateHeader}>{dateKey}</Text>
                {dateSlots.map((slot) => {
                  const { time } = formatDateTime(slot.date_time)
                  const endTime = calculateEndTime(slot.date_time, slot.scheduled_hours || 2)
                  
                  return (
                    <View key={slot.id} style={styles.slotCard}>
                      <View style={styles.slotTime}>
                        <Ionicons
                          name="time-outline"
                          size={14}
                          color={theme.colors.text.secondary}
                        />
                        <Text style={styles.timeText}>
                          {time} - {endTime}
                        </Text>
                      </View>
                      <Text style={styles.groupName}>{slot.group_hosting}</Text>
                      {slot.room && (
                        <Text style={styles.roomText}>Room: {slot.room}</Text>
                      )}
                      {slot.planning_to_bring && (
                        <Text style={styles.planningToBring}>
                          {slot.planning_to_bring}
                        </Text>
                      )}
                    </View>
                  )
                })}
              </View>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No hospitality schedule available
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  )
}
