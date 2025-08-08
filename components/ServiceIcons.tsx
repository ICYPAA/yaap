import { Ionicons } from "@expo/vector-icons"
import React from "react"
import { StyleSheet, View } from "react-native"
import { Event } from "../types/program"

interface ServiceIconsProps {
  event: Event
  theme: any
  size?: number
  spacing?: number
}

const ServiceIcons: React.FC<ServiceIconsProps> = ({
  event,
  theme,
  size = 16,
  spacing = 4
}) => {
  if (!event.services) return null

  const icons = []

  // ASL Interpretation
  if (event.services.asl) {
    icons.push({
      key: "asl",
      name: "hand-left" as const,
      color: theme.colors.success
    })
  }

  // Language Services - using different icons for different languages
  if (event.services.spanish) {
    icons.push({
      key: "spanish",
      name: "language" as const,
      color: theme.colors.warning
    })
  }

  if (event.services.french) {
    icons.push({
      key: "french",
      name: "language" as const,
      color: theme.colors.info
    })
  }

  if (event.services.hmong) {
    icons.push({
      key: "hmong",
      name: "language" as const,
      color: theme.colors.secondary
    })
  }

  if (event.services.somali) {
    icons.push({
      key: "somali",
      name: "language" as const,
      color: theme.colors.accent
    })
  }

  // Hybrid Meeting
  if (event.services.hybrid) {
    icons.push({
      key: "hybrid",
      name: "videocam" as const,
      color: theme.colors.primary
    })
  }

  // Childcare
  if (event.services.childcare) {
    icons.push({
      key: "childcare",
      name: "heart" as const,
      color: theme.colors.error
    })
  }

  // Wheelchair Accessible
  if (event.services.wheelchair) {
    icons.push({
      key: "wheelchair",
      name: "accessibility" as const,
      color: theme.colors.primary
    })
  }

  if (icons.length === 0) return null

  const styles = createStyles(spacing)

  return (
    <View style={styles.container}>
      {icons.map((icon) => (
        <View key={icon.key} style={styles.iconWrapper}>
          <Ionicons name={icon.name} size={size} color={icon.color} />
        </View>
      ))}
    </View>
  )
}

const createStyles = (spacing: number) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap"
    },
    iconWrapper: {
      marginRight: spacing,
      marginBottom: spacing / 2
    }
  })

export default ServiceIcons
