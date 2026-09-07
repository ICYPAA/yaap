import { Ionicons } from "@expo/vector-icons"
import { Redirect, Tabs, usePathname, router } from "expo-router"
import React from "react"
import { TouchableOpacity } from "react-native"
import { useTheme } from "../../context/ThemeContext"

import { useCurrentConference } from "../../context/CurrentConferenceContext"

export default function TabLayout() {
  const { theme } = useTheme()
  const { status } = useCurrentConference()
  const pathname = usePathname()
  if (status !== "active" && !pathname.startsWith("/host")) return <Redirect href="/" />

  return (
    <Tabs
      initialRouteName="program"
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.text.secondary,
        tabBarStyle: {
          ...(status !== "active" ? { display: "none" as const } : {}),
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border
        },
        headerStyle: {
          backgroundColor: theme.colors.background
        },
        headerTintColor: theme.colors.text.primary,
        headerShadowVisible: false
      }}
    >
      <Tabs.Screen
        name="program"
        options={{
          title: "Program",
          tabBarButtonTestID: "tab-program",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="maps"
        options={{
          title: "Accommodations",
          tabBarButtonTestID: "tab-accommodations",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bed" size={size} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: "Services",
          tabBarButtonTestID: "tab-services",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="help-buoy" size={size} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarButtonTestID: "tab-profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          )
        }}
      />

      <Tabs.Screen
        name="safety"
        options={{
          title: "Safety",
          tabBarButtonTestID: "tab-safety",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield-checkmark" size={size} color={color} />
          )
        }}
      />
      
      <Tabs.Screen
        name="host"
        options={{
          href: null,
          title: "Host",
          ...(status !== "active" ? { headerLeft: () => <TouchableOpacity accessibilityRole="button" accessibilityLabel="Return to ICYPAA home" onPress={() => router.replace('/')} style={{ padding: 12 }}><Ionicons name="chevron-back" size={24} color={theme.colors.primary} /></TouchableOpacity> } : {})
        }}
      />
    </Tabs>
  )
}
