import { Ionicons } from "@expo/vector-icons"
import React, { useCallback, useEffect, useState } from "react"
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native"
import { useTheme } from "../context/ThemeContext"
import { DEFAULT_CONFERENCE_TIME_ZONE } from "../lib/conferenceTime"
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
  timeZone?: string
  onCurrentHostChange?: (host: HospitalitySlot | null) => void
}

// Helper function to get current hospitality host
export const getCurrentHospitalityHost = (
  slots: HospitalitySlot[],
  now = new Date()
): HospitalitySlot | null => {
  // Hospitality slots are stored as real instants, so they can be compared
  // directly. The conference time zone is only needed when displaying them.
  // Find the slot that's currently active
  return slots.find((slot) => {
    if (!slot.date_time) return false

    const slotStart = new Date(slot.date_time)
    if (Number.isNaN(slotStart.getTime())) return false
    const slotEnd = new Date(
      slotStart.getTime() + (slot.scheduled_hours || 2) * 60 * 60 * 1000
    )

    return now >= slotStart && now <= slotEnd
  }) || null
}

export const HospitalitySlots: React.FC<HospitalitySlotsProps> = ({
  programId,
  timeZone = DEFAULT_CONFERENCE_TIME_ZONE,
  onCurrentHostChange
}) => {
  const { theme } = useTheme()
  const [slots, setSlots] = useState<HospitalitySlot[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [currentHost, setCurrentHost] = useState<HospitalitySlot | null>(null)

  const fetchHospitalitySlots = useCallback(async () => {
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
  }, [onCurrentHostChange, programId])

  useEffect(() => {
    // Always fetch to get current host
    fetchHospitalitySlots()
  }, [fetchHospitalitySlots])

  const formatDateTime = (dateTimeString: string) => {
    try {
      if (!dateTimeString) return { date: "", time: "TBD", endTime: "TBD" }

      const date = new Date(dateTimeString)
      if (Number.isNaN(date.getTime())) {
        return { date: "", time: "TBD", endTime: "TBD" }
      }
      const formattedDate = new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday: "long",
        month: "short",
        day: "numeric"
      }).format(date)
      const formattedTime = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "numeric",
        minute: "2-digit"
      }).format(date)

      return { date: formattedDate, time: formattedTime, endTime: "" }
    } catch (error) {
      console.error("Error formatting date/time:", error, dateTimeString)
      return { date: "", time: "TBD", endTime: "TBD" }
    }
  }
  
  const calculateEndTime = (dateTimeString: string, hoursToAdd: number) => {
    try {
      const start = new Date(dateTimeString)
      if (Number.isNaN(start.getTime())) return "TBD"
      const end = new Date(start.getTime() + hoursToAdd * 60 * 60 * 1000)

      return new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "numeric",
        minute: "2-digit"
      }).format(end)
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
