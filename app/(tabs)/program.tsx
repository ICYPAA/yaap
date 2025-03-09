import { Ionicons } from "@expo/vector-icons"
import React, { useEffect, useState } from "react"
import {
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
import { theme } from "../../constants/theme"

// Mock data structure
const programData = {
  speakers: [
    {
      id: 11,
      name: "John D.",
      topic: "Recovery Journey",
      time: "2:00 PM",
      date: "2024-07-01",
      location: "Main Hall"
    },
    {
      id: 21,
      name: "Sarah M.",
      topic: "Young & Sober",
      time: "4:00 PM",
      date: "2024-07-01",
      location: "Room 201"
    }
  ],
  panels: [
    {
      id: 12,
      title: "Sponsorship Workshop",
      participants: ["Mike R.", "Lisa K.", "Tom S."],
      time: "1:00 PM",
      date: "2024-07-02",
      location: "Conference Room A"
    },
    {
      id: 22,
      title: "Service Work in AA",
      participants: ["James H.", "Anna P."],
      time: "3:00 PM",
      date: "2024-07-02",
      location: "Main Hall"
    }
  ],
  entertainment: [
    {
      id: 13,
      title: "Sober Dance Party",
      time: "9:00 PM",
      date: "2024-07-01",
      location: "Grand Ballroom"
    },
    {
      id: 23,
      title: "Comedy Show",
      time: "8:00 PM",
      date: "2024-07-02",
      location: "Theater"
    }
  ],
  hospitality: [
    {
      id: 14,
      title: "Coffee & Fellowship",
      time: "All Day",
      location: "Hospitality Suite 401"
    },
    {
      id: 24,
      title: "Midnight Snacks",
      time: "11:00 PM - 2:00 AM",
      location: "Hospitality Suite 401"
    }
  ],
  activities: [
    {
      id: 1,
      title: "Pike Place Market",
      category: "Attractions",
      location: "85 Pike Street",
      description:
        "Historic market featuring local vendors, fresh produce, and the original Starbucks",
      distance: "0.5 miles from venue",
      image: "pike-place.jpg" // You'll need to add actual images
    },
    {
      id: 2,
      title: "Beecher's Handmade Cheese",
      category: "Food & Dining",
      location: "1600 Pike Place",
      description: "Famous local cheese shop known for their mac & cheese",
      distance: "0.6 miles from venue",
      image: "beechers.jpg"
    },
    {
      id: 3,
      title: "Space Needle",
      category: "Attractions",
      location: "400 Broad Street",
      description:
        "Iconic Seattle landmark with observation deck and rotating restaurant",
      distance: "1.2 miles from venue",
      image: "space-needle.jpg"
    },
    {
      id: 4,
      title: "Chihuly Garden and Glass",
      category: "Arts & Culture",
      location: "305 Harrison Street",
      description: "Stunning glass art exhibitions and garden installations",
      distance: "1.2 miles from venue",
      image: "chihuly.jpg"
    },
    {
      id: 5,
      title: "Dick's Drive-In",
      category: "Food & Dining",
      location: "115 Broadway E",
      description: "Seattle's iconic burger joint since 1954",
      distance: "1.8 miles from venue",
      image: "dicks.jpg"
    }
  ],
  faq: [
    {
      question: "What is the dress code?",
      answer: "Casual and comfortable. Some evening events may be dressier."
    },
    {
      question: "Are guests allowed?",
      answer: "Yes, registered guests are welcome at most events."
    },
    {
      question: "Where can I find schedule changes?",
      answer: "Check the app notifications or visit the registration desk."
    }
  ]
}

// Add food data to programData
const foodData = [
  {
    id: 1,
    title: "Cafe Vita",
    category: "Coffee Shop",
    location: "1005 E Pike St",
    description:
      "Local coffee roaster with excellent espresso drinks and pastries",
    distance: "0.3 miles from venue",
    image: "cafe-vita.jpg"
  },
  {
    id: 2,
    title: "Molly Moon's Ice Cream",
    category: "Dessert",
    location: "917 E Pine St",
    description:
      "Handmade ice cream with unique flavors using local ingredients",
    distance: "0.4 miles from venue",
    image: "molly-moons.jpg"
  },
  {
    id: 3,
    title: "Oddfellows Cafe",
    category: "American",
    location: "1525 10th Ave",
    description: "All-day cafe with breakfast, sandwiches, and comfort food",
    distance: "0.5 miles from venue",
    image: "oddfellows.jpg"
  },
  {
    id: 4,
    title: "Tacos Chukis",
    category: "Mexican",
    location: "219 Broadway E",
    description: "Authentic tacos and Mexican street food at affordable prices",
    distance: "0.6 miles from venue",
    image: "tacos-chukis.jpg"
  },
  {
    id: 5,
    title: "Plum Bistro",
    category: "Vegan",
    location: "1429 12th Ave",
    description: "Upscale vegan cuisine with creative plant-based dishes",
    distance: "0.7 miles from venue",
    image: "plum-bistro.jpg"
  }
]

// Update the ScheduleItem type to accept any string for 'type'
type ScheduleItem = {
  id: number
  title?: string
  name?: string // Add this for speakers
  topic?: string
  time: string
  date: string
  location: string
  type: string // Changed from specific union type to string
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
const hasTimeConflict = (item: ScheduleItem, allItems: ScheduleItem[]) => {
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

// Get event type color
const getEventTypeColor = (type: string) => {
  switch (type) {
    case "speaker":
      return theme.colors.primary
    case "panel":
      return theme.colors.secondary
    case "entertainment":
      return "#6c5ce7" // Purple
    default:
      return theme.colors.text.primary
  }
}

// Create a new TimelineView component that shows events across rooms
const TimelineView = ({
  day,
  savedItems,
  onToggleSave,
  allScheduleItems,
  activeFilter
}: {
  day: string
  savedItems: number[]
  onToggleSave: (id: number) => void
  allScheduleItems: ScheduleItem[]
  activeFilter: string
}) => {
  // Add refs to synchronize scrolling
  const roomHeadersScrollRef = React.useRef<ScrollView>(null)
  const roomColumnsScrollRef = React.useRef<ScrollView>(null)

  // Helper function to handle synchronized horizontal scrolling
  const handleHorizontalScroll = (event: any, fromHeaders: boolean) => {
    const scrollX = event.nativeEvent.contentOffset.x

    if (fromHeaders && roomColumnsScrollRef.current) {
      roomColumnsScrollRef.current.scrollTo({ x: scrollX, animated: false })
    } else if (!fromHeaders && roomHeadersScrollRef.current) {
      roomHeadersScrollRef.current.scrollTo({ x: scrollX, animated: false })
    }
  }

  // Helper function to calculate position and height based on time
  const getEventPosition = (startTime: string, duration: number = 60) => {
    // Parse time like "2:00 PM" to get hour and minute
    const timeParts = startTime.match(/(\d+):(\d+)\s*(AM|PM)/)
    if (!timeParts) return { top: 0, height: 0 }

    let hour = parseInt(timeParts[1])
    const minute = parseInt(timeParts[2])
    const period = timeParts[3]

    // Convert to 24-hour format
    if (period === "PM" && hour < 12) hour += 12
    if (period === "AM" && hour === 12) hour = 0

    // Calculate position (each hour is 60px, starting from 7 AM)
    const top = (hour - 7) * 60 + minute

    // Calculate height (1 minute = 1px)
    const height = duration

    return { top, height }
  }

  // Find events for this day
  const dayEvents = allScheduleItems.filter((item) => {
    const itemDate = new Date(item.date).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric"
    })

    // Apply type filter if not "all"
    if (activeFilter !== "all" && item.type !== activeFilter) {
      return false
    }

    return itemDate === day
  })

  // Group events by room
  const eventsByRoom = dayEvents.reduce((acc, event) => {
    const room = event.location.split(" ")[0] // Get first word of location as room name
    if (!acc[room]) acc[room] = []
    acc[room].push(event)
    return acc
  }, {} as Record<string, ScheduleItem[]>)

  // Define room columns to display
  const roomColumns = [
    "Main",
    "Conference",
    "Grand",
    "Room",
    "Theater",
    "Hospitality"
  ]

  return (
    <View style={styles.timelineContainer}>
      <Text style={styles.dayTitle}>{day}</Text>

      {/* Main meeting highlight box */}
      <View style={styles.mainMeetingCard}>
        <Ionicons name="star" size={24} color={theme.colors.background} />
        <View style={styles.mainMeetingContent}>
          <Text style={styles.mainMeetingTitle}>Main Meeting</Text>
          <Text style={styles.mainMeetingTime}>
            7:00 PM - 9:00 PM • Main Hall
          </Text>
        </View>
      </View>

      {/* Timeline with sticky headers and columns */}
      <View style={styles.timelineWrapper}>
        {/* Sticky header row with room names */}
        <View style={styles.stickyHeaderRow}>
          {/* Empty cell for time column */}
          <View style={styles.timeColumnHeader}>
            <Text style={styles.timeColumnHeaderText}>Time</Text>
          </View>

          {/* Scrollable room headers */}
          <ScrollView
            ref={roomHeadersScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.roomHeadersScroll}
            onScroll={(e) => handleHorizontalScroll(e, true)}
            scrollEventThrottle={16}
          >
            {roomColumns.map((room) => (
              <View key={room} style={styles.roomHeader}>
                <Text style={styles.roomName}>{room}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Main content area with sticky time column */}
        <ScrollView style={styles.timelineScrollView}>
          <View style={styles.timelineContentWrapper}>
            {/* Sticky time column */}
            <View style={styles.timeColumn}>
              {Array.from({ length: 16 }, (_, i) => {
                const hour = (i + 7) % 12 || 12
                const period = i + 7 < 12 || i + 7 >= 24 ? "AM" : "PM"
                return (
                  <View key={i} style={styles.timeSlot}>
                    <Text style={styles.timeText}>{`${hour} ${period}`}</Text>
                  </View>
                )
              })}
            </View>

            {/* Scrollable content area */}
            <ScrollView
              ref={roomColumnsScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.roomColumnsScroll}
              onScroll={(e) => handleHorizontalScroll(e, false)}
              scrollEventThrottle={16}
            >
              <View style={styles.roomColumnsContainer}>
                {/* Room columns */}
                {roomColumns.map((room) => (
                  <View key={room} style={styles.roomColumn}>
                    {/* Event blocks */}
                    <View style={styles.eventsContainer}>
                      {eventsByRoom[room]?.map((event) => {
                        const { top, height } = getEventPosition(event.time, 60)
                        return (
                          <View
                            key={event.id}
                            style={[
                              styles.timelineEvent,
                              {
                                top,
                                height,
                                backgroundColor:
                                  event.type === "speaker"
                                    ? theme.colors.primary
                                    : event.type === "panel"
                                    ? theme.colors.secondary
                                    : "#6c5ce7"
                              }
                            ]}
                          >
                            <Text style={styles.timelineEventTitle}>
                              {event.title || event.topic || ""}
                            </Text>
                            <Text style={styles.timelineEventTime}>
                              {event.time}
                            </Text>
                            <TouchableOpacity
                              style={styles.timelineSaveButton}
                              onPress={() => onToggleSave(event.id)}
                            >
                              <Ionicons
                                name={
                                  savedItems.includes(event.id)
                                    ? "star"
                                    : "star-outline"
                                }
                                size={16}
                                color={theme.colors.background}
                              />
                            </TouchableOpacity>
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
const FoodCard = ({ item }: { item: any }) => (
  <View style={styles.activityCard}>
    <View style={styles.activityHeader}>
      <View>
        <Text style={styles.activityCategory}>{item.category}</Text>
        <Text style={styles.activityTitle}>{item.title}</Text>
      </View>
      <TouchableOpacity
        onPress={() => openMaps(item.location)}
        style={styles.mapButton}
      >
        <Ionicons name="map-outline" size={24} color={theme.colors.primary} />
      </TouchableOpacity>
    </View>
    <Text style={styles.activityLocation}>{item.location}</Text>
    <Text style={styles.activityDistance}>{item.distance}</Text>
    <Text style={styles.activityDescription}>{item.description}</Text>
  </View>
)

// Update the DayScheduleCard component to include filtering
const DayScheduleCard = ({
  day,
  items,
  savedItems,
  onToggleSave,
  activeFilter
}: {
  day: string
  items: ScheduleItem[]
  savedItems: number[]
  onToggleSave: (id: number) => void
  activeFilter: string
}) => {
  // Filter items based on activeFilter
  const filteredItems =
    activeFilter === "all"
      ? items
      : items.filter((item) => item.type === activeFilter)

  // Group items by type
  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.type]) {
      acc[item.type] = []
    }
    acc[item.type].push(item)
    return acc
  }, {} as Record<string, ScheduleItem[]>)

  // Type labels
  const typeLabels: Record<string, string> = {
    speaker: "Speakers",
    panel: "Panels",
    entertainment: "Entertainment"
  }

  return (
    <View style={styles.dayCard}>
      <View style={styles.dayTitleContainer}>
        <Text style={styles.dayTitle}>{day}</Text>
      </View>
      <View style={styles.dayContentContainer}>
        {Object.entries(groupedItems).map(([type, typeItems]) => (
          <View key={type} style={styles.eventTypeSection}>
            <Text style={styles.eventTypeTitle}>
              {typeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
            {typeItems.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.scheduleItem,
                  {
                    borderLeftWidth: 4,
                    borderLeftColor: getEventTypeColor(item.type)
                  }
                ]}
              >
                <View style={styles.scheduleItemHeader}>
                  <View style={styles.scheduleTime}>
                    <Text style={styles.itemTime}>{item.time}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => onToggleSave(item.id)}
                    style={styles.saveButton}
                  >
                    <Ionicons
                      name={
                        savedItems.includes(item.id) ? "star" : "star-outline"
                      }
                      size={24}
                      color={
                        savedItems.includes(item.id)
                          ? theme.colors.secondary
                          : theme.colors.text.secondary
                      }
                    />
                  </TouchableOpacity>
                </View>
                <Text style={styles.itemTitle}>
                  {item.title || item.name || item.topic}
                </Text>
                <Text style={styles.itemLocation}>{item.location}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  )
}

export default function Program() {
  const screenWidth = Dimensions.get("window").width
  const [savedItems, setSavedItems] = useState<number[]>([])
  const [activeView, setActiveView] = useState("timeline") // 'timeline', 'list', 'my-schedule'
  const [activeDay, setActiveDay] = useState(0) // 0, 1, 2 for the three days
  const [activeFilter, setActiveFilter] = useState("all") // 'all', 'speaker', 'panel', 'entertainment'

  const handleToggleSave = (id: number) => {
    setSavedItems((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    )
  }

  // Define ScheduleItem type
  type ScheduleItem = {
    id: number
    title?: string
    name?: string
    topic?: string
    time: string
    date: string
    location: string
    type: string
  }

  // Create a combined array of all schedule items from programData
  const allScheduleItems: ScheduleItem[] = [
    ...programData.speakers.map((item) => ({
      ...item,
      title: item.topic,
      type: "speaker"
    })),
    ...programData.panels.map((item) => ({
      ...item,
      type: "panel"
    })),
    ...programData.entertainment.map((item) => ({
      ...item,
      type: "entertainment"
    })),
    // Add an entertainment event on day 1 at 4 pm
    {
      id: 31,
      title: "Open Mic Night",
      time: "4:00 PM",
      date: "2024-07-01",
      location: "Theater",
      type: "entertainment"
    }
  ]

  // Group items by date for the schedule view
  const scheduleData = allScheduleItems.reduce((acc, item) => {
    const dateObj = new Date(item.date)
    const formattedDate = dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric"
    })

    if (!acc[formattedDate]) {
      acc[formattedDate] = []
    }

    acc[formattedDate].push(item)
    return acc
  }, {} as Record<string, ScheduleItem[]>)

  // Convert to array for rendering
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

  // Get current day or fallback to a default
  const getCurrentDay = () => {
    if (scheduleDays.length === 0) {
      return "No events scheduled"
    }

    if (activeDay >= scheduleDays.length) {
      return scheduleDays[0].day
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

    const currentDay = getCurrentDay()

    return allScheduleItems.filter((item) => {
      const itemDate = new Date(item.date).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric"
      })
      return savedItems.includes(item.id) && itemDate === currentDay
    })
  }

  // Get current day saved items
  const currentDaySavedItems = getCurrentDaySavedItems()
  const currentDay = getCurrentDay()
  const currentDayItems = getCurrentDayItems()

  // Get friends attending an event
  const getFriendsAttending = (eventId: number) => {
    return mockFriends.filter((friend) => friend.savedEvents.includes(eventId))
  }

  // Generate QR code data
  const qrData = JSON.stringify({
    userId: "user123", // This would be the actual user ID
    savedEvents: savedItems
  })

  // Define filter options
  const filterOptions = [
    { id: "all", label: "All Events" },
    { id: "speaker", label: "Speakers" },
    { id: "panel", label: "Panels" },
    { id: "entertainment", label: "Entertainment" }
  ]

  return (
    <View style={styles.container}>
      {/* Day selector tabs */}
      <View style={styles.dayTabs}>
        {scheduleDays.map((day, index) => (
          <TouchableOpacity
            key={day.day}
            style={[styles.dayTab, activeDay === index && styles.activeDayTab]}
            onPress={() => setActiveDay(index)}
          >
            <Text
              style={[
                styles.dayTabText,
                activeDay === index && styles.activeDayTabText
              ]}
            >
              {new Date(day.items[0].date).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric"
              })}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* View selector */}
      <View style={styles.viewSelector}>
        <TouchableOpacity
          style={[
            styles.viewButton,
            activeView === "timeline" && styles.activeViewButton
          ]}
          onPress={() => setActiveView("timeline")}
        >
          <Ionicons
            name="calendar-outline"
            size={18}
            color={
              activeView === "timeline"
                ? theme.colors.primary
                : theme.colors.text.primary
            }
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.viewButtonText,
              activeView === "timeline" && styles.activeViewButtonText
            ]}
          >
            Timeline
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.viewButton,
            activeView === "list" && styles.activeViewButton
          ]}
          onPress={() => setActiveView("list")}
        >
          <Ionicons
            name="list-outline"
            size={18}
            color={
              activeView === "list"
                ? theme.colors.primary
                : theme.colors.text.primary
            }
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.viewButtonText,
              activeView === "list" && styles.activeViewButtonText
            ]}
          >
            List
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.viewButton,
            activeView === "my-schedule" && styles.activeViewButton
          ]}
          onPress={() => setActiveView("my-schedule")}
        >
          <Ionicons
            name="star-outline"
            size={18}
            color={
              activeView === "my-schedule"
                ? theme.colors.primary
                : theme.colors.text.primary
            }
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.viewButtonText,
              activeView === "my-schedule" && styles.activeViewButtonText
            ]}
          >
            My Schedule
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <View style={styles.filterChipsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChips}
        >
          {filterOptions.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterChip,
                activeFilter === filter.id && styles.activeFilterChip
              ]}
              onPress={() => setActiveFilter(filter.id)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === filter.id && styles.activeFilterChipText
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content area */}
      <ScrollView style={styles.contentContainer}>
        {activeView === "timeline" && scheduleDays.length > 0 && (
          <TimelineView
            day={currentDay}
            savedItems={savedItems}
            onToggleSave={handleToggleSave}
            allScheduleItems={allScheduleItems}
            activeFilter={activeFilter}
          />
        )}

        {activeView === "list" && scheduleDays.length > 0 && (
          <DayScheduleCard
            day={currentDay}
            items={currentDayItems}
            savedItems={savedItems}
            onToggleSave={handleToggleSave}
            activeFilter={activeFilter}
          />
        )}

        {activeView === "my-schedule" && (
          <View style={styles.myScheduleContainer}>
            {currentDaySavedItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name="calendar-outline"
                  size={64}
                  color={theme.colors.text.secondary}
                />
                <Text style={styles.emptyStateText}>No Saved Events</Text>
                <Text style={styles.emptyStateSubtext}>
                  Save events from the schedule to see them here
                </Text>
              </View>
            ) : (
              <View>
                <View style={styles.dateSection}>
                  <Text style={styles.dateTitle}>{currentDay}</Text>
                  {currentDaySavedItems.map((item) => {
                    const hasConflict = hasTimeConflict(
                      item,
                      currentDaySavedItems
                    )
                    const friendsGoing = getFriendsAttending(item.id)

                    return (
                      <View
                        key={item.id}
                        style={[
                          styles.eventCard,
                          hasConflict && styles.conflictingEvent
                        ]}
                      >
                        <View style={styles.eventHeader}>
                          <View style={styles.eventTime}>
                            <Text style={styles.timeText}>{item.time}</Text>
                            <View
                              style={[
                                styles.typeTag,
                                {
                                  backgroundColor: getEventTypeColor(item.type)
                                }
                              ]}
                            >
                              <Text style={styles.typeText}>
                                {item.type.toUpperCase()}
                              </Text>
                            </View>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleToggleSave(item.id)}
                            style={styles.removeButton}
                          >
                            <Ionicons
                              name="close-circle"
                              size={24}
                              color={theme.colors.text.secondary}
                            />
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.eventTitle}>
                          {item.title || item.name || item.topic}
                        </Text>
                        <Text style={styles.eventLocation}>
                          {item.location}
                        </Text>

                        {/* Show conflict warning if needed */}
                        {hasConflict && (
                          <Text style={styles.conflictWarning}>
                            ⚠️ Time conflict with another saved event
                          </Text>
                        )}

                        {/* Show friends attending */}
                        {friendsGoing.length > 0 && (
                          <View style={styles.friendAvatars}>
                            {friendsGoing.slice(0, 3).map((friend, index) => (
                              <View
                                key={friend.id}
                                style={[
                                  styles.avatarContainer,
                                  { marginLeft: index > 0 ? -10 : 0 }
                                ]}
                              >
                                <Image
                                  source={{ uri: friend.avatar }}
                                  style={styles.avatar}
                                />
                              </View>
                            ))}
                            {friendsGoing.length > 3 && (
                              <Text style={styles.friendCount}>
                                +{friendsGoing.length - 3} more
                              </Text>
                            )}
                            {friendsGoing.length <= 3 && (
                              <Text style={styles.friendCount}>
                                {friendsGoing.length === 1
                                  ? `${friendsGoing[0].name} is going`
                                  : `${friendsGoing.length} friends going`}
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                    )
                  })}
                </View>
              </View>
            )}
            {/* QR Code Section */}
            <View style={styles.qrSection}>
              <Text style={styles.qrTitle}>Share Your Schedule</Text>
              <Text style={styles.qrSubtitle}>
                Let friends scan to see your saved events
              </Text>
              <View style={styles.qrContainer}>
                <QRCode value={qrData} size={200} />
              </View>
            </View>
          </View>
        )}

        {/* Hospitality section - always visible */}
        <View style={styles.hospitalityCard}>
          <View style={styles.hospitalityHeader}>
            <Ionicons
              name="restaurant"
              size={24}
              color={theme.colors.primary}
            />
            <Text style={styles.hospitalityTitle}>Hospitality Suite</Text>
          </View>
          <Text style={styles.hospitalityHours}>
            Open 8:00 AM - 10:00 PM • Refreshments Available
          </Text>
        </View>

        {/* Food Carousel - New */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nearby Food Options</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContainer}
          >
            {foodData.map((item) => (
              <FoodCard key={item.id} item={item} />
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: Platform.OS === "ios" ? 0 : theme.spacing.md // Account for status bar
  },
  sectionTitle: {
    ...theme.typography.h1,
    marginVertical: theme.spacing.lg,
    color: theme.colors.text.primary,
    fontWeight: "bold"
  },
  dayContainer: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    width: Dimensions.get("window").width - 48, // Full width minus padding
    marginHorizontal: theme.spacing.md,
    ...theme.shadows.small
  },
  dayTitle: {
    ...theme.typography.h2,
    marginBottom: theme.spacing.sm,
    color: theme.colors.text.primary,
    fontWeight: "bold"
  },
  scheduleItem: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.sm
  },
  scheduleItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: theme.spacing.xs
  },
  scheduleTime: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm
  },
  itemTypeTag: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm
  },
  itemTypeText: {
    color: theme.colors.background,
    fontSize: 12,
    textTransform: "uppercase"
  },
  saveButton: {
    padding: theme.spacing.xs
  },
  itemTime: {
    ...theme.typography.body,
    fontWeight: "bold",
    color: theme.colors.text.primary
  },
  itemTitle: {
    ...theme.typography.body,
    marginVertical: theme.spacing.xs,
    color: theme.colors.text.primary
  },
  itemLocation: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary
  },
  faqSection: {
    marginVertical: theme.spacing.lg
  },
  faqItem: {
    marginBottom: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface,
    overflow: "hidden"
  },
  faqQuestionContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.sm
  },
  faqAnswerContainer: {
    overflow: "hidden",
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.md
  },
  faqQuestion: {
    ...theme.typography.body,
    fontWeight: "bold",
    marginBottom: theme.spacing.xs,
    color: theme.colors.text.primary
  },
  faqAnswer: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary
  },
  activityCard: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    width: 300,
    marginHorizontal: theme.spacing.sm,
    ...theme.shadows.small
  },
  activityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: theme.spacing.xs
  },
  mapButton: {
    padding: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface
  },
  activityCategory: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
    textTransform: "uppercase",
    fontWeight: "bold"
  },
  activityTitle: {
    ...theme.typography.h2,
    color: theme.colors.text.primary,
    fontWeight: "bold"
  },
  activityLocation: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs
  },
  activityDistance: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
    fontStyle: "italic"
  },
  activityDescription: {
    ...theme.typography.caption,
    color: theme.colors.text.primary,
    lineHeight: 20
  },
  scheduleList: {
    paddingHorizontal: theme.spacing.lg
  },
  activitiesList: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg
  },
  eventTypeSection: {
    marginBottom: theme.spacing.md
  },
  eventTypeTitle: {
    ...theme.typography.h2,
    fontSize: 18,
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    fontWeight: "bold"
  },
  collapsibleDayCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    overflow: "hidden",
    ...theme.shadows.small
  },
  dayTitleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: theme.spacing.md
  },
  dayContentContainer: {
    overflow: "hidden",
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background
  },
  scheduleContainer: {
    width: "100%",
    paddingHorizontal: theme.spacing.md
  },
  // New styles for the timeline view
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
  filterChipsContainer: {
    height: 50,
    justifyContent: "center",
    alignItems: "center" // Center the filter chips
  },
  filterChips: {
    paddingHorizontal: 10,
    alignItems: "center"
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    marginRight: 8
  },
  activeFilterChip: {
    backgroundColor: theme.colors.primary
  },
  filterChipText: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary
  },
  activeFilterChipText: {
    color: theme.colors.background
  },
  contentContainer: {
    flex: 1,
    padding: 16
  },
  timelineContainer: {
    marginBottom: 20
  },
  timelineGrid: {
    flexDirection: "row"
  },
  timeColumn: {
    width: 60
  },
  timeSlot: {
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  timeText: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary
  },
  roomColumn: {
    width: 120,
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.border
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
    marginLeft: 12
  },
  mainMeetingTitle: {
    ...theme.typography.h2,
    color: theme.colors.background,
    fontWeight: "bold"
  },
  mainMeetingTime: {
    ...theme.typography.body,
    color: theme.colors.background,
    opacity: 0.9
  },
  hospitalityCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 16,
    marginTop: 20
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
  },
  hospitalityHours: {
    ...theme.typography.body,
    color: theme.colors.text.secondary
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40
  },
  emptyStateText: {
    ...theme.typography.h2,
    color: theme.colors.text.secondary,
    marginTop: 16,
    fontWeight: "bold"
  },
  emptyStateSubtext: {
    ...theme.typography.body,
    color: theme.colors.text.secondary,
    textAlign: "center",
    marginTop: 8
  },
  myScheduleContainer: {
    flex: 1
  },
  dateSection: {
    marginBottom: theme.spacing.xl
  },
  dateTitle: {
    ...theme.typography.h2,
    marginBottom: theme.spacing.md,
    color: theme.colors.text.primary,
    fontWeight: "bold"
  },
  eventCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.small
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: theme.spacing.xs
  },
  eventTime: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm
  },
  typeTag: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm
  },
  typeText: {
    fontSize: 12,
    color: theme.colors.background,
    fontWeight: "bold"
  },
  removeButton: {
    padding: theme.spacing.xs
  },
  eventTitle: {
    ...theme.typography.body,
    marginBottom: theme.spacing.xs,
    color: theme.colors.text.primary
  },
  eventLocation: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary
  },
  qrSection: {
    alignItems: "center",
    padding: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.small
  },
  qrTitle: {
    ...theme.typography.h2,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
    fontWeight: "bold"
  },
  qrSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.lg
  },
  qrContainer: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm
  },
  dayCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    overflow: "hidden",
    ...theme.shadows.small
  },
  eventsContainer: {
    position: "relative",
    height: 960 // 16 hours * 60px
  },
  timelineEvent: {
    position: "absolute",
    left: 2,
    right: 2,
    borderRadius: theme.borderRadius.sm,
    padding: 4,
    overflow: "hidden"
  },
  timelineEventTitle: {
    color: theme.colors.background,
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 2
  },
  timelineEventTime: {
    color: theme.colors.background,
    fontSize: 9
  },
  timelineSaveButton: {
    position: "absolute",
    right: 2,
    top: 2,
    padding: 2
  },
  // Updated styles for centering sections without changing button styles
  timelineWrapper: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    overflow: "hidden",
    height: 600 // Fixed height to ensure scrolling works properly
  },
  stickyHeaderRow: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    zIndex: 2,
    position: "sticky",
    top: 0
  },
  timeColumnHeader: {
    width: 60,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    zIndex: 2
  },
  timeColumnHeaderText: {
    ...theme.typography.caption,
    fontWeight: "bold",
    color: theme.colors.text.primary
  },
  roomHeadersScroll: {
    flex: 1
  },
  timelineScrollView: {
    flex: 1
  },
  timelineContentWrapper: {
    flexDirection: "row",
    flex: 1
  },
  timeColumn: {
    width: 60,
    backgroundColor: theme.colors.surface,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    zIndex: 1,
    position: "sticky",
    left: 0
  },
  roomColumnsScroll: {
    flex: 1
  },
  roomColumnsContainer: {
    flexDirection: "row"
  },
  roomHeader: {
    width: 120,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.border
  },
  roomName: {
    ...theme.typography.caption,
    fontWeight: "bold",
    textAlign: "center"
  },
  // Add new styles for food carousel
  section: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.lg
  },
  sectionTitle: {
    ...theme.typography.h2,
    marginBottom: theme.spacing.md,
    color: theme.colors.text.primary,
    fontWeight: "bold",
    paddingHorizontal: theme.spacing.md
  },
  carouselContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md
  },
  // Add or update styles for new features
  conflictingEvent: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.secondary
  },
  conflictWarning: {
    ...theme.typography.caption,
    color: theme.colors.secondary,
    marginTop: theme.spacing.xs,
    fontWeight: "bold"
  },
  friendAvatars: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: theme.spacing.sm
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
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    marginLeft: theme.spacing.sm
  }
})
