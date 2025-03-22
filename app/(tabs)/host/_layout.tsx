import { Stack } from "expo-router"
import React, { useEffect, useState } from "react"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"
import { useTheme } from "../../../context/ThemeContext"
import { supabase } from "../../../lib/supabase"

export default function HostLayout() {
  const { theme } = useTheme()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    checkAuth()

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setIsAuthenticated(!!session)
      }
    )

    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe()
      }
    }
  }, [])

  const checkAuth = async () => {
    try {
      const { data } = await supabase.auth.getSession()
      setIsAuthenticated(!!data.session)
    } catch (error) {
      console.error("Error checking auth:", error)
      setIsAuthenticated(false)
    }
  }

  // Show loading while checking authentication
  if (isAuthenticated === null) {
    return (
      <View style={styles(theme).loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles(theme).loadingText}>
          Checking authentication...
        </Text>
      </View>
    )
  }

  // Redirect to login if not authenticated
  // if (!isAuthenticated) {
  //   return <Redirect href="/services/host" />
  // }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="accessibility" />
      <Stack.Screen name="rides" />
      <Stack.Screen name="volunteers" />
      <Stack.Screen name="hospitality" />
      <Stack.Screen name="support" />
    </Stack>
  )
}

const styles = (theme) =>
  StyleSheet.create({
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.background
    },
    loadingText: {
      ...theme.typography.body,
      color: theme.colors.text.primary,
      marginTop: theme.spacing.md
    }
  })
