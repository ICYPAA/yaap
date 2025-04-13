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
import { useDebug } from "../../../context/DebugContext"
import { useTheme } from "../../../context/ThemeContext"
import { makeCountRequest, makeRequest } from "../../../lib/requestHelper"
import { supabase } from "../../../lib/supabase"
import { getTextColorForBackground } from "../../../lib/theme"

type ServiceSection = {
  title: string
  route: string
  count: number
  icon: React.ComponentProps<typeof Ionicons>["name"]
}

interface UserProfile {
  id: string
  full_name?: string
  email?: string
}

export default function HostDashboard() {
  const router = useRouter()
  const { theme, isDarkMode } = useTheme()
  const { isDebugMode } = useDebug()
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
      // For the auth call, we still use supabase directly (could be modified to support debug in future)
      const {
        data: { user }
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await makeRequest({
          table: "profiles",
          isDebugMode,
          query: () =>
            supabase.from("profiles").select("*").eq("id", user.id).single()
        })

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
      // Fetch counts for each service type using makeCountRequest
      const [
        { count: accessibilityCount },
        { count: ridesCount },
        { count: volunteersCount },
        { count: hospitalityCount },
        { count: supportCount }
      ] = await Promise.all([
        makeCountRequest({
          table: "accessibility_forms",
          isDebugMode,
          query: () =>
            supabase
              .from("accessibility_forms")
              .select("*", { count: "exact", head: true })
              .eq("program_id", 1)
              .or("status.is.null,status.eq.pending,status.eq.in_progress")
        }),
        makeCountRequest({
          table: "ride_forms",
          isDebugMode,
          query: () =>
            supabase
              .from("ride_forms")
              .select("*", { count: "exact", head: true })
              .eq("program_id", 1)
              .or("status.is.null,status.eq.pending,status.eq.in_progress")
        }),
        makeCountRequest({
          table: "volunteering_interest",
          isDebugMode,
          query: () =>
            supabase
              .from("volunteering_interest")
              .select("*", { count: "exact", head: true })
              .eq("program_id", 1)
              .or("status.is.null,status.eq.pending,status.eq.in_progress")
        }),
        makeCountRequest({
          table: "hospitality_forms",
          isDebugMode,
          query: () =>
            supabase
              .from("hospitality_forms")
              .select("*", { count: "exact", head: true })
              .eq("program_id", 1)
              .or("status.is.null,status.eq.pending,status.eq.in_progress")
        }),
        makeCountRequest({
          table: "support_chats",
          isDebugMode,
          query: () =>
            supabase
              .from("support_chats")
              .select("*", { count: "exact", head: true })
              .eq("program_id", 1)
        })
      ])

      console.log("Counts fetched:", {
        accessibility: accessibilityCount,
        rides: ridesCount,
        volunteers: volunteersCount,
        hospitality: hospitalityCount,
        support: supportCount
      })

      // Force some dummy values for debug display if all counts are 0
      const counts = [
        accessibilityCount || (isDebugMode ? 2 : 0),
        ridesCount || (isDebugMode ? 3 : 0),
        volunteersCount || (isDebugMode ? 5 : 0),
        hospitalityCount || (isDebugMode ? 1 : 0),
        supportCount || (isDebugMode ? 4 : 0)
      ]

      setServiceSections((prev) => [
        { ...prev[0], count: counts[0] },
        { ...prev[1], count: counts[1] },
        { ...prev[2], count: counts[2] },
        { ...prev[3], count: counts[3] },
        { ...prev[4], count: counts[4] }
      ])
    } catch (error) {
      console.error("Error fetching pending counts:", error)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace("/host/login" as any)
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
        <View style={styles(theme).headerContent}>
          <Text style={styles(theme).title}>Host Dashboard</Text>
          {user && (
            <Text style={styles(theme).userInfo}>
              Logged in as: {user.profile?.full_name || user.email}
            </Text>
          )}
        </View>
        {isDebugMode && (
          <View style={styles(theme).debugBadge}>
            <Text style={styles(theme).debugText}>DEBUG</Text>
          </View>
        )}
      </View>

      <ScrollView style={styles(theme).scrollContainer}>
        <View style={styles(theme).servicesContainer}>
          {serviceSections.map((service) => (
            <TouchableOpacity
              key={service.route}
              style={styles(theme).serviceCard}
              onPress={() => navigateToService(service.route)}
            >
              <View style={styles(theme).serviceCardContent}>
                <View
                  style={[
                    styles(theme).serviceIconContainer,
                    { backgroundColor: theme.colors.primary }
                  ]}
                >
                  <Ionicons
                    name={service.icon}
                    size={28}
                    color={getTextColorForBackground(theme.colors.primary)}
                  />
                </View>
                <View style={styles(theme).serviceTextContainer}>
                  <Text style={styles(theme).serviceTitle}>
                    {service.title}
                  </Text>
                  <Text style={styles(theme).serviceSubtitle}>
                    {service.count} {service.count === 1 ? "item" : "items"} to
                    handle
                  </Text>
                </View>
              </View>
              <View style={styles(theme).serviceCardAction}>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.colors.text.secondary}
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles(theme).logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles(theme).logoutButtonText}>Logout</Text>
          <Ionicons
            name="log-out-outline"
            size={20}
            color={getTextColorForBackground(theme.colors.error)}
          />
        </TouchableOpacity>
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
    headerContent: {
      flex: 1
    },
    title: {
      fontSize: 24,
      fontWeight: "bold",
      color: getTextColorForBackground(theme.colors.primary),
      marginBottom: 4
    },
    userInfo: {
      fontSize: 14,
      color: getTextColorForBackground(theme.colors.primary),
      opacity: 0.8
    },
    debugBadge: {
      backgroundColor: theme.colors.error,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.borderRadius.md
    },
    debugText: {
      color: getTextColorForBackground(theme.colors.error),
      fontSize: 12,
      fontWeight: "bold"
    },
    loadingText: {
      color: theme.colors.text.primary,
      fontSize: 16,
      textAlign: "center",
      marginTop: 20
    },
    scrollContainer: {
      flex: 1,
      padding: theme.spacing.md
    },
    servicesContainer: {
      gap: theme.spacing.md
    },
    serviceCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      ...theme.shadows.small
    },
    serviceCardContent: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1
    },
    serviceIconContainer: {
      width: 50,
      height: 50,
      borderRadius: 25,
      justifyContent: "center",
      alignItems: "center",
      marginRight: theme.spacing.md
    },
    serviceTextContainer: {
      flex: 1
    },
    serviceTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text.primary,
      marginBottom: 2
    },
    serviceSubtitle: {
      fontSize: 14,
      color: theme.colors.text.secondary
    },
    serviceCardAction: {
      marginLeft: theme.spacing.sm
    },
    countBadge: {
      minWidth: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.error,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 6
    },
    countText: {
      color: getTextColorForBackground(theme.colors.error),
      fontSize: 12,
      fontWeight: "bold"
    },
    logoutButton: {
      marginTop: theme.spacing.xl,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.error,
      borderRadius: theme.borderRadius.md,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center"
    },
    logoutButtonText: {
      color: getTextColorForBackground(theme.colors.error),
      fontSize: 16,
      fontWeight: "600",
      marginRight: theme.spacing.sm
    }
  })
