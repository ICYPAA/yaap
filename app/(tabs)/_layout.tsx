import { Ionicons } from "@expo/vector-icons"
import { Tabs } from "expo-router"
import React, { useEffect, useState } from "react"
import { useTheme } from "../../context/ThemeContext"
import { supabase } from "../../lib/supabase"
import { TutorialModal } from "../../components/TutorialModal"

export default function TabLayout() {
  const { theme, isDarkMode } = useTheme()
  const [isHostAuthenticated, setIsHostAuthenticated] = useState(false)

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        setIsHostAuthenticated(!!data.session)
      } catch (error) {
        console.error("Error checking auth in tab layout:", error)
        setIsHostAuthenticated(false)
      }
    }

    checkAuth()

    // Set up auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setIsHostAuthenticated(!!session)
      }
    )

    return () => {
      // Clean up the subscription
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe()
      }
    }
  }, [])

  return (
    <>
      <TutorialModal />
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
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="maps"
        options={{
          title: "Accommodations",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bed" size={size} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: "Services",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="help-buoy" size={size} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          )
        }}
      />

      <Tabs.Screen
        name="host"
        options={{
          title: "Host",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield" size={size} color={color} />
          )
        }}
        href={isHostAuthenticated ? "/host" : null}
      />
    </Tabs>
    </>
  )
}
