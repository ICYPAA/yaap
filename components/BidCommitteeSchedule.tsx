import { Ionicons } from "@expo/vector-icons"
import React, { useState } from "react"
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native"
import { useTheme } from "../context/ThemeContext"

interface ScheduleItem {
  id: string
  title: string
  time: string
  date: string
  location: string
  description?: string
  chair?: string
  type: "meeting" | "deadline" | "event"
}

// Static schedule data - this could be moved to a database later
const BIG_COMMITTEE_SCHEDULE: ScheduleItem[] = [
  {
    id: "1",
    title: "Monthly Host Committee Meeting",
    time: "7:00 PM",
    date: "2024-12-15",
    location: "Main Conference Room",
    description:
      "Regular monthly meeting to discuss conference planning progress and coordinate between committees.",
    chair: "Conference Chair",
    type: "meeting"
  },
  {
    id: "2",
    title: "Program Submission Deadline",
    time: "11:59 PM",
    date: "2025-01-15",
    location: "Online",
    description:
      "Final deadline for all program submissions including speaker applications and workshop proposals.",
    type: "deadline"
  },
  {
    id: "3",
    title: "Registration Committee Meeting",
    time: "6:30 PM",
    date: "2025-01-20",
    location: "Conference Room B",
    description:
      "Focus on registration process, pricing, and early bird promotions.",
    chair: "Registration Chair",
    type: "meeting"
  },
  {
    id: "4",
    title: "Venue Walkthrough",
    time: "2:00 PM",
    date: "2025-02-01",
    location: "Conference Venue",
    description:
      "Final walkthrough of conference venue with all committee chairs to finalize room assignments and logistics.",
    chair: "Hotel/Venue Chair",
    type: "event"
  },
  {
    id: "5",
    title: "Pre-Conference Meeting",
    time: "10:00 AM",
    date: "2025-02-28",
    location: "Hotel Conference Room",
    description:
      "Final preparation meeting before conference begins. All committee chairs required.",
    chair: "Conference Chair",
    type: "meeting"
  }
]

interface BidCommitteeScheduleProps {
  showAll?: boolean
}

