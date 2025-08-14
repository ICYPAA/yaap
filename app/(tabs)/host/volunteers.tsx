import { Ionicons } from "@expo/vector-icons"
import { useFocusEffect } from "@react-navigation/native"
import { useRouter } from "expo-router"
import React, { useCallback, useEffect, useRef, useState } from "react"
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native"
import { ProtectedComponent } from "../../../components/ProtectedComponent"
import { useDebug } from "../../../context/DebugContext"
import { useTheme } from "../../../context/ThemeContext"
import { Permission } from "../../../lib/roleChecker"
import { withDeviceId } from "../../../lib/supabase"
import { getTextColorForBackground } from "../../../lib/theme"
import {
  Event,
  getAllVolunteersForEvent,
  getEvents,
  getOrCreateVolunteeringData,
  getVolunteerInterest,
  VolunteeringData,
  VolunteerSignup
} from "../../../lib/volunteerAPI"

// Define types for section list data
interface SectionHeader {
  id: string
  itemType: "header"
  title: string
  count: number
}

type VolunteerWithType = VolunteerSignup & { itemType: "volunteer" }
type SectionListItem = SectionHeader | VolunteerWithType

function VolunteerSignupsContent() {
  const router = useRouter()
  const { theme } = useTheme()
  const { isDebugMode } = useDebug()
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [volunteeringData, setVolunteeringData] =
    useState<VolunteeringData | null>(null)
  const [volunteers, setVolunteers] = useState<VolunteerSignup[]>([])
  const [volunteerInterest, setVolunteerInterest] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const styles = createStyles(theme)
  const subscriptionRef = useRef<{ unsubscribe?: () => void }>({})

  useEffect(() => {
    fetchInitialData()
    setupRealtimeSubscription()

    // Cleanup subscription when component unmounts
    return () => {
      if (subscriptionRef.current.unsubscribe) {
        subscriptionRef.current.unsubscribe()
      }
    }
  }, [])

  // Refetch data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log("Volunteers screen focused, fetching data")
      fetchInitialData()
      return () => {
        console.log("Volunteers screen unfocused")
      }
    }, [])
  )

  // Fetch data when selected event changes
  useEffect(() => {
    if (selectedEvent) {
      fetchVolunteeringDataForEvent(selectedEvent.id)
    }
  }, [selectedEvent])

  const setupRealtimeSubscription = async () => {
    try {
      const supabaseWithDeviceId = await withDeviceId()

      const subscription = supabaseWithDeviceId
        .channel("volunteering_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "volunteering"
          },
          (payload) => {
            const { eventType, new: newRecord, old: oldRecord } = payload

            // Handle different event types
            if (eventType === "INSERT" || eventType === "UPDATE") {
              // If this is for the currently selected event, refresh the data
              if (selectedEvent && newRecord?.event_id === selectedEvent.id) {
                fetchVolunteeringDataForEvent(selectedEvent.id)
              }
            } else if (eventType === "DELETE") {
              // Handle deletion
              if (selectedEvent && oldRecord?.event_id === selectedEvent.id) {
                fetchVolunteeringDataForEvent(selectedEvent.id)
              }
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "volunteering_interest"
          },
          (payload) => {
            const { eventType } = payload

            // Handle different event types for volunteer interest
            if (eventType === "INSERT" || eventType === "UPDATE" || eventType === "DELETE") {
              console.log("Volunteer interest data changed, refreshing...")
              // Refresh volunteer interest data
              getVolunteerInterest().then(data => {
                setVolunteerInterest(data)
              }).catch(error => {
                console.error("Error refreshing volunteer interest:", error)
              })
            }
          }
        )
        .subscribe()

      subscriptionRef.current = subscription
    } catch (error) {
      console.error("Error setting up realtime subscription:", error)
    }
  }

  const fetchInitialData = async () => {
    try {
      setLoading(true)

      // Fetch events and volunteer interest
      const [eventsData, volunteerInterestData] = await Promise.all([
        getEvents(),
        getVolunteerInterest()
      ])

      setEvents(eventsData)
      setVolunteerInterest(volunteerInterestData)

      // If there are events, select the first one by default
      if (eventsData.length > 0) {
        setSelectedEvent(eventsData[0])
      }
    } catch (error) {
      console.error("Error fetching initial data:", error)
      Alert.alert("Error", "Failed to load volunteer data")
    } finally {
      setLoading(false)
    }
  }

  const fetchVolunteeringDataForEvent = async (eventId: string) => {
    try {
      const [volunteeringData, allVolunteers] = await Promise.all([
        getOrCreateVolunteeringData(eventId),
        getAllVolunteersForEvent(eventId)
      ])

      setVolunteeringData(volunteeringData)
      setVolunteers(allVolunteers)
    } catch (error) {
      console.error("Error fetching volunteering data for event:", error)
      // If no volunteering data exists, just clear the state
      setVolunteeringData(null)
      setVolunteers([])
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchInitialData()
    setRefreshing(false)
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={getTextColorForBackground(theme.colors.primary)}
          />
        </TouchableOpacity>
        <Text style={styles.title}>Volunteer Management</Text>
        {isDebugMode && (
          <View style={styles.debugBadge}>
            <Text style={styles.debugText}>DEBUG</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <Text style={styles.centeredText}>Loading volunteer data...</Text>
        </View>
      ) : (
        <FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={
            <View style={styles.content}>
              {/* Event Selection */}
              <View style={styles.eventSelector}>
                <Text style={styles.sectionTitle}>Select Event</Text>
                <FlatList
                  data={events}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.eventCard,
                        selectedEvent?.id === item.id &&
                          styles.selectedEventCard
                      ]}
                      onPress={() => setSelectedEvent(item)}
                    >
                      <Text
                        style={[
                          styles.eventTitle,
                          selectedEvent?.id === item.id &&
                            styles.selectedEventTitle
                        ]}
                      >
                        {item.title}
                      </Text>
                      <Text
                        style={[
                          styles.eventDate,
                          selectedEvent?.id === item.id &&
                            styles.selectedEventDate
                        ]}
                      >
                        {new Date(item.date).toLocaleDateString()}
                      </Text>
                    </TouchableOpacity>
                  )}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.eventList}
                />
              </View>

              {/* Volunteer Jobs */}
              {selectedEvent && volunteeringData && (
                <View style={styles.jobsSection}>
                  <Text style={styles.sectionTitle}>Volunteer Jobs</Text>
                  {volunteeringData.jobs.map((job, jobIndex) => (
                    <View key={jobIndex} style={styles.jobCard}>
                      <Text style={styles.jobTitle}>{job.name}</Text>
                      <Text style={styles.jobDescription}>
                        {job.description}
                      </Text>

                      {/* Time Slots */}
                      {job.time_slots.length > 0 ? (
                        job.time_slots.map((timeSlot, slotIndex) => (
                          <View key={slotIndex} style={styles.timeSlotCard}>
                            <View style={styles.timeSlotHeader}>
                              <Text style={styles.timeSlotTime}>
                                {timeSlot.time}
                              </Text>
                              <Text style={styles.volunteerCount}>
                                {timeSlot.current_volunteers.length}/
                                {timeSlot.max_volunteers}
                              </Text>
                            </View>

                            {/* Current Volunteers */}
                            {timeSlot.current_volunteers.length > 0 && (
                              <View style={styles.volunteersContainer}>
                                {timeSlot.current_volunteers.map(
                                  (volunteer, volIndex) => (
                                    <View
                                      key={volIndex}
                                      style={styles.volunteerTag}
                                    >
                                      <Text style={styles.volunteerName}>
                                        {volunteer.name}{" "}
                                        {volunteer.last_initial}.
                                      </Text>
                                    </View>
                                  )
                                )}
                              </View>
                            )}
                          </View>
                        ))
                      ) : (
                        <Text style={styles.noTimeSlotsText}>
                          No time slots configured
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Volunteer Interest Section */}
              {volunteerInterest.length > 0 && (
                <View style={styles.interestSection}>
                  <Text style={styles.sectionTitle}>
                    Volunteer Interest ({volunteerInterest.length})
                  </Text>
                  <Text style={styles.sectionSubtitle}>
                    People who have expressed interest in volunteering
                  </Text>
                  {volunteerInterest.slice(0, 5).map((interest, index) => (
                    <View key={index} style={styles.interestCard}>
                      <Text style={styles.interestName}>
                        {interest.name} {interest.last_initial}.
                      </Text>
                      <Text style={styles.interestType}>{interest.type}</Text>
                      <Text style={styles.interestDate}>
                        {new Date(interest.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  ))}
                  {volunteerInterest.length > 5 && (
                    <Text style={styles.moreInterestText}>
                      And {volunteerInterest.length - 5} more...
                    </Text>
                  )}
                </View>
              )}
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  )
}

const createStyles = (theme: ReturnType<typeof useTheme>["theme"]) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      backgroundColor: theme.colors.primary
    },
    backButton: {
      marginRight: 16
    },
    title: {
      fontSize: 20,
      fontWeight: "bold",
      color: getTextColorForBackground(theme.colors.primary),
      flex: 1
    },
    debugBadge: {
      backgroundColor: theme.colors.error,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12
    },
    debugText: {
      color: getTextColorForBackground(theme.colors.error),
      fontSize: 12,
      fontWeight: "bold"
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 16
    },
    centeredText: {
      color: theme.colors.text.primary,
      fontSize: 16
    },
    content: {
      padding: 16
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.colors.text.primary,
      marginBottom: 12
    },
    sectionSubtitle: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      marginBottom: 12
    },
    // Event Selection Styles
    eventSelector: {
      marginBottom: 24
    },
    eventList: {
      paddingHorizontal: 4
    },
    eventCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginRight: 12,
      borderWidth: 2,
      borderColor: theme.colors.border,
      minWidth: 180
    },
    selectedEventCard: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary
    },
    eventTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text.primary,
      marginBottom: 4
    },
    selectedEventTitle: {
      color: getTextColorForBackground(theme.colors.primary)
    },
    eventDate: {
      fontSize: 14,
      color: theme.colors.text.secondary
    },
    selectedEventDate: {
      color: getTextColorForBackground(theme.colors.primary),
      opacity: 0.8
    },
    // Volunteer Jobs Styles
    jobsSection: {
      marginBottom: 24
    },
    jobCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.colors.border
    },
    jobTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text.primary,
      marginBottom: 4
    },
    jobDescription: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      marginBottom: 12
    },
    noTimeSlotsText: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      fontStyle: "italic",
      textAlign: "center",
      padding: 12
    },
    timeSlotCard: {
      backgroundColor: theme.colors.background,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.colors.border
    },
    timeSlotHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8
    },
    timeSlotTime: {
      fontSize: 16,
      fontWeight: "500",
      color: theme.colors.text.primary
    },
    volunteerCount: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12
    },
    volunteersContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8
    },
    volunteerTag: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 16
    },
    volunteerName: {
      fontSize: 12,
      color: getTextColorForBackground(theme.colors.primary),
      fontWeight: "500"
    },
    // Volunteer Interest Styles
    interestSection: {
      marginBottom: 24
    },
    interestCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center"
    },
    interestName: {
      fontSize: 16,
      fontWeight: "500",
      color: theme.colors.text.primary,
      flex: 1
    },
    interestType: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      backgroundColor: theme.colors.background,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      marginHorizontal: 8,
      textTransform: "capitalize"
    },
    interestDate: {
      fontSize: 12,
      color: theme.colors.text.secondary
    },
    moreInterestText: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      textAlign: "center",
      fontStyle: "italic",
      marginTop: 8
    }
  })

// Default export wrapped with ProtectedComponent
export default function VolunteerSignups() {
  return (
    <ProtectedComponent requiredPermissions={[Permission.MANAGE_VOLUNTEERS]}>
      <VolunteerSignupsContent />
    </ProtectedComponent>
  )
}
