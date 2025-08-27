import { FontAwesome6, Ionicons } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useFocusEffect, useNavigation } from "@react-navigation/native"
import * as Linking from "expo-linking"
import * as Notifications from "expo-notifications"
import { router } from "expo-router"
import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  AppState,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native"
import { BidSchedule } from "../../components/BidSchedule"
import { EventDetailsModal } from "../../components/EventDetailsModal"
import { useFeatures } from "../../context/FeatureContext"
import { useTheme } from "../../context/ThemeContext"
import { getOrCreateDeviceId } from "../../lib/security/deviceId"
import { supabase, withDeviceId } from "../../lib/supabase"
import {
  getProgramColor as getProgramColorUtil,
  getTextColorForBackground as getTextColorForBgUtil
} from "../../lib/theme"
import { Activity } from "../../types/activities"
import {
  Event,
  EventCategory,
  Program as ProgramType
} from "../../types/program"
import { Schedule } from "../../types/user"

// Define shadow styles to replace theme.shadows.small
const getShadowStyles = (isDark: boolean) => ({
  shadowColor: "#000",
  shadowOffset: {
    width: 0,
    height: isDark ? 2 : 1
  },
  shadowOpacity: isDark ? 0.3 : 0.1,
  shadowRadius: isDark ? 4 : 2,
  elevation: isDark ? 4 : 2
})

// --- TYPE DEFINITIONS (Refined for generic display) ---

type DisplayScheduleItem = {
  id: number
  title: string // From event.title
  description?: string // From event.description
  speakers?: string[] // From event.speakers
  location: string // From event.location
  time: string // Formatted start_time
  date: string // From event.date
  type: string // From event_categories.title
  categoryColor: string // From event_categories.color
  // Add can_save if needed by UI
  can_save?: boolean
}

// Define shared events data structure
type SharedEventsUser = {
  profile_image: string
  first_name: string
  last_initial: string
  saved_events: number[]
}

type SharedEventsData = {
  [userId: string]: SharedEventsUser
}

type HospitalityInfo = ProgramType["hospitality"] // Use type from ProgramType

// Structure to hold mapped data
type MappedProgramData = {
  programDetails: ProgramType | null
  events: DisplayScheduleItem[] // Single list of generic items
  hospitality: HospitalityInfo
  activities: Activity[]
}

// Add helper function to open maps
const openMaps = (address: string) => {
  const encodedAddress = encodeURIComponent(address)
  const mapsUrl = Platform.select({
    ios: `maps:0,0?q=${encodedAddress}`,
    android: `geo:0,0?q=${encodedAddress}`,
    default: `https://maps.google.com/?q=${encodedAddress}`
  })

  Linking.canOpenURL(mapsUrl).then((supported) => {
    if (supported) {
      Linking.openURL(mapsUrl)
    } else {
      // Fallback to Google Maps web URL if app links not supported
      Linking.openURL(`https://maps.google.com/?q=${encodedAddress}`)
    }
  })
}

// Add mock friends data
const mockFriends = [
  {
    id: 1,
    name: "Mike R.",
    avatar: "https://i.pravatar.cc/40?img=1",
    savedEvents: [11, 13, 23] // Going to Recovery Journey, Dance Party, and Comedy Show
  },
  {
    id: 2,
    name: "Sarah K.",
    avatar: "https://i.pravatar.cc/40?img=2",
    savedEvents: [13, 22] // Going to Dance Party and Service Work
  },
  {
    id: 3,
    name: "James H.",
    avatar: "https://i.pravatar.cc/40?img=3",
    savedEvents: [22, 23] // Going to Service Work and Comedy Show
  }
]

// Component to display users who have saved an event
const SharedEventUsers = ({
  eventId,
  sharedEvents,
  theme
}: {
  eventId: number
  sharedEvents: SharedEventsData
  theme: any
}) => {
  // Find users who have saved this event
  const usersWithEvent = Object.entries(sharedEvents).filter(([_, userData]) =>
    userData.saved_events.includes(eventId)
  )

  if (usersWithEvent.length === 0) {
    return null
  }

  return (
    <View style={{ marginTop: 8 }}>
      <Text
        style={{
          fontSize: 14,
          color: theme.colors.text.secondary,
          marginBottom: 4
        }}
      >
        Friends interested:
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {usersWithEvent.map(([userId, userData]) => (
          <View
            key={userId}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: theme.colors.surface,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 12,
              marginRight: 8,
              marginBottom: 4,
              borderWidth: 1,
              borderColor: theme.colors.border
            }}
          >
            {userData.profile_image ? (
              <Image
                source={{ uri: userData.profile_image }}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  marginRight: 4
                }}
              />
            ) : (
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: theme.colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 4
                }}
              >
                <Text style={{ color: "#fff", fontSize: 10 }}>
                  {userData.first_name.charAt(0)}
                </Text>
              </View>
            )}
            <Text style={{ fontSize: 12, color: theme.colors.text.primary }}>
              {userData.first_name} {userData.last_initial}.
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

// Helper function to check for time conflicts
const hasTimeConflict = (
  item: DisplayScheduleItem,
  allItems: DisplayScheduleItem[]
) => {
  // Parse the time string to get hours and minutes
  const parseTime = (timeStr: string) => {
    const [time, period] = timeStr.split(" ")
    let [hours, minutes] = time.split(":").map(Number)

    // Convert to 24-hour format
    if (period === "PM" && hours < 12) hours += 12
    if (period === "AM" && hours === 12) hours = 0

    return { hours, minutes }
  }

  // Estimate event duration (1 hour by default)
  const getDuration = (type: string) => {
    if (type === "panel") return 90 // 1.5 hours
    if (type === "speaker") return 60 // 1 hour
    if (type === "entertainment") return 120 // 2 hours
    return 60 // Default 1 hour
  }

  // Check if two time ranges overlap
  const isOverlapping = (
    start1: { hours: number; minutes: number },
    duration1: number,
    start2: { hours: number; minutes: number },
    duration2: number
  ) => {
    const end1Minutes = start1.hours * 60 + start1.minutes + duration1
    const end2Minutes = start2.hours * 60 + start2.minutes + duration2
    const start1Minutes = start1.hours * 60 + start1.minutes
    const start2Minutes = start2.hours * 60 + start2.minutes

    return (
      (start1Minutes < end2Minutes && end1Minutes > start2Minutes) ||
      (start2Minutes < end1Minutes && end2Minutes > start1Minutes)
    )
  }

  const itemTime = parseTime(item.time)
  const itemDuration = getDuration(item.type)

  // Find other saved items on the same day
  const sameDay = allItems.filter(
    (other) => other.id !== item.id && other.date === item.date
  )

  // Check for conflicts
  return sameDay.some((other) => {
    const otherTime = parseTime(other.time)
    const otherDuration = getDuration(other.type)
    return isOverlapping(itemTime, itemDuration, otherTime, otherDuration)
  })
}

// Helper function to parse time for sorting
const parseTimeForSorting = (timeStr: string) => {
  const [time, period] = timeStr.split(" ")
  let [hours, minutes] = time.split(":").map(Number)

  // Convert to 24-hour format for proper sorting
  if (period === "PM" && hours < 12) hours += 12
  if (period === "AM" && hours === 12) hours = 0

  return hours * 60 + minutes // Return minutes since midnight
}

// Helper function to calculate position and height based on start and end time
const getEventPosition = (
  startTime: string,
  endTime?: string,
  wrapsFromPreviousDay?: boolean
) => {
  const parseTimeToMinutes = (timeStr: string) => {
    const timeParts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/)
    if (!timeParts) return 0

    let hour = parseInt(timeParts[1])
    const minute = parseInt(timeParts[2])
    const period = timeParts[3]

    // Convert to 24-hour format
    if (period === "PM" && hour < 12) hour += 12
    if (period === "AM" && hour === 12) hour = 0

    return hour * 60 + minute // Return minutes since midnight
  }

  // For events that wrap from previous day, start from midnight
  const startMinutes = wrapsFromPreviousDay ? 0 : parseTimeToMinutes(startTime)

  // Calculate height based on duration (if we have an end time)
  let height = 65 // Default minimum height to fit content with icons

  if (endTime) {
    const endMinutes = parseTimeToMinutes(endTime)

    if (wrapsFromPreviousDay) {
      // Event started yesterday, show from midnight to end time
      height = Math.max((endMinutes / 60) * 60, height)
    } else if (endMinutes === 0 || endMinutes < startMinutes) {
      // Event ends after midnight (wraps to next day)
      // Extend to the end of the current day
      height = Math.max(((24 * 60 - startMinutes) / 60) * 60, height)
    } else {
      // Normal case - end time is after start time on the same day
      height = Math.max(((endMinutes - startMinutes) / 60) * 60, height)
    }
  }

  return { top: startMinutes, height }
}

// Helper function to parse event date and time strings
const parseEventDateTime = (
  dateStr: string,
  timeStr: string, // This will represent the END time when checking if passed
  startTimeStr?: string // The event's START time string
): Date | null => {
  // Parse END time (timeStr)
  const endTimeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!endTimeMatch) {
    console.warn(`parseEventDateTime failed to parse time: ${timeStr}`)
    return null
  }
  let endHours = parseInt(endTimeMatch[1], 10)
  const endMinutes = parseInt(endTimeMatch[2], 10)
  const endPeriod = endTimeMatch[3].toUpperCase()
  if (endPeriod === "PM" && endHours < 12) endHours += 12
  if (endPeriod === "AM" && endHours === 12) endHours = 0 // Midnight case

  // Parse START time (startTimeStr) if provided
  let startHours = -1 // Default indicates start time not parsed or not needed
  let startMinutes = -1
  if (startTimeStr) {
    const startTimeMatch = startTimeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
    if (startTimeMatch) {
      startHours = parseInt(startTimeMatch[1], 10)
      startMinutes = parseInt(startTimeMatch[2], 10)
      const startPeriod = startTimeMatch[3].toUpperCase()
      if (startPeriod === "PM" && startHours < 12) startHours += 12
      if (startPeriod === "AM" && startHours === 12) startHours = 0
    } else {
      console.warn(
        `parseEventDateTime failed to parse start time: ${startTimeStr}`
      )
      // Decide how to handle - maybe proceed without adjusting date? For now, let's log and continue.
      startHours = -1 // Reset to indicate failure/ignore
    }
  }

  // Parse DATE (dateStr)
  const dateMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (!dateMatch) {
    console.warn(`parseEventDateTime failed to parse date: ${dateStr}`)
    return null
  }
  const year = parseInt(dateMatch[1], 10)
  const month = parseInt(dateMatch[2], 10) - 1 // Month is 0-indexed
  let day = parseInt(dateMatch[3], 10) // Use let for potential modification

  // Check if end time is on the next day
  let dayOffset = 0
  if (startHours !== -1) {
    // Only adjust if start time was successfully parsed
    const endTotalMinutes = endHours * 60 + endMinutes
    const startTotalMinutes = startHours * 60 + startMinutes
    if (endTotalMinutes < startTotalMinutes) {
      dayOffset = 1 // End time is on the next day
    }
  }

  try {
    // Use Date.UTC. Note: Date.UTC handles month/day rollovers automatically.
    // -- Switched to local Date constructor --
    // This assumes the input date/time strings represent time in the user's *local* timezone.
    // If the DB times are strictly CST/CDT, this will only be accurate for users in CST/CDT.
    // const utcTimestamp = Date.UTC(
    //   year,
    //   month,
    //   day + dayOffset,
    //   endHours,
    //   endMinutes
    // )
    // return new Date(utcTimestamp)
    return new Date(year, month, day + dayOffset, endHours, endMinutes)
  } catch (e) {
    console.error("Error creating date:", e)
    return null
  }
}

