import { Ionicons } from "@expo/vector-icons"
import React, { useEffect, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View
} from "react-native"
import { useTheme } from "../context/ThemeContext"
import { makeRequest } from "../lib/requestHelper"
import { withDeviceId } from "../lib/supabase"

interface BidEvent {
  id: string
  title: string
  start_time: string
  end_time: string
  location: string
  description?: string
}

interface BidScheduleProps {
  programId?: number
}

export const BidSchedule: React.FC<BidScheduleProps> = ({ programId }) => {
  const { theme } = useTheme()
  const styles = createStyles(theme)
  const [bidEvents, setBidEvents] = useState<BidEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBidSchedule()
  }, [programId])

  const fetchBidSchedule = async () => {
    try {
      setLoading(true)

      if (!programId) {
        // If no program ID, show static schedule
        setBidEvents(DEFAULT_BID_SCHEDULE)
        return
      }

      const supabaseWithDeviceId = await withDeviceId()

      // Fetch bid schedule events from the program
      const { data, error } = await makeRequest({
        table: "pre-conf-events",
        isDebugMode: false,
        query: () =>
          supabaseWithDeviceId
            .from("pre-conf-events")
            .select("id, title, start_time, end_time, location, description")
            .eq("program_id", programId)
            .eq("event_type", "bid_meeting") // Assuming bid meetings have a specific type
            .order("start_time", { ascending: true })
      })

      if (error) {
        console.error("Error fetching bid schedule:", error)
        // Fall back to static schedule if fetch fails
        setBidEvents(DEFAULT_BID_SCHEDULE)
      } else {
        setBidEvents(data || DEFAULT_BID_SCHEDULE)
      }
    } catch (error) {
      console.error("Error in fetchBidSchedule:", error)
      setBidEvents(DEFAULT_BID_SCHEDULE)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (timeString: string) => {
    try {
      const date = new Date(timeString)
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      })
    } catch {
      return timeString
    }
  }

  const formatTimeRange = (startTime: string, endTime: string) => {
    const start = formatTime(startTime)
    const end = formatTime(endTime)
    return `${start} - ${end}`
  }

  const renderBidEvent = ({ item }: { item: BidEvent }) => (
    <View style={styles.eventCard}>
      <View style={styles.eventHeader}>
        <Text style={styles.eventTitle}>{item.title}</Text>
        <View style={styles.timeContainer}>
          <Ionicons
            name="time-outline"
            size={16}
            color={theme.colors.primary}
          />
          <Text style={styles.eventTime}>
            {formatTimeRange(item.start_time, item.end_time)}
          </Text>
        </View>
      </View>

      {item.location && (
        <View style={styles.locationContainer}>
          <Ionicons
            name="location-outline"
            size={16}
            color={theme.colors.primary}
          />
          <Text style={styles.eventLocation}>{item.location}</Text>
        </View>
      )}

      {item.description && (
        <Text style={styles.eventDescription}>{item.description}</Text>
      )}
    </View>
  )

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons
            name="calendar-outline"
            size={24}
            color={theme.colors.primary}
          />
          <Text style={styles.title}>Bid Schedule</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading bid schedule...</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons
          name="calendar-outline"
          size={24}
          color={theme.colors.primary}
        />
        <Text style={styles.title}>Bid Schedule</Text>
      </View>

      {bidEvents.length > 0 ? (
        <FlatList
          data={bidEvents}
          renderItem={renderBidEvent}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No bid schedule available</Text>
        </View>
      )}
    </View>
  )
}

// Default/static bid schedule fallback
const DEFAULT_BID_SCHEDULE: BidEvent[] = [
  {
    id: "1",
    title: "Bid Committee Meeting",
    start_time: "2024-08-01T09:00:00Z",
    end_time: "2024-08-01T10:30:00Z",
    location: "Conference Room A",
    description: "Review bid proposals and guidelines"
  },
  {
    id: "2",
    title: "Bid Presentations",
    start_time: "2024-08-01T14:00:00Z",
    end_time: "2024-08-01T16:00:00Z",
    location: "Main Ballroom",
    description: "Cities present their bids for hosting next year"
  },
  {
    id: "3",
    title: "Bid Voting",
    start_time: "2024-08-01T19:00:00Z",
    end_time: "2024-08-01T20:00:00Z",
    location: "Main Ballroom",
    description: "Official voting for next year's host city"
  },
  {
    id: "4",
    title: "Results Announcement",
    start_time: "2024-08-01T20:30:00Z",
    end_time: "2024-08-01T21:00:00Z",
    location: "Main Ballroom",
    description: "Announcement of winning bid and celebration"
  }
]

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginTop: 16,
      borderWidth: 1,
      borderColor: theme.colors.border
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12
    },
    title: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text.primary,
      marginLeft: 8
    },
    loadingContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 20
    },
    loadingText: {
      marginLeft: 8,
      color: theme.colors.text.secondary,
      fontSize: 14
    },
    eventCard: {
      backgroundColor: theme.colors.background,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.colors.border
    },
    eventHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 8
    },
    eventTitle: {
      fontSize: 16,
      fontWeight: "500",
      color: theme.colors.text.primary,
      flex: 1,
      marginRight: 8
    },
    timeContainer: {
      flexDirection: "row",
      alignItems: "center"
    },
    eventTime: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      marginLeft: 4
    },
    locationContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8
    },
    eventLocation: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      marginLeft: 4
    },
    eventDescription: {
      fontSize: 14,
      color: theme.colors.text.primary,
      lineHeight: 20
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

export default BidSchedule
