import { Ionicons } from "@expo/vector-icons"
import { Link, useRouter } from "expo-router"
import React, { useEffect, useState } from "react"
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native"
import { useFeatures } from "../../../context/FeatureContext"
import { useTheme } from "../../../context/ThemeContext"
import { getStoredProgram } from "../../../lib/theme"
import { Program } from "../../../types/program"
import { supabase } from "../../../lib/supabase"

// Service section type
type ServiceSection = {
  id: string
  title: string
  description: string
  icon: string
  route: `/(tabs)/services/${string}`
}

export default function Services() {
  const { theme } = useTheme()
  const { isFeatureEnabled } = useFeatures()
  const styles = createStyles(theme)
  const router = useRouter()
  const [program, setProgram] = useState<Program | null>(null)
  const [isHostAuthenticated, setIsHostAuthenticated] = useState(false)

  useEffect(() => {
    const loadProgram = async () => {
      const storedProgram = await getStoredProgram()
      if (storedProgram) {
        setProgram(storedProgram)
      }
    }

    const checkAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        setIsHostAuthenticated(!!data.session)
      } catch (error) {
        console.error("Error checking auth:", error)
        setIsHostAuthenticated(false)
      }
    }

    loadProgram()
    checkAuth()

    // Set up auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setIsHostAuthenticated(!!session)
      }
    )

    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe()
      }
    }
  }, [])

  // Service sections data with dynamic content from program if available
  const getAllServiceItems = () => [
    ...(isFeatureEnabled("accessibility_enabled") ? [{
      id: "accessibility",
      title:
        program?.content?.services?.accessibility?.title ||
        "Request Accessibility Assistance",
      description:
        program?.content?.services?.accessibility?.description ||
        "Need physical assistance, ASL interpreter, or language translator? Let us help make your conference experience accessible.",
      icon: "accessibility-outline" as const,
      route: "/(tabs)/services/accessibility"
    }] : []),
    ...(isFeatureEnabled("child_care_enabled") ? [{
      id: "childcare",
      title: "Request Childcare Services",
      description:
        "Need childcare during conference events? Submit a request and we'll help coordinate safe, supervised care for your children.",
      icon: "heart-outline" as const,
      route: "/(tabs)/services/childcare"
    }] : [])
  ]

  const getVolunteerServiceItems = () => [
    ...(isFeatureEnabled("volunteering_enabled") ? [{
      id: "volunteer",
      title:
        program?.content?.services?.volunteering?.title ||
        "Volunteer at Conference",
      description:
        program?.content?.services?.volunteering?.description ||
        "Help make ICYPAA happen! Sign up for greeting, setup, cleanup, or other service opportunities.",
      icon: "people-outline" as const,
      route: "/(tabs)/services/volunteer"
    }] : []),
    ...(isFeatureEnabled("hospitality_enabled") ? [{
      id: "hospitality",
      title:
        program?.content?.services?.hospitality?.title ||
        "Hospitality Updates",
      description:
        program?.content?.services?.hospitality?.description ||
        "Let everyone know when you're bringing food or supplies to the hospitality suite!",
      icon: "restaurant-outline" as const,
      route: "/(tabs)/services/hospitality"
    }] : [])
  ]

  const getOtherServiceItems = () => [
    ...(isFeatureEnabled("support_chat_enabled") ? [{
      id: "support",
      title: program?.content?.services?.support?.title || "Support Chat",
      description:
        program?.content?.services?.support?.description ||
        "Need help? Start a chat with our support team.",
      icon: "chatbubbles-outline" as const,
      route: "/(tabs)/services/support"
    }] : [])
  ]

  const serviceSections = {
    help: {
      title: "How can we help?",
      items: getAllServiceItems()
    },
    volunteer: {
      title: "If you want to help us",
      items: getVolunteerServiceItems()
    },
    other: {
      title: "Other",
      items: getOtherServiceItems()
    }
  }

  // Service section component
  const ServiceSection = ({
    title,
    items
  }: {
    title: string
    items: ServiceSection[]
  }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item) => (
        <Link key={item.id} href={item.route} asChild>
          <TouchableOpacity
            style={styles.card}
            testID={`service-card-${item.id}`}
            accessibilityLabel={item.title}
          >
            <View style={styles.cardHeader}>
              <Ionicons
                name={item.icon as any}
                size={24}
                color={theme.colors.primary}
              />
              <Text style={styles.cardTitle}>{item.title}</Text>
            </View>
            <Text style={styles.cardDescription}>{item.description}</Text>
          </TouchableOpacity>
        </Link>
      ))}
    </View>
  )

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Services</Text>
      {Object.entries(serviceSections)
        .filter(([key, section]) => section.items.length > 0)
        .map(([key, section]) => (
          <ServiceSection
            key={key}
            title={section.title}
            items={section.items as ServiceSection[]}
          />
        ))}

      {/* FAQ Section - New */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        {program?.content?.faq?.map((item: any, index: number) => (
          <View key={index} style={styles.faqItem}>
            <Text style={styles.faqQuestion}>{item.question}</Text>
            <Text style={styles.faqAnswer}>{item.answer}</Text>
          </View>
        ))}
      </View>

      {/* Host Committee Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Host Committee</Text>
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push(isHostAuthenticated ? "/host" : "/host/login")}
        >
          <View style={styles.cardHeader}>
            <Ionicons
              name="shield"
              size={24}
              color={theme.colors.primary}
            />
            <Text style={styles.cardTitle}>Host Dashboard</Text>
          </View>
          <Text style={styles.cardDescription}>
            {isHostAuthenticated 
              ? "Access host committee tools, service requests, and manage conference operations."
              : "Sign in to access host committee tools and manage conference operations."}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: theme.spacing.lg
    },
    title: {
      ...theme.typography.h1,
      marginBottom: theme.spacing.xl,
      color: theme.colors.text.primary,
      fontWeight: "bold"
    },
    section: {
      marginBottom: theme.spacing.xl
    },
    sectionTitle: {
      ...theme.typography.h2,
      marginBottom: theme.spacing.lg,
      color: theme.colors.text.primary,
      fontWeight: "bold"
    },
    card: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.lg,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.md,
      ...theme.shadows.small
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.spacing.sm
    },
    cardTitle: {
      ...theme.typography.h2,
      marginLeft: theme.spacing.md,
      color: theme.colors.text.primary,
      fontWeight: "bold"
    },
    cardDescription: {
      ...theme.typography.body,
      color: theme.colors.text.secondary
    },
    faqItem: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.lg,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.md,
      ...theme.shadows.small
    },
    faqQuestion: {
      fontSize: 18,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.sm,
      fontWeight: "bold"
    },
    faqAnswer: {
      ...theme.typography.body,
      color: theme.colors.text.secondary
    },
    contactCard: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.lg,
      borderRadius: theme.borderRadius.md,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.md,
      ...theme.shadows.small
    },
    contactInfo: {
      marginTop: theme.spacing.md
    },
    contactMethod: {
      ...theme.typography.body,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.sm
    }
  })
