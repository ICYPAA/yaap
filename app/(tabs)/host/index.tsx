import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import React, { useEffect, useState } from "react"
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native"
import { useTheme } from "../../../context/ThemeContext"
import { supabase } from "../../../lib/supabase"

type ServiceSection = {
  title: string
  route: string
  count: number
  icon: React.ComponentProps<typeof Ionicons>["name"]
}

export default function HostDashboard() {
  const router = useRouter()
  const { theme, isDarkMode } = useTheme()
  const [user, setUser] = useState<any>(null)
  const [serviceSections, setServiceSections] = useState<ServiceSection[]>([
    {
      title: "Accessibility Requests",
      route: "accessibility",
      count: 0,
      icon: "accessibility"
    },
    { title: "Ride Requests", route: "rides", count: 0, icon: "car" },
    {
      title: "Volunteer Sign-ups",
      route: "volunteers",
      count: 0,
      icon: "people"
    },
    {
      title: "Hospitality Notifications",
      route: "hospitality",
      count: 0,
      icon: "restaurant"
    },
    { title: "Support Chats", route: "support", count: 0, icon: "chatbubbles" }
  ])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUserProfile()
    fetchPendingCounts()
  }, [])

  const fetchUserProfile = async () => {
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()

        setUser({ ...user, profile })
      }
    } catch (error) {
      console.error("Error fetching user profile:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingCounts = async () => {
    try {
      // Fetch counts for each service type
      const [
        { count: accessibilityCount },
        { count: ridesCount },
        { count: volunteersCount },
        { count: hospitalityCount },
        { count: supportCount }
      ] = await Promise.all([
        supabase
          .from("accessibility_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("ride_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("volunteer_signups")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("hospitality_notifications")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("support_chats")
          .select("*", { count: "exact", head: true })
          .eq("status", "unread")
      ])

      setServiceSections((prev) => [
        { ...prev[0], count: accessibilityCount || 0 },
        { ...prev[1], count: ridesCount || 0 },
        { ...prev[2], count: volunteersCount || 0 },
        { ...prev[3], count: hospitalityCount || 0 },
        { ...prev[4], count: supportCount || 0 }
      ])
    } catch (error) {
      console.error("Error fetching pending counts:", error)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace("/services/host")
  }

  const navigateToService = (route: string) => {
    router.push(`/host/${route}` as any)
  }

  if (loading) {
    return (
      <View style={styles(theme).container}>
        <Text style={styles(theme).loadingText}>Loading...</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles(theme).container}>
      <View style={styles(theme).header}>
        <View>
          <Text style={styles(theme).title}>Host Dashboard</Text>
          {user && (
            <Text style={styles(theme).userInfo}>
              Logged in as: {user.profile?.full_name || user.email}
            </Text>
          )}
        </View>
      </View>

      <ScrollView style={styles(theme).scrollContainer}>
        <View style={styles(theme).servicesContainer}>
          {serviceSections.map((section, index) => (
            <TouchableOpacity
              key={index}
              style={styles(theme).serviceCard}
              onPress={() => navigateToService(section.route)}
            >
              <View style={styles(theme).serviceCardContent}>
                <View style={styles(theme).iconContainer}>
                  <Ionicons
                    name={section.icon}
                    size={24}
                    color={theme.colors.background}
                  />
                </View>
                <Text style={styles(theme).serviceTitle}>{section.title}</Text>
              </View>
              <View style={styles(theme).countContainer}>
                <Text style={styles(theme).countText}>{section.count}</Text>
                <Text style={styles(theme).pendingText}>pending</Text>
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles(theme).logoutCard}
            onPress={handleLogout}
          >
            <View style={styles(theme).serviceCardContent}>
              <View style={styles(theme).iconContainer}>
                <Ionicons
                  name="log-out-outline"
                  size={24}
                  color={theme.colors.background}
                />
              </View>
              <Text style={styles(theme).serviceTitle}>Logout</Text>
            </View>
          </TouchableOpacity>
        </View>
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
    loadingText: {
      ...theme.typography.body,
      color: theme.colors.text.primary,
      textAlign: "center",
      marginTop: theme.spacing.xl
    },
    scrollContainer: {
      flex: 1
    },
    header: {
      padding: theme.spacing.md,
      backgroundColor: theme.colors.primary
    },
    title: {
      ...theme.typography.h1,
      color: theme.colors.background,
      fontWeight: "bold"
    },
    userInfo: {
      ...theme.typography.caption,
      color: theme.colors.background,
      marginTop: theme.spacing.xs,
      opacity: 0.9
    },
    servicesContainer: {
      padding: theme.spacing.md
    },
    serviceCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.sm,
      marginBottom: theme.spacing.md,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      ...theme.shadows.small
    },
    logoutCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginTop: theme.spacing.md,
      flexDirection: "row",
      alignItems: "center",
      ...theme.shadows.small
    },
    serviceCardContent: {
      flexDirection: "row",
      alignItems: "center"
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.primary,
      justifyContent: "center",
      alignItems: "center",
      marginRight: theme.spacing.sm
    },
    serviceTitle: {
      ...theme.typography.body,
      color: theme.colors.text.primary,
      fontWeight: "500"
    },
    countContainer: {
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      padding: theme.spacing.md,
      alignItems: "center",
      minWidth: 70
    },
    countText: {
      ...theme.typography.h3,
      color: theme.colors.primary,
      fontWeight: "bold"
    },
    pendingText: {
      ...theme.typography.caption,
      color: theme.colors.text.secondary
    }
  })