// Create a new TimelineView component that shows events across rooms
const TimelineView = ({
  day,
  savedItems,
  onToggleSave,
  allScheduleItems,
  activeFilter,
  promoteIds,
  programDetails,
  events,
  formatTimeFunction,
  sharedEvents
}: {
  day: string
  savedItems: number[]
  onToggleSave: (id: number) => void
  allScheduleItems: DisplayScheduleItem[]
  activeFilter: string
  promoteIds?: number[]
  programDetails: ProgramType | null
  events: Event[]
  formatTimeFunction: (timeStr: string | null | undefined) => string
  sharedEvents: SharedEventsData
}) => {
  // Add refs to synchronize scrolling
  const roomHeadersScrollRef = React.useRef<ScrollView>(null)
  const roomColumnsScrollRef = React.useRef<ScrollView>(null)
  const isScrollingSyncRef = React.useRef(false) // Add flag to prevent scroll feedback loop
  const { theme, isDarkMode } = useTheme()

  // State for modal instead of expanded events
  const [selectedEvent, setSelectedEvent] =
    useState<DisplayScheduleItem | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [expandedEvents, setExpandedEvents] = useState<Record<number, boolean>>(
    {}
  )

  // State for event details modal
  const [eventDetailsModalVisible, setEventDetailsModalVisible] =
    useState(false)
  const [selectedPromotedEvent, setSelectedPromotedEvent] =
    useState<Event | null>(null)

  // State for collapsible featured events
  const [featuredEventsCollapsed, setFeaturedEventsCollapsed] = useState(false)

  const HEADER_HEIGHT = 37 // Define a constant for the header height

  // Helper function to format time display
  const formatTimeDisplay = (time: string | null) => {
    if (!time) return ""
    return formatTime(time)
  }

  // Define ListView styles function for consistent styling
  const styles = (theme: any) =>
    StyleSheet.create({
      promotedEventsSection: {
        marginBottom: 16
      },
      mainMeetingCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.colors.primary,
        borderRadius: theme.borderRadius.md,
        marginBottom: 12,
        padding: theme.spacing.md
      },
      mainMeetingContent: {
        marginLeft: 12,
        flex: 1
      },
      mainMeetingTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#ffffff"
      },
      mainMeetingTime: {
        fontSize: 14,
        color: "#ffffff",
        opacity: 0.9
      },
      categoryHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8
      },
      categoryTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: theme.colors.text.primary
      }
    })

  // Define local styles for the component with original table styles
  const timelineStyles = StyleSheet.create({
    timelineContainer: { marginBottom: 20 },
    dayCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      marginBottom: 16,
      overflow: "hidden"
    },
    dayHeader: {
      padding: 16,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border
    },
    dayTitle: {
      fontSize: 18,
      marginBottom: 8,
      color: theme.colors.text.primary,
      fontWeight: "bold"
    },
    categoryHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8
    },
    categoryTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.colors.text.primary
    },
    mainMeetingCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: theme.colors.primary,
      padding: 16,
      borderRadius: 8,
      marginBottom: 16,
      flexWrap: "wrap"
    },
    mainMeetingContent: { marginLeft: 12, flex: 1, minWidth: 200 },
    mainMeetingTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: "#ffffff",
      flexWrap: "wrap"
    },
    mainMeetingTime: {
      fontSize: 14,
      color: "#ffffff",
      opacity: 0.9,
      flexWrap: "wrap"
    },
    timelineWrapper: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      overflow: "hidden",
      height: 800,
      margin: 16,
      position: "relative" // Ensure relative positioning for absolute children
    },
    stickyHeaderRow: {
      flexDirection: "row",
      backgroundColor: theme.colors.surface,
      zIndex: 10,
      elevation: 5,
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      height: HEADER_HEIGHT, // Use the constant
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 2
        },
        android: {
          elevation: 4
        }
      })
    },
    timeColumnHeader: {
      width: 60,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
      borderRightWidth: 1,
      borderRightColor: theme.colors.border
    },
    timeColumnHeaderText: {
      fontSize: 12,
      fontWeight: "bold",
      color: isDarkMode ? "#fff" : theme.colors.text.primary
    },
    roomHeadersScroll: { flex: 1 },
    roomHeader: {
      width: 120,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
      borderLeftWidth: 1,
      borderLeftColor: theme.colors.border
    },
    roomName: {
      fontSize: 12,
      fontWeight: "bold",
      color: isDarkMode ? "#fff" : theme.colors.text.primary
    },
    timelineScrollView: {
      flex: 1,
      ...Platform.select({
        android: {
          nestedScrollEnabled: true
        }
      })
    },
    timelineContentWrapper: {
      flexDirection: "row",
      flex: 1,
      paddingTop: HEADER_HEIGHT // Use the constant
    },
    timeColumn: {
      width: 60,
      backgroundColor: theme.colors.surface
    },
    timeSlot: {
      height: 60,
      justifyContent: "center",
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border
    },
    timeText: {
      fontSize: 12,
      color: isDarkMode ? "#fff" : theme.colors.text.secondary
    },
    roomColumnsScroll: { flex: 1 },
    roomColumnsContainer: { flexDirection: "row" },
    roomColumn: {
      width: 120,
      borderLeftWidth: 1,
      borderLeftColor: theme.colors.border
    },
    eventsContainer: {
      position: "relative",
      minHeight: 24 * 60,
      overflow: "visible"
    },
    timelineEvent: {
      position: "absolute",
      left: 2,
      right: 2,
      borderRadius: 4,
      padding: 4,
      paddingRight: 20,
      overflow: "hidden",
      minHeight: 40
    },
    timelineEventExpanded: {
      zIndex: 10,
      minHeight: 60 // At least 1 hour height when expanded
    },
    timelineEventTitle: { fontSize: 12, fontWeight: "bold", marginBottom: 2 },
    // Add style for compact event title with ellipsis
    timelineEventTitleCompact: {
      fontSize: 12,
      fontWeight: "bold",
      flexShrink: 1,
      overflow: "hidden"
    },
    eventTime: {
      flexDirection: "column"
    },
    timelineEventTime: { fontSize: 10 },
    timelineSaveButton: { position: "absolute", top: 4, right: 4 },
    // Add style for compact event container
    compactEventContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      height: "100%"
    },
    expandedDetails: {
      marginTop: 4
    },
    expandedDescription: {
      fontSize: 10,
      marginTop: 2
    },
    expandedSpeakers: {
      fontSize: 10,
      fontStyle: "italic",
      marginTop: 2
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center"
    },
    modalContent: {
      width: "90%",
      maxWidth: 500,
      padding: 20,
      borderRadius: 10,
      maxHeight: "90%",
      overflow: "hidden"
    },
    modalScrollView: {
      width: "100%"
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      width: "100%",
      marginBottom: 15
    },
    modalTypeTag: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 5,
      marginRight: 10
    },
    modalTypeText: {
      fontSize: 14,
      fontWeight: "bold",
      color: "#FFFFFF"
    },
    modalCloseButton: {
      padding: 5
    },
    modalBody: {
      width: "100%",
      paddingBottom: 20
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "bold",
      marginBottom: 15,
      textAlign: "left",
      width: "100%"
    },
    modalTimeLocation: {
      width: "100%",
      marginBottom: 15
    },
    modalDetailText: {
      fontSize: 14
    },
    modalSection: {
      marginBottom: 15,
      width: "100%"
    },
    modalSectionTitle: {
      fontSize: 16,
      fontWeight: "bold",
      marginBottom: 5,
      textAlign: "left",
      width: "100%"
    },
    modalDescription: {
      fontSize: 14,
      lineHeight: 20,
      width: "100%"
    },
    modalSaveButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      paddingHorizontal: 15,
      borderRadius: 5,
      marginTop: 10,
      width: "100%"
    },
    modalSaveButtonText: {
      fontSize: 16,
      fontWeight: "bold",
      color: "#FFFFFF"
    }
  })

  // Helper function to handle synchronized horizontal scrolling
  const handleHorizontalScroll = (event: any, fromHeaders: boolean) => {
    // Prevent feedback loop
    if (isScrollingSyncRef.current) return

    const scrollX = event.nativeEvent.contentOffset.x
    isScrollingSyncRef.current = true

    if (fromHeaders && roomColumnsScrollRef.current) {
      roomColumnsScrollRef.current.scrollTo({ x: scrollX, animated: false })
    } else if (!fromHeaders && roomHeadersScrollRef.current) {
      roomHeadersScrollRef.current.scrollTo({ x: scrollX, animated: false })
    }

    // Reset the flag after a short delay to allow the scroll to complete
    setTimeout(() => {
      isScrollingSyncRef.current = false
    }, 10)
  }

  // Replace toggle event expansion with show modal
  const toggleEventExpanded = (eventId: number) => {
    // Find the event details from all schedule items, not just filtered day events
    const event = allScheduleItems.find((item) => item.id === eventId)
    if (event) {
      console.log("Selected event for modal:", event.title)
      setSelectedEvent(event)
      setModalVisible(true)
    } else {
      console.warn("Event not found:", eventId)
    }
  }

  // Use the passed formatTime function
  const formatTime = formatTimeFunction

  // Find promoted events based on promoteIds
  const promotedEvents = useMemo(() => {
    if (!promoteIds || !events || promoteIds.length === 0) return []

    // Filter for promoted events that match the current day
    return (
      events
        .filter((event) => {
          // First check if it's a promoted event
          if (!promoteIds.includes(event.id)) return false

          // Then check if it matches the current day
          const dateStr = event.date
          const [year, month, dayNum] = dateStr
            .split("-")
            .map((num) => parseInt(num, 10))
          // Treat dates as local CST dates without timezone conversion
          const dateObj = new Date(year, month - 1, dayNum)

          const itemDate = dateObj.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric"
          })

          // Only include if the date matches the current day
          return itemDate === day
        })
        // Sort promoted events by time
        .sort((a, b) => {
          // Format the start_time values first
          const timeA = formatTime(a.start_time)
          const timeB = formatTime(b.start_time)
          // Then sort using parseTimeForSorting
          return parseTimeForSorting(timeA) - parseTimeForSorting(timeB)
        })
    )
  }, [promoteIds, events, day])

  // Find events for this day and apply filters
  const dayEvents = allScheduleItems
    .filter((item) => {
      // The day parameter is a formatted date string (e.g. "Friday, August 25")
      // We need to extract the date from the item.date (e.g. "2023-08-25") and format it the same way
      const dateStr = item.date
      const [year, month, dayNum] = dateStr
        .split("-")
        .map((num) => parseInt(num, 10))
      // Treat dates as local CST dates without timezone conversion
      const dateObj = new Date(year, month - 1, dayNum)

      const itemDate = dateObj.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric"
      })

      // Check if date matches the current day string
      const matchesDay = itemDate === day

      // Also check if this is an event from the previous day that wraps into current day
      let wrapsFromPreviousDay = false
      if (!matchesDay) {
        // Get the previous day's date
        const currentDayParts = day.match(/(\w+), (\w+) (\d+)/)
        if (currentDayParts && events) {
          // Find the full event details to get end_time
          const fullEvent = events.find((e) => e.id === item.id)
          if (fullEvent && fullEvent.end_time) {
            // Parse the end time
            const endTimeParts = fullEvent.end_time?.match(
              /(\d+):(\d+)\s*(AM|PM)/
            )
            if (endTimeParts) {
              let endHour = parseInt(endTimeParts[1])
              const endMinute = parseInt(endTimeParts[2])
              const endPeriod = endTimeParts[3]

              // Check if end time is early morning (suggesting it wraps to next day)
              if (endPeriod === "AM" && endHour <= 6) {
                // This event likely wraps to the next day
                // Check if the next day is our current day
                const nextDateObj = new Date(dateObj)
                nextDateObj.setDate(nextDateObj.getDate() + 1)
                const nextItemDate = nextDateObj.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric"
                })
                wrapsFromPreviousDay = nextItemDate === day
              }
            }
          }
        }
      }

      // Apply type filter if not "all"
      const matchesFilter =
        activeFilter === "all" ||
        item.type.toLowerCase() === activeFilter.toLowerCase()

      // Include if event starts on this day OR wraps from previous day
      return (matchesDay || wrapsFromPreviousDay) && matchesFilter
    })
    .sort((a, b) => parseTimeForSorting(a.time) - parseTimeForSorting(b.time))

  // Get unique room names from events but handle Galway rooms separately
  const roomColumns = useMemo(() => {
    // Start with venue_rooms from programDetails if available
    const roomsArray: string[] = programDetails?.venue_rooms?.length
      ? [...programDetails.venue_rooms]
      : []

    // Track which rooms we've already added
    const roomsSet = new Set(roomsArray)

    // Now go through events and add any rooms not already in our list
    dayEvents.forEach((event) => {
      let roomKey = event.location

      // Special handling for Galway rooms to maintain previous logic
      if (event.location.includes("Galway")) {
        if (event.location.includes("Galway C")) {
          roomKey = "Galway C"
        } else {
          roomKey = "Galway A/B"
        }
      }

      // Only add if not already in the list
      if (!roomsSet.has(roomKey)) {
        roomsArray.push(roomKey)
        roomsSet.add(roomKey)
      }
    })

    return roomsArray
  }, [dayEvents, programDetails?.venue_rooms])

  // Group events by room with the correct Galway distinction
  const eventsByRoom = useMemo(() => {
    const byRoom: Record<string, DisplayScheduleItem[]> = {}

    // Initialize the room arrays - maintain the exact order from roomColumns
    roomColumns.forEach((room) => {
      byRoom[room] = []
    })

    // Distribute events to rooms
    dayEvents.forEach((event) => {
      let roomKey = event.location

      // Special handling for Galway rooms
      if (event.location.includes("Galway")) {
        if (event.location.includes("Galway C")) {
          roomKey = "Galway C"
        } else {
          roomKey = "Galway A/B"
        }
      }

      // Add to the appropriate room
      if (byRoom[roomKey]) {
        byRoom[roomKey].push(event)
      }
    })

    return byRoom
  }, [dayEvents, roomColumns]) // Add roomColumns as a dependency

  // Use program colors in timeline events
  const getProgramEventColor = (event: DisplayScheduleItem) => {
    // First try to use the event's categoryColor
    if (event.categoryColor) return event.categoryColor

    // If not available, try to get from program design
    return getProgramColorUtil(programDetails, "primary", theme)
  }

  // Extract just the day name from the formatted date
  const extractDayName = (fullDay: string) => {
    // Handle the error case where day might be an error message
    if (fullDay === "No events scheduled" || fullDay === "No Events") {
      return ""
    }

    // Extract the day name from the formatted date (e.g., "Friday, August 12" -> "Friday")
    const dayName = fullDay.split(",")[0]
    return dayName
  }

  return (
    <View style={timelineStyles.timelineContainer}>
      {/* Day header styled like list view */}
      <View style={timelineStyles.dayCard}>
        <View style={timelineStyles.dayHeader}>
          <Text style={timelineStyles.dayTitle}>{day}</Text>
        </View>
      </View>

      {/* Featured Activities section with collapsible header */}
      {promotedEvents.length > 0 && (
        <View style={{ padding: 16 }}>
          <View style={styles(theme).promotedEventsSection}>
            <TouchableOpacity
              style={[
                styles(theme).categoryHeader,
                { marginBottom: featuredEventsCollapsed ? 16 : 8 }
              ]}
              onPress={() =>
                setFeaturedEventsCollapsed(!featuredEventsCollapsed)
              }
            >
              <Text
                style={[
                  styles(theme).categoryTitle,
                  {
                    color: getProgramColorUtil(
                      programDetails,
                      "text.primary",
                      theme
                    )
                  }
                ]}
              >
                Featured Activities
              </Text>
              <Ionicons
                name={featuredEventsCollapsed ? "chevron-down" : "chevron-up"}
                size={24}
                color={getProgramColorUtil(
                  programDetails,
                  "text.primary",
                  theme
                )}
              />
            </TouchableOpacity>

            {!featuredEventsCollapsed && (
              <View>
                {promotedEvents.map((event) => {
                  const primaryColor = getProgramColorUtil(
                    programDetails,
                    "primary",
                    theme
                  )
                  const textColor = getTextColorForBgUtil(primaryColor)

                  return (
                    <View
                      key={`promoted-${event.id}`}
                      style={[
                        styles(theme).mainMeetingCard,
                        { backgroundColor: primaryColor }
                      ]}
                    >
                      {event.can_save !== false && (
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation()
                            onToggleSave(event.id)
                          }}
                          style={{ padding: 4 }}
                        >
                          <Ionicons
                            name={
                              savedItems.includes(event.id)
                                ? "star"
                                : "star-outline"
                            }
                            size={24}
                            color={textColor}
                          />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles(theme).mainMeetingContent}
                        onPress={() => {
                          setSelectedPromotedEvent(event)
                          setEventDetailsModalVisible(true)
                        }}
                      >
                        <Text
                          style={[
                            styles(theme).mainMeetingTitle,
                            { color: textColor }
                          ]}
                        >
                          {event.title}{" "}
                          {event.date && `(${extractDayName(day)})`}
                        </Text>
                        <Text
                          style={[
                            styles(theme).mainMeetingTime,
                            { color: textColor }
                          ]}
                        >
                          {formatTimeDisplay(event.start_time)} -{" "}
                          {formatTimeDisplay(event.end_time)} • {event.location}
                        </Text>

                        {/* Service Icons on promoted cards */}
                        {(event.asl ||
                          event.hybrid ||
                          (event.languages && event.languages.length > 0)) && (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              marginTop: 6,
                              gap: 8
                            }}
                          >
                            {event.asl && (
                              <FontAwesome6
                                name="hands-asl-interpreting"
                                size={14}
                                color={textColor}
                              />
                            )}
                            {event.hybrid && (
                              <Ionicons
                                name="videocam"
                                size={14}
                                color={textColor}
                              />
                            )}
                            {event.languages &&
                              event.languages.map((lang) => {
                                const langMap: { [key: string]: string } = {
                                  spanish: "ES",
                                  somali: "SOM",
                                  hmong: "HMN",
                                  french: "FR"
                                }
                                const abbrev =
                                  langMap[lang.toLowerCase()] ||
                                  lang.toUpperCase().slice(0, 3)
                                return (
                                  <Text
                                    key={lang}
                                    style={{
                                      fontSize: 9,
                                      fontWeight: "bold",
                                      color: textColor,
                                      backgroundColor: `${textColor}33`,
                                      paddingHorizontal: 4,
                                      paddingVertical: 2,
                                      borderRadius: 3,
                                      borderWidth: 1,
                                      borderColor: `${textColor}4D`
                                    }}
                                  >
                                    {abbrev}
                                  </Text>
                                )
                              })}
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        </View>
      )}

      {/* Timeline with sticky headers and columns */}
      <View style={timelineStyles.timelineWrapper}>
        {/* Sticky header row with room names - positioned absolutely */}
        <View style={timelineStyles.stickyHeaderRow}>
          {/* Empty cell for time column */}
          <View style={timelineStyles.timeColumnHeader}>
            <Text
              style={[
                timelineStyles.timeColumnHeaderText,
                { color: isDarkMode ? "#fff" : theme.colors.text.primary }
              ]}
            >
              Time
            </Text>
          </View>

          {/* Scrollable room headers */}
          <ScrollView
            ref={roomHeadersScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={timelineStyles.roomHeadersScroll}
            onScroll={(e) => handleHorizontalScroll(e, true)}
            scrollEventThrottle={1}
            bounces={false}
            decelerationRate="fast"
            overScrollMode="never"
          >
            {roomColumns.map((room) => (
              <View key={room} style={timelineStyles.roomHeader}>
                <Text
                  style={[
                    timelineStyles.roomName,
                    { color: isDarkMode ? "#fff" : theme.colors.text.primary }
                  ]}
                >
                  {room}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Main content area with sticky time column */}
        <ScrollView
          style={timelineStyles.timelineScrollView}
          showsVerticalScrollIndicator={true}
          bounces={false}
          nestedScrollEnabled={Platform.OS === "android"}
        >
          <View style={timelineStyles.timelineContentWrapper}>
            {/* Sticky time column - full 24 hours */}
            <View style={timelineStyles.timeColumn}>
              {Array.from({ length: 24 }, (_, i) => {
                const hour = i % 12 || 12
                const period = i < 12 ? "AM" : "PM"
                return (
                  <View key={i} style={timelineStyles.timeSlot}>
                    <Text
                      style={[
                        timelineStyles.timeText,
                        {
                          color: isDarkMode
                            ? "#fff"
                            : theme.colors.text.secondary
                        }
                      ]}
                    >{`${hour} ${period}`}</Text>
                  </View>
                )
              })}
            </View>

            {/* Scrollable content area */}
            <ScrollView
              ref={roomColumnsScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={timelineStyles.roomColumnsScroll}
              onScroll={(e) => handleHorizontalScroll(e, false)}
              scrollEventThrottle={1}
              bounces={false}
              decelerationRate="fast"
              overScrollMode="never"
            >
              <View style={timelineStyles.roomColumnsContainer}>
                {/* Room columns */}
                {roomColumns.map((room) => (
                  <View key={room} style={timelineStyles.roomColumn}>
                    {/* Event blocks */}
                    <View style={timelineStyles.eventsContainer}>
                      {eventsByRoom[room]?.map((event, index) => {
                        // Use end_time if available in the original event data
                        const fullEvent = events.find(
                          (e: Event) => e.id === event.id
                        )
                        const endTime = fullEvent?.end_time
                        const formattedEndTime = endTime
                          ? formatTime(endTime)
                          : undefined

                        // Check if this event wraps from the previous day
                        const wrapsFromPreviousDay = (() => {
                          // Parse the current day to check if event is from previous day
                          const dateStr = event.date
                          const [year, month, dayNum] = dateStr
                            .split("-")
                            .map((num) => parseInt(num, 10))
                          // Treat dates as local CST dates without timezone conversion
                          const dateObj = new Date(year, month - 1, dayNum)
                          const itemDate = dateObj.toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "long",
                            day: "numeric"
                          })

                          // If the event date doesn't match current day, it wraps from previous
                          return itemDate !== day
                        })()

                        const { top, height } = getEventPosition(
                          event.time,
                          formattedEndTime,
                          wrapsFromPreviousDay
                        )

                        // Determine event size based on duration
                        const isShortEvent = height < 60 // Less than 1 hour
                        const isLongEvent = height >= 120 // 2+ hours
                        // Use default height (no expansion for clicking)
                        const adjustedHeight = height

                        const eventColor = getProgramEventColor(event)
                        const textColor = getTextColorForBgUtil(eventColor)

                        // Check if the event has passed
                        const now = new Date()
                        const endTimeForCheck = formattedEndTime || event.time // Use end time if available, else start time
                        const eventEndDateTime = parseEventDateTime(
                          event.date,
                          endTimeForCheck, // This is the end time string
                          event.time // Pass the start time string
                        )
                        const hasPassed = eventEndDateTime
                          ? eventEndDateTime < now
                          : false

                        // Check if this event overlaps or is adjacent to a previous event in same room
                        const shouldShowTopBorder = (() => {
                          if (index === 0) return false // First event in room never needs border

                          const prevEvent = eventsByRoom[room][index - 1]
                          const prevEndTime = events.find(
                            (e: Event) => e.id === prevEvent.id
                          )?.end_time
                          const prevFormattedEndTime = prevEndTime
                            ? formatTime(prevEndTime)
                            : prevEvent.time
                          const { top: prevTop, height: prevHeight } =
                            getEventPosition(
                              prevEvent.time,
                              prevFormattedEndTime
                            )

                          const prevEventBottom = prevTop + prevHeight
                          const currentEventTop = top

                          // Check if events overlap or are adjacent (within 2 pixels for rounding tolerance)
                          return (
                            Math.abs(prevEventBottom - currentEventTop) <= 2
                          )
                        })()

                        return (
                          <TouchableOpacity
                            key={event.id}
                            style={[
                              timelineStyles.timelineEvent,
                              shouldShowTopBorder && {
                                borderTopWidth: 2,
                                borderTopColor: "rgba(0,0,0,0.2)",
                                shadowColor: "#000",
                                shadowOffset: {
                                  width: 0,
                                  height: -4
                                },
                                shadowOpacity: 0.5,
                                shadowRadius: 4,
                                elevation: 8
                              },
                              {
                                top,
                                height: adjustedHeight,
                                backgroundColor: eventColor,
                                minHeight: isShortEvent ? 50 : 65, // Increased for better content fit
                                opacity: hasPassed ? 0.5 : 1, // Grey out past events
                                overflow: "visible" // Allow content to be visible
                              }
                            ]}
                            onPress={() => toggleEventExpanded(event.id)}
                            disabled={hasPassed} // Optionally disable interaction
                          >
                            {isShortEvent ? (
                              // Compact view for short events
                              <View
                                style={timelineStyles.compactEventContainer}
                              >
                                <View style={{ flex: 1 }}>
                                  <Text
                                    style={[
                                      timelineStyles.timelineEventTitleCompact,
                                      { color: textColor }
                                    ]}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                  >
                                    {wrapsFromPreviousDay ? "(cont.) " : ""}
                                    {event.title}
                                  </Text>
                                  {wrapsFromPreviousDay && (
                                    <Text
                                      style={[
                                        {
                                          color: textColor,
                                          fontSize: 8,
                                          fontStyle: "italic"
                                        }
                                      ]}
                                    >
                                      Until {formattedEndTime || event.time}
                                    </Text>
                                  )}
                                </View>
                                {event.can_save !== false && (
                                  <Ionicons
                                    name={
                                      savedItems.includes(event.id)
                                        ? "star"
                                        : "star-outline"
                                    }
                                    size={16}
                                    color={textColor}
                                    onPress={(e) => {
                                      if (hasPassed) return // Prevent saving past events
                                      e.stopPropagation()
                                      onToggleSave(event.id)
                                    }}
                                  />
                                )}
                              </View>
                            ) : (
                              // Normal view
                              <>
                                <Text
                                  style={[
                                    isShortEvent
                                      ? timelineStyles.timelineEventTitleCompact
                                      : timelineStyles.timelineEventTitle,
                                    { color: textColor }
                                  ]}
                                  numberOfLines={
                                    isLongEvent
                                      ? undefined
                                      : isShortEvent
                                      ? 1
                                      : 2
                                  }
                                  ellipsizeMode={
                                    isLongEvent ? undefined : "tail"
                                  }
                                >
                                  {event.title}
                                </Text>
                                <View style={timelineStyles.eventTime}>
                                  {wrapsFromPreviousDay && (
                                    <Text
                                      style={[
                                        timelineStyles.timelineEventTime,
                                        {
                                          color: textColor,
                                          fontStyle: "italic",
                                          fontSize: 9
                                        }
                                      ]}
                                    >
                                      (Continued from previous day)
                                    </Text>
                                  )}
                                  <Text
                                    style={[
                                      timelineStyles.timelineEventTime,
                                      { color: textColor }
                                    ]}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                  >
                                    {wrapsFromPreviousDay
                                      ? `Until ${
                                          formattedEndTime || event.time
                                        }`
                                      : `${event.time}${
                                          formattedEndTime
                                            ? ` - ${formattedEndTime}`
                                            : ""
                                        }`}
                                  </Text>
                                </View>

                                {/* Service Icons - show for events 1+ hours */}
                                {!isShortEvent &&
                                  (() => {
                                    const eventDetails = events.find(
                                      (e) => e.id === event.id
                                    )
                                    if (
                                      !eventDetails?.asl &&
                                      !eventDetails?.hybrid &&
                                      (!eventDetails?.languages ||
                                        eventDetails.languages.length === 0)
                                    ) {
                                      return null
                                    }
                                    return (
                                      <View
                                        style={{
                                          flexDirection: "row",
                                          alignItems: "center",
                                          marginTop: 4,
                                          gap: 4,
                                          paddingHorizontal: 4
                                        }}
                                      >
                                        {eventDetails.asl && (
                                          <FontAwesome6
                                            name="hands-asl-interpreting"
                                            size={10}
                                            color={textColor}
                                          />
                                        )}
                                        {eventDetails.hybrid && (
                                          <Ionicons
                                            name="videocam"
                                            size={10}
                                            color={textColor}
                                          />
                                        )}
                                        {eventDetails.languages &&
                                          eventDetails.languages.map((lang) => {
                                            const langMap: {
                                              [key: string]: string
                                            } = {
                                              spanish: "ES",
                                              somali: "SOM",
                                              hmong: "HMN",
                                              french: "FR"
                                            }
                                            const abbrev =
                                              langMap[lang.toLowerCase()] ||
                                              lang.toUpperCase().slice(0, 3)
                                            return (
                                              <Text
                                                key={lang}
                                                style={{
                                                  fontSize: 7,
                                                  fontWeight: "bold",
                                                  color: textColor,
                                                  backgroundColor: `${textColor}20`,
                                                  paddingHorizontal: 2,
                                                  paddingVertical: 1,
                                                  borderRadius: 2
                                                }}
                                              >
                                                {abbrev}
                                              </Text>
                                            )
                                          })}
                                      </View>
                                    )
                                  })()}

                                {event.can_save !== false && (
                                  <TouchableOpacity
                                    style={timelineStyles.timelineSaveButton}
                                    onPress={(e) => {
                                      if (hasPassed) return // Prevent saving past events
                                      e.stopPropagation()
                                      onToggleSave(event.id)
                                    }}
                                    disabled={hasPassed}
                                  >
                                    <Ionicons
                                      name={
                                        savedItems.includes(event.id)
                                          ? "star"
                                          : "star-outline"
                                      }
                                      size={16}
                                      color={textColor}
                                    />
                                  </TouchableOpacity>
                                )}
                              </>
                            )}
                          </TouchableOpacity>
                        )
                      })}
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      </View>

      {/* Event Detail Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        {selectedEvent && (
          <View style={timelineStyles.modalOverlay}>
            <View
              style={[
                timelineStyles.modalContent,
                { backgroundColor: theme.colors.surface }
              ]}
            >
              <View style={timelineStyles.modalHeader}>
                <View
                  style={[
                    timelineStyles.modalTypeTag,
                    { backgroundColor: selectedEvent.categoryColor }
                  ]}
                >
                  <Text
                    style={[
                      timelineStyles.modalTypeText,
                      {
                        color: getTextColorForBgUtil(
                          selectedEvent.categoryColor
                        )
                      }
                    ]}
                  >
                    {selectedEvent.type}
                  </Text>
                </View>

                <TouchableOpacity
                  style={timelineStyles.modalCloseButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Ionicons
                    name="close"
                    size={24}
                    color={theme.colors.text.primary}
                  />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={timelineStyles.modalScrollView}
                showsVerticalScrollIndicator={true}
                bounces={false}
              >
                <View style={timelineStyles.modalBody}>
                  <Text
                    style={[
                      timelineStyles.modalTitle,
                      { color: theme.colors.text.primary }
                    ]}
                  >
                    {selectedEvent.title}
                  </Text>

                  <View style={timelineStyles.modalTimeLocation}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginBottom: 8
                      }}
                    >
                      <Ionicons
                        name="time-outline"
                        size={16}
                        color={theme.colors.text.secondary}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          timelineStyles.modalDetailText,
                          { color: theme.colors.text.secondary }
                        ]}
                      >
                        {selectedEvent.time}
                        {events.find((e) => e.id === selectedEvent.id)?.end_time
                          ? ` - ${formatTime(
                              events.find((e) => e.id === selectedEvent.id)
                                ?.end_time
                            )}`
                          : ""}
                      </Text>
                    </View>

                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <Ionicons
                        name="location-outline"
                        size={16}
                        color={theme.colors.text.secondary}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          timelineStyles.modalDetailText,
                          { color: theme.colors.text.secondary }
                        ]}
                      >
                        {selectedEvent.location}
                      </Text>
                    </View>
                  </View>

                  {selectedEvent.description && (
                    <View style={timelineStyles.modalSection}>
                      <Text
                        style={[
                          timelineStyles.modalSectionTitle,
                          { color: theme.colors.text.primary }
                        ]}
                      >
                        Description
                      </Text>
                      <Text
                        style={[
                          timelineStyles.modalDescription,
                          { color: theme.colors.text.secondary }
                        ]}
                      >
                        {selectedEvent.description}
                      </Text>
                    </View>
                  )}

                  {selectedEvent.speakers &&
                    selectedEvent.speakers.length > 0 && (
                      <View style={timelineStyles.modalSection}>
                        <Text
                          style={[
                            timelineStyles.modalSectionTitle,
                            { color: theme.colors.text.primary }
                          ]}
                        >
                          Speakers
                        </Text>
                        <Text
                          style={[
                            timelineStyles.modalDescription,
                            { color: theme.colors.text.secondary }
                          ]}
                        >
                          {selectedEvent.speakers.join(", ")}
                        </Text>
                      </View>
                    )}

                  {/* Add shared event users */}
                  <View style={timelineStyles.modalSection}>
                    <Text
                      style={[
                        timelineStyles.modalSectionTitle,
                        { color: theme.colors.text.primary }
                      ]}
                    >
                      Friends Attending
                    </Text>
                    <SharedEventUsers
                      eventId={selectedEvent.id}
                      sharedEvents={sharedEvents}
                      theme={theme}
                      key={`shared-users-${selectedEvent.id}-${
                        Object.keys(sharedEvents).length
                      }`}
                    />
                  </View>

                  {/* Save button at the bottom */}
                  {selectedEvent.can_save !== false && (
                    <TouchableOpacity
                      style={[
                        timelineStyles.modalSaveButton,
                        { backgroundColor: selectedEvent.categoryColor }
                      ]}
                      onPress={() => {
                        onToggleSave(selectedEvent.id)
                      }}
                    >
                      <Ionicons
                        name={
                          savedItems.includes(selectedEvent.id)
                            ? "star"
                            : "star-outline"
                        }
                        size={20}
                        color={getTextColorForBgUtil(
                          selectedEvent.categoryColor
                        )}
                        style={{ marginRight: 8 }}
                      />
                      <Text
                        style={[
                          timelineStyles.modalSaveButtonText,
                          {
                            color: getTextColorForBgUtil(
                              selectedEvent.categoryColor
                            )
                          }
                        ]}
                      >
                        {savedItems.includes(selectedEvent.id)
                          ? "Remove from My Schedule"
                          : "Add to My Schedule"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        )}
      </Modal>

      {/* Event Details Modal for promoted events */}
      <EventDetailsModal
        visible={eventDetailsModalVisible}
        event={selectedPromotedEvent}
        onClose={() => {
          setEventDetailsModalVisible(false)
          setSelectedPromotedEvent(null)
        }}
        onToggleSave={onToggleSave}
        isSaved={
          selectedPromotedEvent
            ? savedItems.includes(selectedPromotedEvent.id)
            : false
        }
        programColor={getProgramColorUtil(programDetails, "primary", theme)}
      />
    </View>
  )
}

// Define a type for the DayScheduleCard component props
type DayScheduleCardProps = {
  day: string
  items: DisplayScheduleItem[]
  savedItems: number[]
  onToggleSave: (id: number) => void
  activeFilter: string
  theme: any
  shadowStyles: any
  programDetails: ProgramType | null
  events: Event[]
  promoteIds?: number[]
  sharedEvents: SharedEventsData
}

// Create a DayScheduleCard component that uses the original styles
const DayScheduleCard = ({
  day,
  items,
  savedItems,
  onToggleSave,
  activeFilter,
  theme,
  shadowStyles,
  programDetails,
  events,
  promoteIds,
  sharedEvents
}: DayScheduleCardProps) => {
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>(
    {}
  )
  const [collapsedCategories, setCollapsedCategories] = useState<
    Record<string, boolean>
  >({})
  const { isDarkMode } = useTheme()

  // State for event details modal
  const [eventDetailsModalVisible, setEventDetailsModalVisible] =
    useState(false)
  const [selectedPromotedEvent, setSelectedPromotedEvent] =
    useState<Event | null>(null)

  // State for collapsible featured events
  const [featuredEventsCollapsed, setFeaturedEventsCollapsed] = useState(false)

  // Define styles function
  const styles = (theme: any) =>
    StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingTop: Platform.OS === "ios" ? 0 : theme.spacing.md
      },
      sectionTitle: {
        fontSize: 20,
        fontWeight: "bold",
        marginVertical: 16,
        color: theme.colors.text.primary
      },
      dayContainer: {
        backgroundColor: theme.colors.background,
        padding: 16,
        borderRadius: 8,
        marginBottom: 16,
        width: Dimensions.get("window").width - 48,
        marginHorizontal: 16,
        ...shadowStyles
      },
      dayTitle: {
        fontSize: 18,
        marginBottom: 8,
        color: theme.colors.text.primary,
        fontWeight: "bold"
      },
      scheduleItem: {
        marginBottom: 16,
        padding: 16,
        backgroundColor: theme.colors.surface,
        borderRadius: 8
      },
      scheduleItemHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 4
      },
      scheduleTime: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
      },
      itemTypeTag: {
        backgroundColor: theme.colors.primary,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4
      },
      itemTypeText: {
        color: theme.colors.background,
        fontSize: 12,
        textTransform: "uppercase"
      },
      saveButton: {
        padding: 4
      },
      itemTime: {
        fontSize: 16,
        fontWeight: "bold",
        color: theme.colors.text.primary
      },
      itemTitle: {
        fontSize: 16,
        marginVertical: 4,
        color: theme.colors.text.primary
      },
      itemLocation: {
        fontSize: 14,
        color: theme.colors.text.secondary
      },
      dayCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: 8,
        marginBottom: 16,
        overflow: "hidden"
      },
      dayHeader: {
        padding: 16,
        backgroundColor: theme.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border
      },
      dayContent: {
        backgroundColor: theme.colors.background,
        padding: 16
      },
      emptyDayText: {
        fontSize: 16,
        color: theme.colors.text.secondary,
        textAlign: "center",
        padding: 16
      },
      categorySection: {
        marginBottom: 24
      },
      categoryHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8
      },
      categoryTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: theme.colors.text.primary
      },
      expandedDetails: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border
      },
      itemDetailText: {
        fontSize: 14,
        color: theme.colors.text.secondary,
        lineHeight: 20
      },
      eventTimeSection: {
        flexDirection: "row",
        marginBottom: 8,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border
      },
      eventTimeLabel: {
        fontSize: 14,
        fontWeight: "bold",
        color: theme.colors.text.primary,
        marginRight: 4
      },
      eventTimeValue: {
        fontSize: 14,
        color: theme.colors.text.primary
      },
      promotedEventsSection: {
        marginBottom: 16
      },
      mainMeetingCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.colors.primary,
        borderRadius: 8,
        padding: 16,
        marginBottom: 16
      },
      mainMeetingContent: {
        marginLeft: 12,
        flex: 1
      },
      mainMeetingTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#ffffff"
      },
      mainMeetingTime: {
        fontSize: 14,
        color: "#ffffff",
        opacity: 0.9
      }
    })

  // Simple time formatter for expanded view
  const formatEventTime = (timeStr: string | null | undefined): string => {
    if (!timeStr) return ""
    try {
      // Handle various formats like H:MM, HH:MM, H:MMam/pm, HH:MMam/pm
      const cleanedTime = timeStr.toUpperCase().replace(/\s+/g, "") // Remove spaces
      const match = cleanedTime.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?(AM|PM)?/)
      if (!match) return timeStr // Return original if format doesn't match

      let hours = parseInt(match[1], 10)
      const minutes = parseInt(match[2], 10)
      let period = match[4] // AM/PM part

      if (isNaN(hours) || isNaN(minutes)) return timeStr

      if (period) {
        // Time includes AM/PM
        if (period === "PM" && hours !== 12) {
          hours += 12
        } else if (period === "AM" && hours === 12) {
          hours = 0 // Midnight case
        }
        // Hours are now effectively 24-hour format internally
      } else {
        // Assuming 24-hour format if no AM/PM provided
        if (hours < 0 || hours > 23) return timeStr // Invalid 24hr hour
      }

      // Format back to 12-hour AM/PM
      const finalHours12 = hours % 12 === 0 ? 12 : hours % 12
      const finalPeriod = hours >= 12 ? "PM" : "AM"
      const finalMinutesStr = minutes < 10 ? "0" + minutes : minutes

      return `${finalHours12}:${finalMinutesStr} ${finalPeriod}`
    } catch {
      return timeStr // Fallback on any error
    }
  }

  const toggleExpansion = (id: number) => {
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleCategoryCollapse = (category: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [category]: !prev[category] }))
  }

  // Filter based on the category title (item.type) or featured status
  const filteredItems = useMemo(() => {
    if (activeFilter === "all") {
      return items
    } else if (activeFilter === "featured") {
      // Filter for featured/promoted events
      return items.filter((item) => promoteIds?.includes(item.id))
    } else {
      // Filter by category type
      return items.filter(
        (item) => item.type.toLowerCase() === activeFilter.toLowerCase()
      )
    }
  }, [items, activeFilter, promoteIds])

  // Group filtered items by category
  const groupedByCategory = useMemo(() => {
    // If showing featured items, group them under "Featured Events"
    if (activeFilter === "featured") {
      return filteredItems.length > 0
        ? { "Featured Events": filteredItems }
        : {}
    }

    // Otherwise, group by category as normal
    const grouped = filteredItems.reduce((acc, item) => {
      const category = item.type
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(item)
      return acc
    }, {} as Record<string, DisplayScheduleItem[]>)

    // Sort categories in the specified order
    const orderedCategories: Record<string, DisplayScheduleItem[]> = {}

    // Priority categories in order (Featured first if it exists)
    const priorityOrder = [
      "Featured Events",
      "Main Meeting",
      "Speaker",
      "Panel",
      "Entertainment",
      "Marathon"
    ]

    // First add priority categories if they exist
    priorityOrder.forEach((category) => {
      if (grouped[category]) {
        orderedCategories[category] = grouped[category]
        delete grouped[category]
      }
    })

    // Then add all remaining categories
    Object.keys(grouped)
      .sort()
      .forEach((category) => {
        orderedCategories[category] = grouped[category]
      })

    return orderedCategories
  }, [filteredItems, activeFilter])

  // Sort each category's items by time
  Object.keys(groupedByCategory).forEach((category) => {
    groupedByCategory[category].sort(
      (a, b) => parseTimeForSorting(a.time) - parseTimeForSorting(b.time)
    )
  })

  // Get colors based on program design or theme
  const getItemColor = (item: DisplayScheduleItem) => {
    // First try to use the event's categoryColor
    if (item.categoryColor) return item.categoryColor

    // Otherwise use the program's primary color or fallback to theme
    return getProgramColorUtil(programDetails, "primary", theme)
  }

  // Format time for the promoted events display
  const formatTimeDisplay = (timeStr: string | null | undefined): string => {
    if (!timeStr) return ""
    try {
      // Handle various formats like H:MM, HH:MM, H:MMam/pm, HH:MMam/pm
      const cleanedTime = timeStr.toUpperCase().replace(/\s+/g, "") // Remove spaces
      const match = cleanedTime.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?(AM|PM)?/)
      if (!match) return timeStr // Return original if format doesn't match

      let hours = parseInt(match[1], 10)
      const minutes = parseInt(match[2], 10)
      let period = match[4] // AM/PM part

      if (isNaN(hours) || isNaN(minutes)) return timeStr

      if (period) {
        // Time includes AM/PM
        if (period === "PM" && hours !== 12) {
          hours += 12
        } else if (period === "AM" && hours === 12) {
          hours = 0 // Midnight case
        }
        // Hours are now effectively 24-hour format internally
      } else {
        // Assuming 24-hour format if no AM/PM provided
        if (hours < 0 || hours > 23) return timeStr // Invalid 24hr hour
      }

      // Format back to 12-hour AM/PM
      const finalHours12 = hours % 12 === 0 ? 12 : hours % 12
      const finalPeriod = hours >= 12 ? "PM" : "AM"
      const finalMinutesStr = minutes < 10 ? "0" + minutes : minutes

      return `${finalHours12}:${finalMinutesStr} ${finalPeriod}`
    } catch {
      return timeStr // Fallback on any error
    }
  }

  // Find promoted events based on promoteIds
  const promotedEvents = useMemo(() => {
    if (!promoteIds || !events || promoteIds.length === 0) return []

    // Filter for promoted events that match the current day
    return (
      events
        .filter((event) => {
          // First check if it's a promoted event
          if (!promoteIds.includes(event.id)) return false

          // Then check if it matches the current day
          const dateStr = event.date
          const [year, month, dayNum] = dateStr
            .split("-")
            .map((num) => parseInt(num, 10))
          // Treat dates as local CST dates without timezone conversion
          const dateObj = new Date(year, month - 1, dayNum)

          const itemDate = dateObj.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric"
          })

          // Only include if the date matches the current day
          return itemDate === day
        })
        // Sort promoted events by time
        .sort((a, b) => {
          // Format the start_time values first
          const timeA = formatTimeDisplay(a.start_time)
          const timeB = formatTimeDisplay(b.start_time)
          // Then sort using parseTimeForSorting
          return parseTimeForSorting(timeA) - parseTimeForSorting(timeB)
        })
    )
  }, [promoteIds, events, day])

  // Extract just the day name from the formatted date
  const extractDayName = (fullDay: string) => {
    // Handle the error case where day might be an error message
    if (fullDay === "No events scheduled" || fullDay === "No Events") {
      return ""
    }

    // Extract the day name from the formatted date (e.g., "Friday, August 12" -> "Friday")
    const dayName = fullDay.split(",")[0]
    return dayName
  }

  return (
    <View style={[styles(theme).dayCard, shadowStyles]}>
      <View style={styles(theme).dayHeader}>
        <Text style={styles(theme).dayTitle}>{day}</Text>
      </View>

      <View style={styles(theme).dayContent}>
        {/* Featured Activities section with collapsible header */}
        {promotedEvents.length > 0 && (
          <View style={styles(theme).promotedEventsSection}>
            <TouchableOpacity
              style={[
                styles(theme).categoryHeader,
                { marginBottom: featuredEventsCollapsed ? 16 : 8 }
              ]}
              onPress={() =>
                setFeaturedEventsCollapsed(!featuredEventsCollapsed)
              }
            >
              <Text
                style={[
                  styles(theme).categoryTitle,
                  {
                    color: getProgramColorUtil(
                      programDetails,
                      "text.primary",
                      theme
                    )
                  }
                ]}
              >
                Featured Activities
              </Text>
              <Ionicons
                name={featuredEventsCollapsed ? "chevron-down" : "chevron-up"}
                size={24}
                color={getProgramColorUtil(
                  programDetails,
                  "text.primary",
                  theme
                )}
              />
            </TouchableOpacity>

            {!featuredEventsCollapsed && (
              <View>
                {promotedEvents.map((event) => {
                  const promotedItem = items.find(
                    (item) => item.id === event.id
                  )
                  if (!promotedItem) return null

                  const primaryColor = getProgramColorUtil(
                    programDetails,
                    "primary",
                    theme
                  )
                  const textColor = getTextColorForBgUtil(primaryColor)

                  return (
                    <View
                      key={`promoted-${event.id}`}
                      style={[
                        styles(theme).mainMeetingCard,
                        { backgroundColor: primaryColor }
                      ]}
                    >
                      {event.can_save !== false && (
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation()
                            onToggleSave(event.id)
                          }}
                          style={{ padding: 4 }}
                        >
                          <Ionicons
                            name={
                              savedItems.includes(event.id)
                                ? "star"
                                : "star-outline"
                            }
                            size={24}
                            color={textColor}
                          />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles(theme).mainMeetingContent}
                        onPress={() => {
                          setSelectedPromotedEvent(event)
                          setEventDetailsModalVisible(true)
                        }}
                      >
                        <Text
                          style={[
                            styles(theme).mainMeetingTitle,
                            { color: textColor }
                          ]}
                        >
                          {event.title}{" "}
                          {event.date && `(${extractDayName(day)})`}
                        </Text>
                        <Text
                          style={[
                            styles(theme).mainMeetingTime,
                            { color: textColor }
                          ]}
                        >
                          {formatTimeDisplay(event.start_time)} -{" "}
                          {formatTimeDisplay(event.end_time)} • {event.location}
                        </Text>

                        {/* Service Icons on promoted cards */}
                        {(event.asl ||
                          event.hybrid ||
                          (event.languages && event.languages.length > 0)) && (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              marginTop: 6,
                              gap: 8
                            }}
                          >
                            {event.asl && (
                              <FontAwesome6
                                name="hands-asl-interpreting"
                                size={14}
                                color={textColor}
                              />
                            )}
                            {event.hybrid && (
                              <Ionicons
                                name="videocam"
                                size={14}
                                color={textColor}
                              />
                            )}
                            {event.languages &&
                              event.languages.map((lang) => {
                                const langMap: { [key: string]: string } = {
                                  spanish: "ES",
                                  somali: "SOM",
                                  hmong: "HMN",
                                  french: "FR"
                                }
                                const abbrev =
                                  langMap[lang.toLowerCase()] ||
                                  lang.toUpperCase().slice(0, 3)
                                return (
                                  <Text
                                    key={lang}
                                    style={{
                                      fontSize: 9,
                                      fontWeight: "bold",
                                      color: textColor,
                                      backgroundColor: `${textColor}20`,
                                      paddingHorizontal: 4,
                                      paddingVertical: 2,
                                      borderRadius: 3,
                                      borderWidth: 1,
                                      borderColor: `${textColor}30`
                                    }}
                                  >
                                    {abbrev}
                                  </Text>
                                )
                              })}
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        )}

        {Object.keys(groupedByCategory).length === 0 ? (
          <Text style={styles(theme).emptyDayText}>
            No events scheduled for this filter.
          </Text>
        ) : (
          Object.entries(groupedByCategory).map(([category, categoryItems]) => (
            <View key={category} style={styles(theme).categorySection}>
              <TouchableOpacity
                style={styles(theme).categoryHeader}
                onPress={() => toggleCategoryCollapse(category)}
              >
                <Text
                  style={[
                    styles(theme).categoryTitle,
                    {
                      color: getProgramColorUtil(
                        programDetails,
                        "text.primary",
                        theme
                      )
                    }
                  ]}
                >
                  {category}
                </Text>
                <Ionicons
                  name={
                    collapsedCategories[category]
                      ? "chevron-down"
                      : "chevron-up"
                  }
                  size={24}
                  color={getProgramColorUtil(
                    programDetails,
                    "text.primary",
                    theme
                  )}
                />
              </TouchableOpacity>

              {!collapsedCategories[category] &&
                categoryItems.map((item) => {
                  const isSaved = savedItems.includes(item.id)
                  const conflict = hasTimeConflict(item, items)
                  const itemColor = getItemColor(item)

                  // Find original event to get end time
                  const eventDetails = events.find((e) => e.id === item.id)
                  const endTime = eventDetails?.end_time
                  const canSave = eventDetails?.can_save !== false

                  // Check if event has passed
                  const now = new Date()
                  // Use end time if available and valid, otherwise use start time
                  const endTimeForCheck = endTime
                    ? formatEventTime(endTime)
                    : item.time
                  const eventEndDateTime = parseEventDateTime(
                    item.date,
                    endTimeForCheck, // This is the end time string
                    item.time // Pass the start time string
                  )
                  const hasPassed = eventEndDateTime
                    ? eventEndDateTime < now
                    : false
                  const itemOpacity = hasPassed ? 0.5 : 1 // Opacity for past events

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles(theme).scheduleItem,
                        {
                          borderLeftWidth: 4,
                          borderLeftColor: itemColor,
                          opacity: itemOpacity // Apply opacity here
                        }
                      ]}
                      onPress={() => !hasPassed && toggleExpansion(item.id)} // Disable press if passed
                      activeOpacity={hasPassed ? itemOpacity : 0.7} // Adjust active opacity too
                      disabled={hasPassed} // Disable touchable
                    >
                      <View style={styles(theme).scheduleItemHeader}>
                        <Text style={styles(theme).itemTime}>{item.time}</Text>
                        {canSave && (
                          <TouchableOpacity
                            onPress={(e) => {
                              if (hasPassed) return // Prevent saving past events
                              e.stopPropagation()
                              onToggleSave(item.id)
                            }}
                            style={styles(theme).saveButton}
                            disabled={hasPassed} // Disable button if passed
                          >
                            <Ionicons
                              name={
                                savedItems.includes(item.id)
                                  ? "star"
                                  : "star-outline"
                              }
                              size={24}
                              color={
                                savedItems.includes(item.id)
                                  ? itemColor // Use category color for star
                                  : getProgramColorUtil(
                                      programDetails,
                                      "text.secondary",
                                      theme
                                    )
                              }
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text style={styles(theme).itemTitle}>{item.title}</Text>
                      {item.speakers && item.speakers.length > 0 && (
                        <Text style={styles(theme).itemLocation}>
                          {item.speakers.join(", ")}
                        </Text>
                      )}
                      <Text style={styles(theme).itemLocation}>
                        {item.location}
                      </Text>

                      {/* Service Icons - Collapsed View */}
                      {!expandedItems[item.id] &&
                        (eventDetails?.asl ||
                          eventDetails?.hybrid ||
                          (eventDetails?.languages &&
                            eventDetails.languages.length > 0)) && (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              marginTop: 8,
                              gap: 10
                            }}
                          >
                            {eventDetails.asl && (
                              <FontAwesome6
                                name="hands-asl-interpreting"
                                size={16}
                                color={getProgramColorUtil(
                                  programDetails,
                                  "text.secondary",
                                  theme
                                )}
                              />
                            )}
                            {eventDetails.hybrid && (
                              <Ionicons
                                name="videocam"
                                size={16}
                                color={getProgramColorUtil(
                                  programDetails,
                                  "text.secondary",
                                  theme
                                )}
                              />
                            )}
                            {eventDetails.languages &&
                              eventDetails.languages.map((lang) => {
                                const langMap: { [key: string]: string } = {
                                  spanish: "ES",
                                  somali: "SOM",
                                  hmong: "HMN",
                                  french: "FR"
                                }
                                const abbrev =
                                  langMap[lang.toLowerCase()] ||
                                  lang.toUpperCase().slice(0, 3)
                                return (
                                  <Text
                                    key={lang}
                                    style={{
                                      fontSize: 10,
                                      fontWeight: "bold",
                                      color: getProgramColorUtil(
                                        programDetails,
                                        "text.secondary",
                                        theme
                                      ),
                                      backgroundColor: theme.colors.surface,
                                      paddingHorizontal: 4,
                                      paddingVertical: 2,
                                      borderRadius: 4,
                                      borderWidth: 1,
                                      borderColor: theme.colors.border
                                    }}
                                  >
                                    {abbrev}
                                  </Text>
                                )
                              })}
                          </View>
                        )}

                      {expandedItems[item.id] &&
                        !hasPassed && ( // Only show expanded if not passed
                          <View style={styles(theme).expandedDetails}>
                            {/* Add event time section */}
                            <View style={styles(theme).eventTimeSection}>
                              <Text style={styles(theme).eventTimeLabel}>
                                Event Time:
                              </Text>
                              <Text style={styles(theme).eventTimeValue}>
                                {item.time}
                                {endTime
                                  ? ` - ${formatEventTime(endTime)}`
                                  : ""}
                              </Text>
                            </View>

                            {item.description && (
                              <Text style={styles(theme).itemDetailText}>
                                {item.description}
                              </Text>
                            )}

                            {/* Accessibility Services in expanded view - Stacked */}
                            {(eventDetails?.asl ||
                              eventDetails?.hybrid ||
                              (eventDetails?.languages &&
                                eventDetails.languages.length > 0)) && (
                              <View style={{ marginTop: 12 }}>
                                {eventDetails.asl && (
                                  <View
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      marginBottom: 8
                                    }}
                                  >
                                    <FontAwesome6
                                      name="hands-asl-interpreting"
                                      size={16}
                                      color={getProgramColorUtil(
                                        programDetails,
                                        "text.secondary",
                                        theme
                                      )}
                                      style={{ marginRight: 10 }}
                                    />
                                    <Text
                                      style={{
                                        color: getProgramColorUtil(
                                          programDetails,
                                          "text.primary",
                                          theme
                                        ),
                                        fontSize: 14
                                      }}
                                    >
                                      ASL Interpretation
                                    </Text>
                                  </View>
                                )}
                                {eventDetails.hybrid && (
                                  <View
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      marginBottom: 8
                                    }}
                                  >
                                    <Ionicons
                                      name="videocam"
                                      size={16}
                                      color={getProgramColorUtil(
                                        programDetails,
                                        "text.secondary",
                                        theme
                                      )}
                                      style={{ marginRight: 10 }}
                                    />
                                    <Text
                                      style={{
                                        color: getProgramColorUtil(
                                          programDetails,
                                          "text.primary",
                                          theme
                                        ),
                                        fontSize: 14
                                      }}
                                    >
                                      Hybrid Meeting
                                    </Text>
                                  </View>
                                )}
                                {eventDetails.languages &&
                                  eventDetails.languages.map((lang) => {
                                    const langMap: { [key: string]: string } = {
                                      spanish: "ES",
                                      somali: "SOM",
                                      hmong: "HMN",
                                      french: "FR"
                                    }
                                    const langNames: { [key: string]: string } =
                                      {
                                        spanish: "Spanish",
                                        somali: "Somali",
                                        hmong: "Hmong",
                                        french: "French"
                                      }
                                    const abbrev =
                                      langMap[lang.toLowerCase()] ||
                                      lang.toUpperCase().slice(0, 3)
                                    const fullName =
                                      langNames[lang.toLowerCase()] || lang
                                    return (
                                      <View
                                        key={lang}
                                        style={{
                                          flexDirection: "row",
                                          alignItems: "center",
                                          marginBottom: 8
                                        }}
                                      >
                                        <Text
                                          style={{
                                            fontSize: 10,
                                            fontWeight: "bold",
                                            color: getProgramColorUtil(
                                              programDetails,
                                              "text.secondary",
                                              theme
                                            ),
                                            backgroundColor:
                                              theme.colors.surface,
                                            paddingHorizontal: 4,
                                            paddingVertical: 2,
                                            borderRadius: 4,
                                            borderWidth: 1,
                                            borderColor: theme.colors.border,
                                            marginRight: 10,
                                            minWidth: 32,
                                            textAlign: "center"
                                          }}
                                        >
                                          {abbrev}
                                        </Text>
                                        <Text
                                          style={{
                                            color: getProgramColorUtil(
                                              programDetails,
                                              "text.primary",
                                              theme
                                            ),
                                            fontSize: 14
                                          }}
                                        >
                                          {fullName} Translation
                                        </Text>
                                      </View>
                                    )
                                  })}
                              </View>
                            )}

                            {/* Show shared event users */}
                            <SharedEventUsers
                              eventId={item.id}
                              sharedEvents={sharedEvents}
                              theme={theme}
                              key={`shared-users-${item.id}-${
                                Object.keys(sharedEvents).length
                              }`}
                            />
                          </View>
                        )}
                    </TouchableOpacity>
                  )
                })}
            </View>
          ))
        )}
      </View>

      {/* Event Details Modal for promoted events */}
      <EventDetailsModal
        visible={eventDetailsModalVisible}
        event={selectedPromotedEvent}
        onClose={() => {
          setEventDetailsModalVisible(false)
          setSelectedPromotedEvent(null)
        }}
        onToggleSave={onToggleSave}
        isSaved={
          selectedPromotedEvent
            ? savedItems.includes(selectedPromotedEvent.id)
            : false
        }
        programColor={getProgramColorUtil(programDetails, "primary", theme)}
      />
    </View>
  )
}

