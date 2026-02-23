import { Ionicons, FontAwesome6 } from "@expo/vector-icons"
import React from "react"
import {
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native"
import { useTheme } from "../context/ThemeContext"
import { Event } from "../types/program"
import { getTextColorForBackground } from "../lib/theme"

interface EventDetailsModalProps {
  visible: boolean
  event: Event | null
  onClose: () => void
  onToggleSave?: (eventId: number) => void
  isSaved?: boolean
  programColor?: string
}

export const EventDetailsModal: React.FC<EventDetailsModalProps> = ({
  visible,
  event,
  onClose,
  onToggleSave,
  isSaved = false,
  programColor
}) => {
  const { theme } = useTheme()

  if (!event) return null

  const handleCTAPress = () => {
    if (event.cta_link) {
      Linking.openURL(event.cta_link)
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

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center"
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      margin: 20,
      maxHeight: "85%",
      width: "90%",
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2
      },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.colors.text.primary,
      flex: 1,
      marginRight: 8
    },
    closeButton: {
      padding: 4
    },
    scrollContent: {
      padding: 20
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16
    },
    infoIcon: {
      marginRight: 12
    },
    infoContent: {
      flex: 1
    },
    infoLabel: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      marginBottom: 2
    },
    infoText: {
      fontSize: 16,
      color: theme.colors.text.primary
    },
    descriptionSection: {
      marginTop: 20
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text.primary,
      marginBottom: 8
    },
    descriptionText: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.text.secondary
    },
    speakersSection: {
      marginTop: 20
    },
    speakersList: {
      marginTop: 8
    },
    speakerItem: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 6
    },
    speakerBullet: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: programColor || theme.colors.primary,
      marginRight: 8
    },
    speakerName: {
      fontSize: 15,
      color: theme.colors.text.primary
    },
    servicesSection: {
      marginTop: 20
    },
    servicesGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: 8,
      alignItems: "center"
    },
    serviceIcon: {
      marginRight: 12,
      marginBottom: 8
    },
    languageTag: {
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      marginRight: 8,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.colors.border
    },
    languageText: {
      fontSize: 12,
      fontWeight: "bold",
      color: theme.colors.text.primary
    },
    footer: {
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center"
    },
    saveButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border
    },
    saveButtonText: {
      marginLeft: 8,
      fontSize: 16,
      fontWeight: "500",
      color: theme.colors.text.primary
    },
    ctaButton: {
      backgroundColor: programColor || theme.colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
      flexDirection: "row",
      alignItems: "center"
    },
    ctaButtonText: {
      color: getTextColorForBackground(programColor || theme.colors.primary),
      fontSize: 16,
      fontWeight: "600",
      marginRight: 6
    }
  })

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle} numberOfLines={2}>
              {event.title}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons
                name="close"
                size={24}
                color={theme.colors.text.secondary}
              />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent}>
            {/* Date and Time */}
            <View style={styles.infoRow}>
              <Ionicons
                name="calendar-outline"
                size={20}
                color={programColor || theme.colors.primary}
                style={styles.infoIcon}
              />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Date & Time</Text>
                <Text style={styles.infoText}>
                  {formatDate(event.date)}
                </Text>
                <Text style={styles.infoText}>
                  {formatTime(event.start_time)} - {formatTime(event.end_time)}
                </Text>
              </View>
            </View>

            {/* Location */}
            <View style={styles.infoRow}>
              <Ionicons
                name="location-outline"
                size={20}
                color={programColor || theme.colors.primary}
                style={styles.infoIcon}
              />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Location</Text>
                <Text style={styles.infoText}>{event.location}</Text>
              </View>
            </View>

            {/* Event Type */}
            {event.event_categories && (
              <View style={styles.infoRow}>
                <View
                  style={[
                    styles.infoIcon,
                    {
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      backgroundColor: event.event_categories.color
                    }
                  ]}
                />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Category</Text>
                  <Text style={styles.infoText}>
                    {event.event_categories.title}
                  </Text>
                </View>
              </View>
            )}

            {/* Description */}
            {event.description && (
              <View style={styles.descriptionSection}>
                <Text style={styles.sectionTitle}>About This Event</Text>
                <Text style={styles.descriptionText}>{event.description}</Text>
              </View>
            )}

            {/* Speakers */}
            {event.speakers && event.speakers.length > 0 && (
              <View style={styles.speakersSection}>
                <Text style={styles.sectionTitle}>Speakers</Text>
                <View style={styles.speakersList}>
                  {event.speakers.map((speaker, index) => (
                    <View key={index} style={styles.speakerItem}>
                      <View style={styles.speakerBullet} />
                      <Text style={styles.speakerName}>{speaker}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Services/Accessibility */}
            {(event.asl || event.hybrid || (event.languages && event.languages.length > 0)) && (
              <View style={styles.servicesSection}>
                <Text style={styles.sectionTitle}>Services & Accessibility</Text>
                <View style={styles.servicesGrid}>
                  {event.asl && (
                    <View style={styles.serviceIcon}>
                      <FontAwesome6
                        name="hands-asl-interpreting"
                        size={20}
                        color={programColor || theme.colors.primary}
                      />
                    </View>
                  )}
                  {event.hybrid && (
                    <View style={styles.serviceIcon}>
                      <Ionicons
                        name="videocam"
                        size={20}
                        color={programColor || theme.colors.primary}
                      />
                    </View>
                  )}
                  {event.languages && event.languages.map((lang) => {
                    const langMap: { [key: string]: string } = {
                      'spanish': 'ES',
                      'somali': 'SOM',
                      'hmong': 'HMN',
                      'french': 'FR'
                    };
                    const abbrev = langMap[lang.toLowerCase()] || lang.toUpperCase().slice(0, 3);
                    return (
                      <View key={lang} style={styles.languageTag}>
                        <Text style={styles.languageText}>{abbrev}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            {event.can_save !== false && onToggleSave && (
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => onToggleSave(event.id)}
              >
                <Ionicons
                  name={isSaved ? "star" : "star-outline"}
                  size={20}
                  color={programColor || theme.colors.primary}
                />
                <Text style={styles.saveButtonText}>
                  {isSaved ? "Saved" : "Save"}
                </Text>
              </TouchableOpacity>
            )}

            {event.cta_link && (
              <TouchableOpacity style={styles.ctaButton} onPress={handleCTAPress}>
                <Text style={styles.ctaButtonText}>Learn More</Text>
                <Ionicons
                  name="open-outline"
                  size={18}
                  color={getTextColorForBackground(programColor || theme.colors.primary)}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  )
}