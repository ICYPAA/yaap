import { Ionicons } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import React, { useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native"
import QRCode from "react-native-qrcode-svg"
import { useTheme } from "../../context/ThemeContext"
import { supabase } from "../../lib/supabase"
import {
  getProgramColor as getProgramColorUtil,
  getTextColorForBackground as getTextColorForBgUtil
} from "../../lib/theme"
import { Activity, Food } from "../../types/activities"
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
const getEventPosition = (startTime: string, endTime?: string) => {
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

  const startMinutes = parseTimeToMinutes(startTime)

  // Calculate height based on duration (if we have an end time)
  let height = 50 // Default minimum height to fit content

  if (endTime) {
    const endMinutes = parseTimeToMinutes(endTime)
    if (endMinutes > startMinutes) {
      // 1 hour = 60px height, minimum 50px
      height = Math.max(((endMinutes - startMinutes) / 60) * 60, height)
    }
  }

  return { top: startMinutes, height }
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
  formatTimeFunction
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
}) => {
  // Add refs to synchronize scrolling
  const roomHeadersScrollRef = React.useRef<ScrollView>(null)
  const roomColumnsScrollRef = React.useRef<ScrollView>(null)
  const { theme, isDarkMode } = useTheme()

  // Define local styles for the component with original table styles
  const timelineStyles = StyleSheet.create({
    timelineContainer: { marginBottom: 20 },
    dayTitle: {
      fontSize: 20,
      fontWeight: "bold",
      marginBottom: 8,
      marginLeft: 16,
      color: theme.colors.text.primary
    },
    mainMeetingCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.primary,
      padding: 16,
      borderRadius: 8,
      marginBottom: 16,
      marginHorizontal: 16
    },
    mainMeetingContent: { marginLeft: 12, flex: 1 },
    mainMeetingTitle: { fontSize: 18, fontWeight: "bold", color: "#ffffff" },
    mainMeetingTime: { fontSize: 14, color: "#ffffff", opacity: 0.9 },
    timelineWrapper: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      overflow: "hidden",
      height: 800,
      marginHorizontal: 16
    },
    stickyHeaderRow: {
      flexDirection: "row",
      backgroundColor: theme.colors.surface,
      zIndex: 1
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
    timelineScrollView: { flex: 1 },
    timelineContentWrapper: { flexDirection: "row", flex: 1 },
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
    eventsContainer: { position: "relative", minHeight: 24 * 60 },
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
    timelineEventTitle: { fontSize: 12, fontWeight: "bold", marginBottom: 2 },
    eventTime: {
      flexDirection: "column"
    },
    timelineEventTime: { fontSize: 10 },
    timelineSaveButton: { position: "absolute", top: 4, right: 4 }
  })

  // Helper function to handle synchronized horizontal scrolling
  const handleHorizontalScroll = (event: any, fromHeaders: boolean) => {
    const scrollX = event.nativeEvent.contentOffset.x

    if (fromHeaders && roomColumnsScrollRef.current) {
      roomColumnsScrollRef.current.scrollTo({ x: scrollX, animated: false })
    } else if (!fromHeaders && roomHeadersScrollRef.current) {
      roomHeadersScrollRef.current.scrollTo({ x: scrollX, animated: false })
    }
  }

  // Use the passed formatTime function
  const formatTime = formatTimeFunction

  // Find promoted events based on promoteIds
  const promotedEvents = useMemo(() => {
    if (!promoteIds || !events || promoteIds.length === 0) return []
    return events.filter((event) => promoteIds.includes(event.id))
  }, [promoteIds, events])

  // Find events for this day and apply filters
  const dayEvents = allScheduleItems
    .filter((item) => {
      const itemDate = new Date(item.date).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric"
      })

      // Check if date matches the current day
      const matchesDay = itemDate === day

      // Apply type filter if not "all"
      const matchesFilter =
        activeFilter === "all" ||
        item.type.toLowerCase() === activeFilter.toLowerCase()

      // Only include if both day and filter match
      return matchesDay && matchesFilter
    })
    .sort((a, b) => parseTimeForSorting(a.time) - parseTimeForSorting(b.time))

  // Get unique room names from events but handle Galway rooms separately
  const roomColumns = useMemo(() => {
    const rooms = new Set<string>()

    dayEvents.forEach((event) => {
      // Special handling for Galway rooms
      if (event.location.includes("Galway")) {
        // Check if it's specifically Galway C
        if (event.location.includes("Galway C")) {
          rooms.add("Galway C")
        } else {
          // All other Galway variants go to "Galway A/B"
          rooms.add("Galway A/B")
        }
      } else {
        rooms.add(event.location)
      }
    })

    // Return array without sorting to preserve original order
    return Array.from(rooms)
  }, [dayEvents])

  // Group events by room with the correct Galway distinction
  const eventsByRoom = useMemo(() => {
    const byRoom: Record<string, DisplayScheduleItem[]> = {}

    // Initialize the room arrays
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
  }, [dayEvents, roomColumns])

  // Use program colors in timeline events
  const getProgramEventColor = (event: DisplayScheduleItem) => {
    // First try to use the event's categoryColor
    if (event.categoryColor) return event.categoryColor

    // If not available, try to get from program design
    return getProgramColorUtil(programDetails, "primary", theme)
  }

  return (
    <View style={timelineStyles.timelineContainer}>
      <Text style={timelineStyles.dayTitle}>{day}</Text>

      {/* Promoted events highlight boxes */}
      {promotedEvents.map((event) => (
        <TouchableOpacity
          key={`promoted-${event.id}`}
          style={[
            timelineStyles.mainMeetingCard,
            {
              backgroundColor: getProgramColorUtil(
                programDetails,
                "primary",
                theme
              )
            }
          ]}
          onPress={() => onToggleSave(event.id)}
        >
          {event.can_save !== false && (
            <Ionicons
              name={savedItems.includes(event.id) ? "star" : "star-outline"}
              size={24}
              color="#ffffff" // Use white for better contrast on primary color background
            />
          )}
          <View style={timelineStyles.mainMeetingContent}>
            <Text
              style={[
                timelineStyles.mainMeetingTitle,
                { color: "#ffffff" } // Use white for better contrast on primary color background
              ]}
            >
              {event.title}
            </Text>
            <Text
              style={[
                timelineStyles.mainMeetingTime,
                { color: "#ffffff" } // Use white for better contrast on primary color background
              ]}
            >
              {formatTime(event.start_time)} - {formatTime(event.end_time)} •{" "}
              {event.location}
            </Text>
          </View>
        </TouchableOpacity>
      ))}

      {/* Timeline with sticky headers and columns */}
      <View style={timelineStyles.timelineWrapper}>
        {/* Sticky header row with room names */}
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
            scrollEventThrottle={16}
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
        <ScrollView style={timelineStyles.timelineScrollView}>
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
              scrollEventThrottle={16}
            >
              <View style={timelineStyles.roomColumnsContainer}>
                {/* Room columns */}
                {roomColumns.map((room) => (
                  <View key={room} style={timelineStyles.roomColumn}>
                    {/* Event blocks */}
                    <View style={timelineStyles.eventsContainer}>
                      {eventsByRoom[room]?.map((event) => {
                        // Use end_time if available in the original event data
                        const endTime = events.find(
                          (e: Event) => e.id === event.id
                        )?.end_time
                        const formattedEndTime = endTime
                          ? formatTime(endTime)
                          : undefined
                        const { top, height } = getEventPosition(
                          event.time,
                          formattedEndTime
                        )

                        const eventColor = getProgramEventColor(event)
                        const textColor = getTextColorForBgUtil(eventColor)

                        return (
                          <View
                            key={event.id}
                            style={[
                              timelineStyles.timelineEvent,
                              {
                                top,
                                height,
                                backgroundColor: eventColor,
                                minHeight: 30 // Minimum height for visibility
                              }
                            ]}
                          >
                            <Text
                              style={[
                                timelineStyles.timelineEventTitle,
                                { color: textColor }
                              ]}
                            >
                              {event.title}
                            </Text>
                            <View style={timelineStyles.eventTime}>
                              <Text
                                style={[
                                  timelineStyles.timelineEventTime,
                                  { color: textColor }
                                ]}
                              >
                                {event.time}
                                {formattedEndTime
                                  ? ` - ${formattedEndTime}`
                                  : ""}
                              </Text>
                            </View>
                            {event.can_save !== false && (
                              <TouchableOpacity
                                style={timelineStyles.timelineSaveButton}
                                onPress={() => onToggleSave(event.id)}
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
                          </View>
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
    </View>
  )
}

// Food card component
const FoodCard = ({ item }: { item: Food }) => {
  const { theme, isDarkMode } = useTheme()

  // Calculate distance if available
  const formattedDistance = item.distance
    ? `${item.distance} mi.`
    : "Distance not available"

  // Define local styles for FoodCard
  const foodCardStyles = StyleSheet.create({
    activityCard: {
      backgroundColor: theme.colors.background,
      padding: 16,
      borderRadius: 8,
      width: 300,
      marginHorizontal: 8,
      ...getShadowStyles(isDarkMode)
    },
    activityHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 8
    },
    activityCategory: {
      fontSize: 12,
      color: theme.colors.primary,
      marginBottom: 4,
      textTransform: "uppercase",
      fontWeight: "bold"
    },
    activityTitle: {
      fontSize: 18,
      color: theme.colors.text.primary,
      fontWeight: "bold"
    },
    mapButton: {
      padding: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.surface
    },
    activityLocation: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      marginBottom: 4
    },
    activityDistance: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      marginBottom: 4,
      fontStyle: "italic"
    },
    activityDescription: {
      fontSize: 14,
      color: theme.colors.text.primary,
      lineHeight: 20
    }
  })

  return (
    <View style={foodCardStyles.activityCard}>
      <View style={foodCardStyles.activityHeader}>
        <View>
          <Text style={foodCardStyles.activityCategory}>{item.category}</Text>
          <Text style={foodCardStyles.activityTitle}>{item.name}</Text>
        </View>
        <TouchableOpacity
          onPress={() => openMaps(item.location)}
          style={foodCardStyles.mapButton}
        >
          <Ionicons name="map-outline" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
      <Text style={foodCardStyles.activityLocation}>{item.location}</Text>
      <Text style={foodCardStyles.activityDistance}>{formattedDistance}</Text>
      <Text style={foodCardStyles.activityDescription}>{item.description}</Text>
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
  promoteIds
}: DayScheduleCardProps) => {
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>(
    {}
  )
  const [collapsedCategories, setCollapsedCategories] = useState<
    Record<string, boolean>
  >({})
  const { isDarkMode } = useTheme()

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

  // Filter based on the category title (item.type)
  const filteredItems = useMemo(() => {
    return items.filter(
      (item) =>
        activeFilter === "all" ||
        item.type.toLowerCase() === activeFilter.toLowerCase()
    )
  }, [items, activeFilter])

  // Group filtered items by category
  const groupedByCategory = useMemo(() => {
    // First, group by category
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

    // Priority categories in order
    const priorityOrder = ["Speaker", "Panel", "Entertainment", "Marathon"]

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
  }, [filteredItems])

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

  // Find promoted events based on promoteIds
  const promotedEvents = useMemo(() => {
    if (!promoteIds || !events || promoteIds.length === 0) return []
    return events.filter((event) => promoteIds.includes(event.id))
  }, [promoteIds, events])

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

  return (
    <View style={[styles(theme).dayCard, shadowStyles]}>
      <View style={styles(theme).dayHeader}>
        <Text style={styles(theme).dayTitle}>{day}</Text>
      </View>

      <View style={styles(theme).dayContent}>
        {/* Show promoted events at the top of list view */}
        {promotedEvents.length > 0 && (
          <View style={styles(theme).promotedEventsSection}>
            {promotedEvents.map((event) => {
              const promotedItem = items.find((item) => item.id === event.id)
              if (!promotedItem) return null

              const primaryColor = getProgramColorUtil(
                programDetails,
                "primary",
                theme
              )
              const textColor = getTextColorForBgUtil(primaryColor)

              return (
                <TouchableOpacity
                  key={`promoted-${event.id}`}
                  style={[
                    styles(theme).mainMeetingCard,
                    { backgroundColor: primaryColor }
                  ]}
                  onPress={() => onToggleSave(event.id)}
                >
                  {event.can_save !== false && (
                    <Ionicons
                      name={
                        savedItems.includes(event.id) ? "star" : "star-outline"
                      }
                      size={24}
                      color={textColor}
                    />
                  )}
                  <View style={styles(theme).mainMeetingContent}>
                    <Text
                      style={[
                        styles(theme).mainMeetingTitle,
                        { color: textColor }
                      ]}
                    >
                      {event.title}
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
                  </View>
                </TouchableOpacity>
              )
            })}
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

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles(theme).scheduleItem,
                        {
                          borderLeftWidth: 4,
                          borderLeftColor: itemColor
                        }
                      ]}
                      onPress={() => toggleExpansion(item.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles(theme).scheduleItemHeader}>
                        <Text style={styles(theme).itemTime}>{item.time}</Text>
                        {canSave && (
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation()
                              onToggleSave(item.id)
                            }}
                            style={styles(theme).saveButton}
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

                      {expandedItems[item.id] && (
                        <View style={styles(theme).expandedDetails}>
                          {/* Add event time section */}
                          <View style={styles(theme).eventTimeSection}>
                            <Text style={styles(theme).eventTimeLabel}>
                              Event Time:
                            </Text>
                            <Text style={styles(theme).eventTimeValue}>
                              {item.time}
                              {endTime ? ` - ${formatEventTime(endTime)}` : ""}
                            </Text>
                          </View>

                          {item.description && (
                            <Text style={styles(theme).itemDetailText}>
                              {item.description}
                            </Text>
                          )}
                        </View>
                      )}
                    </TouchableOpacity>
                  )
                })}
            </View>
          ))
        )}
      </View>
    </View>
  )
}

