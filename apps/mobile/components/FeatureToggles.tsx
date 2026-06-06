import { Ionicons } from "@expo/vector-icons"
import React, { useCallback, useEffect, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  Text,
  View
} from "react-native"
import { useCurrentConference } from "../context/CurrentConferenceContext"
import { useFeatures } from "../context/FeatureContext"
import { useTheme } from "../context/ThemeContext"
import { withDeviceId } from "../lib/supabase"

interface Feature {
  id: string
  name: string
  description: string
  key: string
  enabled: boolean
  icon: string
}

const DEFAULT_FEATURES: Feature[] = [
  {
    id: "1",
    name: "Child Care Services",
    key: "child_care_enabled",
    description: "Enable child care request forms and information",
    enabled: true,
    icon: "heart"
  },
  {
    id: "2",
    name: "Volunteer Sign-ups",
    key: "volunteering_enabled",
    description: "Allow attendees to sign up for volunteer positions",
    enabled: true,
    icon: "people"
  },
  {
    id: "3",
    name: "Hospitality Suite",
    key: "hospitality_enabled",
    description: "Show hospitality suite information and schedule",
    enabled: true,
    icon: "restaurant"
  },
  {
    id: "4",
    name: "Accessibility Services",
    key: "accessibility_enabled",
    description: "Enable accessibility request forms",
    enabled: true,
    icon: "accessibility"
  },
  {
    id: "5",
    name: "Support Chat",
    key: "support_chat_enabled",
    description: "Enable in-app support chat feature",
    enabled: true,
    icon: "chatbubbles"
  },
  {
    id: "6",
    name: "Bid Schedule",
    key: "bid_schedule_enabled",
    description: "Show bid presentation schedule",
    enabled: true,
    icon: "trophy"
  },
  {
    id: "7",
    name: "Schedule Sharing",
    key: "schedule_sharing_enabled",
    description: "Allow users to share their personal schedules",
    enabled: true,
    icon: "share-social"
  },
  {
    id: "8",
    name: "Push Notifications",
    key: "push_notifications_enabled",
    description: "Enable push notifications for events and updates",
    enabled: true,
    icon: "notifications"
  }
]

interface FeatureTogglesProps {
  programId?: number
}

