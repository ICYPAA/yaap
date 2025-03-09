import { Ionicons } from "@expo/vector-icons"
import { Tabs } from "expo-router"
import { theme } from "../../constants/theme"

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.text.secondary,
        headerStyle: {
          backgroundColor: theme.colors.background
        },
        headerTitleStyle: {
          color: theme.colors.text.primary
        },
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border
        },
        headerSafeAreaInsets: { top: 44 } // Add safe area insets for status bar
      }}
    >
      <Tabs.Screen
        name="program"
        options={{
          title: "Program",
          tabBarIcon: ({ color }) => (
            <Ionicons name="calendar" size={24} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="maps"
        options={{
          title: "Maps",
          tabBarIcon: ({ color }) => (
            <Ionicons name="map" size={24} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: "Services",
          tabBarIcon: ({ color }) => (
            <Ionicons name="help-buoy" size={24} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <Ionicons name="person" size={24} color={color} />
          )
        }}
      />
    </Tabs>
  )
}
