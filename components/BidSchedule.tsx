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
  date: string
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
        console.log("No program ID provided for bid schedule")
        setBidEvents([])
        return
      }

      const supabaseWithDeviceId = await withDeviceId()

      // First, fetch the bid-related category IDs
      const { data: categories, error: catError } = await makeRequest({
        table: "event_categories",
        isDebugMode: false,
        query: () =>
          supabaseWithDeviceId
            .from("event_categories")
            .select("id, title")
            .eq("program_id", programId)
      })

      if (catError) {
        console.error("Error fetching event categories:", catError)
        setBidEvents([])
        return
      }

      // Find bid-related category IDs
      const bidCategoryIds = categories?.filter((cat: any) => {
        const normalizedTitle = cat.title
          .toLowerCase()
          .replace(/[^a-z\s]/g, '')
          .trim()
        
        return normalizedTitle.includes('bid') || 
               normalizedTitle === 'bidcommittee' ||
               normalizedTitle === 'bid committee'
      }).map((cat: any) => cat.id) || []

      if (bidCategoryIds.length === 0) {
        console.log("No bid categories found for program", programId)
        setBidEvents([])
        return
      }

      // Fetch events that have the bid category IDs
      const { data, error } = await makeRequest({
        table: "events",
        isDebugMode: false,
        query: () =>
          supabaseWithDeviceId
            .from("events")
            .select(`
              id,
              title,
              date,
              start_time,
              end_time,
              location,
              description
            `)
            .eq("program_id", programId)
            .in("event_category_id", bidCategoryIds)
            .order("date", { ascending: true })
            .order("start_time", { ascending: true })
      })

      if (error) {
        console.error("Error fetching bid schedule:", error)
        setBidEvents([])
      } else if (data && data.length > 0) {
        // Transform the data to match our BidEvent interface
        const transformedEvents: BidEvent[] = data.map((event: any) => ({
          id: event.id,
          title: event.title,
          date: event.date || '',
          start_time: event.start_time,
          end_time: event.end_time,
          location: event.location || '',
          description: event.description || undefined
        }))
        
        console.log(`Found ${transformedEvents.length} bid events`)
        setBidEvents(transformedEvents)
      } else {
        console.log("No bid events found")
        setBidEvents([])
      }
    } catch (error) {
      console.error("Error in fetchBidSchedule:", error)
      setBidEvents([])
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (timeString: string) => {
    try {
      if (!timeString) return "TBD"
      
      // Time is stored as HH:MM:SS format
      const [hours, minutes] = timeString.split(':')
      const hour = parseInt(hours)
      const minute = parseInt(minutes)
      
      if (isNaN(hour) || isNaN(minute)) {
        return "TBD"
      }
      
      // Convert to 12-hour format
      const period = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
      const displayMinute = minute.toString().padStart(2, '0')
      
      return `${displayHour}:${displayMinute} ${period}`
    } catch (error) {
      console.error("Error formatting time:", error, timeString)
      return "TBD"
    }
  }

  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return "Date TBD"
      
      // Date is stored as YYYY-MM-DD format
      const [year, month, day] = dateString.split('-').map(num => parseInt(num))
      
      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        return "Date TBD"
      }
      
      // Create date in local timezone (no conversion)
      const date = new Date(year, month - 1, day) // month is 0-indexed in JS
      
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December']
      
      return `${weekdays[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`
    } catch (error) {
      console.error("Error formatting date:", error, dateString)
      return "Date TBD"
    }
  }

  const formatTimeRange = (startTime: string, endTime: string) => {
    const start = formatTime(startTime)
    const end = formatTime(endTime)
    if (start === "TBD" || end === "TBD") {
      return "Time TBD"
    }
    return `${start} - ${end}`
  }

  // Group events by date
  const groupedEvents = bidEvents.reduce((groups: { [key: string]: BidEvent[] }, event) => {
    const dateKey = formatDate(event.date)
    if (!groups[dateKey]) {
      groups[dateKey] = []
    }
    groups[dateKey].push(event)
    return groups
  }, {})

  // Sort groups by date and sort events within each group by time
  const sortedGroupKeys = Object.keys(groupedEvents).sort((a, b) => {
    if (a === "Date TBD") return 1
    if (b === "Date TBD") return -1
    // Compare the date strings directly (YYYY-MM-DD format sorts correctly as strings)
    const dateA = groupedEvents[a][0]?.date || ''
    const dateB = groupedEvents[b][0]?.date || ''
    return dateA.localeCompare(dateB)
  })

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
        <View>
          {sortedGroupKeys.map((dateKey) => (
            <View key={dateKey}>
              <Text style={styles.dateHeader}>{dateKey}</Text>
              {groupedEvents[dateKey]
                .sort((a, b) => {
                  // Sort by start_time string (HH:MM:SS format sorts correctly as strings)
                  return (a.start_time || '').localeCompare(b.start_time || '')
                })
                .map((event) => (
                  <View key={event.id}>
                    {renderBidEvent({ item: event })}
                  </View>
                ))}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No bid schedule available</Text>
        </View>
      )}
    </View>
  )
}


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
    dateHeader: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.primary,
      marginTop: 12,
      marginBottom: 8,
      paddingVertical: 4
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
