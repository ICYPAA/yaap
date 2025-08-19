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

interface HospitalitySlot {
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
}

export const HospitalitySlots: React.FC<HospitalitySlotsProps> = ({
  programId
}) => {
  const { theme } = useTheme()
  const [slots, setSlots] = useState<HospitalitySlot[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (expanded) {
      fetchHospitalitySlots()
    }
  }, [programId, expanded])

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
        setSlots([])
      } else {
        console.log("Hospitality slots data from DB:", data)
        setSlots(data || [])
      }
    } catch (error) {
      console.error("Error in fetchHospitalitySlots:", error)
      setSlots([])
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
    }
  })

  return (
    <View style={styles.container}>
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
