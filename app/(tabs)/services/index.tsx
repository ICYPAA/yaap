import { Ionicons } from "@expo/vector-icons"
import { Link } from "expo-router"
import React, { useEffect, useState } from "react"
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native"
import { useTheme } from "../../../context/ThemeContext"
import { getStoredProgram } from "../../../lib/theme"
import { Program } from "../../../types/program"

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
  const styles = createStyles(theme)
  const [program, setProgram] = useState<Program | null>(null)

  useEffect(() => {
    const loadProgram = async () => {
      const storedProgram = await getStoredProgram()
      if (storedProgram) {
        setProgram(storedProgram)
      }
    }

    loadProgram()
  }, [])

  // Service sections data with dynamic content from program if available
  const serviceSections = {
    help: {
      title: "How can we help?",
      items: [
        {
          id: "accessibility",
          title:
            program?.content?.services?.accessibility?.title ||
            "Request Accessibility Assistance",
          description:
            program?.content?.services?.accessibility?.description ||
            "Need physical assistance, ASL interpreter, or language translator? Let us help make your conference experience accessible.",
          icon: "accessibility-outline" as const,
          route: "/(tabs)/services/accessibility"
        },
        {
          id: "ride",
          title: program?.content?.services?.rides?.title || "Request a Ride",
          description:
            program?.content?.services?.rides?.description ||
            "Need a ride within 30 miles of the conference? Connect with local members offering rides.",
          icon: "car-outline" as const,
          route: "/(tabs)/services/ride"
        }
      ]
    },
    volunteer: {
      title: "If you want to help us",
      items: [
        {
          id: "volunteer",
          title:
            program?.content?.services?.volunteering?.title ||
            "Volunteer at Conference",
          description:
            program?.content?.services?.volunteering?.description ||
            "Help make ICYPAA happen! Sign up for greeting, setup, cleanup, or other service opportunities.",
          icon: "people-outline" as const,
          route: "/(tabs)/services/volunteer"
        },
        {
          id: "hospitality",
          title:
            program?.content?.services?.hospitality?.title ||
            "Hospitality Updates",
          description:
            program?.content?.services?.hospitality?.description ||
            "Let everyone know when you're bringing food or supplies to the hospitality suite!",
          icon: "restaurant-outline" as const,
          route: "/(tabs)/services/hospitality"
        }
      ]
    },
    other: {
      title: "Other",
      items: [
        {
          id: "support",
          title: program?.content?.services?.support?.title || "Support Chat",
          description:
            program?.content?.services?.support?.description ||
            "Need help? Start a chat with our support team.",
          icon: "chatbubbles-outline" as const,
          route: "/(tabs)/services/support"
        }
      ]
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
          <TouchableOpacity style={styles.card}>
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
      {Object.entries(serviceSections).map(([key, section]) => (
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