export default function Program() {
  const { theme, isDarkMode } = useTheme()
  const { isFeatureEnabled } = useFeatures()
  const shadowStyles = getShadowStyles(isDarkMode)
  const navigation = useNavigation()

  // Program ID - hardcoded for now
  const programId = 3

  // State for tabs
  const [activeTab, setActiveTab] = useState(0)
  const [activeCategoryFilter, setActiveCategoryFilter] = useState("all")
  const [activeDay, setActiveDay] = useState(0)
  const [headerHeight, setHeaderHeight] = useState(1) // Use 0-1 value for animation

  // State for program data
  const [programDetails, setProgramDetails] = useState<ProgramType | null>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [savedItems, setSavedItems] = useState<number[]>([])
  const [sharedEvents, setSharedEvents] = useState<SharedEventsData>({})
  const [events, setEvents] = useState<Event[]>([])
  const [categories, setCategories] = useState<EventCategory[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // State for My Schedule collapsible past events
  const [isPastEventsCollapsed, setIsPastEventsCollapsed] = useState(true)

  // State for bid schedule visibility
  const [showBidSchedule, setShowBidSchedule] = useState(false)

  // Reference to scroll view to track scrolling
  const scrollViewRef = React.useRef<ScrollView>(null)
  // Reference to store the shared events polling interval
  const sharedEventsPollingInterval = useRef<NodeJS.Timeout | null>(null)
  // Store the last known shared events data to compare for changes
  const lastSharedEventsRef = useRef<string>("")

  // Use the unified device ID system from lib/security/deviceId
  // This ensures consistency with the withDeviceId function

  // Load bid schedule preference when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      AsyncStorage.getItem("showBidSchedule").then((value) => {
        if (value !== null) {
          setShowBidSchedule(value === "true")
        }
      })
    }, [])
  )

  // Load saved items from AsyncStorage on mount
  useEffect(() => {
    const loadSavedItems = async () => {
      try {
        // Use the unified device ID system
        const storedDeviceId = await getOrCreateDeviceId()

        if (!storedDeviceId) {
          console.error("Could not get or create device ID")
          setCheckingProfile(false) // Make sure we're not stuck in checking state
          return
        }

        setDeviceId(storedDeviceId)
        console.log("Initial mount - using device ID:", storedDeviceId)

        // Load shared events from AsyncStorage
        const sharedEventsJson = await AsyncStorage.getItem("sharedEvents")
        if (sharedEventsJson) {
          try {
            const parsedSharedEvents: SharedEventsData =
              JSON.parse(sharedEventsJson)
            console.log("Loaded shared events:", parsedSharedEvents)
            setSharedEvents(parsedSharedEvents)
            // Initialize the last known shared events for comparison
            lastSharedEventsRef.current = sharedEventsJson
          } catch (error) {
            console.error("Error parsing shared events:", error)
          }
        }

        // Load saved schedule from AsyncStorage (done in the checkUserProfile function now)
      } catch (error) {
        console.error("Error loading saved items:", error)
      }
    }

    loadSavedItems()
  }, [])

  // Function to check for shared events updates
  const checkForSharedEventsUpdates = async () => {
    try {
      const sharedEventsJson = await AsyncStorage.getItem("sharedEvents")

      // If there's no data or it's the same as before, do nothing
      if (
        !sharedEventsJson ||
        sharedEventsJson === lastSharedEventsRef.current
      ) {
        return
      }

      // Data has changed, update the state
      console.log("Shared events updated, refreshing UI")
      const parsedSharedEvents: SharedEventsData = JSON.parse(sharedEventsJson)
      setSharedEvents(parsedSharedEvents)

      // Update the last known value
      lastSharedEventsRef.current = sharedEventsJson
    } catch (error) {
      console.error("Error checking for shared events updates:", error)
    }
  }

  // Set up polling for shared events updates
  useEffect(() => {
    // Start polling when component mounts
    if (sharedEventsPollingInterval.current === null) {
      sharedEventsPollingInterval.current = setInterval(() => {
        // console.log("Polling for shared events updates")
        checkForSharedEventsUpdates()
      }, 3000) // Check every 3 seconds
    }

    // Setup AppState listener to handle app going to background/foreground
    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextAppState) => {
        const currentState = AppState.currentState
        if (
          currentState.match(/inactive|background/) &&
          nextAppState === "active"
        ) {
          console.log("App has come to the foreground, checking shared events")
          checkForSharedEventsUpdates()
        }
      }
    )

    // Cleanup function
    return () => {
      if (sharedEventsPollingInterval.current) {
        clearInterval(sharedEventsPollingInterval.current)
        sharedEventsPollingInterval.current = null
      }
      appStateSubscription.remove()
    }
  }, [])

  // Add state to track if user has a profile
  const [hasProfile, setHasProfile] = useState(false)
  const [userId, setUserId] = useState<number | null>(null)
  const [checkingProfile, setCheckingProfile] = useState(true)

  // Check if user has a profile in Supabase
  useEffect(() => {
    const checkUserProfile = async () => {
      if (!deviceId) {
        console.log("No device ID available for profile check")
        return
      }
      console.log("Checking user profile for device ID:", deviceId)

      setCheckingProfile(true)
      try {
        const supabaseWithDeviceId = await withDeviceId()
        const { data, error } = await supabaseWithDeviceId
          .from("users")
          .select("id, first_name, last_initial, schedule")
          .eq("device_id", deviceId)
          .single()

        if (error && error.code !== "PGRST116") {
          console.error("Error checking user profile:", error)
        }

        if (data) {
          // User profile exists
          console.log("User profile found:", data.first_name)
          setHasProfile(true)
          setUserId(data.id)

          // Set saved items from profile data if it exists
          if (data.schedule && data.schedule.saved_events) {
            setSavedItems(data.schedule.saved_events)
          } else {
            // Load from AsyncStorage as fallback
            const savedScheduleJson = await AsyncStorage.getItem(
              "user_schedule"
            )
            if (savedScheduleJson) {
              const savedSchedule: Schedule = JSON.parse(savedScheduleJson)
              setSavedItems(savedSchedule.saved_events || [])
            }
          }
        } else {
          // No profile
          console.log("No user profile found for device ID:", deviceId)
          setHasProfile(false)
          setUserId(null)
          // Don't clear saved items here - let them load from AsyncStorage
          // Load from AsyncStorage even without profile
          const savedScheduleJson = await AsyncStorage.getItem("user_schedule")
          if (savedScheduleJson) {
            const savedSchedule: Schedule = JSON.parse(savedScheduleJson)
            setSavedItems(savedSchedule.saved_events || [])
          }
        }
      } catch (error) {
        console.error("Error checking user profile:", error)
      } finally {
        setCheckingProfile(false)
      }
    }

    if (deviceId) {
      checkUserProfile()
    } else {
      setCheckingProfile(false)
    }
  }, [deviceId])

  // Effect to recheck profile on focus (coming back from profile creation)
  useEffect(() => {
    // Function to check user profile
    const checkUserProfileOnFocus = async () => {
      // Always get device ID first to ensure we have it
      let currentDeviceId = deviceId
      if (!currentDeviceId) {
        // Use the unified device ID system
        currentDeviceId = await getOrCreateDeviceId()
        if (currentDeviceId) {
          setDeviceId(currentDeviceId)
        }
      }

      if (!currentDeviceId) {
        console.log("Still no device ID available on focus")
        return
      }

      console.log(
        "Screen focused, rechecking user profile with device ID:",
        currentDeviceId
      )

      try {
        const supabaseWithDeviceId = await withDeviceId()
        const { data, error } = await supabaseWithDeviceId
          .from("users")
          .select("id, first_name, last_initial, schedule")
          .eq("device_id", currentDeviceId)
          .single()

        if (error && error.code !== "PGRST116") {
          console.error("Error checking user profile on focus:", error)
          return
        }

        if (data) {
          // User profile exists now
          console.log("Profile found on focus check:", data.first_name)
          setHasProfile(true)
          setUserId(data.id)

          // Set saved items from profile
          if (data.schedule && data.schedule.saved_events) {
            setSavedItems(data.schedule.saved_events)
          }

          // Also check for updated shared events
          await checkForSharedEventsUpdates()
        } else {
          console.log(
            "No profile found on focus check for device ID:",
            currentDeviceId
          )
          setHasProfile(false)
          setUserId(null)
        }
      } catch (error) {
        console.error("Error checking user profile on focus:", error)
      }
    }

    // Register for focus events
    const unsubscribe = navigation.addListener("focus", checkUserProfileOnFocus)

    return unsubscribe
  }, [deviceId, navigation])

  // Fetch data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const supabaseWithDeviceId = await withDeviceId()
        const [programRes, eventsRes, categoriesRes, activitiesRes] =
          await Promise.all([
            supabaseWithDeviceId
              .from("programs")
              .select("*")
              .eq("id", programId)
              .maybeSingle(),
            // Fetch events and their category details
            supabaseWithDeviceId
              .from("events")
              .select("*, event_categories(title, color)")
              .eq("program_id", programId),
            supabaseWithDeviceId
              .from("event_categories")
              .select("*")
              .eq("program_id", programId), // Keep fetching categories separately if needed elsewhere
            supabaseWithDeviceId
              .from("activities")
              .select("*")
              .eq("program_id", programId)
          ])

        // Error handling
        if (programRes.error) throw programRes.error
        if (eventsRes.error) throw eventsRes.error
        if (categoriesRes.error) throw categoriesRes.error
        if (activitiesRes.error) throw activitiesRes.error

        // Set state
        setProgramDetails(programRes.data)
        // Type assertion needed because Supabase join returns nested object or array
        setEvents((eventsRes.data as Event[]) || [])
        setCategories(categoriesRes.data || [])
        setActivities(activitiesRes.data || [])
      } catch (err: any) {
        console.error("Error fetching data:", err)
        setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // --- Helper Function ---
  // Simple time formatter (e.g., "HH:MM:SS" -> "H:MM AM/PM")
  const formatTime = (timeStr: string | null | undefined): string => {
    if (!timeStr) return ""
    try {
      // Handle various formats like H:MM, HH:MM, H:MMam/pm, HH:MMam/pm
      const cleanedTime = timeStr.toUpperCase().replace(/\s+/g, "") // Remove spaces
      const match = cleanedTime.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?(AM|PM)?/)
      if (!match) return timeStr // Return original if format doesn't match

      let hours = parseInt(match[1], 10)
      const minutes = parseInt(match[2], 10)
      let period = match[4] // AM/PM part

      if (isNaN(hours) || isNaN(minutes)) return timeStr

      if (period) {
        // Time includes AM/PM
        if (period === "PM" && hours !== 12) {
          hours += 12
        } else if (period === "AM" && hours === 12) {
          hours = 0 // Midnight case
        }
        // Hours are now effectively 24-hour format internally
      } else {
        // Assuming 24-hour format if no AM/PM provided
        if (hours < 0 || hours > 23) return timeStr // Invalid 24hr hour
      }

      // Format back to 12-hour AM/PM
      const finalHours12 = hours % 12 === 0 ? 12 : hours % 12
      const finalPeriod = hours >= 12 ? "PM" : "AM"
      const finalMinutesStr = minutes < 10 ? "0" + minutes : minutes

      return `${finalHours12}:${finalMinutesStr} ${finalPeriod}`
    } catch {
      return timeStr // Fallback on any error
    }
  }

  // --- MAP DATA TO ORIGINAL MOCK STRUCTURE ---
  const mappedProgramData: MappedProgramData | null = useMemo(() => {
    if (!programDetails || !events || !categories) return null

    const mapped: MappedProgramData = {
      programDetails: programDetails,
      events: [],
      hospitality: programDetails.hospitality,
      activities: activities
    }

    // Create a lookup map for category colors
    const categoryColorMap = new Map()
    categories.forEach((cat) => {
      categoryColorMap.set(cat.id, cat.color)
      // Also map by lowercase title for easier lookups
      categoryColorMap.set(cat.title.toLowerCase(), cat.color)
    })

    // Default colors for specific categories if not provided
    const defaultCategoryColors: Record<string, string> = {
      archives: theme.colors.info,
      workshop: theme.colors.warning,
      workshops: theme.colors.warning,
      panel: theme.colors.secondary,
      speaker: theme.colors.primary,
      entertainment: "#fad48a",
      marathon: theme.colors.success
    }

    events.forEach((event) => {
      // Use category title fetched via join if available, otherwise lookup
      const category = event.event_categories
      const categoryName =
        category?.title ||
        categoryColorMap.get(event.event_category_id)?.toUpperCase() ||
        "Event" // Default to Event

      // Try to get color from different sources, with fallbacks
      let categoryColor = category?.color

      // If no color from join, try the category ID lookup
      if (!categoryColor) {
        categoryColor = categoryColorMap.get(event.event_category_id)
      }

      // If still no color, try lookup by category name (case insensitive)
      if (!categoryColor) {
        categoryColor = categoryColorMap.get(categoryName.toLowerCase())
      }

      // If still no color, try default category colors
      if (!categoryColor) {
        categoryColor =
          defaultCategoryColors[categoryName.toLowerCase()] ||
          theme.colors.primary
      }

      const formattedTime = formatTime(event.start_time)

      const baseItem = {
        id: event.id,
        title: event.title,
        description: event.description,
        speakers: event.speakers,
        time: formattedTime,
        date: event.date,
        location: event.location,
        type: categoryName,
        categoryColor: categoryColor,
        can_save: event.can_save
      }

      mapped.events.push(baseItem)
    })

    return mapped
  }, [programDetails, events, categories, activities, theme])

  // --- Event Handling ---
  const handleToggleSave = async (id: number) => {
    try {
      // Check if user has a profile first
      if (!hasProfile) {
        // If no profile, redirect to the profile page
        Alert.alert(
          "Profile Required",
          "You need to create a profile before saving events to your schedule.",
          [
            {
              text: "Create Profile",
              onPress: goToProfilePage
            }
          ]
        )
        return
      }

      // Update local state first for immediate UI response
      const newSavedItems = savedItems.includes(id)
        ? savedItems.filter((itemId) => itemId !== id)
        : [...savedItems, id]

      setSavedItems(newSavedItems)

      // Get existing schedule from AsyncStorage or create new
      const savedScheduleJson = await AsyncStorage.getItem("user_schedule")
      let schedule: Schedule

      if (savedScheduleJson) {
        try {
          // Parse the existing schedule and only update the saved_events property
          const parsedSchedule = JSON.parse(savedScheduleJson)
          schedule = {
            ...parsedSchedule, // Keep all existing properties
            saved_events: newSavedItems // Only update saved_events
          }
        } catch (e) {
          // Handle parse error with defaults
          schedule = {
            saved_events: newSavedItems,
            banned: [],
            shared_by: [],
            shared_with: [],
            pending_share: [],
            requested_share: []
          }
        }
      } else {
        // Create fresh schedule object
        schedule = {
          saved_events: newSavedItems,
          banned: [],
          shared_by: [],
          shared_with: [],
          pending_share: [],
          requested_share: []
        }
      }

      // Save to AsyncStorage
      await AsyncStorage.setItem("user_schedule", JSON.stringify(schedule))

      // Skip Supabase update if no device ID
      if (!deviceId) return

      // Get push token and auth session
      const pushToken = await registerForPushNotificationsAsync()
      const { data: sessionData } = await supabase.auth.getSession()
      const authUserId = sessionData?.session?.user?.id

      // Update existing user record in Supabase - only update the saved_events field
      const supabaseWithDeviceId = await withDeviceId()

      // First get the current user data to ensure we have the complete schedule
      const { data: userData, error: fetchError } = await supabaseWithDeviceId
        .from("users")
        .select("schedule")
        .eq("device_id", deviceId)
        .maybeSingle()

      if (fetchError) {
        console.error("Error fetching user data:", fetchError)
        return
      }

      // Create an updated schedule object that preserves all existing properties
      const updatedSchedule = userData?.schedule
        ? {
            ...userData.schedule,
            saved_events: newSavedItems
          }
        : schedule

      // Update only the schedule in the database
      const { error } = await supabaseWithDeviceId
        .from("users")
        .update({
          schedule: updatedSchedule,
          expo_push_token: pushToken // Keep push token updated
        })
        .eq("device_id", deviceId)

      if (error) {
        console.error("Error saving schedule to Supabase:", error)
      }
    } catch (error) {
      console.error("Error saving schedule:", error)
    }
  }

  // --- USE MAPPED DATA FOR UI LOGIC ---

  // Create a combined array of all schedule items
  const allScheduleItems: DisplayScheduleItem[] = useMemo(() => {
    if (!mappedProgramData) return [] // Return empty if data not loaded/mapped
    return mappedProgramData.events // Directly use the mapped events
  }, [mappedProgramData])

  // Group items by date for the schedule view
  const scheduleData = useMemo(
    () =>
      allScheduleItems.reduce((acc, item) => {
        // Fix date parsing to prevent timezone issues
        // Use YYYY-MM-DD format and force UTC to avoid timezone shifts
        const dateStr = item.date
        const [year, month, day] = dateStr
          .split("-")
          .map((num) => parseInt(num, 10))
        // Treat dates as local CST dates without timezone conversion
        const dateObj = new Date(year, month - 1, day)

        const formattedDate = dateObj.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric"
          // No timeZone specified - display as local date
        })

        if (!acc[formattedDate]) {
          acc[formattedDate] = []
        }

        acc[formattedDate].push(item)
        // Sort within the day by time
        acc[formattedDate].sort(
          (a, b) => parseTimeForSorting(a.time) - parseTimeForSorting(b.time)
        )
        return acc
      }, {} as Record<string, DisplayScheduleItem[]>),
    [allScheduleItems]
  )

  // Convert to array for rendering, matching original structure
  const scheduleDays = Object.entries(scheduleData)
    .map(([date, items]) => ({
      day: date,
      items,
      // Add sortable date for proper ordering
      sortDate: new Date(items[0]?.date || "1970-01-01")
    }))
    .sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime())
    .map(({ day, items }) => ({ day, items }))

  // Ensure activeDay is within bounds
  useEffect(() => {
    if (scheduleDays.length > 0 && activeDay >= scheduleDays.length) {
      setActiveDay(0)
    }
  }, [scheduleDays, activeDay])

  // Get current day data based on activeDay index
  const getCurrentDay = () => {
    if (scheduleDays.length === 0) {
      return "No events scheduled"
    }
    if (activeDay >= scheduleDays.length) {
      // Fallback to first day if index is out of bounds after load
      return scheduleDays[0]?.day || "No Events"
    }
    return scheduleDays[activeDay].day
  }

  // Get current day items or empty array
  const getCurrentDayItems = () => {
    if (scheduleDays.length === 0 || activeDay >= scheduleDays.length) {
      return []
    }
    return scheduleDays[activeDay].items
  }

  // Get saved items for My Schedule view - filtered by current day
  const getCurrentDaySavedItems = () => {
    if (scheduleDays.length === 0) {
      return []
    }
    const currentDayFormatted = getCurrentDay()
    return allScheduleItems
      .filter((item) => {
        // Use the same UTC date parsing to avoid timezone issues
        const dateStr = item.date
        const [year, month, day] = dateStr
          .split("-")
          .map((num) => parseInt(num, 10))
        // Treat dates as local CST dates without timezone conversion
        const dateObj = new Date(year, month - 1, day)

        const itemDate = dateObj.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric"
          // No timeZone specified - display as local date
        })

        return savedItems.includes(item.id) && itemDate === currentDayFormatted
      })
      .sort((a, b) => parseTimeForSorting(a.time) - parseTimeForSorting(b.time))
  }

  // Get current day saved items
  const currentDay = getCurrentDay()
  const currentDayItems = getCurrentDayItems()
  const currentDaySavedItems = getCurrentDaySavedItems()

  // Get friends attending an event
  const getFriendsAttending = (eventId: number) => {
    return mockFriends.filter((friend) => friend.savedEvents.includes(eventId))
  }

  // Add state for expanded items in My Schedule view
  const [myScheduleExpandedItems, setMyScheduleExpandedItems] = useState<
    Record<number, boolean>
  >({})

  // Toggle expanded state function
  const toggleMyScheduleExpansion = (id: number) => {
    setMyScheduleExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Navigate to profile page
  const goToProfilePage = () => {
    router.replace("/(tabs)/profile" as any)
  }

  // Generate QR code data - now with user ID for schedule sharing
  const qrData = userId
    ? `yaap://profile?schedule_share=${userId}`
    : JSON.stringify({ type: "schedule_share", userId: null })

  // Generate dynamic filter options from categories
  const filterOptions = useMemo(() => {
    const defaultOption = { id: "all", label: "All Events" }
    const featuredOption = { id: "featured", label: "Featured" }

    if (!categories || categories.length === 0) {
      return [defaultOption, featuredOption]
    }

    // Create filter options from actual categories
    const categoryOptions = categories.map((cat) => ({
      id: cat.title.toLowerCase(),
      label: cat.title
    }))

    return [defaultOption, featuredOption, ...categoryOptions]
  }, [categories])

  // Add onScroll handler for collapsible header
  const handleScroll = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y
    const scrollViewHeight = event.nativeEvent.layoutMeasurement.height

    // Calculate how far we've scrolled as a percentage of 25% of the scroll view height
    const scrollPercentage = Math.min(1, scrollY / (scrollViewHeight * 0.25))

    // Inverse the percentage to get the header height (1 = full height, 0 = no height)
    const newHeaderHeight = Math.max(0, 1 - scrollPercentage)

    setHeaderHeight(newHeaderHeight)
  }

  // Define programStyles with all required properties to fix tab styling
  const programStyles = (theme: any) =>
    StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingTop: 0
      },
      contentContainer: {
        flex: 1
      },
      sectionTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: theme.colors.text.primary, // Use text.primary
        marginTop: 20,
        marginBottom: 10,
        marginHorizontal: 16
      },
      // Timeline specific styles
      timelineWrapper: {
        flex: 1,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.md, // Use theme border radius
        overflow: "hidden",
        height: 600
      },
      headerArea: {
        position: "absolute",
        width: "100%",
        backgroundColor: theme.colors.background,
        zIndex: 999
      },
      filterContainer: {
        paddingHorizontal: 16,
        paddingBottom: 8,
        flexDirection: "row",
        flexWrap: "wrap"
      },
      filterButton: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        marginRight: 8,
        marginBottom: 8,
        backgroundColor: theme.colors.background,
        borderWidth: 1,
        borderColor: theme.colors.border
      },
      activeFilterButton: {
        backgroundColor: theme.colors.primary
      },
      filterButtonText: {
        color: theme.colors.text.primary,
        fontSize: 14
      },
      activeFilterButtonText: {
        color: "#ffffff"
      },
      hospitalityBar: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: "#f0f8ff",
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 8,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between"
      },
      hospitalityTime: {
        color: theme.colors.primary,
        fontSize: 14,
        fontWeight: "500"
      },
      // Day tab styles
      dayTabs: {
        flexDirection: "row",
        justifyContent: "center", // Center the day tabs
        backgroundColor: theme.colors.surface,
        paddingVertical: theme.spacing.sm,
        marginBottom: theme.spacing.sm
      },
      dayTab: {
        flex: 1,
        alignItems: "center",
        paddingVertical: 12
      },
      activeDayTab: {
        borderBottomWidth: 2,
        borderBottomColor: theme.colors.primary
      },
      dayTabText: {
        fontSize: theme.typography.body.fontSize, // Use theme typography
        color: theme.colors.text.secondary
      },
      activeDayTabText: {
        color: theme.colors.primary,
        fontWeight: "bold"
      },
      viewSelector: {
        flexDirection: "row",
        justifyContent: "center", // Center the view selector
        marginBottom: theme.spacing.sm
      },
      viewButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.md,
        marginHorizontal: theme.spacing.xs
      },
      activeViewButton: {
        backgroundColor: theme.colors.background,
        borderWidth: 1,
        borderColor: theme.colors.primary
      },
      viewButtonText: {
        fontSize: theme.typography.caption.fontSize, // Use theme typography
        color: theme.colors.text.secondary,
        marginLeft: 4
      },
      activeViewButtonText: {
        color: theme.colors.primary,
        fontWeight: "bold"
      },
      // Program header styles
      programHeader: {
        backgroundColor: theme.colors.primary,
        padding: 16,
        alignItems: "center",
        justifyContent: "center"
      },
      programTitle: {
        fontSize: 22,
        fontWeight: "bold",
        color: "#ffffff",
        textAlign: "center"
      },
      programTheme: {
        fontSize: 16,
        color: "#ffffff",
        textAlign: "center",
        fontStyle: "italic",
        marginTop: 4
      },
      // Filter chip styles
      filterChipsContainer: {
        paddingHorizontal: 16,
        paddingBottom: 8,
        flexDirection: "row",
        flexWrap: "wrap"
      },
      filterChips: {
        flexDirection: "row",
        flexWrap: "wrap"
      },
      filterChip: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        marginRight: 8,
        marginBottom: 8,
        backgroundColor: theme.colors.background,
        borderWidth: 1,
        borderColor: theme.colors.border
      },
      activeFilterChip: {
        backgroundColor: theme.colors.primary
      },
      filterChipText: {
        color: theme.colors.text.primary,
        fontSize: 14
      },
      activeFilterChipText: {
        color: "#ffffff"
      },
      // My schedule styles
      myScheduleContainer: {
        flex: 1,
        padding: 16
      },
      emptyState: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 16
      },
      emptyStateText: {
        fontSize: 18,
        fontWeight: "bold",
        color: theme.colors.text.primary,
        textAlign: "center"
      },
      emptyStateSubtext: {
        fontSize: 14,
        color: theme.colors.text.secondary,
        textAlign: "center",
        marginTop: 8
      },
      dateSection: {
        marginBottom: 16
      },
      dateTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: theme.colors.text.primary,
        marginBottom: 8
      },
      eventCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: 8,
        padding: 16,
        marginBottom: 12
      },
      conflictingEvent: {
        borderLeftWidth: 4,
        borderLeftColor: theme.colors.error
      },
      eventHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start"
      },
      eventTime: {
        flexDirection: "column"
      },
      timeText: {
        fontSize: 14,
        fontWeight: "bold",
        color: theme.colors.text.primary
      },
      typeTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        alignSelf: "flex-start",
        marginBottom: 6
      },
      typeText: {
        fontSize: 12,
        fontWeight: "bold",
        color: "#ffffff"
      },
      removeButton: {
        padding: 4
      },
      eventTitle: {
        fontSize: 16,
        fontWeight: "500",
        color: theme.colors.text.primary,
        marginBottom: 6
      },
      eventLocation: {
        fontSize: 14,
        color: theme.colors.text.secondary
      },
      conflictWarning: {
        fontSize: 12,
        color: theme.colors.error,
        marginTop: 8,
        fontWeight: "bold"
      },
      friendAvatars: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 8
      },
      avatarContainer: {
        borderRadius: 20,
        borderWidth: 2,
        borderColor: theme.colors.background
      },
      avatar: {
        width: 40,
        height: 40,
        borderRadius: 20
      },
      friendCount: {
        fontSize: 12,
        color: theme.colors.text.secondary,
        marginLeft: 8
      },
      expandedDetails: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border
      },
      eventTimeSection: {
        flexDirection: "row",
        marginBottom: 8,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border
      },
      eventTimeLabel: {
        fontSize: 14,
        fontWeight: "bold",
        color: theme.colors.text.primary,
        marginRight: 4
      },
      eventTimeValue: {
        fontSize: 14,
        color: theme.colors.text.primary
      },
      itemDetailText: {
        fontSize: 14,
        color: theme.colors.text.secondary,
        lineHeight: 20
      },
      qrSection: {
        marginTop: 24,
        alignItems: "center",
        padding: 16
      },
      qrTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: theme.colors.text.primary,
        marginBottom: 16
      },
      qrSubtitle: {
        fontSize: 14,
        color: theme.colors.text.secondary,
        textAlign: "center",
        marginBottom: 16
      },
      qrContainer: {
        backgroundColor: theme.colors.surface,
        padding: 16,
        borderRadius: 8,
        alignItems: "center"
      },
      createProfileButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        marginTop: 16,
        alignItems: "center",
        justifyContent: "center"
      },
      createProfileButtonText: {
        fontSize: 16,
        fontWeight: "bold"
      },
      scrollView: {
        flex: 1
      },
      scrollViewContent: {
        paddingBottom: 20
      },
      // Styles for Past Events Collapsible Section
      pastEventsSection: {
        marginTop: 24,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        paddingTop: 16
      },
      pastEventsHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12
      },
      pastEventsTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: theme.colors.text.primary
      },
      pastEventsList: {
        // Optional: Add padding or margin if needed
      }
    })

  // --- RENDER LOGIC ---

  if (loading) {
    return (
      <View
        style={[
          programStyles(theme).container,
          { justifyContent: "center", alignItems: "center" }
        ]}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    )
  }

  if (error) {
    return (
      <View
        style={[
          programStyles(theme).container,
          { justifyContent: "center", alignItems: "center" }
        ]}
      >
        <Text style={{ color: theme.colors.error }}>
          Error loading data: {error.message}
        </Text>
      </View>
    )
  }

  // Ensure mapped data is available before rendering UI that depends on it
  if (!mappedProgramData) {
    return (
      <View
        style={[
          programStyles(theme).container,
          { justifyContent: "center", alignItems: "center" }
        ]}
      >
        <Text style={{ color: theme.colors.text.secondary }}>
          Preparing data...
        </Text>
      </View>
    )
  }
  return (
    <View style={[programStyles(theme).container, { paddingTop: 0 }]}>
      {/* Program Header with dynamic height */}
      {programDetails && (
        <View
          style={[
            programStyles(theme).programHeader,
            {
              maxHeight: headerHeight * 80, // assuming original height is approximately 80
              height: headerHeight * 80,
              overflow: "hidden",
              opacity: headerHeight,
              // Set height to 0 when fully collapsed
              marginTop: headerHeight === 0 ? 0 : undefined,
              marginBottom: headerHeight === 0 ? 0 : undefined,
              padding: headerHeight === 0 ? 0 : undefined
            }
          ]}
        >
          <Text
            style={[
              programStyles(theme).programTitle,
              { opacity: headerHeight }
            ]}
          >
            {programDetails.title || "ICYPAA"}
          </Text>
          <Text
            style={[
              programStyles(theme).programTheme,
              { opacity: headerHeight }
            ]}
          >
            {programDetails.theme || ""}
          </Text>
        </View>
      )}

      {/* Day selector tabs - Fix date display */}
      <View style={programStyles(theme).dayTabs}>
        {scheduleDays.map((day, index) => {
          // Parse the date properly to avoid timezone issues
          const dateStr = day.items[0].date
          const [year, month, dayNum] = dateStr
            .split("-")
            .map((num) => parseInt(num, 10))
          // Treat dates as local CST dates without timezone conversion
          const dateObj = new Date(year, month - 1, dayNum)

          const formattedDayTab = dateObj.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric"
            // No timeZone specified - display as local date
          })

          return (
            <TouchableOpacity
              key={day.day}
              style={[
                programStyles(theme).dayTab,
                activeDay === index && programStyles(theme).activeDayTab
              ]}
              onPress={() => setActiveDay(index)}
            >
              <Text
                style={[
                  programStyles(theme).dayTabText,
                  activeDay === index && programStyles(theme).activeDayTabText
                ]}
              >
                {formattedDayTab}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* View selector */}
      <View style={programStyles(theme).viewSelector}>
        <TouchableOpacity
          style={[
            programStyles(theme).viewButton,
            activeTab === 0 && programStyles(theme).activeViewButton
          ]}
          onPress={() => setActiveTab(0)}
        >
          <Ionicons
            name="list-outline"
            size={18}
            color={
              activeTab === 0
                ? getProgramColorUtil(programDetails, "primary", theme)
                : getProgramColorUtil(programDetails, "text.primary", theme)
            }
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              programStyles(theme).viewButtonText,
              activeTab === 0 && programStyles(theme).activeViewButtonText
            ]}
          >
            List
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            programStyles(theme).viewButton,
            activeTab === 1 && programStyles(theme).activeViewButton
          ]}
          onPress={() => setActiveTab(1)}
        >
          <Ionicons
            name="calendar-outline"
            size={18}
            color={
              activeTab === 1
                ? getProgramColorUtil(programDetails, "primary", theme)
                : getProgramColorUtil(programDetails, "text.primary", theme)
            }
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              programStyles(theme).viewButtonText,
              activeTab === 1 && programStyles(theme).activeViewButtonText
            ]}
          >
            Timeline
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            programStyles(theme).viewButton,
            activeTab === 2 && programStyles(theme).activeViewButton
          ]}
          onPress={() => setActiveTab(2)}
        >
          <Ionicons
            name="star-outline"
            size={18}
            color={
              activeTab === 2
                ? getProgramColorUtil(programDetails, "primary", theme)
                : getProgramColorUtil(programDetails, "text.primary", theme)
            }
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              programStyles(theme).viewButtonText,
              activeTab === 2 && programStyles(theme).activeViewButtonText
            ]}
          >
            My Schedule
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <View style={programStyles(theme).filterChipsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={programStyles(theme).filterChips}
        >
          {filterOptions.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[
                programStyles(theme).filterChip,
                activeCategoryFilter === filter.id &&
                  programStyles(theme).activeFilterChip
              ]}
              onPress={() => setActiveCategoryFilter(filter.id)}
            >
              <Text
                style={[
                  programStyles(theme).filterChipText,
                  activeCategoryFilter === filter.id &&
                    programStyles(theme).activeFilterChipText
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content area with scroll event handler */}
      <ScrollView
        ref={scrollViewRef}
        style={programStyles(theme).scrollView}
        contentContainerStyle={programStyles(theme).scrollViewContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16} // Ensures smooth updates
      >
        {activeTab === 1 && scheduleDays.length > 0 && (
          <TimelineView
            day={currentDay}
            savedItems={savedItems}
            onToggleSave={handleToggleSave}
            allScheduleItems={allScheduleItems}
            activeFilter={activeCategoryFilter}
            promoteIds={programDetails?.promote}
            programDetails={programDetails}
            events={events}
            formatTimeFunction={formatTime}
            sharedEvents={sharedEvents}
          />
        )}

        {activeTab === 0 && scheduleDays.length > 0 && (
          <DayScheduleCard
            day={currentDay}
            items={currentDayItems}
            savedItems={savedItems}
            onToggleSave={handleToggleSave}
            activeFilter={activeCategoryFilter}
            theme={theme}
            shadowStyles={shadowStyles}
            programDetails={programDetails}
            events={events}
            promoteIds={programDetails?.promote}
            sharedEvents={sharedEvents}
          />
        )}

        {activeTab === 2 && (
          <View style={programStyles(theme).myScheduleContainer}>
            {currentDaySavedItems.length === 0 ? (
              <View style={programStyles(theme).emptyState}>
                <Ionicons
                  name="calendar-outline"
                  size={64}
                  color={isDarkMode ? "#aaa" : theme.colors.text.secondary}
                />
                <Text
                  style={[
                    programStyles(theme).emptyStateText,
                    { color: isDarkMode ? "#fff" : theme.colors.text.secondary }
                  ]}
                >
                  No Saved Events
                </Text>
                <Text
                  style={[
                    programStyles(theme).emptyStateSubtext,
                    { color: isDarkMode ? "#ddd" : theme.colors.text.secondary }
                  ]}
                >
                  Save events from the schedule to see them here
                </Text>
              </View>
            ) : (
              <View>
                {/* Split events into upcoming and past */}
                {(() => {
                  const now = new Date()
                  const upcomingEvents: DisplayScheduleItem[] = []
                  const pastEvents: DisplayScheduleItem[] = []

                  currentDaySavedItems.forEach((item) => {
                    const eventDetails = events.find((e) => e.id === item.id)
                    const endTimeForCheck = eventDetails?.end_time
                      ? formatTime(eventDetails.end_time)
                      : item.time
                    const eventEndDateTime = parseEventDateTime(
                      item.date,
                      endTimeForCheck,
                      item.time
                    )
                    const hasPassed = eventEndDateTime
                      ? eventEndDateTime < now
                      : false

                    if (hasPassed) {
                      pastEvents.push(item)
                    } else {
                      upcomingEvents.push(item)
                    }
                  })

                  // Helper function to render an event card (used for both lists)
                  const renderEventCard = (
                    item: DisplayScheduleItem,
                    isPastEvent = false
                  ) => {
                    const hasConflict = hasTimeConflict(
                      item,
                      currentDaySavedItems
                    )
                    const friendsGoing = getFriendsAttending(item.id)
                    const eventDetails = events.find((e) => e.id === item.id)
                    const canSave = eventDetails?.can_save !== false

                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          programStyles(theme).eventCard,
                          // No opacity applied directly here anymore
                          hasConflict &&
                            !isPastEvent &&
                            programStyles(theme).conflictingEvent // Only show conflict for upcoming
                        ]}
                        onPress={() => toggleMyScheduleExpansion(item.id)}
                        activeOpacity={0.7}
                      >
                        {/* Card Content - No wrapping view needed now */}
                        <View style={programStyles(theme).eventHeader}>
                          {/* ... Header Content (Time, Type Tag, Title) ... */}
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center"
                              }}
                            >
                              <Text
                                style={[
                                  programStyles(theme).timeText,
                                  {
                                    color: isDarkMode
                                      ? "#fff"
                                      : theme.colors.text.primary
                                  }
                                ]}
                              >
                                {item.time}
                              </Text>
                              <View
                                style={[
                                  programStyles(theme).typeTag,
                                  {
                                    backgroundColor:
                                      item.categoryColor ||
                                      getProgramColorUtil(
                                        programDetails,
                                        "primary",
                                        theme
                                      ),
                                    marginBottom: 0,
                                    marginLeft: 8
                                  }
                                ]}
                              >
                                <Text
                                  style={[
                                    programStyles(theme).typeText,
                                    {
                                      color: getTextColorForBgUtil(
                                        item.categoryColor ||
                                          getProgramColorUtil(
                                            programDetails,
                                            "primary",
                                            theme
                                          )
                                      )
                                    }
                                  ]}
                                >
                                  {item.type.toUpperCase()}
                                </Text>
                              </View>
                            </View>
                            <Text
                              style={[
                                programStyles(theme).eventTitle,
                                {
                                  color: isDarkMode
                                    ? "#fff"
                                    : theme.colors.text.primary,
                                  marginTop: 8,
                                  flexShrink: 1
                                }
                              ]}
                              numberOfLines={
                                myScheduleExpandedItems[item.id] ? undefined : 2
                              }
                            >
                              {item.title}
                            </Text>
                          </View>
                          {canSave && (
                            <TouchableOpacity
                              onPress={(e) => {
                                e.stopPropagation()
                                handleToggleSave(item.id)
                              }}
                              style={programStyles(theme).removeButton}
                            >
                              <Ionicons
                                name="close-circle"
                                size={24}
                                color={
                                  item.categoryColor ||
                                  getProgramColorUtil(
                                    programDetails,
                                    "text.secondary",
                                    theme
                                  )
                                }
                              />
                            </TouchableOpacity>
                          )}
                        </View>
                        <Text
                          style={[
                            programStyles(theme).eventLocation,
                            {
                              color: isDarkMode
                                ? "#ddd"
                                : theme.colors.text.secondary
                            }
                          ]}
                        >
                          {item.location}
                        </Text>

                        {hasConflict && !isPastEvent && (
                          <Text style={programStyles(theme).conflictWarning}>
                            ⚠️ Time conflict with another saved event
                          </Text>
                        )}

                        {myScheduleExpandedItems[item.id] && (
                          <View style={programStyles(theme).expandedDetails}>
                            {/* ... Expanded Details Content ... */}
                            <View style={programStyles(theme).eventTimeSection}>
                              <Text style={programStyles(theme).eventTimeLabel}>
                                Event Time:
                              </Text>
                              <Text style={programStyles(theme).eventTimeValue}>
                                {item.time}
                                {eventDetails?.end_time
                                  ? ` - ${formatTime(eventDetails.end_time)}`
                                  : ""}
                              </Text>
                            </View>

                            {item.description && (
                              <Text style={programStyles(theme).itemDetailText}>
                                {item.description}
                              </Text>
                            )}

                            {item.speakers && item.speakers.length > 0 && (
                              <View style={{ marginTop: 8 }}>
                                <Text
                                  style={[
                                    programStyles(theme).eventTimeLabel,
                                    { marginBottom: 4 }
                                  ]}
                                >
                                  Speakers:
                                </Text>
                                <Text
                                  style={programStyles(theme).itemDetailText}
                                >
                                  {item.speakers.join(", ")}
                                </Text>
                              </View>
                            )}

                            {friendsGoing.length > 0 && (
                              <View style={{ marginTop: 12 }}>
                                <Text
                                  style={[
                                    programStyles(theme).eventTimeLabel,
                                    { marginBottom: 8 }
                                  ]}
                                >
                                  Friends Going:
                                </Text>
                                {friendsGoing.map((friend) => (
                                  <View
                                    key={friend.id}
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      marginBottom: 6
                                    }}
                                  >
                                    <Image
                                      source={{ uri: friend.avatar }}
                                      style={[
                                        programStyles(theme).avatar,
                                        {
                                          width: 32,
                                          height: 32,
                                          marginRight: 8
                                        }
                                      ]}
                                    />
                                    <Text
                                      style={
                                        programStyles(theme).itemDetailText
                                      }
                                    >
                                      {friend.name}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            )}

                            <SharedEventUsers
                              eventId={item.id}
                              sharedEvents={sharedEvents}
                              theme={theme}
                              key={`shared-users-${item.id}-${
                                Object.keys(sharedEvents).length
                              }`}
                            />
                          </View>
                        )}

                        {!myScheduleExpandedItems[item.id] &&
                          friendsGoing.length > 0 && (
                            <View style={programStyles(theme).friendAvatars}>
                              {friendsGoing.slice(0, 3).map((friend, index) => (
                                <View
                                  key={friend.id}
                                  style={[
                                    programStyles(theme).avatarContainer,
                                    { marginLeft: index > 0 ? -10 : 0 }
                                  ]}
                                >
                                  <Image
                                    source={{ uri: friend.avatar }}
                                    style={programStyles(theme).avatar}
                                  />
                                </View>
                              ))}
                              {friendsGoing.length > 3 && (
                                <Text style={programStyles(theme).friendCount}>
                                  +{friendsGoing.length - 3} more
                                </Text>
                              )}
                              {friendsGoing.length <= 3 && (
                                <Text style={programStyles(theme).friendCount}>
                                  {friendsGoing.length === 1
                                    ? `${friendsGoing[0].name} is going`
                                    : `${friendsGoing.length} friends going`}
                                </Text>
                              )}
                            </View>
                          )}
                      </TouchableOpacity>
                    )
                  }

                  return (
                    <View>
                      {/* Render Upcoming Events */}
                      <View style={programStyles(theme).dateSection}>
                        {upcomingEvents.length === 0 ? (
                          <Text style={programStyles(theme).emptyStateSubtext}>
                            No upcoming saved events for this day.
                          </Text>
                        ) : (
                          upcomingEvents.map((item) =>
                            renderEventCard(item, false)
                          )
                        )}
                      </View>

                      {/* Render Collapsible Past Events */}
                      {pastEvents.length > 0 && (
                        <View style={programStyles(theme).pastEventsSection}>
                          <TouchableOpacity
                            style={programStyles(theme).pastEventsHeader}
                            onPress={() =>
                              setIsPastEventsCollapsed(!isPastEventsCollapsed)
                            }
                          >
                            <Text style={programStyles(theme).pastEventsTitle}>
                              Past Events ({pastEvents.length})
                            </Text>
                            <Ionicons
                              name={
                                isPastEventsCollapsed
                                  ? "chevron-down"
                                  : "chevron-up"
                              }
                              size={24}
                              color={theme.colors.text.primary}
                            />
                          </TouchableOpacity>

                          {!isPastEventsCollapsed && (
                            <View style={programStyles(theme).pastEventsList}>
                              {pastEvents.map((item) =>
                                renderEventCard(item, true)
                              )}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  )
                })()}
              </View>
            )}

            {/* Bid Committee Schedule */}
            {isFeatureEnabled("bid_schedule_enabled") && showBidSchedule && (
              <View style={{ marginVertical: 16 }}>
                <BidSchedule programId={programId} />
              </View>
            )}

            {/* QR Code or Profile Button Section */}
            {isFeatureEnabled("schedule_sharing_enabled") && (
              <View style={programStyles(theme).qrSection}>
                <Text
                  style={[
                    programStyles(theme).qrTitle,
                    { color: isDarkMode ? "#fff" : theme.colors.text.primary }
                  ]}
                >
                  Share Your Schedule
                </Text>

                {checkingProfile ? (
                  <ActivityIndicator
                    size="large"
                    color={theme.colors.primary}
                  />
                ) : hasProfile ? (
                  <>
                    <Text
                      style={[
                        programStyles(theme).qrSubtitle,
                        {
                          color: isDarkMode
                            ? "#ddd"
                            : theme.colors.text.secondary
                        }
                      ]}
                    >
                      Let friends scan to see your saved events
                    </Text>
                    <View style={programStyles(theme).qrContainer}>
                      <QRCodeImage
                        data={qrData}
                        size={200}
                        isDarkMode={isDarkMode}
                      />
                    </View>
                  </>
                ) : (
                  <>
                    <Text
                      style={[
                        programStyles(theme).qrSubtitle,
                        {
                          color: isDarkMode
                            ? "#ddd"
                            : theme.colors.text.secondary
                        }
                      ]}
                    >
                      You need to create a profile before sharing your schedule
                    </Text>
                    <TouchableOpacity
                      style={[
                        programStyles(theme).createProfileButton,
                        { backgroundColor: theme.colors.primary }
                      ]}
                      onPress={goToProfilePage}
                    >
                      <Text
                        style={[
                          programStyles(theme).createProfileButtonText,
                          { color: "#FFFFFF" }
                        ]}
                      >
                        Create Profile
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </View>
        )}

        {/* Hospitality section - pass current day */}
        {programDetails?.hospitality && (
          <HospitalitySection
            hospitalityInfo={programDetails.hospitality}
            day={getCurrentDay()}
          />
        )}
      </ScrollView>
    </View>
  )
}

// Fix HospitalitySection structure to original format
const HospitalitySection = ({
  hospitalityInfo,
  day
}: {
  hospitalityInfo: HospitalityInfo
  day: string
}) => {
  const { theme, isDarkMode } = useTheme()

  // Extract just the day name from the formatted date (e.g., "Friday, August 12" -> "Friday")
  const extractDayName = (fullDay: string) => {
    // Handle the error case where day might be an error message
    if (fullDay === "No events scheduled" || fullDay === "No Events") {
      return ""
    }

    // Extract the day name from the formatted date (e.g., "Friday, August 12" -> "Friday")
    const dayName = fullDay.split(",")[0]
    return dayName
  }

  const dayName = extractDayName(day)

  // Create local styles for HospitalitySection with original format
  const hospitalityStyles = StyleSheet.create({
    hospitality: {
      marginBottom: 16
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.colors.text.primary,
      marginBottom: 10,
      marginHorizontal: 16
    },
    hospitalityCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 8
    },
    hospitalityLocation: {
      fontSize: 16,
      color: theme.colors.text.primary,
      marginBottom: 8
    },
    timeRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4
    },
    noTimesText: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      marginBottom: 4
    },
    hospitalityTime: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      marginLeft: 8
    },
    hospitalityHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8
    },
    hospitalityTitle: {
      fontSize: theme.typography.h2.fontSize, // Use theme typography
      marginLeft: 8,
      color: theme.colors.text.primary,
      fontWeight: "bold"
    }
  })

  // Filter hospitality times for the current day
  const dayTimes = hospitalityInfo.times.filter(
    (timeSlot) => timeSlot.day.toLowerCase() === dayName.toLowerCase()
  )

  // Use the formatTime function from parent
  const formatHospitalityTime = (time: string | null | undefined) => {
    if (!time) return ""

    // Simple formatter like the one in parent scope
    try {
      const cleanedTime = time.toUpperCase().replace(/\s+/g, "")
      const match = cleanedTime.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?(AM|PM)?/)
      if (!match) return time

      let hours = parseInt(match[1], 10)
      const minutes = parseInt(match[2], 10)
      let period = match[4]

      if (period) {
        if (period === "PM" && hours !== 12) {
          hours += 12
        } else if (period === "AM" && hours === 12) {
          hours = 0
        }
      }

      const finalHours12 = hours % 12 === 0 ? 12 : hours % 12
      const finalPeriod = hours >= 12 ? "PM" : "AM"
      const finalMinutesStr = minutes < 10 ? "0" + minutes : minutes

      return `${finalHours12}:${finalMinutesStr} ${finalPeriod}`
    } catch {
      return time
    }
  }

  return (
    <View style={hospitalityStyles.hospitalityCard}>
      <View style={hospitalityStyles.hospitalityHeader}>
        <Ionicons name="restaurant" size={24} color={theme.colors.primary} />
        <Text style={hospitalityStyles.hospitalityTitle}>
          Hospitality Suite
        </Text>
      </View>
      <Text style={hospitalityStyles.hospitalityLocation}>
        {hospitalityInfo.location}
      </Text>
      {dayTimes.length > 0 ? (
        dayTimes.map((time, index) => (
          <Text key={index} style={hospitalityStyles.hospitalityTime}>
            {formatHospitalityTime(time.start_time)} -{" "}
            {formatHospitalityTime(time.end_time)}
          </Text>
        ))
      ) : (
        <Text style={hospitalityStyles.noTimesText}>
          No suite times available for this day
        </Text>
      )}
    </View>
  )
}