const BidCommitteeSchedule: React.FC<BidCommitteeScheduleProps> = ({
  showAll = false
}) => {
  const { theme } = useTheme()
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(
    {}
  )
  const [showFullSchedule, setShowFullSchedule] = useState(showAll)

  const styles = createStyles(theme)

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const getTypeIcon = (type: ScheduleItem["type"]) => {
    switch (type) {
      case "meeting":
        return "people"
      case "deadline":
        return "alarm"
      case "event":
        return "calendar"
      default:
        return "calendar"
    }
  }

  const getTypeColor = (type: ScheduleItem["type"]) => {
    switch (type) {
      case "meeting":
        return theme.colors.primary
      case "deadline":
        return theme.colors.error
      case "event":
        return theme.colors.success
      default:
        return theme.colors.primary
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    })
  }

  const scheduleToShow = showFullSchedule
    ? BIG_COMMITTEE_SCHEDULE
    : BIG_COMMITTEE_SCHEDULE.slice(0, 3)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bid Committee Schedule</Text>
        <Text style={styles.subtitle}>
          Important meetings and deadlines for bid presentation
        </Text>
      </View>

      <ScrollView
        style={styles.scheduleList}
        showsVerticalScrollIndicator={false}
      >
        {scheduleToShow.map((item) => {
          const isExpanded = expandedItems[item.id]

          return (
            <TouchableOpacity
              key={item.id}
              style={styles.scheduleItem}
              onPress={() => toggleExpanded(item.id)}
              activeOpacity={0.7}
            >
              <View style={styles.itemHeader}>
                <View style={[styles.iconContainer, { backgroundColor: getTypeColor(item.type) + '20' }]}>
                  <Ionicons
                    name={getTypeIcon(item.type) as any}
                    size={20}
                    color={getTypeColor(item.type)}
                  />
                </View>

                <View style={styles.itemContent}>
                  <View style={styles.itemTitleRow}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <View style={[styles.typeTag, { backgroundColor: getTypeColor(item.type) }]}>
                      <Text style={styles.typeTagText}>
                        {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.itemDate}>{formatDate(item.date)}</Text>
                  <View style={styles.itemTimeRow}>
                    <Ionicons 
                      name="time-outline" 
                      size={12} 
                      color={theme.colors.text.secondary}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.itemTime}>{item.time}</Text>
                    <Text style={styles.itemTime}> • </Text>
                    <Ionicons 
                      name="location-outline" 
                      size={12} 
                      color={theme.colors.text.secondary}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.itemTime}>{item.location}</Text>
                  </View>
                </View>
              </View>

              {isExpanded && (
                <View style={styles.itemDetails}>
                  {item.description && (
                    <Text style={styles.itemDescription}>
                      {item.description}
                    </Text>
                  )}

                  {item.chair && (
                    <View style={styles.chairInfo}>
                      <Ionicons
                        name="person"
                        size={16}
                        color={theme.colors.text.secondary}
                      />
                      <Text style={styles.chairText}>Chair: {item.chair}</Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {!showAll && BIG_COMMITTEE_SCHEDULE.length > 3 && (
        <TouchableOpacity
          style={styles.showMoreButton}
          onPress={() => setShowFullSchedule(!showFullSchedule)}
        >
          <Text style={styles.showMoreText}>
            {showFullSchedule
              ? "Show Less"
              : `Show All ${BIG_COMMITTEE_SCHEDULE.length} Items`}
          </Text>
          <Ionicons
            name={showFullSchedule ? "chevron-up" : "chevron-down"}
            size={16}
            color={theme.colors.primary}
          />
        </TouchableOpacity>
      )}
    </View>
  )
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      overflow: "hidden",
      marginVertical: theme.spacing.md,
      ...theme.shadows.medium
    },
    header: {
      backgroundColor: theme.colors.primary,
      padding: theme.spacing.lg,
      marginBottom: 0
    },
    title: {
      fontSize: 20,
      fontWeight: "bold",
      color: "#FFFFFF",
      marginBottom: theme.spacing.xs
    },
    subtitle: {
      fontSize: 14,
      color: "rgba(255, 255, 255, 0.9)",
      lineHeight: 20
    },
    scheduleList: {
      padding: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      maxHeight: 400
    },
    scheduleItem: {
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border
    },
    itemHeader: {
      flexDirection: "row",
      alignItems: "flex-start"
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.background,
      justifyContent: "center",
      alignItems: "center",
      marginRight: theme.spacing.md
    },
    itemContent: {
      flex: 1
    },
    itemTitleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: theme.spacing.xs,
      flexWrap: "wrap"
    },
    itemTimeRow: {
      flexDirection: "row",
      alignItems: "center"
    },
    typeTag: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: theme.spacing.sm
    },
    typeTagText: {
      fontSize: 10,
      fontWeight: "bold",
      color: "#FFFFFF",
      textTransform: "uppercase"
    },
    itemTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.xs,
      flex: 1,
      marginRight: theme.spacing.sm
    },
    itemDate: {
      fontSize: 14,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.xs
    },
    itemTime: {
      fontSize: 12,
      color: theme.colors.text.secondary
    },
    itemDetails: {
      marginTop: theme.spacing.md,
      paddingTop: theme.spacing.md,
      marginLeft: 40 + theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border
    },
    itemDescription: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      lineHeight: 20,
      marginBottom: theme.spacing.sm
    },
    chairInfo: {
      flexDirection: "row",
      alignItems: "center"
    },
    chairText: {
      ...theme.typography.caption,
      color: theme.colors.text.secondary,
      marginLeft: theme.spacing.xs
    },
    showMoreButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      marginHorizontal: theme.spacing.lg,
      marginTop: 0,
      marginBottom: theme.spacing.md,
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.primary
    },
    showMoreText: {
      ...theme.typography.body,
      color: theme.colors.primary,
      marginRight: theme.spacing.xs
    }
  })

export default BidCommitteeSchedule
