import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import React from "react"
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native"
import FeatureToggles from "../../../components/FeatureToggles"
import { useTheme } from "../../../context/ThemeContext"
import { getTextColorForBackground } from "../../../lib/theme"

export default function FeaturesPage() {
  const { theme } = useTheme()
  const router = useRouter()

  const handleBack = () => {
    router.back()
  }

  return (
    <SafeAreaView style={styles(theme).container}>
      <View style={styles(theme).header}>
        <TouchableOpacity onPress={handleBack} style={styles(theme).backButton}>
          <Ionicons
            name="arrow-back"
            size={24}
            color={getTextColorForBackground(theme.colors.primary)}
          />
        </TouchableOpacity>
        <Text style={styles(theme).title}>Feature Management</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles(theme).scrollContainer}>
        <View style={styles(theme).infoCard}>
          <Text style={styles(theme).infoTitle}>About Feature Management</Text>
          <Text style={styles(theme).infoText}>
            Control which features are available to attendees in the app. 
            Disabling a feature will hide it from all users immediately.
          </Text>
          <Text style={styles(theme).infoText}>
            Changes are saved automatically and take effect immediately across all devices.
          </Text>
        </View>

        <FeatureToggles programId={3} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing.md,
      backgroundColor: theme.colors.primary
    },
    backButton: {
      padding: theme.spacing.sm
    },
    title: {
      fontSize: 20,
      fontWeight: "bold",
      color: getTextColorForBackground(theme.colors.primary)
    },
    scrollContainer: {
      flex: 1,
      padding: theme.spacing.md
    },
    infoCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.md,
      ...theme.shadows.small
    },
    infoTitle: {
      ...theme.typography.h2,
      color: theme.colors.text.primary,
      fontWeight: "bold",
      marginBottom: theme.spacing.md
    },
    infoText: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      lineHeight: 20,
      marginBottom: theme.spacing.sm
    }
  })