export default function Program() {
  const { theme, isDarkMode } = useTheme()
  const shadowStyles = getShadowStyles(isDarkMode)
  const screenWidth = Dimensions.get("window").width
  const [savedItems, setSavedItems] = useState<number[]>([])
  const [activeView, setActiveView] = useState("list") // 'list', 'timeline', 'my-schedule'
  const [activeDay, setActiveDay] = useState(0) // 0, 1, 2 for the three days
  const [activeFilter, setActiveFilter] = useState("all") // 'all', 'speaker', 'panel', 'entertainment'
  // Add state for header height
  const [headerHeight, setHeaderHeight] = useState(1) // 1 = full height, 0 = no height
  // Add state for device ID
  const [deviceId, setDeviceId] = useState<string>("")

  // Reference to scroll view to track scrolling
  const scrollViewRef = React.useRef<ScrollView>(null)

  // State for fetched data
  const [programDetails, setProgramDetails] = useState<ProgramType | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [categories, setCategories] = useState<EventCategory[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [foodItems, setFoodItems] = useState<Food[]>([]) // Use fetched food state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Load saved items from AsyncStorage on mount
  useEffect(() => {
    const loadSavedItems = async () => {
      try {
        // Try to get device ID
        let storedDeviceId = await AsyncStorage.getItem("device_id")
        if (!storedDeviceId) {
          // Generate a new device ID if none exists
          storedDeviceId = `device_${Date.now()}_${Math.random()
            .toString(36)
            .substring(2, 9)}`
          await AsyncStorage.setItem("device_id", storedDeviceId)
        }
        setDeviceId(storedDeviceId)

        // Load saved schedule from AsyncStorage
        const savedScheduleJson = await AsyncStorage.getItem("user_schedule")
        if (savedScheduleJson) {
          const savedSchedule: Schedule = JSON.parse(savedScheduleJson)
          setSavedItems(savedSchedule.saved_events || [])
        }
      } catch (error) {
        console.error("Error loading saved items:", error)
      }
    }

    loadSavedItems()
  }, [])

  // Fetch data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        // Assume program ID 1 for now
        const programId = 1

        const [programRes, eventsRes, categoriesRes, activitiesRes, foodRes] =
          await Promise.all([
            supabase
              .from("programs")
              .select("*")
              .eq("id", programId)
              .maybeSingle(),
            // Fetch events and their category details
            supabase
              .from("events")
              .select("*, event_categories(title, color)")
              .eq("program_id", programId),
            supabase
              .from("event_categories")
              .select("*")
              .eq("program_id", programId), // Keep fetching categories separately if needed elsewhere
            supabase.from("activities").select("*").eq("program_id", programId),
            supabase.from("food").select("*").eq("program_id", programId)
          ])

        // Error handling
        if (programRes.error) throw programRes.error
        if (eventsRes.error) throw eventsRes.error
        if (categoriesRes.error) throw categoriesRes.error
        if (activitiesRes.error) throw activitiesRes.error
        if (foodRes.error) throw foodRes.error

        // Set state
        setProgramDetails(programRes.data)
        // Type assertion needed because Supabase join returns nested object or array
        setEvents((eventsRes.data as Event[]) || [])
        setCategories(categoriesRes.data || [])
        setActivities(activitiesRes.data || [])
        setFoodItems(foodRes.data || [])
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
      // Update local state first for immediate UI response
      const newSavedItems = savedItems.includes(id)
        ? savedItems.filter((itemId) => itemId !== id)
        : [...savedItems, id]

      setSavedItems(newSavedItems)

      // Create schedule object matching the user.ts type
      const schedule: Schedule = {
        saved_events: newSavedItems,
        shared_with: [],
        shared_by: []
      }

      // Save to AsyncStorage
      await AsyncStorage.setItem("user_schedule", JSON.stringify(schedule))

      // Skip Supabase update if no device ID
      if (!deviceId) return

      // Update or insert user record in Supabase
      const { error } = await supabase.from("users").upsert(
        {
          device_id: deviceId,
          schedule: schedule,
          // Set minimal default values for required fields if this is a new user
          first_name: "Anonymous",
          last_initial: "U",
          profile_image: "",
          settings: {
            notifications: true,
            schedule_notifications: true,
            event_notifications: true,
            main_meeting_notifications: true,
            game_notifications: true,
            hospitality_notifications: true
          }
        },
        {
          onConflict: "device_id"
        }
      )

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
        const dateObj = new Date(Date.UTC(year, month - 1, day))

        const formattedDate = dateObj.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          timeZone: "UTC" // Force UTC timezone to avoid date shifting
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
  const scheduleDays = Object.entries(scheduleData).map(([date, items]) => ({
    day: date,
    items
  }))

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
        const dateObj = new Date(Date.UTC(year, month - 1, day))

        const itemDate = dateObj.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          timeZone: "UTC"
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

  // Generate QR code data
  const qrData = JSON.stringify({
    userId: "user123", // This would be the actual user ID
    savedEvents: savedItems
  })

  // Generate dynamic filter options from categories
  const filterOptions = useMemo(() => {
    const defaultOption = { id: "all", label: "All Events" }

    if (!categories || categories.length === 0) {
      return [defaultOption]
    }

    // Create filter options from actual categories
    const categoryOptions = categories.map((cat) => ({
      id: cat.title.toLowerCase(),
      label: cat.title
    }))

    return [defaultOption, ...categoryOptions]
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
        color: theme.colors.text,
        marginTop: 20,
        marginBottom: 10,
        marginHorizontal: 16
      },
      // Timeline specific styles
      timelineWrapper: {
        flex: 1,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.roundness,
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
        ...theme.typography.body,
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
        ...theme.typography.caption,
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
      foodSection: {
        marginVertical: 16
      },
      foodListContainer: {
        paddingHorizontal: 16
      }
      // Additional common styles for components
      // ... add any other styles needed
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
          const dateObj = new Date(Date.UTC(year, month - 1, dayNum))

          const formattedDayTab = dateObj.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            timeZone: "UTC"
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
            activeView === "list" && programStyles(theme).activeViewButton
          ]}
          onPress={() => setActiveView("list")}
        >
          <Ionicons
            name="list-outline"
            size={18}
            color={
              activeView === "list"
                ? getProgramColorUtil(programDetails, "primary", theme)
                : getProgramColorUtil(programDetails, "text.primary", theme)
            }
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              programStyles(theme).viewButtonText,
              activeView === "list" && programStyles(theme).activeViewButtonText
            ]}
          >
            List
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            programStyles(theme).viewButton,
            activeView === "timeline" && programStyles(theme).activeViewButton
          ]}
          onPress={() => setActiveView("timeline")}
        >
          <Ionicons
            name="calendar-outline"
            size={18}
            color={
              activeView === "timeline"
                ? getProgramColorUtil(programDetails, "primary", theme)
                : getProgramColorUtil(programDetails, "text.primary", theme)
            }
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              programStyles(theme).viewButtonText,
              activeView === "timeline" &&
                programStyles(theme).activeViewButtonText
            ]}
          >
            Timeline
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            programStyles(theme).viewButton,
            activeView === "my-schedule" &&
              programStyles(theme).activeViewButton
          ]}
          onPress={() => setActiveView("my-schedule")}
        >
          <Ionicons
            name="star-outline"
            size={18}
            color={
              activeView === "my-schedule"
                ? getProgramColorUtil(programDetails, "primary", theme)
                : getProgramColorUtil(programDetails, "text.primary", theme)
            }
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              programStyles(theme).viewButtonText,
              activeView === "my-schedule" &&
                programStyles(theme).activeViewButtonText
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
                activeFilter === filter.id &&
                  programStyles(theme).activeFilterChip
              ]}
              onPress={() => setActiveFilter(filter.id)}
            >
              <Text
                style={[
                  programStyles(theme).filterChipText,
                  activeFilter === filter.id &&
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
        style={programStyles(theme).contentContainer}
        onScroll={handleScroll}
        scrollEventThrottle={16} // Ensures smooth updates
      >
        {activeView === "timeline" && scheduleDays.length > 0 && (
          <TimelineView
            day={currentDay}
            savedItems={savedItems}
            onToggleSave={handleToggleSave}
            allScheduleItems={allScheduleItems}
            activeFilter={activeFilter}
            promoteIds={programDetails?.promote}
            programDetails={programDetails}
            events={events}
            formatTimeFunction={formatTime}
          />
        )}

        {activeView === "list" && scheduleDays.length > 0 && (
          <DayScheduleCard
            day={currentDay}
            items={currentDayItems}
            savedItems={savedItems}
            onToggleSave={handleToggleSave}
            activeFilter={activeFilter}
            theme={theme}
            shadowStyles={shadowStyles}
            programDetails={programDetails}
            events={events}
            promoteIds={programDetails?.promote}
          />
        )}

        {activeView === "my-schedule" && (
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
                <View style={programStyles(theme).dateSection}>
                  <Text
                    style={[
                      programStyles(theme).dateTitle,
                      { color: isDarkMode ? "#fff" : theme.colors.text.primary }
                    ]}
                  >
                    {currentDay}
                  </Text>
                  {currentDaySavedItems.map((item) => {
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
                          hasConflict && programStyles(theme).conflictingEvent
                        ]}
                        onPress={() => toggleMyScheduleExpansion(item.id)}
                        activeOpacity={0.7}
                      >
                        <View style={programStyles(theme).eventHeader}>
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

                        {/* Show conflict warning if needed */}
                        {hasConflict && (
                          <Text style={programStyles(theme).conflictWarning}>
                            ⚠️ Time conflict with another saved event
                          </Text>
                        )}

                        {/* Show expanded details when card is clicked */}
                        {myScheduleExpandedItems[item.id] && (
                          <View style={programStyles(theme).expandedDetails}>
                            {/* Event time details */}
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

                            {/* Event description if available */}
                            {item.description && (
                              <Text style={programStyles(theme).itemDetailText}>
                                {item.description}
                              </Text>
                            )}

                            {/* Speakers if available */}
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

                            {/* Friends section - show all friends */}
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
                          </View>
                        )}

                        {/* Show collapsed version of friends for non-expanded cards */}
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
                  })}
                </View>
              </View>
            )}
            {/* QR Code Section */}
            <View style={programStyles(theme).qrSection}>
              <Text
                style={[
                  programStyles(theme).qrTitle,
                  { color: isDarkMode ? "#fff" : theme.colors.text.primary }
                ]}
              >
                Share Your Schedule
              </Text>
              <Text
                style={[
                  programStyles(theme).qrSubtitle,
                  { color: isDarkMode ? "#ddd" : theme.colors.text.secondary }
                ]}
              >
                Let friends scan to see your saved events
              </Text>
              <View style={programStyles(theme).qrContainer}>
                <QRCode
                  value={qrData}
                  size={200}
                  backgroundColor={isDarkMode ? "#333" : "#fff"}
                  color={isDarkMode ? "#fff" : "#000"}
                />
              </View>
            </View>
          </View>
        )}

        {/* Hospitality section - pass current day */}
        {programDetails?.hospitality && (
          <HospitalitySection
            hospitalityInfo={programDetails.hospitality}
            day={getCurrentDay()}
          />
        )}

        {/* Food section */}
        <View style={programStyles(theme).foodSection}>
          <Text style={programStyles(theme).sectionTitle}>Food</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={programStyles(theme).foodListContainer}
          >
            {foodItems.map((item) => (
              <FoodCard key={item.id} item={item} />
            ))}
          </ScrollView>
        </View>
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
      ...theme.typography.h2,
      marginLeft: 8,
      color: theme.colors.text.primary,
      fontWeight: "bold"
    }
  })

  // Filter hospitality times for the current day
  const dayTimes = hospitalityInfo.times.filter(
    (timeSlot) => timeSlot.day.toLowerCase() === day.toLowerCase()
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
          <Text style={hospitalityStyles.hospitalityTime}>
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
