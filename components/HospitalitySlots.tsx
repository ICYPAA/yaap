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
  // Get current time and convert to CST for comparison
  // Since database times are stored in CST, we need to compare in CST
  const now = new Date()
  
  // Get CST offset (UTC-6 for CST, UTC-5 for CDT)
  // We'll get the current time in CST by getting UTC and adjusting
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000)
  // CST is UTC-6 hours (during standard time) or UTC-5 (during daylight time)
  // For simplicity, we'll check if we're in daylight saving time
  const isDST = () => {
    const jan = new Date(now.getFullYear(), 0, 1)
    const jul = new Date(now.getFullYear(), 6, 1)
    return now.getTimezoneOffset() < Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset())
  }
  const cstOffset = isDST() ? -5 : -6
  const cstTime = new Date(utcTime + (cstOffset * 60 * 60 * 1000))
  
  console.log("Current CST time for hospitality check:", cstTime.toISOString())
  
  // Find the slot that's currently active
  return slots.find((slot) => {
    if (!slot.date_time) return false
    
    // Parse the database time directly (it's already in CST)
    // Remove any timezone indicators to treat as CST time
    const cleanString = slot.date_time.replace('Z', '').replace(/[+-]\d{2}:\d{2}$/, '')
    
    // Create date from the clean string, treating it as CST
    const slotStart = new Date(cleanString)
    const slotEnd = new Date(slotStart.getTime() + (slot.scheduled_hours || 2) * 60 * 60 * 1000)
    
    console.log(`Checking slot: ${slot.group_hosting}`)
    console.log(`  Slot start: ${slotStart.toISOString()}`)
    console.log(`  Slot end: ${slotEnd.toISOString()}`)
    console.log(`  Current CST: ${cstTime.toISOString()}`)
    console.log(`  Is active: ${cstTime >= slotStart && cstTime <= slotEnd}`)
    
    return cstTime >= slotStart && cstTime <= slotEnd
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

      if (error) {
        console.error("Error fetching hospitality slots:", error)
        console.error("Error details:", JSON.stringify(error, null, 2))
        console.log("Note: Only confirmed slots (group_confirmed = true) are returned")
        setSlots([])
        setCurrentHost(null)
        if (onCurrentHostChange) {
          onCurrentHostChange(null)
        }
      } else {
        console.log("Hospitality slots fetched successfully")
        console.log("Raw data from RPC:", JSON.stringify(data, null, 2))
        console.log("Number of slots:", data?.length || 0)
        
        const slotsData = data || []
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
      setSlots([])
      setCurrentHost(null)
    } finally {
      setLoading(false)
    }
  }

  const formatDateTime = (dateTimeString: string) => {
    try {
      if (!dateTimeString) return { date: "", time: "TBD", endTime: "TBD" }
      
      // Parse the timestamp string directly WITHOUT timezone conversion
      // Treat whatever time is in the string as the display time
      
      // Extract date and time parts from the ISO string
      // Format can be: "2024-01-15T14:30:00Z" or "2024-01-15T14:30:00+00:00" etc
      const cleanString = dateTimeString.replace('Z', '').replace(/[+-]\d{2}:\d{2}$/, '')
      const [datePart, timePart] = cleanString.split('T')
      
      if (!datePart || !timePart) {
        console.error("Invalid date format:", dateTimeString)
        return { date: "", time: "TBD", endTime: "TBD" }
      }
      
      // Parse date components for day of week calculation
      const [year, month, day] = datePart.split('-').map(Number)
      
      // Create date object just for day of week (no timezone conversion)
      const dateForDayOfWeek = new Date(year, month - 1, day)
      
      const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      
      const dayOfWeek = weekdays[dateForDayOfWeek.getDay()]
      const monthName = months[month - 1]
      const formattedDate = `${dayOfWeek}, ${monthName} ${day}`
      
      // Parse time directly from the string (no conversion)
      const [hourStr, minuteStr] = timePart.split(':')
      const hours = parseInt(hourStr)
      const minutes = parseInt(minuteStr) || 0
      
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
  
  const calculateEndTime = (dateTimeString: string, hoursToAdd: number) => {
    try {
      // Parse time directly from string without timezone conversion
      const cleanString = dateTimeString.replace('Z', '').replace(/[+-]\d{2}:\d{2}$/, '')
      const [datePart, timePart] = cleanString.split('T')
      
      if (!timePart) return "TBD"
      
      // Parse hours and minutes
      const [hourStr, minuteStr] = timePart.split(':')
      let hours = parseInt(hourStr)
      const minutes = parseInt(minuteStr) || 0
      
      // Add the scheduled hours
      hours = hours + hoursToAdd
      
      // Handle day overflow
      if (hours >= 24) {
        hours = hours % 24
      }
      
      const period = hours >= 12 ? "PM" : "AM"
      const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
      const displayMinute = minutes.toString().padStart(2, "0")
      
      return `${displayHour}:${displayMinute} ${period}`
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