// Function to register for push notifications and get token
async function registerForPushNotificationsAsync() {
  let token
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C"
    })
  }

  try {
    token = (
      await Notifications.getExpoPushTokenAsync({
        projectId: "15c03e66-5f31-409b-b31a-b53b92e00fb1"
      })
    ).data
    console.log("Expo push token:", token)
    return token
  } catch (error) {
    console.error("Error getting push token:", error)
    return null
  }
}

// Robust QR code image component with loading and error states
const QRCodeImage = ({
  data,
  size,
  isDarkMode
}: {
  data: string
  size: number
  isDarkMode: boolean
}) => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Use a more reliable QR code API (QR Server)
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    data
  )}&color=${isDarkMode ? "FFFFFF" : "000000"}&bgcolor=${
    isDarkMode ? "333333" : "FFFFFF"
  }`

  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: isDarkMode ? "#333" : "#fff",
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 8
      }}
    >
      {loading && (
        <ActivityIndicator
          size="large"
          color={isDarkMode ? "#fff" : "#000"}
          style={{ position: "absolute" }}
        />
      )}

      {error ? (
        <View style={{ padding: 10, alignItems: "center" }}>
          <Text
            style={{ color: isDarkMode ? "#fff" : "#000", marginBottom: 10 }}
          >
            Could not load QR code
          </Text>
          <TouchableOpacity
            onPress={() => {
              setError(false)
              setLoading(true)
            }}
            style={{
              padding: 8,
              backgroundColor: isDarkMode ? "#444" : "#eee",
              borderRadius: 4
            }}
          >
            <Text style={{ color: isDarkMode ? "#fff" : "#000" }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Image
          source={{ uri: qrCodeUrl }}
          style={{ width: size, height: size }}
          onLoadStart={() => setLoading(true)}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false)
            setError(true)
          }}
        />
      )}
    </View>
  )
}
