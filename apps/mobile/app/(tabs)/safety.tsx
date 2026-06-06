import { Ionicons } from "@expo/vector-icons"
import React, { useCallback, useEffect, useState } from "react"
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native"
import { useCurrentConference } from "../../context/CurrentConferenceContext"
import { useTheme } from "../../context/ThemeContext"
import { withDeviceId } from "../../lib/supabase"

interface NDAHContent {
  safety_statement?: string // Note: keeping the typo to match database
  anti_harassment_short?: string
  anti_discrimination_short?: string
  ndah_link?: string
  report_crime?: {
    info?: string
    emergency_number?: string
    non_emergency_number?: string
  }
  committee_contact?: {
    info?: string
    contact?: string
  }
}

export default function Safety() {
  const { theme } = useTheme()
  const currentConference = useCurrentConference()
  const styles = createStyles(theme)
  const programId =
    currentConference.status === "active"
      ? currentConference.currentProgramId
      : null
  const [ndahContent, setNdahContent] = useState<NDAHContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [policyExpanded, setPolicyExpanded] = useState(true)

  const fetchNDAHContent = useCallback(async () => {
    try {
      if (!programId) {
        setNdahContent(null)
        return
      }

      const supabaseWithDeviceId = await withDeviceId()
      const { data, error } = await supabaseWithDeviceId
        .from("programs")
        .select("ndah_content")
        .eq("id", programId)
        .single()

      if (error) {
        console.error("Error fetching NDAH content:", error)
      } else if (data?.ndah_content) {
        setNdahContent(data.ndah_content)
      }
    } catch (error) {
      console.error("Error in fetchNDAHContent:", error)
    } finally {
      setLoading(false)
    }
  }, [programId])

  useEffect(() => {
    fetchNDAHContent()
  }, [fetchNDAHContent])

  const openPolicyLink = () => {
    const link = ndahContent?.ndah_link || "https://icypaa.org/ndahp.pdf"
    Linking.openURL(link)
  }

  const openPhoneNumber = (number: string) => {
    const phoneUrl = `tel:${number.replace(/\D/g, "")}`
    Linking.openURL(phoneUrl)
  }

  const openEmail = (email: string) => {
    const emailUrl = `mailto:${email}`
    Linking.openURL(emailUrl)
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons
          name="shield-checkmark"
          size={64}
          color={theme.colors.primary}
        />
        <Text style={styles.title}>Safety</Text>
      </View>

      {/* Collapsible Policy Section */}
      <TouchableOpacity
        style={styles.collapsibleHeader}
        onPress={() => setPolicyExpanded(!policyExpanded)}
        activeOpacity={0.7}
      >
        <Text style={styles.collapsibleTitle}>
          Non-Discrimination and Anti-Harassment Policies
        </Text>
        <Ionicons
          name={policyExpanded ? "chevron-up" : "chevron-down"}
          size={24}
          color={theme.colors.text.primary}
        />
      </TouchableOpacity>

      {policyExpanded && (
        <View>
          {ndahContent?.safety_statement && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Statement of Safety</Text>
              <Text style={styles.bodyText}>
                {ndahContent.safety_statement}
              </Text>
            </View>
          )}

          {ndahContent?.anti_harassment_short && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Anti-Harassment Policy</Text>
              <Text style={styles.bodyText}>
                {ndahContent.anti_harassment_short}
              </Text>
            </View>
          )}

          {ndahContent?.anti_discrimination_short && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Anti-Discrimination Policy
              </Text>
              <Text style={styles.bodyText}>
                {ndahContent.anti_discrimination_short}
              </Text>
            </View>
          )}
        </View>
      )}

      {ndahContent?.ndah_link && (
        <TouchableOpacity style={styles.linkButton} onPress={openPolicyLink}>
          <Text style={styles.linkText}>View full NDAH Policy (PDF)</Text>
        </TouchableOpacity>
      )}

      {/* How to Report Section */}
      {(ndahContent?.report_crime || ndahContent?.committee_contact) && (
        <View style={styles.section}>
          <Text style={styles.mainSectionTitle}>How to Report</Text>
        </View>
      )}

      {ndahContent?.report_crime &&
        (ndahContent.report_crime.info ||
          ndahContent.report_crime.emergency_number ||
          ndahContent.report_crime.non_emergency_number) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Report a Crime</Text>
            {ndahContent.report_crime.info && (
              <Text style={styles.bodyText}>
                {ndahContent.report_crime.info}
              </Text>
            )}
            {ndahContent.report_crime.emergency_number && (
              <TouchableOpacity
                onPress={() =>
                  openPhoneNumber(ndahContent.report_crime!.emergency_number!)
                }
                style={styles.contactButton}
              >
                <Ionicons
                  name="call-outline"
                  size={20}
                  color={theme.colors.primary}
                  style={styles.contactIcon}
                />
                <Text style={styles.contactText}>
                  Emergency: {ndahContent.report_crime.emergency_number}
                </Text>
              </TouchableOpacity>
            )}
            {ndahContent.report_crime.non_emergency_number && (
              <TouchableOpacity
                onPress={() =>
                  openPhoneNumber(
                    ndahContent.report_crime!.non_emergency_number!
                  )
                }
                style={styles.contactButton}
              >
                <Ionicons
                  name="call-outline"
                  size={20}
                  color={theme.colors.primary}
                  style={styles.contactIcon}
                />
                <Text style={styles.contactText}>
                  Non-Emergency: {ndahContent.report_crime.non_emergency_number}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

      {ndahContent?.committee_contact &&
        (ndahContent.committee_contact.info ||
          ndahContent.committee_contact.contact) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Report a violation of ICYPAA's NDAH Policy
            </Text>
            {ndahContent.committee_contact.info && (
              <Text style={styles.bodyText}>
                {ndahContent.committee_contact.info}
              </Text>
            )}
            {ndahContent.committee_contact.contact && (
              <TouchableOpacity
                onPress={() =>
                  openEmail(ndahContent.committee_contact!.contact!)
                }
                style={styles.contactButton}
              >
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={theme.colors.primary}
                  style={styles.contactIcon}
                />
                <Text style={styles.contactText}>
                  {ndahContent.committee_contact.contact}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
    </ScrollView>
  )
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.background
    },
    header: {
      alignItems: "center",
      paddingTop: theme.spacing.xl,
      paddingBottom: theme.spacing.lg
    },
    title: {
      ...theme.typography.h1,
      marginTop: theme.spacing.md,
      color: theme.colors.text.primary,
      fontWeight: "bold"
    },
    collapsibleHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      marginHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.md,
      borderRadius: theme.borderRadius.md
    },
    collapsibleTitle: {
      ...theme.typography.h2,
      fontWeight: "600",
      color: theme.colors.text.primary
    },
    section: {
      paddingHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.xl
    },
    mainSectionTitle: {
      ...theme.typography.h1,
      fontWeight: "700",
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.md,
      fontSize: 24
    },
    sectionTitle: {
      ...theme.typography.h2,
      fontWeight: "600",
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.md
    },
    bodyText: {
      ...theme.typography.body,
      lineHeight: 22,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing.md
    },
    italicText: {
      ...theme.typography.body,
      fontStyle: "italic",
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing.md
    },
    linkButton: {
      marginHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.xl
    },
    linkText: {
      color: theme.colors.primary,
      fontSize: 16,
      textDecorationLine: "underline"
    },
    contactButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      marginTop: theme.spacing.sm
    },
    contactIcon: {
      marginRight: theme.spacing.sm
    },
    contactText: {
      color: theme.colors.primary,
      fontSize: 16,
      textDecorationLine: "underline"
    }
  })