const FeatureToggles: React.FC<FeatureTogglesProps> = ({ programId }) => {
  const { theme } = useTheme()
  const currentConference = useCurrentConference()
  const { refreshFeatures } = useFeatures()
  const activeProgramId =
    programId ||
    (currentConference.status === "active"
      ? currentConference.currentProgramId
      : null)
  const [features, setFeatures] = useState<Feature[]>(DEFAULT_FEATURES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const styles = createStyles(theme)

  const fetchFeatureSettings = useCallback(async () => {
    try {
      setLoading(true)
      if (!activeProgramId) {
        setFeatures(DEFAULT_FEATURES)
        return
      }

      const supabaseWithDeviceId = await withDeviceId()

      // Fetch feature settings from the programs table
      const { data, error } = await supabaseWithDeviceId
        .from("programs")
        .select("features")
        .eq("id", activeProgramId)
        .single()

      if (error) {
        console.error("Error fetching feature settings:", error)
        return
      }

      if (data?.features) {
        // Update features with settings from database
        setFeatures(prevFeatures =>
          prevFeatures.map(feature => ({
            ...feature,
            enabled: data.features[feature.key] ?? feature.enabled
          }))
        )
      }
    } catch (error) {
      console.error("Error fetching feature settings:", error)
      Alert.alert("Error", "Failed to load feature settings")
    } finally {
      setLoading(false)
    }
  }, [activeProgramId])

  useEffect(() => {
    fetchFeatureSettings()
  }, [fetchFeatureSettings])

  const toggleFeature = async (featureKey: string) => {
    try {
      setSaving(true)
      if (!activeProgramId) {
        Alert.alert("Error", "No active conference program is selected")
        return
      }

      // Find the feature
      const feature = features.find(f => f.key === featureKey)
      if (!feature) return

      const newValue = !feature.enabled

      // Optimistically update UI
      setFeatures(prevFeatures =>
        prevFeatures.map(f =>
          f.key === featureKey ? { ...f, enabled: newValue } : f
        )
      )

      const supabaseWithDeviceId = await withDeviceId()

      // Get current features from database
      const { data: current, error: fetchError } = await supabaseWithDeviceId
        .from("programs")
        .select("features")
        .eq("id", activeProgramId)
        .single()

      if (fetchError) throw fetchError

      // Update features object
      const updatedFeatures = {
        ...(current?.features || {}),
        [featureKey]: newValue
      }

      // Update in database
      const { error: updateError } = await supabaseWithDeviceId
        .from("programs")
        .update({ features: updatedFeatures })
        .eq("id", activeProgramId)

      if (updateError) throw updateError

      // Trigger refresh of features across the app
      await refreshFeatures()

    } catch (error) {
      console.error("Error updating feature setting:", error)
      
      // Revert the optimistic update
      setFeatures(prevFeatures =>
        prevFeatures.map(f =>
          f.key === featureKey ? { ...f, enabled: !f.enabled } : f
        )
      )

      Alert.alert("Error", "Failed to update feature setting")
    } finally {
      setSaving(false)
    }
  }

  const getCriticalFeatures = () => 
    features.filter(f => 
      ["child_care_enabled", "accessibility_enabled", "support_chat_enabled"].includes(f.key)
    )

  const getEngagementFeatures = () =>
    features.filter(f =>
      ["volunteering_enabled", "schedule_sharing_enabled", "push_notifications_enabled"].includes(f.key)
    )

  const getInformationalFeatures = () =>
    features.filter(f =>
      ["hospitality_enabled", "bid_schedule_enabled"].includes(f.key)
    )

  const renderFeatureGroup = (title: string, features: Feature[]) => (
    <View style={styles.featureGroup}>
      <Text style={styles.groupTitle}>{title}</Text>
      {features.map(feature => (
        <View key={feature.id} style={styles.featureItem}>
          <View style={styles.featureInfo}>
            <View style={styles.featureHeader}>
              <Ionicons
                name={feature.icon as any}
                size={20}
                color={theme.colors.primary}
                style={styles.featureIcon}
              />
              <Text style={styles.featureName}>{feature.name}</Text>
            </View>
            <Text style={styles.featureDescription}>{feature.description}</Text>
          </View>
          <Switch
            value={feature.enabled}
            onValueChange={() => toggleFeature(feature.key)}
            trackColor={{ false: "#767577", true: theme.colors.primary }}
            thumbColor={feature.enabled ? "#f4f3f4" : "#f4f3f4"}
            disabled={saving}
          />
        </View>
      ))}
    </View>
  )

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {renderFeatureGroup("Critical Services", getCriticalFeatures())}
      {renderFeatureGroup("Engagement Features", getEngagementFeatures())}
      {renderFeatureGroup("Information Features", getInformationalFeatures())}

      {saving && (
        <View style={styles.savingIndicator}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.savingText}>Saving changes...</Text>
        </View>
      )}
    </View>
  )
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1
    },
    featureGroup: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.lg,
      ...theme.shadows.small
    },
    groupTitle: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      fontWeight: "bold",
      textTransform: "uppercase",
      marginBottom: theme.spacing.md,
      fontSize: 12
    },
    featureItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border
    },
    featureInfo: {
      flex: 1,
      marginRight: theme.spacing.md
    },
    featureHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.spacing.xs
    },
    featureIcon: {
      marginRight: theme.spacing.sm
    },
    featureName: {
      ...theme.typography.body,
      color: theme.colors.text.primary,
      fontWeight: "600"
    },
    featureDescription: {
      ...theme.typography.caption,
      color: theme.colors.text.secondary,
      lineHeight: 18,
      marginLeft: theme.spacing.lg + 8 // Align with text after icon
    },
    savingIndicator: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      padding: theme.spacing.md,
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.sm,
      marginTop: theme.spacing.md
    },
    savingText: {
      ...theme.typography.caption,
      color: theme.colors.text.secondary,
      marginLeft: theme.spacing.sm
    }
  })

export default FeatureToggles
