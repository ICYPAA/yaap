import { Ionicons } from "@expo/vector-icons"
import { Tabs } from "expo-router"
import React from "react"
import { useTheme } from "../../context/ThemeContext"

export default function TabLayout() {
  const { theme } = useTheme()

  return (
    <Tabs
      initialRouteName="program"
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.text.secondary,
        tabBarStyle: {
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
          href: null
        }}
      />
    </Tabs>
  )
}
